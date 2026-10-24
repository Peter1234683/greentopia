// 물량 산정 · 예상가 계산 (순수 함수, 서버·클라이언트 공용)
import type { PricingSettings } from "@/config/pricing";

export type QuantityBuilding = { grossArea: number; floors: number; households: number; windowArea: number | null };
export type Quantity = { unit: string; amount: number; mix: Record<string, number> };
export type MoneyRange = { low: number; high: number };

const r10k = (n: number) => Math.round(n / 10_000) * 10_000;

export function quantityFor(b: QuantityBuilding, trade: string, p: PricingSettings): Quantity {
  const tp = p.trades[trade];
  let amount: number;
  switch (trade) {
    case "WINDOW":
      amount = b.windowArea ?? Math.round(b.grossArea * 0.15);
      break;
    case "BOILER":
      amount = b.households;
      break;
    case "ROOF":
      amount = Math.round(b.grossArea / Math.max(1, b.floors));
      break;
    default:
      amount = Math.round(b.grossArea * (p.quantityRatio[trade] ?? 1));
  }
  const mix: Record<string, number> = {};
  for (const [type, share] of Object.entries(tp.defaultMix)) mix[type] = +(amount * share).toFixed(1);
  return { unit: tp.unit, amount, mix };
}

// 유형 비율을 반영한 평균 보정계수
export function mixFactor(trade: string, p: PricingSettings, mix?: Record<string, number>) {
  const tp = p.trades[trade];
  const m = mix ?? tp.defaultMix;
  const total = Object.values(m).reduce((s, v) => s + v, 0) || 1;
  return Object.entries(m).reduce((s, [code, v]) => s + (tp.types.find((t) => t.code === code)?.factor ?? 1) * (v / total), 0);
}

export function soloEstimate(b: QuantityBuilding, trade: string, p: PricingSettings): MoneyRange {
  const q = quantityFor(b, trade, p);
  const f = mixFactor(trade, p, q.mix);
  const up = p.trades[trade].unitPrice;
  return { low: r10k(q.amount * up.low * f), high: r10k(q.amount * up.high * f) };
}

export function discountFor(n: number, p: PricingSettings) {
  return p.jointDiscountTiers.find((t) => n >= t.min && n <= t.max) ?? p.jointDiscountTiers[p.jointDiscountTiers.length - 1];
}

export type ActualUnitRange = { trade: string; low: number; high: number; samples: number };

// 공동발주 예상가: 실제 낙찰 데이터가 충분하면 그 범위, 아니면 개별가 × (1 − 할인 가정치)
export function jointEstimate(
  b: QuantityBuilding,
  trade: string,
  n: number,
  p: PricingSettings,
  actual?: ActualUnitRange | null,
): MoneyRange & { basis: "ACTUAL" | "ASSUMPTION" | "SOLO"; samples?: number } {
  const d = discountFor(n, p);
  // 함께할 이웃이 없으면(할인 구간 0) 공동발주가 성립하지 않으므로 개별 발주가를 그대로 쓴다
  if (d.high === 0) return { ...soloEstimate(b, trade, p), basis: "SOLO" };
  if (actual && actual.samples >= p.actualMinSamples) {
    const q = quantityFor(b, trade, p);
    return { low: r10k(q.amount * actual.low), high: r10k(q.amount * actual.high), basis: "ACTUAL", samples: actual.samples };
  }
  const solo = soloEstimate(b, trade, p);
  // 할인 폭이 클수록 낮은 쪽 범위가 내려간다: low 는 큰 할인, high 는 작은 할인
  return { low: r10k(solo.low * (1 - d.high)), high: r10k(solo.high * (1 - d.low)), basis: "ASSUMPTION" };
}

// 이자지원 예시: 원금 균등분할 상환 시 총이자 ≈ P × r × (N+1)/2
export function interestExample(principal: number, loanRatePct: number, supportRatePct: number, years: number) {
  const k = (years + 1) / 2;
  const interest = principal * (loanRatePct / 100) * k;
  const supported = principal * (Math.min(supportRatePct, loanRatePct) / 100) * k;
  return { interest: r10k(interest), supported: r10k(supported), net: r10k(interest - supported) };
}
