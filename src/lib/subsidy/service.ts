import "server-only";
import type { SubsidyProgram } from "@prisma/client";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { parseJson } from "@/lib/constants";
import type { DiagnosisResult } from "@/lib/diagnosis/types";
import { parseBenefit, parseConditions } from "./schema";
import { improvementFromDiagnosis, matchProgram, type MatchInput } from "./match";

export type ProgramView = ReturnType<typeof toView>;

export function programBadge(p: Pick<SubsidyProgram, "verifiedAt">, staleAfterDays = 180) {
  if (!p.verifiedAt) return { kind: "NOTICE" as const, label: "공고문 확인 필요" };
  const age = (Date.now() - p.verifiedAt.getTime()) / 864e5;
  if (age > staleAfterDays) return { kind: "STALE" as const, label: "정보 확인 필요" };
  return null;
}

export function toView(p: SubsidyProgram, staleAfterDays?: number) {
  return {
    id: p.id,
    name: p.name,
    provider: p.provider,
    region: p.region,
    targetBuildingTypes: parseJson<string[]>(p.targetBuildingTypesJson, []),
    conditions: parseConditions(p.conditionsJson),
    benefit: parseBenefit(p.benefitJson),
    summary: p.summary,
    applySteps: parseJson<string[]>(p.applyStepsJson, []),
    applyPeriod: p.applyPeriod,
    applyUrl: p.applyUrl,
    sourceUrl: p.sourceUrl,
    sourceNote: p.sourceNote,
    verifiedAt: p.verifiedAt,
    status: p.status,
    badge: programBadge(p, staleAfterDays),
  };
}

// 고객에게는 진행 중(ACTIVE) 항목만. 검증 필요·마감은 숨긴다.
export async function visiblePrograms() {
  const [list, settings] = await Promise.all([db.subsidyProgram.findMany({ where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" } }), getSettings()]);
  return list.map((p) => toView(p, settings.support.staleAfterDays));
}

export async function matchContext(userId: string, buildingId?: string) {
  const buildings = await db.building.findMany({
    where: { ownerId: userId },
    include: {
      demands: { where: { status: { in: ["ACTIVE", "MATCHED", "DONE"] } }, orderBy: { createdAt: "desc" }, take: 1 },
      diagnoses: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "asc" },
  });
  const b = buildings.find((x) => x.id === buildingId) ?? buildings[0];
  if (!b) return null;
  const profile = await db.customerProfile.findUnique({ where: { userId } });
  const diag = b.diagnoses[0] ? parseJson<DiagnosisResult | null>(b.diagnoses[0].resultJson, null) : null;
  const input: MatchInput = {
    sido: b.sido,
    sigungu: b.sigungu,
    usage: b.usage,
    approvalDate: b.approvalDate,
    trades: b.demands[0] ? parseJson<string[]>(b.demands[0].tradesJson, []) : [],
    improvementPct: improvementFromDiagnosis(diag?.combined),
    beneficiaryTypes: parseJson<string[]>(profile?.beneficiaryTypesJson, []),
  };
  return { building: b, buildings, input, hasDiagnosis: !!diag };
}

export async function matchAllForBuilding(userId: string, buildingId?: string) {
  const ctx = await matchContext(userId, buildingId);
  if (!ctx) return null;
  const programs = await visiblePrograms();
  const results = programs.map((p) => ({ program: p, match: matchProgram(p, ctx.input) }));
  for (const r of results)
    await db.subsidyMatchResult.upsert({
      where: { buildingId_programId: { buildingId: ctx.building.id, programId: r.program.id } },
      create: { buildingId: ctx.building.id, programId: r.program.id, status: r.match.status, reasonsJson: JSON.stringify(r.match.reasons) },
      update: { status: r.match.status, reasonsJson: JSON.stringify(r.match.reasons), createdAt: new Date() },
    });
  const order = { ELIGIBLE: 0, CHECK: 1, INELIGIBLE: 2 } as const;
  results.sort((a, b) => order[a.match.status] - order[b.match.status]);
  return { ...ctx, results };
}
