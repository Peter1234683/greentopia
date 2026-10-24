"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createInspection, ensureMilestones, syncMilestones } from "@/lib/contractFlow";
import { requireRole } from "@/lib/dal";
import { notify } from "@/lib/notify";
import { repriceContracts } from "@/lib/bidding/close";
import { syncClusterProgress } from "@/lib/projects";
import { saveUpload, validateUpload } from "@/lib/uploads";
import type { FormState } from "@/lib/forms";

// ── 건물주 ──
async function myContract(userId: string, id: string) {
  const c = await db.contract.findFirst({ where: { id, building: { ownerId: userId } }, include: { contractor: true, building: true, tender: { include: { cluster: true } } } });
  if (!c) throw new Error("계약을 찾을 수 없어요.");
  return c;
}

export async function confirmParticipation(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole("CUSTOMER");
  const c = await myContract(user.id, String(formData.get("contractId")));
  if (c.status !== "PENDING") return { message: "이미 처리된 계약이에요." };
  if (c.isNegotiated && formData.get("consent") !== "on") return { message: "수의계약 전환 사유를 확인하고 동의해주세요." };
  await db.contract.update({ where: { id: c.id }, data: { status: "CONFIRMED", ownerConsentAt: new Date() } });
  await db.project.upsert({
    where: { contractId: c.id },
    create: { contractId: c.id, status: "SITE_CHECK", plannedEnd: c.tender?.workEnd ?? null, scheduledStart: c.tender?.workStart ?? null },
    update: {},
  });
  await notify([c.contractor.userId], "현장확인 요청", `${c.building.address} 건물주가 참여를 확정했어요. 현장확인(실측)을 진행해주세요.`, "/contractor/projects");
  revalidatePath("/", "layout");
  return { message: "참여를 확정했어요. 업체가 현장확인 일정을 연락드려요." };
}

export async function declineParticipation(formData: FormData) {
  const user = await requireRole("CUSTOMER");
  const c = await myContract(user.id, String(formData.get("contractId")));
  if (!["PENDING", "CONFIRMED", "READY"].includes(c.status)) return;
  await db.contract.update({ where: { id: c.id }, data: { status: "CANCELLED" } });
  await db.project.deleteMany({ where: { contractId: c.id } });
  if (c.tender) {
    await db.clusterMember.updateMany({ where: { clusterId: c.tender.clusterId, buildingId: c.buildingId }, data: { status: "LEFT" } });
    // 이탈로 물량 구간이 바뀌면 남은 건물의 (서명 전) 금액을 다시 계산
    await repriceContracts(c.tender.id);
  }
  await notify([c.contractor.userId], "참여 취소", `${c.building.address} 건물주가 이번 공동공사에 참여하지 않기로 했어요.`, "/contractor/projects");
  revalidatePath("/", "layout");
}

export async function saveOwnerQuote(formData: FormData) {
  const user = await requireRole("CUSTOMER");
  const c = await myContract(user.id, String(formData.get("contractId")));
  const v = Number(String(formData.get("ownerQuote") ?? "").replace(/[^\d]/g, ""));
  await db.contract.update({ where: { id: c.id }, data: { ownerQuote: v > 0 ? v : null } });
  revalidatePath("/customer/projects", "layout");
}

export async function signContract(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole("CUSTOMER");
  const c = await myContract(user.id, String(formData.get("contractId")));
  if (c.status !== "READY") return { message: "현장확인이 끝난 뒤 서명할 수 있어요." };
  if (formData.get("agree") !== "on") return { message: "계약 내용을 확인하고 동의해주세요." };
  await db.contract.update({ where: { id: c.id }, data: { status: "SIGNED", signedAt: new Date() } });
  await db.project.update({ where: { contractId: c.id }, data: { status: "CONTRACTED" } });
  await ensureMilestones(c.id);
  await notify([c.contractor.userId], "계약 서명 완료", `${c.building.address} 계약이 체결됐어요. 시공 일정을 확정해주세요.`, "/contractor/projects");
  revalidatePath("/", "layout");
  return { message: "계약이 체결됐어요." };
}

export async function requestAS(formData: FormData) {
  const user = await requireRole("CUSTOMER");
  const c = await myContract(user.id, String(formData.get("contractId")));
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  await db.project.update({ where: { contractId: c.id }, data: { status: "AS", completionNote: note ? `A/S 요청: ${note}` : undefined } });
  await syncMilestones(c.id);
  await notify([c.contractor.userId], "A/S 요청", `${c.building.address}: ${note || "A/S 요청이 들어왔어요."}`, "/contractor/projects");
  revalidatePath("/", "layout");
}

// ── 시공업체 ──
async function ourContract(profileId: string, id: string) {
  const c = await db.contract.findFirst({ where: { id, contractorId: profileId }, include: { project: true, building: true, tender: { include: { cluster: true } } } });
  if (!c) throw new Error("계약을 찾을 수 없어요.");
  return c;
}

export async function completeSiteCheck(formData: FormData) {
  const user = await requireRole("CONTRACTOR");
  const c = await ourContract(user.contractorProfile!.id, String(formData.get("contractId")));
  if (c.status !== "CONFIRMED") return;
  const measured = Number(formData.get("measuredQty"));
  const estimated = Number(formData.get("estimatedQty"));
  if (!(measured > 0) || !(estimated > 0)) return;
  // 실측 물량으로 금액 조정: 같은 단가표·유형 비율 기준
  const amount = Math.round((c.amount * (measured / estimated)) / 1000) * 1000;
  await db.contract.update({ where: { id: c.id }, data: { status: "READY", measuredQty: measured, amount } });
  await db.project.update({ where: { contractId: c.id }, data: { siteCheckedAt: new Date() } });
  await notify([c.building.ownerId], "현장확인이 끝났어요", `실측 결과 최종 금액이 정해졌어요. 계약서를 확인하고 서명해주세요.`, `/customer/projects/${c.tender?.clusterId ?? ""}`);
  revalidatePath("/", "layout");
}

export async function scheduleProject(formData: FormData) {
  const user = await requireRole("CONTRACTOR");
  const c = await ourContract(user.contractorProfile!.id, String(formData.get("contractId")));
  const date = String(formData.get("date"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !c.project) return;
  await db.project.update({ where: { id: c.project.id }, data: { scheduledStart: new Date(`${date}T09:00:00+09:00`) } });
  await notify([c.building.ownerId], "시공 일정 안내", `시공 예정일: ${date}`, `/customer/projects/${c.tender?.clusterId ?? ""}`);
  revalidatePath("/", "layout");
}

export async function startProject(formData: FormData) {
  const user = await requireRole("CONTRACTOR");
  const c = await ourContract(user.contractorProfile!.id, String(formData.get("contractId")));
  if (c.status !== "SIGNED" || c.project?.status !== "CONTRACTED") return;
  await db.project.update({ where: { id: c.project.id }, data: { status: "IN_PROGRESS", startedAt: new Date() } });
  if (c.tenderId) await syncClusterProgress(c.tenderId);
  await notify([c.building.ownerId], "시공을 시작했어요", c.building.address, `/customer/projects/${c.tender?.clusterId ?? ""}`);
  revalidatePath("/", "layout");
}

export async function completeProject(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole("CONTRACTOR");
  const c = await ourContract(user.contractorProfile!.id, String(formData.get("contractId")));
  if (!c.project || !["IN_PROGRESS", "AS"].includes(c.project.status)) return { message: "진행 중인 공사만 완료할 수 있어요." };
  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (c.project.status === "IN_PROGRESS" && files.length === 0) return { message: "완료 사진을 1장 이상 올려주세요." };
  for (const f of files) {
    const err = validateUpload(f);
    if (err) return { message: err };
  }
  const ids: string[] = JSON.parse(c.project.photosJson || "[]");
  for (const f of files) {
    const saved = await saveUpload(f);
    const doc = await db.document.create({ data: { ...saved, kind: "COMPLETION_PHOTO", ownerId: user.id, contractorId: c.contractorId, buildingId: c.buildingId } });
    ids.push(doc.id);
  }
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000);
  const wasAS = c.project.status === "AS";
  await db.project.update({
    where: { id: c.project.id },
    data: { status: "COMPLETED", completedAt: wasAS ? c.project.completedAt : new Date(), completionNote: note || c.project.completionNote, photosJson: JSON.stringify(ids) },
  });
  if (!wasAS) await createInspection(c.project.id);
  await syncMilestones(c.id);
  if (c.tenderId) await syncClusterProgress(c.tenderId);
  await notify([c.building.ownerId], wasAS ? "A/S가 완료됐어요" : "공사가 완료됐어요", wasAS ? c.building.address : "준공 검측을 확인하고 승인해주세요. 리뷰도 남길 수 있어요.", `/customer/projects/${c.tender?.clusterId ?? ""}`);
  revalidatePath("/", "layout");
  return { message: "완료 보고를 올렸어요." };
}
