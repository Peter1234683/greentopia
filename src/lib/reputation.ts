// 평판 점수 = 항목별 별점 가중평균(최근 리뷰 가중) + 하자 처리율 + 기간 준수율 − 불만 태그 감점  (0~100, 순수 함수)
import type { ReputationSettings } from "@/config/reputation";

export type RepReview = {
  kind: string;
  createdAt: Date;
  ratingQuality: number;
  ratingSchedule: number;
  ratingCleanliness: number;
  ratingComm: number;
  ratingAS: number;
  ratingValue: number;
  complaintTags: string[];
  defectOccurred: boolean | null;
  defectResolved: boolean | null;
};
export type RepProject = { completedAt: Date | null; plannedEnd: Date | null };

export const RATING_KEYS = [
  ["quality", "ratingQuality", "시공 품질"],
  ["schedule", "ratingSchedule", "공사기간 준수"],
  ["cleanliness", "ratingCleanliness", "청결·안전"],
  ["comm", "ratingComm", "소통"],
  ["as", "ratingAS", "A/S 대응"],
  ["value", "ratingValue", "가격 대비 만족"],
] as const;

export function computeReputation(reviews: RepReview[], projects: RepProject[], s: ReputationSettings, now = new Date()) {
  const initial = reviews.filter((r) => r.kind === "INITIAL");
  if (initial.length === 0) return null;

  let wSum = 0;
  let rSum = 0;
  const catSum: Record<string, number> = {};
  for (const r of initial) {
    const ageDays = (now.getTime() - r.createdAt.getTime()) / 864e5;
    const w = Math.pow(0.5, ageDays / s.recencyHalfLifeDays);
    let weighted = 0;
    for (const [k, field] of RATING_KEYS) {
      weighted += s.ratingWeights[k] * r[field];
      catSum[k] = (catSum[k] ?? 0) + r[field];
    }
    rSum += w * weighted;
    wSum += w;
  }
  const ratingScore = ((rSum / wSum) / 5) * 100; // 5점 만점 → 100점
  const categoryAvg = Object.fromEntries(Object.entries(catSum).map(([k, v]) => [k, Math.round((v / initial.length) * 10) / 10]));

  const defects = reviews.filter((r) => r.defectOccurred);
  const defectRate = defects.length ? defects.filter((r) => r.defectResolved).length / defects.length : 1;
  const done = projects.filter((p) => p.completedAt && p.plannedEnd);
  const scheduleRate = done.length ? done.filter((p) => p.completedAt! <= p.plannedEnd!).length / done.length : 1;

  const tagCounts: Record<string, number> = {};
  for (const r of reviews) for (const t of r.complaintTags) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
  const tagPenalty = Math.min(
    s.maxTagPenalty,
    Object.entries(tagCounts).reduce((sum, [t, n]) => sum + (s.tagPenalty[t] ?? 2) * (n / initial.length) * s.tagPenaltyScale, 0),
  );

  const extra = s.defectResolutionWeight + s.scheduleAdherenceWeight;
  const score = ratingScore * (1 - extra / 100) + s.defectResolutionWeight * defectRate + s.scheduleAdherenceWeight * scheduleRate - tagPenalty;
  return {
    score: Math.max(0, Math.min(100, Math.round(score * 10) / 10)),
    ratingScore: Math.round(ratingScore * 10) / 10,
    categoryAvg,
    defectRate,
    defectCount: defects.length,
    scheduleRate,
    tagCounts,
    tagPenalty: Math.round(tagPenalty * 10) / 10,
    reviewCount: initial.length,
  };
}

export function gradeFor(score: number | null, reviewCount: number, s: ReputationSettings) {
  for (const g of s.grades) if ((score ?? 0) >= g.minScore && reviewCount >= g.minReviews) return g.grade;
  return "SPROUT";
}
