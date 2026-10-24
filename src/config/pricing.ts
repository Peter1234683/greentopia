// 공사비 예상 가정치.
// ⚠️ 모든 단가·할인율은 "가정치"다. 실제 가격은 입찰로 확정된다.
// 같은 공종의 실제 낙찰 데이터가 actualMinSamples 건 이상 쌓이면 화면은 가정치 대신 실제 낙찰가 범위를 쓴다.

export type SpecType = { code: string; label: string; factor: number };
export type TradePricing = {
  unit: "㎡" | "대";
  quantityLabel: string; // 물량 산정 기준 설명
  unitPrice: { low: number; high: number }; // 개별 발주 기준 단가 (원/단위)
  types: SpecType[]; // 유형·규격별 보정
  defaultMix: Record<string, number>; // 유형별 기본 비율 (합 1)
};

export const PRICING_DEFAULTS = {
  trades: {
    WINDOW: {
      unit: "㎡",
      quantityLabel: "창호 면적",
      unitPrice: { low: 420_000, high: 540_000 },
      types: [
        { code: "PVC_STD", label: "PVC 이중창 (일반)", factor: 1.0 },
        { code: "PVC_LARGE", label: "PVC 이중창 (대형·거실창)", factor: 1.1 },
        { code: "SYSTEM", label: "시스템 창호", factor: 1.35 },
      ],
      defaultMix: { PVC_STD: 0.7, PVC_LARGE: 0.3 },
    },
    EXT_INSULATION: {
      unit: "㎡",
      quantityLabel: "외벽 면적 (연면적 × 0.9 추정)",
      unitPrice: { low: 140_000, high: 190_000 },
      types: [
        { code: "EPS100", label: "외단열 100mm", factor: 1.0 },
        { code: "EPS150", label: "외단열 150mm", factor: 1.12 },
      ],
      defaultMix: { EPS100: 1 },
    },
    INT_INSULATION: {
      unit: "㎡",
      quantityLabel: "실내 외기 접벽 면적 (연면적 × 0.6 추정)",
      unitPrice: { low: 70_000, high: 100_000 },
      types: [
        { code: "IN50", label: "내단열 50mm", factor: 1.0 },
        { code: "IN80", label: "내단열 80mm", factor: 1.1 },
      ],
      defaultMix: { IN50: 1 },
    },
    BOILER: {
      unit: "대",
      quantityLabel: "세대별 보일러 대수",
      unitPrice: { low: 1_100_000, high: 1_500_000 },
      types: [
        { code: "K20", label: "콘덴싱 20,000kcal", factor: 1.0 },
        { code: "K25", label: "콘덴싱 25,000kcal", factor: 1.08 },
        { code: "K30", label: "콘덴싱 30,000kcal", factor: 1.16 },
      ],
      defaultMix: { K20: 0.6, K25: 0.4 },
    },
    ROOF: {
      unit: "㎡",
      quantityLabel: "지붕 면적 (연면적 ÷ 층수 추정)",
      unitPrice: { low: 80_000, high: 120_000 },
      types: [
        { code: "R100", label: "지붕 단열 100mm", factor: 1.0 },
        { code: "R150", label: "지붕 단열 150mm", factor: 1.15 },
      ],
      defaultMix: { R100: 1 },
    },
  } as Record<string, TradePricing>,
  quantityRatio: { EXT_INSULATION: 0.9, INT_INSULATION: 0.6 } as Record<string, number>,
  // 공동발주 물량 구간별 할인 가정치 (개별 발주 대비)
  jointDiscountTiers: [
    { min: 1, max: 2, low: 0, high: 0 },
    { min: 3, max: 4, low: 0.04, high: 0.08 },
    { min: 5, max: 8, low: 0.08, high: 0.13 },
    { min: 9, max: 99, low: 0.12, high: 0.18 },
  ],
  actualMinSamples: 3,
};
export type PricingSettings = typeof PRICING_DEFAULTS;
