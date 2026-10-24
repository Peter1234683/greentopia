"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { echo, fieldErrors, optionalNumber, requiredNumber, type FormState } from "@/lib/forms";
import { getBuildingRegistry, parseDaeguAddress, type RegistryLookup } from "@/lib/adapters/buildingRegistry";
import { DAEGU_DISTRICTS } from "@/config/regions";
import { BUDGET_OPTIONS, DESIRED_START_MONTHS, WINDOW_AREA_RATIO } from "@/config/building";
import { SYMPTOMS, TRADES } from "@/lib/constants";
import { saveUpload, validateUpload } from "@/lib/uploads";
import { runMatching } from "@/lib/matching/run";
import { onDemandSaved } from "@/lib/invite";

async function ownedBuilding(userId: string, id: string) {
  const b = await db.building.findFirst({ where: { id, ownerId: userId } });
  if (!b) throw new Error("건물을 찾을 수 없어요.");
  return b;
}

export async function lookupBuilding(address: string): Promise<RegistryLookup> {
  await requireRole("CUSTOMER");
  return getBuildingRegistry().lookup(address);
}

const buildingSchema = z.object({
  id: z.string().optional(),
  nickname: z.string().trim().max(30, "30자 이내로 적어주세요.").optional(),
  address: z.string().trim().min(5, "주소를 입력해주세요."),
  approvalDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "사용승인일을 골라주세요.")
    .refine((v) => new Date(v) <= new Date(), "미래 날짜는 고를 수 없어요.")
    .optional()
    .or(z.literal("")),
  usage: z.enum(["DETACHED", "MULTI_HOUSEHOLD", "MULTIPLEX"], { message: "집 유형을 골라주세요." }),
  structure: z.enum(["RC", "MASONRY", "BRICK", "WOOD", "STEEL", "OTHER"], { message: "구조를 골라주세요." }),
  grossArea: requiredNumber(z.number().min(20, "20㎡ 이상이어야 해요.").max(5000, "5,000㎡ 이하만 등록할 수 있어요."), "연면적을 입력해주세요."),
  floors: requiredNumber(z.number().int("정수로 입력해주세요.").min(1, "1층 이상이어야 해요.").max(10, "10층 이하 저층 주택만 지원해요."), "층수를 입력해주세요."),
  households: requiredNumber(z.number().int("정수로 입력해주세요.").min(1, "1세대 이상이어야 해요.").max(50, "50세대 이하만 지원해요."), "세대수를 입력해주세요."),
  windowArea: optionalNumber(z.number({ message: "숫자로 입력해주세요." }).min(0).max(2000, "2,000㎡ 이하로 입력해주세요.")),
  source: z.enum(["MOCK", "API", "MANUAL"]).default("MANUAL"),
  lat: optionalNumber(z.number().min(33).max(39)),
  lng: optionalNumber(z.number().min(124).max(132)),
});

export async function saveBuilding(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole("CUSTOMER");
  const values = echo(formData);
  const parsed = buildingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const d = parsed.data;

  // 행정구역은 항상 주소에서 다시 계산한다 (사용자가 주소를 고쳤을 수 있으므로)
  const addr = parseDaeguAddress(d.address);
  if ("error" in addr) return { errors: { address: addr.error.message }, values };
  const district = DAEGU_DISTRICTS.find((x) => x.sigungu === addr.sigungu)!;
  const dong = district.dongs.find((x) => x.name === addr.dong);
  const hasCoords = d.lat != null && d.lng != null;
  const lat = hasCoords ? d.lat! : (dong ?? district).lat;
  const lng = hasCoords ? d.lng! : (dong ?? district).lng;

  const data = {
    nickname: d.nickname || null,
    address: d.address,
    sido: addr.sido,
    sigungu: addr.sigungu,
    dong: addr.dong ?? district.dongs[0].name,
    lat,
    lng,
    approvalDate: d.approvalDate ? new Date(`${d.approvalDate}T00:00:00+09:00`) : null,
    usage: d.usage,
    structure: d.structure,
    grossArea: d.grossArea,
    floors: d.floors,
    households: d.households,
    windowArea: d.windowArea ?? Math.round(d.grossArea * WINDOW_AREA_RATIO),
    registrySource: d.source,
  };

  let id = d.id;
  if (id) {
    await ownedBuilding(user.id, id);
    await db.building.update({ where: { id }, data });
  } else {
    id = (await db.building.create({ data: { ...data, ownerId: user.id } })).id;
  }
  revalidatePath("/customer", "layout");
  const hasDemand = (await db.retrofitDemand.count({ where: { buildingId: id, status: { in: ["ACTIVE", "MATCHED"] } } })) > 0;
  redirect(d.id && hasDemand ? "/customer/diagnosis" : `/customer/buildings/${id}/demand`);
}

const monthRe = /^\d{4}-\d{2}$/;
const demandSchema = z.object({
  buildingId: z.string().min(1),
  symptoms: z.array(z.enum(SYMPTOMS.map((s) => s.code) as [string, ...string[]])).default([]),
  trades: z.array(z.enum(TRADES)).min(1, "필요한 공사를 하나 이상 골라주세요."),
  desiredStart: z.string().regex(monthRe, "희망 공사 시기를 골라주세요."),
  budget: z.enum(BUDGET_OPTIONS.map((b) => b.code) as [string, ...string[]], { message: "예상 예산을 골라주세요." }),
  jointIntent: z.enum(["YES", "MAYBE", "NO"], { message: "공동공사 참여 의향을 골라주세요." }),
  billElectric: optionalNumber(z.number({ message: "숫자로 입력해주세요." }).int().min(0).max(5_000_000, "금액을 다시 확인해주세요.")),
  billGas: optionalNumber(z.number({ message: "숫자로 입력해주세요." }).int().min(0).max(5_000_000, "금액을 다시 확인해주세요.")),
});

export async function saveDemand(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole("CUSTOMER");
  const values = echo(formData);
  const parsed = demandSchema.safeParse({
    ...Object.fromEntries(formData),
    symptoms: formData.getAll("symptoms"),
    trades: formData.getAll("trades"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const d = parsed.data;
  const building = await ownedBuilding(user.id, d.buildingId);

  const [y, m] = d.desiredStart.split("-").map(Number);
  const desiredStart = new Date(y, m - 1, 1);
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + DESIRED_START_MONTHS, 1);
  if (desiredStart < first || desiredStart > last)
    return { errors: { desiredStart: "다음 달부터 12개월 안에서 골라주세요." }, values };

  const photo = formData.get("billPhoto");
  const hasPhoto = photo instanceof File && photo.size > 0;
  if (hasPhoto) {
    const err = validateUpload(photo);
    if (err) return { errors: { billPhoto: err }, values };
  }

  const budget = BUDGET_OPTIONS.find((b) => b.code === d.budget)!;
  const data = {
    tradesJson: JSON.stringify(d.trades),
    symptomsJson: JSON.stringify(d.symptoms),
    desiredStart,
    budgetMin: budget.min,
    budgetMax: budget.max,
    jointIntent: d.jointIntent,
    billElectric: d.billElectric ?? null,
    billGas: d.billGas ?? null,
  };

  // 건물당 진행 중인 수요는 하나만 둔다. 이미 매칭된 수요는 수정만 가능.
  const existing = await db.retrofitDemand.findFirst({
    where: { buildingId: building.id, status: { in: ["ACTIVE", "MATCHED"] } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) await db.retrofitDemand.update({ where: { id: existing.id }, data });
  else await db.retrofitDemand.create({ data: { ...data, buildingId: building.id } });

  if (hasPhoto) {
    const saved = await saveUpload(photo);
    await db.document.create({ data: { ...saved, kind: "BILL", ownerId: user.id, buildingId: building.id } });
  }

  // 새 수요가 들어오면 AI 매칭을 다시 돌린다 (진행 중 Cluster 는 유지)
  await runMatching();
  await onDemandSaved(user.id, building.id);
  revalidatePath("/customer", "layout");
  redirect(`/customer/diagnosis?saved=${building.id}`);
}
