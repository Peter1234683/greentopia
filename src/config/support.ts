// 지원사업 요건 대조·예시 계산 설정값 (규칙 기반. 실제 요건·비율은 매년 공고로 확인해 수정)
export const SUPPORT_DEFAULTS = {
  // 지원 요건·혜택의 정본은 지원금 DB(SubsidyProgram)다. 아래는 DB 가 비었을 때의 예시 계산용 값.
  interestSupport: {
    name: "그린리모델링 이자지원",
    approvalBefore: "2100-01-01", // 2026 공고 기준 사용승인일 요건 미확인 → 제한하지 않음
    eligibleUsages: ["DETACHED", "MULTI_HOUSEHOLD", "MULTIPLEX"],
    requiresEnergyImprovement: true, // 에너지 성능 개선 공사(창호·단열 등) 포함
    // 예시 계산 가정치: 시중 대출금리(가정)와 2026 일반 이자 지원율(4.5%)
    exampleLoanRatePct: 5.0,
    exampleSupportRatePct: 4.5,
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

// 지원금 화면 설정 (F1)
export const SUBSIDY_DEFAULTS = {
  staleAfterDays: 180, // 확인일이 이보다 오래되면 "정보 확인 필요" 배지
  calculator: { loanRatePct: 5.0, termYears: 5 }, // 계산기 기본 가정치 (시중 대출금리는 가정)
};
