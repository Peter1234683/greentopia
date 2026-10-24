import "server-only";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { notify } from "@/lib/notify";
import { TRADE_LABEL, TENDER_METHOD_LABEL, type Trade } from "@/lib/constants";
import { checkEligibility } from "./eligibility";
import { loadContractors, loadPQRules } from "./contractors";
import { tenderEligInput } from "./tenders";

// 관리자가 입찰 방식을 확정하면 공고가 열린다. 자격 있는 업체에게 알림 (상위 등급은 '우선 알림')
export async function confirmTender(tenderId: string, method: string, opts: { nominatedIds?: string[]; contractorId?: string } = {}) {
  const settings = await getSettings();
  const t = await db.tender.findUniqueOrThrow({ where: { id: tenderId }, include: { cluster: true, nominations: true } });
  const qual = JSON.parse(t.qualificationJson ?? "{}");
  if (method === "NEGOTIATED" && opts.contractorId) qual.contractorId = opts.contractorId;
  if (method === "RESTRICTED" && !qual.minProjects) Object.assign(qual, { ...settings.bidding.restrictedConditions, minProjects: settings.bidding.restrictedConditions.minPlatformOrExternalProjects });

  if (opts.nominatedIds) {
    await db.tenderNomination.deleteMany({ where: { tenderId } });
    await db.tenderNomination.createMany({ data: opts.nominatedIds.map((contractorId) => ({ tenderId, contractorId })) });
  }
  await db.tender.update({
    where: { id: tenderId },
    data: {
      method,
      qualificationJson: JSON.stringify(qual),
      status: "OPEN",
      methodConfirmedAt: new Date(),
      deadline: new Date(Date.now() + (t.round > 1 ? settings.bidding.tenderDays + settings.bidding.reannounceExtraDays : settings.bidding.tenderDays) * 864e5),
    },
  });
  await db.cluster.update({ where: { id: t.clusterId }, data: { status: "TENDERING" } });

  const [contractors, rules] = await Promise.all([loadContractors(), loadPQRules()]);
  const full = await db.tender.findUniqueOrThrow({ where: { id: tenderId }, include: { cluster: true, nominations: true } });
  const elig = contractors.filter((c) => checkEligibility(c, tenderEligInput(full), rules).eligible);
  const label = `Cluster #${t.cluster.code} ${TRADE_LABEL[t.cluster.trade as Trade]} (${TENDER_METHOD_LABEL[method]})`;
  const priority = elig.filter((c) => ["GREEN_PARTNER", "EXCELLENT"].includes(c.grade));
  await notify(priority.map((c) => c.userId), "⭐ 우선 알림: 신규 입찰 공고", `${label} 공고가 열렸어요.`, `/contractor/tenders/${tenderId}`);
  await notify(elig.filter((c) => !priority.includes(c)).map((c) => c.userId), "신규 입찰 공고", `${label} 공고가 열렸어요.`, `/contractor/tenders/${tenderId}`);
  const owners = await db.clusterMember.findMany({ where: { clusterId: t.clusterId, status: "JOINED" }, include: { building: true } });
  await notify(owners.map((o) => o.building.ownerId), "입찰 공고가 열렸어요", `${label} 입찰이 시작됐어요.`, "/customer/joint");
  return full;
}
