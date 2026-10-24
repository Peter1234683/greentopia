// 건물 등록·공사 수요 입력에 쓰는 설정값. (관리자 설정 화면은 마일스톤 9)

// 연면적 대비 창호 면적 비율 — 창호 물량을 처음 추정할 때만 쓰는 가정치. 사용자가 수정할 수 있다.
export const WINDOW_AREA_RATIO = 0.15;

// 현재 서비스 지역 (시드·mock 어댑터가 대구만 다룬다)
export const SUPPORTED_SIDO = ["대구광역시"];

// 희망 공사 시작 시기: 다음 달부터 몇 개월 뒤까지 고를 수 있는지
export const DESIRED_START_MONTHS = 12;

// 예상 예산 선택지 (원). max 가 null 이면 상한 없음
export const BUDGET_OPTIONS = [
  { code: "U500", label: "500만 원 이하", min: 0, max: 5_000_000 },
  { code: "500_1000", label: "500만 ~ 1,000만 원", min: 5_000_000, max: 10_000_000 },
  { code: "1000_2000", label: "1,000만 ~ 2,000만 원", min: 10_000_000, max: 20_000_000 },
  { code: "2000_3000", label: "2,000만 ~ 3,000만 원", min: 20_000_000, max: 30_000_000 },
  { code: "O3000", label: "3,000만 원 이상", min: 30_000_000, max: null },
  { code: "UNKNOWN", label: "아직 잘 모르겠어요", min: null, max: null },
] as const;
