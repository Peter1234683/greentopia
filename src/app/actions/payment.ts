"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { notify } from "@/lib/notify";
import { getSettings } from "@/lib/settings";
import { demoToolsEnabled } from "@/lib/demo";
import { saveUpload, validateUpload } from "@/lib/uploads";
import { flagCrossCheck, syncMilestones } from "@/lib/contractFlow";
import { passRate, type CheckItem, type Verdict } from "@/lib/inspection";
import { parseJson } from "@/lib/constants";

const STAGE_LABEL: Record<string, string> = { DEPOSIT: "착공금", INTERIM: "중도금", COMPLETION: "준공금", RETENTION: "A/S 유보금" };

async function ownerContract(userId: string, contractId: string) {
  const c = await db.contract.findFirst({
    where: { id: contractId, building: { ownerId: userId } },
    include: { contractor: true, building: true, project: { include: { inspection: true } }, milestones: true },
  });
  if (!c) throw new Error("계약을 찾을 수 없어요.");
  return c;
}

const refresh = () => revalidatePath("/", "layout");

// 건물주 승인 = 해당 단계 지급 처리 기록 (데모: 실제 송금 없음)
export async function approveMilestone(formData: FormData) {
  const user = await requireRole("CUSTOMER");
  const c = await ownerContract(user.id, String(formData.get("contractId") ?? ""));
  await syncMilestones(c.id);
  const m = await db.paymentMilestone.findFirst({ where: { contractId: c.id, stage: String(formData.get("stage") ?? "") } });
  if (!m || m.status !== "READY") return;
  await db.paymentMilestone.update({ where: { id: m.id }, data: { status: "RELEASED", approvedBy: user.id, approvedAt: new Date() } });
  await syncMilestones(c.id);
  await notify([c.contractor.userId], `${STAGE_LABEL[m.stage]} 승인 (데모)`, `${c.building.dong} 건물주가 ${STAGE_LABEL[m.stage]} 단계를 승인했어요. 실제 송금은 제휴 금융기관 연동 후 진행돼요.`, "/contractor/projects");
  refresh();
}

// 데모 도구: A/S 유보 기간이 지난 것으로 처리
export async function demoElapseRetention(formData: FormData) {
  const user = await requireRole("CUSTOMER");
  if (!demoToolsEnabled()) return;
  const c = await ownerContract(user.id, String(formData.get("contractId") ?? ""));
  await db.paymentMilestone.updateMany({ where: { contractId: c.id, stage: "RETENTION" }, data: { releaseAt: new Date(Date.now() - 1000) } });
  await syncMilestones(c.id);
  refresh();
}

// ── 준공 검측: 건물주 ──
export async function setOwnerCheck(formData: FormData) {
  const user = await requireRole("CUSTOMER");
  const c = await ownerContract(user.id, String(formData.get("contractId") ?? ""));
  const insp = c.project?.inspection;
  if (!insp || insp.ownerApproved) return;
  const idx = Number(formData.get("index"));
  const v = String(formData.get("verdict") ?? "") as Verdict;
  if (!["O", "X", "UNKNOWN"].includes(v)) return;
  const items = parseJson<CheckItem[]>(insp.checklistJson, []);
  if (!items[idx]) return;
  items[idx] = { ...items[idx], ownerCheck: v };
  await db.completionInspection.update({ where: { id: insp.id }, data: { checklistJson: JSON.stringify(items), score: passRate(items) } });
  refresh();
}

export type ApproveState = { error?: string } | undefined;

export async function approveInspection(_: ApproveState, formData: FormData): Promise<ApproveState> {
  const user = await requireRole("CUSTOMER");
  const c = await ownerContract(user.id, String(formData.get("contractId") ?? ""));
  const insp = c.project?.inspection;
  if (!insp || insp.ownerApproved) return { error: "승인할 준공 검측이 없어요." };
  const items = parseJson<CheckItem[]>(insp.checklistJson, []);
  const unchecked = items.filter((x) => (x.ownerCheck ?? x.verdict) === "UNKNOWN").length;
  if (unchecked > 0) return { error: `아직 확인하지 않은 항목이 ${unchecked}개 있어요. 직접 보고 O/X 를 골라주세요.` };
  if (items.some((x) => (x.ownerCheck ?? x.verdict) === "X") && formData.get("acceptIssues") !== "on")
    return { error: "미흡(X) 항목이 있어요. 업체에 보완을 요청하거나, 그대로 승인하려면 확인란에 체크해주세요." };
  const note = String(formData.get("note") ?? "").trim().slice(0, 500) || null;
  const { contract: cfg } = await getSettings();
  const releaseAt = new Date((c.project!.completedAt ?? new Date()).getTime() + cfg.retentionDays * 864e5);
  await db.completionInspection.update({ where: { id: insp.id }, data: { ownerApproved: true, ownerApprovedAt: new Date(), ownerNote: note, score: passRate(items) } });
  await db.paymentMilestone.updateMany({ where: { contractId: c.id, stage: "RETENTION" }, data: { releaseAt } });
  await syncMilestones(c.id);
  await flagCrossCheck(c.project!.id, `${c.building.dong} ${c.contractor.companyName}`);
  await notify([c.contractor.userId], "준공 검측 승인", `${c.building.dong} 건물주가 준공 검측을 승인했어요. 준공금 단계가 열렸어요.`, "/contractor/projects");
  refresh();
  return undefined;
}

export async function requestFix(formData: FormData) {
  const user = await requireRole("CUSTOMER");
  const c = await ownerContract(user.id, String(formData.get("contractId") ?? ""));
  const note = String(formData.get("note") ?? "").trim().slice(0, 300);
  await notify([c.contractor.userId], "준공 검측 보완 요청", `${c.building.dong}: ${note || "미흡 항목 보완을 요청했어요."}`, "/contractor/projects");
  refresh();
}

// ── 업체 ──
async function ourContract(profileId: string, id: string) {
  const c = await db.contract.findFirst({ where: { id, contractorId: profileId }, include: { project: { include: { inspection: true } }, building: true, tender: true } });
  if (!c) throw new Error("계약을 찾을 수 없어요.");
  return c;
}

export async function reportMaterials(formData: FormData) {
  const user = await requireRole("CONTRACTOR");
  const c = await ourContract(user.contractorProfile!.id, String(formData.get("contractId") ?? ""));
  if (!c.project || c.status !== "SIGNED" || c.project.materialsDeliveredAt) return;
  await db.project.update({ where: { id: c.project.id }, data: { materialsDeliveredAt: new Date() } });
  await syncMilestones(c.id);
  await notify([c.building.ownerId], "자재가 들어왔어요", "자재 입고를 확인하고 중도금 단계를 승인해주세요.", `/customer/contracts/${c.id}`);
  refresh();
}

export type LotState = { error?: string; ok?: boolean } | undefined;

export async function saveLot(_: LotState, formData: FormData): Promise<LotState> {
  const user = await requireRole("CONTRACTOR");
  const c = await ourContract(user.contractorProfile!.id, String(formData.get("contractId") ?? ""));
  const insp = c.project?.inspection;
  if (!insp) return { error: "완료 보고 후 입력할 수 있어요." };
  if (insp.ownerApproved) return { error: "이미 승인된 검측이에요." };
  const lot = String(formData.get("lotNumber") ?? "").trim().slice(0, 60);
  const photos = formData.getAll("lotPhotos").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 3);
  for (const f of photos) {
    const err = validateUpload(f);
    if (err) return { error: err };
  }
  const ids = parseJson<string[]>(insp.lotPhotosJson, []);
  for (const f of photos) {
    const saved = await saveUpload(f);
    const doc = await db.document.create({ data: { ...saved, kind: "LOT_PHOTO", ownerId: user.id, contractorId: c.contractorId, buildingId: c.buildingId } });
    ids.push(doc.id);
  }
  await db.completionInspection.update({ where: { id: insp.id }, data: { lotNumber: lot || insp.lotNumber, lotPhotosJson: JSON.stringify(ids) } });
  refresh();
  return { ok: true };
}
