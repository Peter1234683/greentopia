// 지원사업 요건 대조·예시 계산 설정값 (규칙 기반. 실제 요건·비율은 매년 공고로 확인해 수정)
export const SUPPORT_DEFAULTS = {
  interestSupport: {
    name: "그린리모델링 이자지원",
    approvalBefore: "2016-01-01", // 사용승인일이 이 날짜 이전인 건물 (예시 요건)
    eligibleUsages: ["DETACHED", "MULTI_HOUSEHOLD", "MULTIPLEX"],
    requiresEnergyImprovement: true, // 에너지 성능 개선 공사(창호·단열 등) 포함
    // 아래는 화면의 "예시 계산"용 가정치
    exampleLoanRatePct: 5.0,
    exampleSupportRatePct: 3.0,
    exampleTermYears: 5,
    exampleLoanShare: 1.0, // 공사비 중 대출 비율
    infoUrl: "https://www.greenremodeling.or.kr",
  },
  consulting: {
    name: "무료 그린리모델링 컨설팅",
    minAgeYears: 15,
    infoUrl: "https://www.greenremodeling.or.kr",
  },
};
export type SupportSettings = typeof SUPPORT_DEFAULTS;
