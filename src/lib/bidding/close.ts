import "server-only";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { notify, notifyAdmins } from "@/lib/notify";
import { parseJson, TRADE_LABEL, type Trade } from "@/lib/constants";
import { quantityFor, type Quantity } from "@/lib/pricing";
import { memberAmount, tierFor, type Tier, type UnitTable } from "./bidMath";
import { evaluateBids, type EvalContractor } from "./evaluate";
import { loadContractors, loadPQRules } from "./contractors";
import { clusterEstimate, createTenderDraft, tenderEligInput } from "./tenders";

async function gradeBonuses() {
  const benefits = await db.benefit.findMany({ where: { kind: "REPUTATION_BONUS" } });
  return Object.fromEntries(benefits.map((b) => [b.grade, Number(parseJson<{ points?: number }>(b.valueJson, {}).points ?? 0)]));
}

// 마감이 지난 공고를 모두 평가한다 (스케줄러·관리자 화면에서 호출)
export async function closeDueTenders() {
  const due = await db.tender.findMany({ where: { status: "OPEN", deadline: { lte: new Date() } }, select: { id: true } });
  for (const t of due) await closeTender(t.id);
  return due.length;
}

export async function closeTender(tenderId: string, opts: { force?: boolean } = {}) {
  const settings = await getSettings();
  const s = settings.bidding;
  const tender = await db.tender.findUniqueOrThrow({
    where: { id: tenderId },
    include: { cluster: true, nominations: true, bids: { where: { status: "SUBMITTED" } } },
  });
  if (tender.status !== "OPEN") return { status: tender.status };
  if (!opts.force && tender.deadline > new Date()) return { status: "OPEN" };
  if (opts.force && tender.deadline > new Date()) await db.tender.update({ where: { id: tenderId }, data: { deadline: new Date() } });
  await db.tender.update({ where: { id: tenderId }, data: { status: "EVALUATING" } });

  const [contractorRows, rules, bonus, est] = await Promise.all([loadContractors(), loadPQRules(), gradeBonuses(), clusterEstimate(tender.clusterId)]);
  const contractors = new Map<string, EvalContractor>(contractorRows.map((c) => [c.id, c]));
  const { results, balanced } = evaluateBids(
    tender.bids,
    contractors,
    { ...tenderEligInput(tender), priceCap: tender.priceCap, estimatedAmount: est.mid },
    rules,
    s,
    settings.reputation,
    bonus,
  );
  await db.evaluation.deleteMany({ where: { bidId: { in: tender.bids.map((b) => b.id) } } });
  for (const r of results)
    await db.evaluation.create({
      data: {
        bidId: r.bidId,
        pqPassed: r.pqPassed,
        pqDetailsJson: JSON.stringify({ ...r.pqDetails, balancedPrice: Math.round(balanced), dumping: r.dumping }),
        scoresJson: JSON.stringify(r.scores),
        dumpingPenalty: r.dumpingPenalty,
        total: r.total,
        rank: r.rank,
      },
    });

  const ranked = results.filter((r) => r.rank != null).sort((a, b) => a.rank! - b.rank!);
  const minBidders = tender.method === "NEGOTIATED" ? 1 : s.minBidders;
  if (ranked.length < minBidders) {
    const reason =
      tender.bids.length === 0
        ? "입찰 참여 업체가 없어요"
        : ranked.length === 0 && results.some((r) => r.pqDetails.overCap)
          ? "모든 입찰이 공고 상한을 넘었어요"
          : `유효 입찰이 ${ranked.length}곳으로 최소 ${minBidders}곳에 못 미쳐요`;
    return failTender(tenderId, reason);
  }
  return awardTender(tenderId, ranked[0].bidId);
}

async function failTender(tenderId: string, reason: string) {
  const settings = await getSettings();
  const t = await db.tender.update({ where: { id: tenderId }, data: { status: "FAILED", failReason: reason }, include: { cluster: true } });
  await db.bid.updateMany({ where: { tenderId, status: "SUBMITTED" }, data: { status: "LOST" } });
  const label = `Cluster #${t.cluster.code} ${TRADE_LABEL[t.cluster.trade as Trade]}`;
  // 재공고: 권역 확대 + 기간 연장. 재공고까지 유찰되면 수의계약 전환 추천 (운영자 확정 필요)
  const draft = await createTenderDraft(t.clusterId, {
    round: t.round + 1,
    parentTenderId: t.id,
    failedRounds: t.round,
    expandedRegion: true,
    priceCap: t.priceCap ?? undefined, // 수의계약은 직전 공고 상한을 넘을 수 없다
  });
  await db.cluster.update({ where: { id: t.clusterId }, data: { status: "CONFIRMED" } });
  const owners = await db.clusterMember.findMany({ where: { clusterId: t.clusterId, status: "JOINED" }, include: { building: true } });
  await notify(owners.map((o) => o.building.ownerId), "입찰이 유찰됐어요", `${label}: ${reason}. ${t.round >= settings.bidding.maxRoundsBeforeNegotiation ? "수의계약 전환을 검토해요." : "권역을 넓혀 재공고해요."}`, "/customer/joint");
  await notifyAdmins("유찰 · 재공고 확인 필요", `${label} ${t.round}차 공고 유찰 (${reason})`, `/admin/tenders/${draft.id}`);
  return { status: "FAILED", reason, nextTenderId: draft.id };
}

// 건물별 계약 금액: 입찰 단가표 × 건물 물량 × 현재 참여 동수의 구간 가산율
export async function contractAmounts(bidId: string, buildingIds: string[]) {
  const settings = await getSettings();
  const bid = await db.bid.findUniqueOrThrow({ where: { id: bidId }, include: { tender: { include: { cluster: { include: { members: true } } } } } });
  const trade = bid.tender.cluster.trade;
  const table = parseJson<UnitTable>(bid.unitPriceTableJson, {});
  const tiers = parseJson<Tier[]>(bid.tierPricesJson, []);
  // 하위 구간보다 더 줄면 가장 낮은 구간 가산율을 적용
  const tier = tierFor(buildingIds.length, tiers) ?? tiers[tiers.length - 1];
  const buildings = await db.building.findMany({ where: { id: { in: buildingIds } } });
  return Object.fromEntries(
    buildings.map((b) => {
      const m = bid.tender.cluster.members.find((x) => x.buildingId === b.id);
      const q = parseJson<Record<string, Quantity>>(m?.quantityJson, {})[trade] ?? quantityFor(b, trade, settings.pricing);
      return [b.id, memberAmount({ memberId: b.id, label: "", ...q }, table, tier?.adjustPct ?? 0)];
    }),
  );
}

async function awardTender(tenderId: string, winningBidId: string) {
  const t = await db.tender.update({
    where: { id: tenderId },
    data: { status: "AWARDED" },
    include: { cluster: { include: { members: { where: { status: "JOINED" }, include: { building: true } } } }, bids: { include: { contractor: true } } },
  });
  await db.bid.update({ where: { id: winningBidId }, data: { status: "WON" } });
  await db.bid.updateMany({ where: { tenderId, id: { not: winningBidId }, status: "SUBMITTED" }, data: { status: "LOST" } });
  await db.cluster.update({ where: { id: t.clusterId }, data: { status: "AWARDED" } });
  const winner = t.bids.find((b) => b.id === winningBidId)!;
  const amounts = await contractAmounts(winningBidId, t.cluster.members.map((m) => m.buildingId));
  for (const m of t.cluster.members)
    await db.contract.create({
      data: {
        buildingId: m.buildingId,
        contractorId: winner.contractorId,
        tenderId,
        bidId: winningBidId,
        amount: amounts[m.buildingId],
        isNegotiated: t.method === "NEGOTIATED",
        status: "PENDING",
      },
    });
  const label = `Cluster #${t.cluster.code} ${TRADE_LABEL[t.cluster.trade as Trade]}`;
  await notify(t.cluster.members.map((m) => m.building.ownerId), "업체가 정해졌어요", `${label}: ${winner.contractor.companyName}이(가) 낙찰됐어요. 견적을 비교하고 참여 여부를 정해주세요.`, `/customer/projects/${t.clusterId}`);
  await notify([winner.contractor.userId], "🎉 낙찰됐어요", `${label} 공고에 낙찰됐어요. 건물주 참여 확정 후 현장확인을 진행해주세요.`, "/contractor/projects");
  const losers = t.bids.filter((b) => b.id !== winningBidId && b.status !== "WITHDRAWN");
  await notify(losers.map((b) => b.contractor.userId), "입찰 결과가 나왔어요", `${label} 평가 결과를 확인하세요.`, "/contractor/bids");
  return { status: "AWARDED", winner: winner.contractor.companyName };
}

// 참여 이탈 후 남은 (아직 서명 전) 계약 금액을 물량 구간에 맞게 다시 계산
export async function repriceContracts(tenderId: string) {
  const contracts = await db.contract.findMany({ where: { tenderId, status: { not: "CANCELLED" } } });
  const win = contracts[0]?.bidId;
  if (!win) return;
  const amounts = await contractAmounts(win, contracts.map((c) => c.buildingId));
  for (const c of contracts) if (!["SIGNED"].includes(c.status) && amounts[c.buildingId] !== c.amount) await db.contract.update({ where: { id: c.id }, data: { amount: amounts[c.buildingId] } });
}
