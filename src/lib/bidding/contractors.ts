import "server-only";
import { db } from "@/lib/db";
import { parseJson } from "@/lib/constants";
import type { EligContractor, PQRuleLite } from "./eligibility";

export type ContractorRow = EligContractor & { name: string; grade: string; reputationScore: number | null; userId: string };

export async function loadContractors(where: { id?: string } = {}): Promise<ContractorRow[]> {
  const list = await db.contractorProfile.findMany({
    where,
    include: {
      trades: true,
      regions: true,
      reviews: { where: { kind: "INITIAL", status: { not: "HIDDEN" } }, select: { complaintTagsJson: true } },
      contracts: { where: { project: { status: { in: ["COMPLETED", "AS"] } } }, select: { id: true } },
    },
  });
  return list.map((c) => {
    const tagCounts: Record<string, number> = {};
    for (const r of c.reviews) for (const t of parseJson<string[]>(r.complaintTagsJson, [])) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
    return {
      id: c.id,
      userId: c.userId,
      name: c.companyName,
      grade: c.grade,
      reputationScore: c.reputationScore,
      reviewStatus: c.reviewStatus,
      grRegistered: c.grRegistered,
      constructionLicense: c.constructionLicense,
      warrantyAvailable: c.warrantyAvailable,
      recentSanction: c.recentSanction,
      techStaffCount: c.techStaffCount,
      externalProjectCount: c.externalProjectCount,
      trades: c.trades.map((t) => t.trade),
      regions: c.regions.map((r) => r.sigungu),
      platformProjects: c.contracts.length,
      reviewCount: c.reviews.length,
      tagCounts,
    };
  });
}

export async function loadPQRules(): Promise<PQRuleLite[]> {
  const rules = await db.pQRule.findMany({ where: { active: true } });
  return rules.map((r) => ({ id: r.id, name: r.name, kind: r.kind, params: parseJson(r.paramsJson, {}), action: r.action, active: r.active }));
}
