// 사진 진단 · 성공 가이드 설정값 (F4·F5).
// ⚠️ 단열 기준 수치는 "가정치"다. 「건축물의 에너지절약설계기준」(국토교통부 고시) 연도별 개정 원문과
//    지역 구분(대구 = 남부지역 가정)을 운영자가 확인해 고친다. 화면에는 "가정 기반 · 원문 확인 필요"로 표시한다.

export const INSULATION_STANDARDS = {
  sourceNote: "건축물의 에너지절약설계기준(국토교통부 고시) 연도별 개정 — 대략값(가정치), 원문 확인 필요",
  region: "남부지역 가정",
  unit: "W/㎡·K (열관류율, 낮을수록 단열이 좋아요)",
  // until: 해당 시기 마지막 사용승인연도
  eras: [
    { until: 1979, label: "1980년 이전", wall: null, window: null, note: "단열 기준이 거의 없던 시기" },
    { until: 1987, label: "1980~1987년", wall: 1.05, window: null },
    { until: 2000, label: "1988~2000년", wall: 0.76, window: 3.8 },
    { until: 2010, label: "2001~2010년", wall: 0.58, window: 3.3 },
    { until: 2015, label: "2011~2015년", wall: 0.35, window: 2.1 },
    { until: 9999, label: "2016년 이후", wall: 0.26, window: 1.6 },
  ] as { until: number; label: string; wall: number | null; window: number | null; note?: string }[],
  current: { label: "현행 기준", wall: 0.22, window: 1.5 },
};

// 촬영 부위 → 관련 공사
export const PART_TRADES: Record<string, string[]> = {
  WINDOW: ["WINDOW"],
  WALL: ["EXT_INSULATION", "INT_INSULATION"],
  CEILING: ["INT_INSULATION", "ROOF"],
  ROOF: ["ROOF"],
  BOILER: ["BOILER"],
  OTHER: [],
};

// 사용자 메모 키워드 → 심각도 가중 (규칙 기반 판정용)
export const NOTE_KEYWORDS: { re: RegExp; label: string; weight: number }[] = [
  { re: /곰팡이|검은\s*얼룩/, label: "곰팡이", weight: 2 },
  { re: /결로|물방울|이슬/, label: "결로", weight: 2 },
  { re: /누수|물\s*샘|물이\s*새|빗물/, label: "누수", weight: 3 },
  { re: /균열|금|크랙|갈라/, label: "균열", weight: 2 },
  { re: /외풍|바람|틈/, label: "외풍", weight: 1 },
  { re: /녹|부식/, label: "부식", weight: 1 },
  { re: /소음|안\s*켜|고장|점화/, label: "작동 이상", weight: 2 },
];

// 같은 규격으로 묶어 시공하기 좋은 공사 (공동시공 가능 규격 안내)
export const JOINT_FRIENDLY: Record<string, string> = {
  WINDOW: "PVC 이중창 표준 규격으로 묶기 좋아요",
  EXT_INSULATION: "비계·자재를 함께 쓰면 고정비를 나눌 수 있어요",
  BOILER: "같은 모델로 일괄 발주하기 좋아요",
  ROOF: "같은 시기 자재 반입으로 묶을 수 있어요",
};

// 성공 가이드: "전문가 확인 필요"로 강제 표시할 위험 키워드
export const EXPERT_CHECK_RE = /전기|분전반|배선|가스|배관|보일러\s*(연통|배기)|배기|비계|고소|추락|석면|슬레이트|구조\s*보강|철거\s*안전|용접|화재/;

export const GUIDE_STRATEGIES = [
  { code: "COST", label: "비용 절감형", desc: "꼭 필요한 공사부터, 지원사업·공동시공으로 비용을 줄여요" },
  { code: "PERFORMANCE", label: "성능 극대화형", desc: "단열·창호·설비를 한 번에 올려 효과를 최대로" },
  { code: "PHASED", label: "단계적 시공형", desc: "몇 해에 나눠 순서대로, 다음 공사와 겹치지 않게" },
] as const;
export type GuideStrategy = (typeof GUIDE_STRATEGIES)[number]["code"];

export const MAX_PHOTOS = 4; // 한 번에 올리는 진단 사진 수
export const PHOTO_MAX_EDGE = 1600; // 업로드 전 브라우저에서 줄이는 긴 변(px)
