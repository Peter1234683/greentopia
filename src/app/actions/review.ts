"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole, getCurrentUser } from "@/lib/dal";
import { getSettings } from "@/lib/settings";
import { notify, notifyAdmins } from "@/lib/notify";
import { flagNewReview, followupDue, recomputeContractor } from "@/lib/reviews";
import { saveUpload, validateUpload } from "@/lib/uploads";
import { COMPLAINT_TAGS } from "@/lib/constants";
import { optionalNumber, requiredNumber, type FormState } from "@/lib/forms";

const STAR_MSG = "별점을 모두 매겨주세요.";
const starSchema = z.number().int().min(1, STAR_MSG).max(5, STAR_MSG);
const star = requiredNumber(starSchema, STAR_MSG);
const optStar = optionalNumber(starSchema);
const schema = z.object({
  contractId: z.string(),
  kind: z.enum(["INITIAL", "FOLLOWUP_6M", "FOLLOWUP_12M"]),
  ratingQuality: optStar,
  ratingSchedule: optStar,
  ratingCleanliness: optStar,
  ratingComm: optStar,
  ratingAS: star,
  ratingValue: optStar,
  tags: z.array(z.enum(COMPLAINT_TAGS.map((t) => t.code) as [string, ...string[]])).default([]),
  text: z.string().trim().max(2000).optional(),
  defectOccurred: z.enum(["yes", "no"]).optional(),
  defectResolved: z.enum(["yes", "no"]).optional(),
});

export async function createReview(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole("CUSTOMER");
  const parsed = schema.safeParse({ ...Object.fromEntries(formData), tags: formData.getAll("tags") });
  if (!parsed.success) return { message: parsed.error.issues[0].message };
  const d = parsed.data;
  const c = await db.contract.findFirst({
    where: { id: d.contractId, building: { ownerId: user.id } },
    include: { project: { include: { reviews: true } }, contractor: true, tender: true },
  });
  // 계약·완료가 확인된 건물주만 작성 가능
  if (!c || c.status !== "SIGNED" || !c.project || !["COMPLETED", "AS"].includes(c.project.status))
    return { message: "공사 완료가 확인된 계약만 리뷰를 남길 수 있어요." };
  if (c.project.reviews.some((r) => r.kind === d.kind)) return { message: "이미 작성한 리뷰예요." };
  const initial = c.project.reviews.find((r) => r.kind === "INITIAL");

  let ratings: Record<string, number>;
  if (d.kind === "INITIAL") {
    const keys = ["ratingQuality", "ratingSchedule", "ratingCleanliness", "ratingComm", "ratingValue"] as const;
    if (keys.some((k) => !d[k])) return { message: "별점을 모두 매겨주세요." };
    ratings = Object.fromEntries([...keys.map((k) => [k, d[k]!]), ["ratingAS", d.ratingAS]]);
  } else {
    if (!initial) return { message: "첫 리뷰를 먼저 남겨주세요." };
    const months = d.kind === "FOLLOWUP_6M" ? 6 : 12;
    if (!followupDue(c.project.completedAt, months)) return { message: `공사 완료 ${months}개월 뒤에 작성할 수 있어요.` };
    if (!d.defectOccurred) return { message: "하자 발생 여부를 알려주세요." };
    ratings = {
      ratingQuality: initial.ratingQuality,
      ratingSchedule: initial.ratingSchedule,
      ratingCleanliness: initial.ratingCleanliness,
      ratingComm: initial.ratingComm,
      ratingValue: initial.ratingValue,
      ratingAS: d.ratingAS,
    };
  }

  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 5);
  for (const f of files) {
    const err = validateUpload(f);
    if (err) return { message: err };
  }
  const photoIds: string[] = [];
  for (const f of files) {
    const saved = await saveUpload(f);
    const doc = await db.document.create({ data: { ...saved, kind: "REVIEW_PHOTO", ownerId: user.id, buildingId: c.buildingId, contractorId: c.contractorId } });
    photoIds.push(doc.id);
  }

  const created = await db.review.create({
    data: {
      projectId: c.project.id,
      authorId: user.id,
      contractorId: c.contractorId,
      kind: d.kind,
      ...(ratings as {
        ratingQuality: number;
        ratingSchedule: number;
        ratingCleanliness: number;
        ratingComm: number;
        ratingAS: number;
        ratingValue: number;
      }),
      complaintTagsJson: JSON.stringify(d.tags),
      text: d.text || null,
      photosJson: JSON.stringify(photoIds),
      defectOccurred: d.kind === "INITIAL" ? null : d.defectOccurred === "yes",
      defectResolved: d.kind === "INITIAL" || d.defectOccurred !== "yes" ? null : d.defectResolved === "yes",
    },
  });
  const settings = await getSettings();
  if (d.kind === "INITIAL")
    await db.customerProfile.update({ where: { userId: user.id }, data: { points: { increment: settings.reputation.reviewPoints } } });
  await flagNewReview(created.id);
  await recomputeContractor(c.contractorId);
  await notify([c.contractor.userId], "새 리뷰가 등록됐어요", "내 업체 화면에서 확인하고 답글을 남겨보세요.", "/contractor/company");
  revalidatePath("/", "layout");
  redirect(`/customer/reviews/new?contract=${c.id}&done=${d.kind}`);
}

export async function replyReview(formData: FormData) {
  const user = await requireRole("CONTRACTOR");
  const id = String(formData.get("reviewId"));
  const reply = String(formData.get("reply") ?? "").trim().slice(0, 1000);
  const r = await db.review.findFirst({ where: { id, contractorId: user.contractorProfile!.id }, include: { author: true } });
  if (!r || !reply) return;
  await db.review.update({ where: { id }, data: { reply, repliedAt: new Date() } });
  await notify([r.authorId], "업체가 리뷰에 답글을 남겼어요", reply.slice(0, 60), "/customer/projects");
  revalidatePath("/", "layout");
}

export async function reportReview(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const id = String(formData.get("reviewId"));
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500) || "허위·비방 의심";
  const r = await db.review.findUnique({ where: { id } });
  if (!r) return;
  // 업체는 자기 리뷰만, 고객은 누구나 신고 가능
  if (user.role === "CONTRACTOR" && r.contractorId !== user.contractorProfile?.id) return;
  await db.reviewReport.create({ data: { reviewId: id, reporterId: user.id, reason } });
  await db.review.update({ where: { id }, data: { status: "REPORTED" } });
  await notifyAdmins("리뷰 신고 접수", reason, "/admin/reviews");
  revalidatePath("/", "layout");
}
