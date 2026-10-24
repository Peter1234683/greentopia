// 간이 에너지 진단 설정값.
// ⚠️ 모든 수치는 "가정치"다. 실제 진단·인증 기준이 아니며, 운영자가 근거 자료를 확인해 수정한다. (관리자 설정 화면: 마일스톤 9)
// 결과는 반드시 "간이 추정"으로, 단일 값이 아니라 범위로 보여준다.

export const DIAGNOSIS_VERSION = "simple-v1";

// 사용승인연도 구간별 기준 냉난방 에너지 소요량 (kWh/㎡·년, 가정치)
// 단열 기준이 강화된 시기를 대략 반영한 구간 — 운영자 검토 필요
export const AGE_BANDS = [
  { label: "1980년 이전", until: 1979, baseIntensity: 270, savingFactor: 1.15 },
  { label: "1980~1987년", until: 1987, baseIntensity: 240, savingFactor: 1.1 },
  { label: "1988~2000년", until: 2000, baseIntensity: 200, savingFactor: 1.0 },
  { label: "2001~2010년", until: 2010, baseIntensity: 165, savingFactor: 0.85 },
  { label: "2011~2015년", until: 2015, baseIntensity: 135, savingFactor: 0.7 },
  { label: "2016년 이후", until: 9999, baseIntensity: 110, savingFactor: 0.55 },
] as const;
export const UNKNOWN_AGE_BAND_INDEX = 2; // 사용승인일을 모를 때 쓰는 구간

// 구조·유형 보정 계수 (가정치)
export const STRUCTURE_FACTOR: Record<string, number> = { BRICK: 1.08, MASONRY: 1.05, RC: 1.0, WOOD: 1.1, STEEL: 1.05, OTHER: 1.0 };
export const USAGE_FACTOR: Record<string, number> = { DETACHED: 1.12, MULTI_HOUSEHOLD: 1.0, MULTIPLEX: 0.95 };

// 고지서 보정: 가스요금 → 연간 난방 에너지 환산 (가정치)
export const GAS_WON_PER_KWH = 90; // 도시가스 1kWh 상당 요금 (원)
export const GAS_ANNUAL_MONTH_EQUIV = 4.5; // "최근 월 가스요금" × 4.5 ≈ 연간 난방용 (겨울 고지서 기준 가정)
// 고지서는 "우리 세대" 기준으로 받는다 → 연면적 ÷ 세대수 면적으로 나눈다 (세대 면적이 같다는 가정)
export const ELECTRIC_COOLING_SHARE = 0.15; // 연간 전기요금 중 냉방 비중
export const ELECTRIC_WON_PER_KWH = 150;
export const BILL_WEIGHT = 0.5; // 모델 추정과 고지서 추정을 섞는 비율

// 추정 범위 폭 (±)
export const RANGE_WITHOUT_BILLS = 0.2;
export const RANGE_WITH_BILLS = 0.12;

// 절감액 환산 단가 (원/kWh, 가스·전기 혼합 가정치)
export const ENERGY_WON_PER_KWH = 95;

// 간이 등급 (그린토피아 자체 구간 — 공식 건축물 에너지효율등급이 아님)
export const GRADE_BANDS = [
  { grade: "A", max: 120, label: "매우 좋음" },
  { grade: "B", max: 160, label: "좋음" },
  { grade: "C", max: 200, label: "보통" },
  { grade: "D", max: 250, label: "개선 필요" },
  { grade: "E", max: Infinity, label: "개선 시급" },
] as const;

// 공종별 개선 시 냉난방 에너지 절감률 범위 (가정치). 연식 구간의 savingFactor 를 곱한다.
export const MEASURE_SAVINGS: Record<string, { low: number; high: number }> = {
  WINDOW: { low: 0.12, high: 0.22 },
  EXT_INSULATION: { low: 0.2, high: 0.3 },
  INT_INSULATION: { low: 0.1, high: 0.18 },
  BOILER: { low: 0.08, high: 0.15 },
  ROOF: { low: 0.05, high: 0.1 },
};
export const ROOF_DETACHED_BONUS = 1.4; // 단독주택은 지붕 면적 비중이 커서 지붕 개선 효과가 큼
export const COMBINED_CAP = 0.55; // 통합 개선 절감률 상한

// 같은 연식·유형 평균 비교: DB에 표본이 이 수보다 적으면 설정 기준값을 쓴다
export const PEER_MIN_SAMPLE = 3;

// 정밀 진단 추천 조건
export const PRECISE_RULES = {
  minAgeYears: 30,
  grades: ["D", "E"],
  minTrades: 3,
  minHouseholds: 5,
};

// 외부 서비스 링크 (운영자가 최신 주소 확인)
export const GRAI_URL = "https://grai.ibed.cloud";
export const GR_CONSULTING_URL = "https://www.greenremodeling.or.kr"; // 무료 GR 컨설팅 신청 안내 — 2026년 공고 페이지 주소 확인 필요
export const GR_CONSULTING_LABEL = "2026 무료 그린리모델링 컨설팅";
