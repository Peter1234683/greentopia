import "server-only";
import { db } from "./db";
import { getSettings } from "./settings";
import { parseJson } from "./constants";
import { computeReputation } from "./reputation";
import { initialReputation } from "./bidding/evaluate";

export async function reputationDetail(contractorId: string) {
  const settings = await getSettings();
  const s = settings.reputation;
  const [p, reviews, contracts] = await Promise.all([
    db.contractorProfile.findUniqueOrThrow({ where: { id: contractorId } }),
    db.review.findMany({ where: { contractorId }, include: { author: true, project: { include: { contract: { include: { building: true } } } } }, orderBy: { createdAt: "desc" } }),
    db.contract.findMany({ where: { contractorId, status: "SIGNED" }, include: { project: true } }),
  ]);
  const visible = reviews.filter((r) => r.status !== "HIDDEN");
  const rep = computeReputation(
    visible.map((r) => ({ ...r, complaintTags: parseJson<string[]>(r.complaintTagsJson, []) })),
    contracts.map((c) => ({ completedAt: c.project?.completedAt ?? null, plannedEnd: c.project?.plannedEnd ?? null })),
    s,
  );
  const benefits = await db.benefit.findMany({ where: { grade: p.grade } });
  const gIdx = s.grades.findIndex((g) => g.grade === p.grade);
  const next = gIdx > 0 ? s.grades[gIdx - 1] : null;
  return { p, rep, reviews, benefits, next, sproutScore: initialReputation(p, s), settings };
}
