"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { confirmTender } from "@/lib/bidding/lifecycle";
import { closeDueTenders, closeTender } from "@/lib/bidding/close";
import { runMatching } from "@/lib/matching/run";

export async function reviewContractor(formData: FormData) {
  await requireRole("ADMIN");
  const id = String(formData.get("contractorId"));
  const decision = formData.get("decision") === "approve" ? "APPROVED" : "REJECTED";
  const note = String(formData.get("note") ?? "").trim() || null;
  const profile = await db.contractorProfile.update({
    where: { id },
    data: { reviewStatus: decision, reviewNote: note, reviewedAt: new Date() },
  });
  await db.notification.create({
    data: {
      userId: profile.userId,
      title: decision === "APPROVED" ? "가입 심사가 승인되었어요" : "가입 심사가 반려되었어요",
      body: decision === "APPROVED" ? "이제 입찰 공고에 참여할 수 있어요." : `사유: ${note ?? "운영자에게 문의해주세요."}`,
      link: "/contractor",
    },
  });
  revalidatePath("/admin");
}

// ── 입찰 ──
export async function confirmTenderAction(formData: FormData) {
  await requireRole("ADMIN");
  const tenderId = String(formData.get("tenderId"));
  const method = String(formData.get("method"));
  const nominatedIds = formData.getAll("nominatedIds").map(String);
  const contractorId = String(formData.get("contractorId") ?? "") || undefined;
  if (method === "NOMINATED" && nominatedIds.length < 2) throw new Error("지명경쟁은 2곳 이상 지명해야 해요.");
  if (method === "NEGOTIATED" && !contractorId) throw new Error("수의계약 업체를 골라주세요.");
  await confirmTender(tenderId, method, { nominatedIds: method === "NOMINATED" ? nominatedIds : [], contractorId });
  revalidatePath("/", "layout");
}

export async function closeTenderAction(formData: FormData) {
  await requireRole("ADMIN");
  await closeTender(String(formData.get("tenderId")), { force: true });
  revalidatePath("/", "layout");
}

export async function closeDueTendersAction() {
  await requireRole("ADMIN");
  await closeDueTenders();
  revalidatePath("/", "layout");
}

export async function runMatchingAction() {
  await requireRole("ADMIN");
  await runMatching();
  revalidatePath("/", "layout");
}
