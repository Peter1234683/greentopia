// 그린토피아 종합평가 (종심제 간소화) — 순수 함수
// 1) PQ: 통과/탈락 게이트 (점수에 넣지 않음 → 이중 반영 금지)
// 2) 종합평가: 가격·실적·공사기간·A/S·평판 (배점은 설정값, 소형 Cluster 는 간이 배점)
// 3) 덤핑 방지: 균형가격(상·하위 절사 평균) 대비 크게 낮으면 가격 점수 감점
import type { BiddingSettings } from "@/config/bidding";
import type { ReputationSettings } from "@/config/reputation";
import { checkEligibility, type EligContractor, type EligTender, type PQRuleLite } from "./eligibility";

export type EvalBid = {
  id: string;
  contractorId: string;
  totalPrice: number;
  durationDays: number;
  warrantyMonths: number;
  asMonths: number;
  dumpingReason: string | null;
};
export type EvalContractor = EligContractor & { grade: string; reputationScore: number | null };

export type EvalResult = {
  bidId: string;
  pqPassed: boolean;
  pqDetails: { failures: string[]; warnings: string[]; overCap: boolean };
  scores: Record<string, number>;
  dumpingPenalty: number;
  dumping: boolean;
  total: number;
  rank: number | null;
};

export function balancedPrice(prices: number[], trimRatio: number) {
  if (!prices.length) return 0;
  const sorted = [...prices].sort((a, b) => a - b);
  const cut = sorted.length >= 4 ? Math.floor(sorted.length * trimRatio) : 0;
  const kept = sorted.slice(cut, sorted.length - cut);
  return kept.reduce((s, v) => s + v, 0) / kept.length;
}

// 리뷰가 없는 업체: 새싹 트랙 초기 점수 (외부 실적 반영)
export function initialReputation(c: { reputationScore: number | null; externalProjectCount: number }, r: ReputationSettings) {
  if (c.reputationScore != null) return c.reputationScore;
  return Math.min(r.sproutMax, r.sproutBase + c.externalProjectCount * r.sproutPerExternalProject);
}

export function evaluateBids(
  bids: EvalBid[],
  contractors: Map<string, EvalContractor>,
  tender: EligTender & { priceCap: number | null; estimatedAmount: number },
  rules: PQRuleLite[],
  s: BiddingSettings,
  rep: ReputationSettings,
  gradeBonus: Record<string, number>,
): { results: EvalResult[]; balanced: number; weights: Record<string, number>; full: boolean } {
  const full = tender.estimatedAmount >= s.largeClusterAmount;
  const w = full ? s.weights : s.simpleWeights;

  const pre = bids.map((b) => {
    const c = contractors.get(b.contractorId)!;
    const e = checkEligibility(c, tender, rules);
    const overCap = tender.priceCap != null && b.totalPrice > tender.priceCap;
    return { b, c, e, overCap, valid: e.eligible && !overCap };
  });
  const valid = pre.filter((x) => x.valid);
  const balanced = balancedPrice(valid.map((x) => x.b.totalPrice), s.trimRatio);
  const isDumping = (price: number) => valid.length >= 2 && price < balanced * (1 - s.dumpingThreshold);
  // 가격 점수 기준가: 덤핑이 아닌 유효 입찰 중 최저가 (덤핑 입찰이 다른 업체 점수를 끌어내리지 않게)
  const fair = valid.filter((x) => !isDumping(x.b.totalPrice));
  const minPrice = Math.min(...(fair.length ? fair : valid).map((x) => x.b.totalPrice));
  const minDuration = Math.min(...valid.map((x) => x.b.durationDays));
  const maxCare = Math.max(...valid.map((x) => x.b.warrantyMonths + x.b.asMonths));

  const results: EvalResult[] = pre.map(({ b, c, e, overCap, valid: ok }) => {
    if (!ok)
      return { bidId: b.id, pqPassed: e.eligible, pqDetails: { failures: e.failures, warnings: e.warnings, overCap }, scores: {}, dumpingPenalty: 0, dumping: false, total: 0, rank: null };
    const price = w.price * Math.min(1, minPrice / b.totalPrice);
    const dumping = isDumping(b.totalPrice);
    // 사유서를 내지 않은 덤핑은 감점을 두 배로
    const dumpingPenalty = dumping ? price * s.dumpingPenaltyRate * (b.dumpingReason ? 1 : 2) : 0;
    const record = w.record * Math.min(1, (c.platformProjects + c.externalProjectCount * 0.5) / s.recordFullAt);
    const duration = w.duration * (minDuration / b.durationDays);
    const warranty = w.warranty * ((b.warrantyMonths + b.asMonths) / maxCare);
    const reputation = Math.min(w.reputation, w.reputation * (initialReputation(c, rep) / 100) + (gradeBonus[c.grade] ?? 0));
    const scores = { price: price - dumpingPenalty, record, duration, warranty, reputation };
    const r1 = (n: number) => Math.round(n * 10) / 10;
    const rounded = Object.fromEntries(Object.entries(scores).filter(([k]) => w[k as keyof typeof w] > 0).map(([k, v]) => [k, r1(v)]));
    return {
      bidId: b.id,
      pqPassed: true,
      pqDetails: { failures: [], warnings: e.warnings, overCap: false },
      scores: rounded,
      dumpingPenalty: r1(dumpingPenalty),
      dumping,
      total: r1(Object.values(rounded).reduce((s2, v) => s2 + v, 0)),
      rank: null,
    };
  });
  results
    .filter((r) => r.pqPassed && !r.pqDetails.overCap)
    .sort((a, b) => b.total - a.total)
    .forEach((r, i) => (r.rank = i + 1));
  return { results, balanced, weights: w, full };
}
