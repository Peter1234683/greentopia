// 지원금 화면 설정 (F1). 지원 요건·금리·한도의 정본은 지원금 DB(SubsidyProgram)이고,
// 여기에는 화면 표시와 계산기 가정치만 둔다. (관리자 설정 화면의 "지원금" 섹션에서 수정)
export const SUBSIDY_DEFAULTS = {
  staleAfterDays: 180, // 확인일이 이보다 오래되면 "정보 확인 필요" 배지
  calculator: { loanRatePct: 5.0, termYears: 5 }, // 시중 대출금리·기간 가정치
};
export type SubsidySettings = typeof SUBSIDY_DEFAULTS;
