"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import type { FormState } from "@/lib/forms";
import { loadTenderView, myContractor } from "@/lib/bidding/view";
import { bidTotal, tierRanges, type Tier } from "@/lib/bidding/bidMath";
import { clusterEstimate } from "@/lib/bidding/tenders";

const schema = z.object({
  tenderId: z.string(),
  table: z.record(z.string(), z.number().positive("단가를 입력해주세요.").max(100_000_000)),
  lowerTierAdjustPct: z.number().min(0, "가산율은 0% 이상이어야 해요.").max(50, "가산율은 50% 이하로 입력해주세요."),
  durationDays: z.number().int().min(1, "공사기간을 입력해주세요.").max(365, "공사기간은 365일 이하로 입력해주세요."),
  warrantyMonths: z.number().int().min(12, "하자보증은 12개월 이상이어야 해요.").max(120),
  asMonths: z.number().int().min(0).max(120),
  staffPlan: z.string().trim().min(2, "투입 인력·장비를 적어주세요.").max(500),
  planSummary: z.string().trim().min(10, "시공계획을 10자 이상 적어주세요.").max(2000),
  dumpingReason: z.string().trim().max(1000).optional(),
});

export async function submitBid(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole("CONTRACTOR");
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload")));
  } catch {
    return { message: "입력값을 읽지 못했어요. 다시 시도해주세요." };
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return { message: parsed.error.issues[0].message };
  const d = parsed.data;

  const me = await myContractor(user.contractorProfile!.id);
  const view = await loadTenderView(d.tenderId, me);
  if (!view) return { message: "공고를 찾을 수 없어요." };
  if (!view.isOpen) return { message: "마감된 공고예요. 입찰서는 봉인되어 수정할 수 없어요." };
  if (!view.eligibility.eligible) return { message: view.eligibility.failures[0] };
  const missing = view.pricing.types.filter((t) => (view.typeTotals[t.code] ?? 0) > 0 && !d.table[t.code]);
  if (missing.length) return { message: `${missing[0].label} 단가를 입력해주세요.` };

  const ranges = tierRanges(view.members.length, view.minClusterSize, view.bidding.tierUpperShare, view.bidding.tierExtra);
  const tiers: Tier[] = ranges.map((r, i) => ({ ...r, adjustPct: i === 0 ? 0 : d.lowerTierAdjustPct }));
  const { total } = bidTotal(view.members, d.table, tiers);
  if (view.tender.priceCap && total > view.tender.priceCap)
    return { message: `총액이 공고 상한(${view.tender.priceCap.toLocaleString("ko-KR")}원)을 넘어요. 상한 초과 입찰은 무효예요.` };

  // 저가 입찰: 가정 기반 예상가 대비 기준 이상 낮으면 사유서 필수 (평가 때 균형가격 기준으로 다시 확인)
  const est = await clusterEstimate(view.tender.clusterId);
  if (total < est.low * (1 - view.bidding.dumpingThreshold) && !d.dumpingReason)
    return { message: "예상가보다 크게 낮은 금액이에요. 저가 입찰 사유를 적어주세요." };

  const data = {
    tierPricesJson: JSON.stringify(tiers),
    unitPriceTableJson: JSON.stringify(d.table),
    totalPrice: total,
    durationDays: d.durationDays,
    warrantyMonths: d.warrantyMonths,
    asMonths: d.asMonths,
    staffPlan: d.staffPlan,
    planSummary: d.planSummary,
    dumpingReason: d.dumpingReason || null,
    status: "SUBMITTED",
    submittedAt: new Date(),
  };
  await db.bid.upsert({
    where: { tenderId_contractorId: { tenderId: d.tenderId, contractorId: me.id } },
    create: { ...data, tenderId: d.tenderId, contractorId: me.id },
    update: data,
  });
  revalidatePath("/contractor", "layout");
  redirect(`/contractor/bids?submitted=${d.tenderId}`);
}

export async function withdrawBid(formData: FormData) {
  const user = await requireRole("CONTRACTOR");
  const tenderId = String(formData.get("tenderId"));
  const bid = await db.bid.findFirst({ where: { tenderId, contractorId: user.contractorProfile!.id }, include: { tender: true } });
  if (!bid || bid.tender.status !== "OPEN" || bid.tender.deadline < new Date()) return;
  await db.bid.update({ where: { id: bid.id }, data: { status: "WITHDRAWN" } });
  revalidatePath("/contractor", "layout");
}
