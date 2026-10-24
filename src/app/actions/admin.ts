"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/dal";

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
