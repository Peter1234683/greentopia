import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { aiJson, type AiImage } from "@/lib/ai";
import { notifyAdmins } from "@/lib/notify";
import { parseJson } from "@/lib/constants";
import { computeStatuses, splitAmounts, STAGE_ORDER, type Stage, type StageStatus } from "./payments";
import { applyAi, buildChecklist, crossCheck, inspectionAiSchema, inspectionPrompt, INSPECTION_SYSTEM, manualInspection, passRate, type CheckItem } from "./inspection";

// 서명된 계약의 지급 단계를 만든다 (이미 있으면 그대로)
export async function ensureMilestones(contractId: string) {
  const c = await db.contract.findUnique({ where: { id: contractId }, include: { milestones: true } });
  if (!c || c.status !== "SIGNED" || c.milestones.length) return;
  const { contract: cfg } = await getSettings();
  const amounts = splitAmounts(c.amount, cfg.stages);
  await db.paymentMilestone.createMany({
    data: cfg.stages.map((s, i) => ({ contractId, stage: s.code, seq: i + 1, ratio: s.ratio, amount: amounts[i], condition: s.condition })),
  });
  await syncMilestones(contractId);
}

// 현재 계약·공사·검측 상태로 단계별 READY/LOCKED 를 다시 맞춘다
export async function syncMilestones(contractId: string) {
  const c = await db.contract.findUnique({
    where: { id: contractId },
    include: { milestones: true, project: { include: { inspection: true } } },
  });
  if (!c || !c.milestones.length) return;
  const current = Object.fromEntries(STAGE_ORDER.map((s) => [s, (c.milestones.find((m) => m.stage === s)?.status ?? "LOCKED") as StageStatus])) as Record<Stage, StageStatus>;
  const retention = c.milestones.find((m) => m.stage === "RETENTION");
  const next = computeStatuses(current, {
    signed: c.status === "SIGNED",
    materialsDelivered: !!c.project?.materialsDeliveredAt,
    inspectionApproved: !!c.project?.inspection?.ownerApproved,
    openAS: c.project?.status === "AS",
    releaseAt: retention?.releaseAt ?? null,
    now: new Date(),
  });
  for (const m of c.milestones) {
    const want = next[m.stage as Stage];
    if (want && want !== m.status) await db.paymentMilestone.update({ where: { id: m.id }, data: { status: want } });
  }
}

const readImage = async (docId: string): Promise<AiImage | null> => {
  const d = await db.document.findUnique({ where: { id: docId } });
  if (!d || !d.mimeType.startsWith("image/")) return null;
  try {
    return { mimeType: d.mimeType, base64: (await readFile(path.join(process.cwd(), "storage", d.path))).toString("base64") };
  } catch {
    return null;
  }
};

// 완료 보고 시: 시공 전(진단 사진)·후(완료 사진) + 계약 규격 체크리스트 → AI 참고 판정 (키 없으면 수동 모드)
export async function createInspection(projectId: string) {
  const p = await db.project.findUnique({
    where: { id: projectId },
    include: { inspection: true, contract: { include: { bid: true, tender: { include: { cluster: true } } } } },
  });
  if (!p || p.inspection) return;
  const settings = await getSettings();
  const trade = p.contract.tender?.cluster.trade ?? "";
  const table = parseJson<Record<string, number>>(p.contract.bid?.unitPriceTableJson, {});
  const types = settings.pricing.trades[trade]?.types ?? [];
  const specLabels = types.filter((t) => table[t.code] != null).map((t) => t.label);
  const items = buildChecklist(trade, specLabels, settings.contract.checklist);

  const before = (await db.diagnosisPhoto.findMany({ where: { buildingId: p.contract.buildingId }, orderBy: { createdAt: "desc" }, take: 3 })).map((x) => x.documentId);
  const after = parseJson<string[]>(p.photosJson, []).slice(0, 3);
  const images = (await Promise.all([...before, ...after].map(readImage))).filter((x): x is AiImage => !!x);
  const res = after.length
    ? await aiJson({ schema: inspectionAiSchema, system: INSPECTION_SYSTEM, prompt: inspectionPrompt(items, before.length, after.length), images }, () => manualInspection(items))
    : { data: manualInspection(items), source: "rule" as const, provider: "rule" as const };
  const checked = applyAi(items, res.data);
  await db.completionInspection.create({
    data: {
      projectId,
      beforePhotosJson: JSON.stringify(before),
      afterPhotosJson: JSON.stringify(after),
      checklistJson: JSON.stringify(checked),
      aiVerdictJson: res.source === "ai" ? JSON.stringify(res.data) : null,
      source: res.source === "ai" ? "ai" : "manual",
      provider: res.provider,
      score: passRate(checked),
    },
  });
}

// 같은 Cluster 이웃 세대의 검측 통과율과 비교
export async function inspectionCrossCheck(projectId: string) {
  const p = await db.project.findUnique({ where: { id: projectId }, include: { inspection: true, contract: { include: { tender: true } } } });
  if (!p?.inspection || !p.contract.tender) return null;
  const others = await db.completionInspection.findMany({
    where: { projectId: { not: projectId }, project: { contract: { tender: { clusterId: p.contract.tender.clusterId } } }, score: { not: null } },
    select: { score: true },
  });
  const { contract } = await getSettings();
  const mine = passRate(parseJson<CheckItem[]>(p.inspection.checklistJson, []));
  return { mine, others: others.map((o) => o.score!), ...crossCheck(mine, others.map((o) => o.score!), contract.crossCheckGap) };
}

export async function flagCrossCheck(projectId: string, label: string) {
  const r = await inspectionCrossCheck(projectId);
  if (r?.flagged) await notifyAdmins("준공 검측 교차 검증 필요", `${label}: 같은 묶음 이웃 세대보다 검측 통과율이 낮아요.`, "/admin/monitoring");
  return r;
}
