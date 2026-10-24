import "server-only";
import { db } from "./db";
import { getSettings } from "./settings";
import { checkEligibility } from "./bidding/eligibility";
import { loadContractors, loadPQRules } from "./bidding/contractors";
import { tenderEligInput } from "./bidding/tenders";
import { loadTenderView } from "./bidding/view";
import { bidTotal, tierRanges } from "./bidding/bidMath";

export const demoToolsEnabled = () => process.env.DEMO_TOOLS === "1" || process.env.NODE_ENV !== "production";

// 데모: 아직 입찰하지 않은 자격 업체 중 권역 업체 우선 limit 곳이 그럴듯한 입찰서를 낸다
// (발표자 계정 contractor@demo.kr 제외 → 발표자 포함 업체 3곳 시나리오)
export async function demoAutoBids(tenderId: string, limit = 2) {
  if (!demoToolsEnabled()) throw new Error("데모 도구가 꺼져 있어요.");
  const settings = await getSettings();
  const t = await db.tender.findUniqueOrThrow({ where: { id: tenderId }, include: { cluster: true, nominations: true, bids: true } });
  if (t.status !== "OPEN") return 0;
  const [contractors, rules] = await Promise.all([loadContractors(), loadPQRules()]);
  const presenter = await db.user.findUnique({ where: { email: "contractor@demo.kr" }, include: { contractorProfile: true } });
  const tp = settings.pricing.trades[t.cluster.trade];
  const mid = (tp.unitPrice.low + tp.unitPrice.high) / 2;
  let made = 0;
  const candidates = contractors
    .filter((c) => c.id !== presenter?.contractorProfile?.id && !t.bids.some((b) => b.contractorId === c.id))
    .filter((c) => checkEligibility(c, tenderEligInput(t), rules).eligible)
    .sort((a, b) => Number(b.regions.includes(t.cluster.sigungu) || b.regions.includes("전체")) - Number(a.regions.includes(t.cluster.sigungu) || a.regions.includes("전체")))
    .slice(0, limit);
  for (const c of candidates) {
    const view = await loadTenderView(tenderId, c);
    if (!view) continue;
    let factor = 0.84 + Math.random() * 0.12;
    const tiers = tierRanges(view.members.length, view.minClusterSize, settings.bidding.tierUpperShare, settings.bidding.tierExtra).map((r, i) => ({ ...r, adjustPct: i === 0 ? 0 : 5 }));
    let table = Object.fromEntries(tp.types.map((x) => [x.code, Math.round((mid * factor * x.factor) / 1000) * 1000]));
    let total = bidTotal(view.members, table, tiers).total;
    if (t.priceCap && total > t.priceCap) {
      factor *= (t.priceCap / total) * 0.97;
      table = Object.fromEntries(tp.types.map((x) => [x.code, Math.round((mid * factor * x.factor) / 1000) * 1000]));
      total = bidTotal(view.members, table, tiers).total;
    }
    await db.bid.create({
      data: {
        tenderId, contractorId: c.id, tierPricesJson: JSON.stringify(tiers), unitPriceTableJson: JSON.stringify(table), totalPrice: total,
        durationDays: 20 + Math.floor(Math.random() * 20), warrantyMonths: Math.random() < 0.5 ? 24 : 36, asMonths: 12,
        staffPlan: "시공 2개 조(5명)", planSummary: "실측 후 근거리 순서로 연속 시공하고 마지막 주에 일괄 점검합니다.",
        status: "SUBMITTED", submittedAt: new Date(),
      },
    });
    made++;
  }
  return made;
}
