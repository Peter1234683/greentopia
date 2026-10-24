"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { aiJson, type AiImage } from "@/lib/ai";
import { getSettings } from "@/lib/settings";
import { saveUpload, validateUpload } from "@/lib/uploads";
import { PHOTO_PARTS, parseJson } from "@/lib/constants";
import { GUIDE_STRATEGIES, MAX_PHOTOS, type GuideStrategy } from "@/config/photoDiagnosis";
import { ageOf, enrichPhotoResult, photoAiSchema, photoPrompt, PHOTO_SYSTEM, rulePhotoDiagnosis, type PhotoResult } from "@/lib/photo/diagnose";
import { enforceExpertCheck, GUIDE_SYSTEM, guidePrompt, guideSchema, ruleGuide } from "@/lib/photo/guide";



async function ownedBuilding(userId: string, buildingId: string) {
  const b = await db.building.findFirst({ where: { id: buildingId, ownerId: userId } });
  if (!b) throw new Error("건물을 찾을 수 없어요.");
  return b;
}

export type PhotoState = { error?: string } | undefined;

export async function runPhotoDiagnosis(_: PhotoState, formData: FormData): Promise<PhotoState> {
  const user = await requireRole("CUSTOMER");
  const b = await ownedBuilding(user.id, String(formData.get("buildingId") ?? ""));
  const memo = String(formData.get("memo") ?? "").trim().slice(0, 300);
  const parts = PHOTO_PARTS.map((p) => p.code as string);

  const rows: { file: File; part: string; note: string | null }[] = [];
  for (let i = 0; i < MAX_PHOTOS; i++) {
    const f = formData.get(`photo${i}`);
    if (!(f instanceof File) || f.size === 0) continue;
    const err = validateUpload(f);
    if (err) return { error: `${i + 1}번 사진: ${err}` };
    if (!f.type.startsWith("image/")) return { error: `${i + 1}번 사진: 이미지 파일만 올릴 수 있어요.` };
    const part = String(formData.get(`part${i}`) ?? "OTHER");
    rows.push({ file: f, part: parts.includes(part) ? part : "OTHER", note: String(formData.get(`note${i}`) ?? "").trim().slice(0, 200) || null });
  }
  if (rows.length === 0) return { error: "사진을 한 장 이상 올려주세요. 창호·벽 모서리·천장처럼 신경 쓰이는 곳을 찍어주세요." };

  const photos = [];
  const images: AiImage[] = [];
  for (const r of rows) {
    const saved = await saveUpload(r.file);
    const doc = await db.document.create({ data: { ...saved, kind: "DIAGNOSIS_PHOTO", ownerId: user.id, buildingId: b.id } });
    photos.push(await db.diagnosisPhoto.create({ data: { buildingId: b.id, documentId: doc.id, part: r.part, note: r.note } }));
    images.push({ mimeType: saved.mimeType, base64: (await readFile(path.join(process.cwd(), "storage", saved.path))).toString("base64") });
  }

  const inputs = rows.map((r) => ({ part: r.part, note: r.note }));
  const res = await aiJson({ schema: photoAiSchema, system: PHOTO_SYSTEM, prompt: photoPrompt(b, inputs, memo), images }, () => rulePhotoDiagnosis(b, inputs, memo));
  const settings = await getSettings();
  const result: PhotoResult & { memo: string } = { ...enrichPhotoResult(res.data, b, settings.pricing), memo };
  const saved = await db.photoDiagnosisResult.create({
    data: { buildingId: b.id, photoIdsJson: JSON.stringify(photos.map((p) => p.id)), resultJson: JSON.stringify(result), source: res.source, provider: res.provider },
  });
  revalidatePath("/customer/diagnosis");
  redirect(`/customer/buildings/${b.id}/photo/${saved.id}`);
}

// ── 성공 가이드 ──
export async function generateGuide(formData: FormData) {
  const user = await requireRole("CUSTOMER");
  const b = await ownedBuilding(user.id, String(formData.get("buildingId") ?? ""));
  const raw = String(formData.get("strategy") ?? "COST");
  const strategy = (GUIDE_STRATEGIES.some((s) => s.code === raw) ? raw : "COST") as GuideStrategy;

  const [demand, photo] = await Promise.all([
    db.retrofitDemand.findFirst({ where: { buildingId: b.id, status: { in: ["ACTIVE", "MATCHED"] } }, orderBy: { createdAt: "desc" } }),
    db.photoDiagnosisResult.findFirst({ where: { buildingId: b.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const pr = photo ? parseJson<PhotoResult | null>(photo.resultJson, null) : null;
  const trades = [...new Set([...parseJson<string[]>(demand?.tradesJson, []), ...(pr?.recommendations.map((r) => r.trade) ?? [])])];
  const findings = pr?.defects.slice(0, 5).map((d) => `${PHOTO_PARTS.find((p) => p.code === d.part)?.label}: ${d.observation}`) ?? [];
  const gb = { usage: b.usage, structure: b.structure, age: ageOf(b), floors: b.floors, households: b.households };

  const res = await aiJson({ schema: guideSchema, system: GUIDE_SYSTEM, prompt: guidePrompt(gb, strategy, trades, findings) }, () => ruleGuide(gb, strategy, trades));
  const g = await db.successGuide.create({
    data: { buildingId: b.id, strategy, contentJson: JSON.stringify(enforceExpertCheck(res.data)), source: res.source, provider: res.provider },
  });
  redirect(`/customer/buildings/${b.id}/guide?g=${g.id}`);
}

// 가이드 체크리스트 → 내 공사 할 일 (진행 중 공사가 있으면 연결)
export async function importChecklist(formData: FormData) {
  const user = await requireRole("CUSTOMER");
  const guide = await db.successGuide.findFirst({ where: { id: String(formData.get("guideId") ?? ""), building: { ownerId: user.id } } });
  if (!guide) return;
  const content = guideSchema.safeParse(parseJson(guide.contentJson, null));
  if (!content.success) return;
  const project = await db.project.findFirst({
    where: { contract: { buildingId: guide.buildingId, status: { not: "CANCELLED" } }, status: { not: "COMPLETED" } },
    orderBy: { createdAt: "desc" },
  });
  await db.$transaction([
    // 같은 건물의 아직 안 한 가이드 할 일은 새 가이드로 바꾼다 (끝낸 항목은 남김)
    db.checklistItem.deleteMany({ where: { buildingId: guide.buildingId, done: false, guideId: { not: null } } }),
    db.checklistItem.createMany({
      data: content.data.checklist.map((c) => ({ buildingId: guide.buildingId, guideId: guide.id, projectId: project?.id ?? null, ...c })),
    }),
  ]);
  revalidatePath("/customer/projects");
  redirect("/customer/projects?checklist=1");
}

export async function toggleChecklist(formData: FormData) {
  const user = await requireRole("CUSTOMER");
  const item = await db.checklistItem.findFirst({ where: { id: String(formData.get("itemId") ?? ""), building: { ownerId: user.id } } });
  if (!item) return;
  await db.checklistItem.update({ where: { id: item.id }, data: { done: !item.done, doneAt: item.done ? null : new Date() } });
  revalidatePath("/customer/projects");
}
