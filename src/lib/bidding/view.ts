import "server-only";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { quantityFor, type Quantity } from "@/lib/pricing";
import { parseJson } from "@/lib/constants";
import { checkEligibility } from "./eligibility";
import { loadContractors, loadPQRules, type ContractorRow } from "./contractors";
import { tenderEligInput } from "./tenders";
import type { MemberQty } from "./bidMath";

export async function myContractor(profileId: string): Promise<ContractorRow> {
  return (await loadContractors({ id: profileId }))[0];
}

// 업체에 보여줄 공고 정보 (건물 주소는 낙찰 전까지 공개하지 않는다)
export async function loadTenderView(tenderId: string, me: ContractorRow) {
  const settings = await getSettings();
  const tender = await db.tender.findUnique({
    where: { id: tenderId },
    include: {
      nominations: true,
      cluster: { include: { members: { where: { status: "JOINED" }, include: { building: true }, orderBy: { joinedAt: "asc" } } } },
      bids: { where: { contractorId: me.id }, include: { evaluation: true } },
    },
  });
  if (!tender) return null;
  const trade = tender.cluster.trade;
  const members: (MemberQty & { lat: number; lng: number; usage: string; grossArea: number; approvalYear: number | null })[] =
    tender.cluster.members.map((m, i) => {
      const q = parseJson<Record<string, Quantity>>(m.quantityJson, {})[trade] ?? quantityFor(m.building, trade, settings.pricing);
      return {
        memberId: m.id,
        label: `${i + 1}번 건물`,
        amount: q.amount,
        mix: q.mix,
        unit: q.unit,
        lat: m.building.lat,
        lng: m.building.lng,
        usage: m.building.usage,
        grossArea: m.building.grossArea,
        approvalYear: m.building.approvalDate?.getFullYear() ?? null,
      };
    });
  const eligibility = checkEligibility(me, tenderEligInput(tender), await loadPQRules());
  const totals: Record<string, number> = {};
  for (const m of members) for (const [k, v] of Object.entries(m.mix)) totals[k] = (totals[k] ?? 0) + v;
  return {
    tender,
    trade,
    members,
    typeTotals: totals,
    eligibility,
    myBid: tender.bids[0] ?? null,
    pricing: settings.pricing.trades[trade],
    bidding: settings.bidding,
    minClusterSize: settings.matching.minClusterSize,
    isOpen: tender.status === "OPEN" && tender.deadline > new Date(),
  };
}
