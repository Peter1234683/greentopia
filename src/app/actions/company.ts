"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { SAFETY_PLEDGE_ITEMS } from "@/lib/constants";

// 안심 보장제 참여 · 영업배상 책임보험 가입 여부 (업체 자기 신고, 운영자 확인 대상)
export async function saveSafetyPledge(formData: FormData) {
  const user = await requireRole("CONTRACTOR");
  const id = user.contractorProfile!.id;
  const allowed = SAFETY_PLEDGE_ITEMS.map((i) => i.code) as string[];
  const items = formData.getAll("items").map(String).filter((x) => allowed.includes(x));
  if (items.length) await db.safetyPledge.upsert({ where: { contractorId: id }, create: { contractorId: id, itemsJson: JSON.stringify(items) }, update: { itemsJson: JSON.stringify(items) } });
  else await db.safetyPledge.deleteMany({ where: { contractorId: id } });
  await db.contractorProfile.update({ where: { id }, data: { liabilityInsurance: formData.get("liabilityInsurance") === "on" } });
  revalidatePath("/", "layout");
}
