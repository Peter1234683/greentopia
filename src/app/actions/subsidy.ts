"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { aiChat } from "@/lib/ai";
import { matchAllForBuilding } from "@/lib/subsidy/service";
import { ADVISOR_SYSTEM, buildContext, ruleAnswer, sourcesFooter } from "@/lib/subsidy/advisor";
import { benefitSchema, conditionsSchema } from "@/lib/subsidy/schema";
import { BENEFICIARY_TYPES } from "@/lib/constants";

// ── 고객 ──
export async function saveBeneficiaries(formData: FormData) {
  const user = await requireRole("CUSTOMER");
  const allowed = BENEFICIARY_TYPES.map((b) => b.code) as string[];
  const types = formData.getAll("types").map(String).filter((t) => allowed.includes(t));
  await db.customerProfile.update({ where: { userId: user.id }, data: { beneficiaryTypesJson: JSON.stringify(types) } });
  revalidatePath("/customer/subsidy");
}

export type AdvisorState = { error?: string } | undefined;

export async function askAdvisor(_: AdvisorState, formData: FormData): Promise<AdvisorState> {
  const user = await requireRole("CUSTOMER");
  const question = String(formData.get("question") ?? "").trim().slice(0, 500);
  const buildingId = String(formData.get("buildingId") ?? "") || undefined;
  if (question.length < 2) return { error: "질문을 입력해주세요." };

  const m = await matchAllForBuilding(user.id, buildingId);
  if (!m) return { error: "먼저 내 건물을 등록해주세요." };
  await db.advisorChatMessage.create({ data: { userId: user.id, buildingId: m.building.id, role: "user", content: question } });

  const history = await db.advisorChatMessage.findMany({ where: { userId: user.id, buildingId: m.building.id }, orderBy: { createdAt: "desc" }, take: 10 });
  const messages = history.reverse().map((h) => ({ role: h.role as "user" | "assistant", content: h.content }));
  const items = m.results;
  const res = await aiChat({ system: ADVISOR_SYSTEM, context: buildContext(items, m.input), messages }, () => ruleAnswer(question, items, m.input));
  await db.advisorChatMessage.create({
    data: {
      userId: user.id,
      buildingId: m.building.id,
      role: "assistant",
      content: res.data.trim() + sourcesFooter(items),
      sourcesJson: JSON.stringify(items.map((i) => i.program.id)),
      provider: res.provider,
    },
  });
  revalidatePath("/customer/subsidy/advisor");
  return undefined;
}

export async function clearAdvisor(formData: FormData) {
  const user = await requireRole("CUSTOMER");
  await db.advisorChatMessage.deleteMany({ where: { userId: user.id, buildingId: String(formData.get("buildingId") ?? "") || undefined } });
  revalidatePath("/customer/subsidy/advisor");
}

// ── 운영자: 지원금 DB 관리 ──
const programSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "사업명을 입력해주세요."),
  provider: z.string().trim().min(2, "주관 기관을 입력해주세요."),
  region: z.string().trim().min(2, "지역을 입력해주세요. (전국 / 대구광역시 / 대구광역시 ○○구)"),
  summary: z.string().trim().min(5, "한 줄 요약을 입력해주세요."),
  applyPeriod: z.string().trim().optional(),
  applyUrl: z.string().trim().url("신청 링크 형식을 확인해주세요.").optional().or(z.literal("")),
  sourceUrl: z.string().trim().url("출처 링크 형식을 확인해주세요.").optional().or(z.literal("")),
  sourceNote: z.string().trim().optional(),
  status: z.enum(["ACTIVE", "CLOSED", "UNVERIFIED"]),
  verifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  steps: z.string().optional(),
  conditionsJson: z.string(),
  benefitJson: z.string(),
});

export type ProgramFormState = { errors?: string[]; ok?: boolean; values?: Record<string, string | string[]> } | undefined;

export async function saveSubsidyProgram(_: ProgramFormState, formData: FormData): Promise<ProgramFormState> {
  await requireRole("ADMIN");
  // 오류가 나도 입력값이 지워지지 않게 돌려준다
  const values = { ...Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string")), targets: formData.getAll("targets").map(String) } as Record<string, string | string[]>;
  const parsed = programSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.issues.map((i) => i.message), values };
  const d = parsed.data;
  let conditions: unknown, benefit: unknown;
  try {
    conditions = conditionsSchema.parse(JSON.parse(d.conditionsJson || "{}"));
    benefit = benefitSchema.parse(JSON.parse(d.benefitJson || "{}"));
  } catch (e) {
    return { values, errors: [`요건·혜택 JSON 을 확인해주세요: ${e instanceof z.ZodError ? e.issues.map((i) => `${i.path.join(".")} ${i.message}`).join(", ") : (e as Error).message}`] };
  }
  // 출처 없는 항목은 고객에게 노출(ACTIVE)할 수 없다
  if (d.status === "ACTIVE" && !d.sourceUrl) return { values, errors: ["출처 링크가 없는 지원사업은 '진행 중'으로 공개할 수 없어요. '검증 필요'로 저장하세요."] };
  const data = {
    name: d.name,
    provider: d.provider,
    region: d.region,
    summary: d.summary,
    applyPeriod: d.applyPeriod || null,
    applyUrl: d.applyUrl || null,
    sourceUrl: d.sourceUrl || null,
    sourceNote: d.sourceNote || null,
    status: d.status,
    verifiedAt: d.verifiedAt ? new Date(`${d.verifiedAt}T00:00:00+09:00`) : null,
    targetBuildingTypesJson: JSON.stringify(formData.getAll("targets").map(String)),
    applyStepsJson: JSON.stringify((d.steps ?? "").split("\n").map((s) => s.trim()).filter(Boolean)),
    conditionsJson: JSON.stringify(conditions),
    benefitJson: JSON.stringify(benefit),
  };
  if (d.id) await db.subsidyProgram.update({ where: { id: d.id }, data });
  else await db.subsidyProgram.create({ data });
  revalidatePath("/", "layout");
  if (!d.id) redirect("/admin/subsidies");
  return { ok: true, values };
}

export async function setSubsidyStatus(formData: FormData) {
  await requireRole("ADMIN");
  const id = String(formData.get("id"));
  const op = String(formData.get("op"));
  if (op === "verify") await db.subsidyProgram.update({ where: { id }, data: { verifiedAt: new Date() } });
  if (op === "close") await db.subsidyProgram.update({ where: { id }, data: { status: "CLOSED" } });
  if (op === "hide") await db.subsidyProgram.update({ where: { id }, data: { status: "UNVERIFIED" } });
  revalidatePath("/", "layout");
}
