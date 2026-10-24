// 리뷰 → 평판 → 등급 설정
export const REPUTATION_DEFAULTS = {
  ratingWeights: { quality: 0.25, schedule: 0.15, cleanliness: 0.1, comm: 0.15, as: 0.2, value: 0.15 },
  recencyHalfLifeDays: 365, // 최근 리뷰일수록 가중
  defectResolutionWeight: 10, // 하자 처리율 반영 (점)
  scheduleAdherenceWeight: 10, // 기간 준수율 반영 (점)
  // 불만 태그 감점: 태그 점수 × (해당 태그 리뷰 비율) × tagPenaltyScale  (예: 하자 처리 지연이 리뷰 60% → 4 × 0.6 × 5 = 12점)
  tagPenalty: { DELAY: 2, EXTRA_COST: 3, POOR_FINISH: 3, NOISE_DUST: 1, NO_CONTACT: 3, DEFECT_DELAY: 4, SAFETY: 4 } as Record<string, number>,
  tagPenaltyScale: 5,
  maxTagPenalty: 20,
  // 새싹 트랙: 리뷰가 없을 때 외부 실적으로 초기 점수
  sproutBase: 60,
  sproutPerExternalProject: 0.5,
  sproutMax: 75,
  grades: [
    { grade: "GREEN_PARTNER", minScore: 88, minReviews: 6 },
    { grade: "EXCELLENT", minScore: 80, minReviews: 4 },
    { grade: "STANDARD", minScore: 0, minReviews: 1 },
    { grade: "SPROUT", minScore: 0, minReviews: 0 },
  ],
  pqCandidate: { minReviews: 3, tagRatio: 0.3 }, // 불만 태그가 리뷰의 30% 이상인 업체가 있으면 규칙 후보
  reviewPoints: 3000, // 리뷰 작성 고객 포인트
  followupMonths: [6, 12],
  anomaly: { windowDays: 3, minReviews: 4 }, // 짧은 기간 몰린 리뷰
  // 리뷰 교차 검증: 같은 묶음·같은 업체 세대들의 평균 별점과 이만큼 차이 나면 "교차 검증 필요" → 운영자 확인 전까지 평판 반영 보류
  crossCheck: { outlierGap: 1.5, minPeers: 2 },
};
export type ReputationSettings = typeof REPUTATION_DEFAULTS;
