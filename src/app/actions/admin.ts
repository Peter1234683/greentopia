"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { confirmTender } from "@/lib/bidding/lifecycle";
import { closeDueTenders, closeTender } from "@/lib/bidding/close";
import { runMatching } from "@/lib/matching/run";
import { recomputeContractor } from "@/lib/reviews";
import { runCollusionCheck } from "@/lib/collusionRun";
import { SETTINGS_DEFAULTS, SETTINGS_SECTIONS, type SettingsSection } from "@/lib/settings";
import { validateShape } from "@/lib/settingsValidate";
import { demoAutoBids } from "@/lib/demo";
import { simulateMatching, type SimParams } from "@/lib/matching/simulate";

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

// ── 리뷰 · PQ ──
export async function resolveReport(formData: FormData) {
  await requireRole("ADMIN");
  const id = String(formData.get("reportId"));
  const accept = formData.get("decision") === "accept";
  const report = await db.reviewReport.update({ where: { id }, data: { status: accept ? "ACCEPTED" : "REJECTED" }, include: { review: true } });
  const others = await db.reviewReport.count({ where: { reviewId: report.reviewId, status: "OPEN" } });
  if (accept || others === 0) await db.review.update({ where: { id: report.reviewId }, data: { status: accept ? "HIDDEN" : "VISIBLE" } });
  await recomputeContractor(report.review.contractorId);
  revalidatePath("/", "layout");
}

export async function addPQRuleFromCandidate(formData: FormData) {
  await requireRole("ADMIN");
  const tag = String(formData.get("tag"));
  const label = String(formData.get("label"));
  const ratio = Number(formData.get("ratio"));
  const minReviews = Number(formData.get("minReviews"));
  const action = formData.get("ruleAction") === "FAIL" ? "FAIL" : "WARN";
  await db.pQRule.create({
    data: {
      name: `리뷰 불만: ${label}`,
      description: `리뷰 ${minReviews}건 이상 업체 중 '${label}' 태그 비율이 ${Math.round(ratio * 100)}% 이상이면 ${action === "FAIL" ? "PQ 탈락" : "경고"}`,
      kind: "COMPLAINT_TAG_RATIO",
      paramsJson: JSON.stringify({ tag, ratio, minReviews }),
      action,
      source: "REVIEW_CANDIDATE",
    },
  });
  revalidatePath("/", "layout");
}

export async function updatePQRule(formData: FormData) {
  await requireRole("ADMIN");
  const id = String(formData.get("ruleId"));
  const op = String(formData.get("op"));
  const r = await db.pQRule.findUniqueOrThrow({ where: { id } });
  if (op === "toggle") await db.pQRule.update({ where: { id }, data: { active: !r.active } });
  if (op === "action") await db.pQRule.update({ where: { id }, data: { action: r.action === "FAIL" ? "WARN" : "FAIL" } });
  revalidatePath("/", "layout");
}

// ── 감시 · 설정 ──
export async function runCollusionAction() {
  await requireRole("ADMIN");
  await runCollusionCheck();
  revalidatePath("/admin", "layout");
}

export async function updateFlag(formData: FormData) {
  await requireRole("ADMIN");
  const status = formData.get("status") === "CONFIRMED" ? "CONFIRMED" : "DISMISSED";
  await db.collusionFlag.update({ where: { id: String(formData.get("flagId")) }, data: { status } });
  revalidatePath("/admin", "layout");
}

export type SettingsState = { section?: string; ok?: boolean; errors?: string[] } | undefined;

export async function saveSettingsSection(_: SettingsState, formData: FormData): Promise<SettingsState> {
  const admin = await requireRole("ADMIN");
  const section = String(formData.get("section")) as SettingsSection;
  if (!SETTINGS_SECTIONS.includes(section)) return { section, errors: ["알 수 없는 설정이에요."] };
  if (formData.get("op") === "reset") {
    await db.config.deleteMany({ where: { key: section } });
    revalidatePath("/", "layout");
    return { section, ok: true };
  }
  let value: unknown;
  try {
    value = JSON.parse(String(formData.get("json")));
  } catch (e) {
    return { section, errors: [`JSON 형식 오류: ${(e as Error).message}`] };
  }
  const errors = validateShape(SETTINGS_DEFAULTS[section], value);
  if (errors.length) return { section, errors: errors.slice(0, 10) };
  await db.config.upsert({
    where: { key: section },
    create: { key: section, valueJson: JSON.stringify(value), updatedBy: admin.email },
    update: { valueJson: JSON.stringify(value), updatedBy: admin.email },
  });
  revalidatePath("/", "layout");
  return { section, ok: true };
}

export async function demoAutoBidsAction(formData: FormData) {
  await requireRole("ADMIN");
  await demoAutoBids(String(formData.get("tenderId")));
  revalidatePath("/", "layout");
}

// ── 매칭 파라미터 시뮬레이션 (F8, DB 변경 없음) ──
export async function simulateMatchingAction(p: SimParams) {
  await requireRole("ADMIN");
  const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  const w = (p.weights ?? {}) as Record<string, unknown>;
  return simulateMatching({
    radiusKm: clamp(p.radiusKm, 0.5, 10, 3),
    timingMonths: clamp(p.timingMonths, 0, 12, 2),
    minClusterSize: Math.round(clamp(p.minClusterSize, 2, 12, 4)),
    edgeThreshold: clamp(p.edgeThreshold, 0, 100, 65),
    weights: {
      trade: clamp(w.trade, 0, 100, 30),
      distance: clamp(w.distance, 0, 100, 20),
      timing: clamp(w.timing, 0, 100, 20),
      scale: clamp(w.scale, 0, 100, 10),
      volume: clamp(w.volume, 0, 100, 10),
      condition: clamp(w.condition, 0, 100, 10),
    },
  });
}
