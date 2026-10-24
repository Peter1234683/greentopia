// AI 공동공사 매칭 설정 (가중치는 이후 실제 데이터로 학습·조정할 수 있도록 설정값으로 둔다)
export const MATCHING_DEFAULTS = {
  // STEP 1 Hard Filter
  radiusKm: 3,
  timingMonths: 2, // 희망 시기 ±N개월
  excludedIntents: ["NO"], // "혼자 진행할래요" 는 매칭에서 제외
  // 유사 공종 호환도 (같은 공종 = 1). 이 값 이상이면 같은 Cluster 후보로 본다
  tradeCompat: {
    "EXT_INSULATION|ROOF": 0.6,
    "INT_INSULATION|WINDOW": 0.5,
  } as Record<string, number>,
  similarTradeMin: 0.6,
  // STEP 2 적합도 점수 (합계 100)
  weights: { trade: 30, distance: 20, timing: 20, scale: 10, volume: 10, condition: 10 },
  // STEP 3 Cluster 구성
  edgeThreshold: 65, // 이 점수 이상인 쌍만 연결
  minClusterSize: 4,
  maxClusterSize: 12,
  minJoinedForTender: 4, // 참여 확정 건물이 이 수 이상이면 입찰 공고 초안 생성
};
export type MatchingSettings = typeof MATCHING_DEFAULTS;
