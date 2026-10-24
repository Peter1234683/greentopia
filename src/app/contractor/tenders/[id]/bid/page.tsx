import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { loadTenderView, myContractor } from "@/lib/bidding/view";
import { tierRanges, type Tier } from "@/lib/bidding/bidMath";
import { clusterEstimate } from "@/lib/bidding/tenders";
import { parseJson } from "@/lib/constants";
import { BidWizard, type BidInitial } from "./BidWizard";

export const metadata: Metadata = { title: "입찰서 작성" };

export default async function BidPage(props: PageProps<"/contractor/tenders/[id]/bid">) {
  const user = await requireRole("CONTRACTOR");
  const { id } = await props.params;
  const me = await myContractor(user.contractorProfile!.id);
  const v = await loadTenderView(id, me);
  if (!v) notFound();
  if (!v.isOpen || !v.eligibility.eligible) redirect(`/contractor/tenders/${id}`);
  const est = await clusterEstimate(v.tender.clusterId);
  const b = v.myBid && v.myBid.status !== "WITHDRAWN" ? v.myBid : null;
  const prevTable = parseJson<Record<string, number>>(b?.unitPriceTableJson, {});
  const prevTiers = parseJson<Tier[]>(b?.tierPricesJson, []);
  const initial: BidInitial = {
    table: Object.fromEntries(Object.entries(prevTable).map(([k, n]) => [k, String(n)])),
    lowerTierAdjustPct: String(prevTiers[1]?.adjustPct ?? 5),
    durationDays: String(b?.durationDays ?? ""),
    warrantyMonths: String(b?.warrantyMonths ?? 24),
    asMonths: String(b?.asMonths ?? 12),
    staffPlan: b?.staffPlan ?? "",
    planSummary: b?.planSummary ?? "",
    dumpingReason: b?.dumpingReason ?? "",
  };
  return (
    <div>
      <Link href={`/contractor/tenders/${id}`} className="text-sm text-muted">‹ 공고 상세</Link>
      <h1 className="mt-2 mb-4 text-xl font-extrabold">Cluster #{v.tender.cluster.code} 입찰서 {b ? "수정" : "작성"}</h1>
      <BidWizard
        tenderId={id}
        unit={v.pricing.unit}
        types={v.pricing.types}
        typeTotals={v.typeTotals}
        members={v.members.map(({ memberId, label, amount, mix, unit }) => ({ memberId, label, amount, mix, unit }))}
        tierRanges={tierRanges(v.members.length, v.minClusterSize, v.bidding.tierUpperShare, v.bidding.tierExtra)}
        priceCap={v.tender.priceCap}
        dumpingFloor={Math.round(est.low * (1 - v.bidding.dumpingThreshold))}
        siteVisitPolicy={v.tender.siteVisitCostPolicy}
        eligibility={v.eligibility}
        initial={initial}
      />
    </div>
  );
}
