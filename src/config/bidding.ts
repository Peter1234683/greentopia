// 입찰 제도 설정 (민간 공사이므로 국가계약법 강제 적용 대상 아님 — 공공조달 원리를 설계에 차용)
export const BIDDING_DEFAULTS = {
  tenderDays: 10, // 공고 기간
  priceCapMargin: 0.1, // 공고 상한 = 공동발주 예상 범위 상단 × (1 + 이 비율)
  reannounceExtraDays: 7,
  minBidders: 2, // 이 미만이면 유찰
  maxRoundsBeforeNegotiation: 2, // 재공고까지 유찰되면 수의계약 전환 가능
  // 입찰 방식 추천 규칙
  hardTrades: ["EXT_INSULATION"], // 고난도 공종 → 제한경쟁 후보
  largeClusterAmount: 300_000_000, // 이 금액 이상 대형 Cluster → 제한경쟁 / 전체 항목 평가
  restrictedMinQualified: 4, // 권역 내 자격 업체가 이 수 이상일 때만 제한경쟁
  nominatedMaxQualified: 2, // 자격 업체가 이 수 이하면 유찰 위험 → 지명경쟁
  nominatedCount: 3,
  nominatedGrades: ["GREEN_PARTNER", "EXCELLENT"],
  riskyBuildingAge: 45, // 이 연식 이상 건물이
  riskyBuildingShare: 0.5, // 이 비율 이상이면 하자 위험이 큰 Cluster → 지명경쟁 고려
  restrictedConditions: { minPlatformOrExternalProjects: 10, regionOnly: true, minTechStaff: 3 },
  // 종합평가 배점 (대형)
  weights: { price: 50, record: 20, duration: 10, warranty: 10, reputation: 10 },
  // 소형 Cluster 간이 평가 배점
  simpleWeights: { price: 70, record: 0, duration: 0, warranty: 15, reputation: 15 },
  // 덤핑 방지: 균형가격(상·하위 절사 평균) 대비 이 비율 이상 낮으면 감점 + 사유서
  dumpingThreshold: 0.15,
  dumpingPenaltyRate: 0.3, // 가격 점수의 30% 감점
  trimRatio: 0.2, // 균형가격 계산 시 상·하위 절사 비율
  recordFullAt: 30, // 실적 건수 이 이상이면 만점
  siteVisitCostPolicy: "PLATFORM" as "PLATFORM" | "WINNER", // 현장확인(실측) 비용: 플랫폼 부담 | 낙찰업체 정산
  // 물량 구간: 현재 참여 동수 N 기준 [ceil(N*upperShare) ~ N+extra], [minClusterSize ~ 그 아래]
  tierUpperShare: 0.75,
  tierExtra: 3,
  // 공고에 표시하는 공통 GR 성능조건 (운영자가 실제 기준으로 수정)
  performanceSpecs: {
    WINDOW: "에너지소비효율 1등급 창호 또는 동등 이상, 기밀·결로 방지 시공",
    EXT_INSULATION: "건축물 에너지절약설계기준 지역별 외벽 열관류율 이상 단열 성능, 준불연 이상 단열재",
    INT_INSULATION: "결로 방지층 포함, 외기 접벽 단열 보강",
    BOILER: "친환경 콘덴싱 보일러 (에너지효율 1등급)",
    ROOF: "지붕 열관류율 지역 기준 이상 단열 성능, 방수층 보강",
  } as Record<string, string>,
  negotiatedShareAlert: 0.3, // 업체 수주 중 수의계약 비중 경고선
  collusion: { minSharedTenders: 3, closePriceGap: 0.01 },
};
export type BiddingSettings = typeof BIDDING_DEFAULTS;
