"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { echo, fieldErrors, optionalNumber, requiredNumber, type FormState } from "@/lib/forms";
import { graiLinkAdapter, simpleAdapter, type DiagnosisContext } from "@/lib/diagnosis/adapters";
import { peerAverage } from "@/lib/diagnosis/peer";
import { parseJson, TRADES } from "@/lib/constants";
import { saveUpload, validateUpload } from "@/lib/uploads";

async function context(userId: string, buildingId: string) {
  const building = await db.building.findFirst({
    where: { id: buildingId, ownerId: userId },
    include: { demands: { where: { status: { in: ["ACTIVE", "MATCHED"] } }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!building) throw new Error("건물을 찾을 수 없어요.");
  const demand = building.demands[0] ?? null;
  const ctx: DiagnosisContext = {
    building,
    demandTrades: demand ? parseJson<string[]>(demand.tradesJson, []) : [],
    peer: await peerAverage(building),
  };
  return { building, demand, ctx };
}

export async function runSimpleDiagnosis(formData: FormData) {
  const user = await requireRole("CUSTOMER");
  const buildingId = String(formData.get("buildingId"));
  const { demand, ctx } = await context(user.id, buildingId);
  const bills = demand && (demand.billElectric != null || demand.billGas != null) ? { electric: demand.billElectric, gas: demand.billGas } : null;
  const result = await simpleAdapter.diagnose(ctx, { bills });
  const saved = await db.energyDiagnosis.create({
    data: { buildingId, mode: simpleAdapter.mode, source: simpleAdapter.sourceLabel, resultJson: JSON.stringify(result) },
  });
  revalidatePath("/customer", "layout");
  redirect(`/customer/buildings/${buildingId}/diagnosis?d=${saved.id}`);
}

const kwh = (label: string) => optionalNumber(z.number().min(0, `${label} 값을 확인해주세요.`).max(10_000_000, `${label} 값이 너무 커요.`));
const graiSchema = z.object({
  buildingId: z.string().min(1),
  baselineKwh: requiredNumber(z.number().min(100, "현재 상태 값을 확인해주세요.").max(10_000_000, "값이 너무 커요."), "현재 상태의 연간 에너지 소요량을 입력해주세요."),
  ...Object.fromEntries(TRADES.map((t) => [t, kwh("시나리오")])),
  COMBINED: kwh("통합 시나리오"),
});

export async function saveGraiResult(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole("CUSTOMER");
  const values = echo(formData);
  const parsed = graiSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const d = parsed.data as Record<string, number | undefined> & { buildingId: string; baselineKwh: number };

  const scenarios: Record<string, number> = {};
  for (const k of [...TRADES, "COMBINED"]) {
    const v = d[k];
    if (v == null) continue;
    if (v > d.baselineKwh) return { errors: { [k]: "개선 후 값이 현재 상태보다 클 수 없어요." }, values };
    scenarios[k] = v;
  }
  if (Object.keys(scenarios).length === 0)
    return { errors: { form: "개선 시나리오 값을 하나 이상 입력해주세요." }, values };

  const file = formData.get("resultFile");
  const hasFile = file instanceof File && file.size > 0;
  if (hasFile) {
    const err = validateUpload(file);
    if (err) return { errors: { resultFile: err }, values };
  }

  const { ctx } = await context(user.id, d.buildingId);
  const result = await graiLinkAdapter.diagnose(ctx, { baselineKwh: d.baselineKwh, scenarios });
  const saved = await db.energyDiagnosis.create({
    data: { buildingId: d.buildingId, mode: graiLinkAdapter.mode, source: graiLinkAdapter.sourceLabel, resultJson: JSON.stringify(result) },
  });
  if (hasFile) {
    const up = await saveUpload(file);
    await db.document.create({ data: { ...up, kind: "DIAGNOSIS_RESULT", ownerId: user.id, buildingId: d.buildingId } });
  }
  revalidatePath("/customer", "layout");
  redirect(`/customer/buildings/${d.buildingId}/diagnosis?d=${saved.id}`);
}
