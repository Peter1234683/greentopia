import "server-only";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { jointEstimate } from "@/lib/pricing";
import { actualUnitRanges } from "@/lib/actualPrices";
import { buildingAge } from "@/lib/format";
import { parseJson } from "@/lib/constants";
import { checkEligibility, type EligTender } from "./eligibility";
import { loadContractors, loadPQRules } from "./contractors";
import { recommendMethod } from "./recommend";

export function tenderEligInput(t: { method: string; qualificationJson: string | null; cluster: { trade: string; sigungu: string }; nominations: { contractorId: string }[] }): EligTender {
  return {
    method: t.method,
    trade: t.cluster.trade,
    sigungu: t.cluster.sigungu,
    qualification: parseJson(t.qualificationJson, null),
    nominatedIds: t.nominations.map((n) => n.contractorId),
  };
}

// Cluster 의 참여(JOINED) 건물 기준 예상 공사비 (공동발주 예상 범위의 중간값 합)
export async function clusterEstimate(clusterId: string) {
  const settings = await getSettings();
  const cluster = await db.cluster.findUniqueOrThrow({
    where: { id: clusterId },
    include: { members: { where: { status: "JOINED" }, include: { building: true, demand: true } } },
  });
  const actual = (await actualUnitRanges(settings.pricing))[cluster.trade];
  const n = cluster.members.length;
  let low = 0;
  let high = 0;
  for (const m of cluster.members) {
    const e = jointEstimate(m.building, cluster.trade, n, settings.pricing, actual);
    low += e.low;
    high += e.high;
  }
  return { cluster, low, high, mid: Math.round((low + high) / 2), n };
}

// 입찰 방식 추천을 붙인 공고 초안 생성 (관리자 확정 대기)
export async function createTenderDraft(clusterId: string, opts: { round?: number; parentTenderId?: string; failedRounds?: number; expandedRegion?: boolean; priceCap?: number } = {}) {
  const settings = await getSettings();
  const s = settings.bidding;
  const { cluster, high, mid } = await clusterEstimate(clusterId);
  const [contractors, rules] = await Promise.all([loadContractors(), loadPQRules()]);
  const base: EligTender = { method: "OPEN", trade: cluster.trade, sigungu: cluster.sigungu, qualification: { expandedRegion: opts.expandedRegion }, nominatedIds: [] };
  const qualified = contractors.filter((c) => checkEligibility(c, base, rules).eligible);
  const inRegion = qualified.filter((c) => c.regions.includes("전체") || c.regions.includes(cluster.sigungu));
  const pool = qualified
    .filter((c) => s.nominatedGrades.includes(c.grade))
    .map((c) => ({ id: c.id, name: c.name, score: c.reputationScore ?? 0 }))
    .sort((a, b) => b.score - a.score);
  const ages = cluster.members.map((m) => buildingAge(m.building.approvalDate)).filter((a): a is number => a != null);

  const rec = recommendMethod(
    {
      trade: cluster.trade,
      estimatedAmount: mid,
      qualifiedCount: qualified.length,
      regionQualifiedCount: opts.expandedRegion ? qualified.length : inRegion.length,
      failedRounds: opts.failedRounds ?? 0,
      buildingAges: ages,
      nominationPool: pool,
    },
    s,
  );
  // 공사 시작: 참여 건물의 가장 이른 희망 시기, 단 공고·평가·계약 기간(공고일 + 3주) 이후
  const starts = cluster.members.map((m) => m.demand?.desiredStart.getTime()).filter((t): t is number => t != null);
  const earliest = starts.length ? Math.min(...starts) : 0;
  const workStart = new Date(Math.max(Date.now() + (s.tenderDays + 21) * 864e5, earliest));

  const tender = await db.tender.create({
    data: {
      clusterId,
      method: rec.method,
      recommendedMethod: rec.method,
      recommendationReason: rec.reasons.join("\n"),
      qualificationJson: JSON.stringify({ ...(rec.qualification ?? {}), ...(opts.expandedRegion ? { expandedRegion: true } : {}) }),
      priceCap: opts.priceCap ?? Math.round((high * (1 + s.priceCapMargin)) / 10_000) * 10_000,
      performanceSpec: s.performanceSpecs[cluster.trade] ?? null,
      workStart,
      workEnd: new Date(workStart.getTime() + 60 * 864e5),
      deadline: new Date(Date.now() + s.tenderDays * 864e5),
      round: opts.round ?? 1,
      parentTenderId: opts.parentTenderId,
      status: "DRAFT",
      siteVisitCostPolicy: s.siteVisitCostPolicy,
      nominations: { create: rec.nominatedIds.map((contractorId) => ({ contractorId })) },
    },
  });
  await db.cluster.update({ where: { id: clusterId }, data: { status: "CONFIRMED" } });
  return tender;
}
