import * as C from "@/config/diagnosis";
import { TRADES } from "@/lib/constants";
import type { Bills, BuildingForDiagnosis, DiagnosisResult, MeasureResult, Range } from "./types";

// 순수 계산 함수 모음 (DB·네트워크 없음) — 테스트와 Peer 계산에서 재사용

export function ageBandIndex(approvalDate: Date | null) {
  if (!approvalDate) return C.UNKNOWN_AGE_BAND_INDEX;
  const y = approvalDate.getFullYear();
  return C.AGE_BANDS.findIndex((b) => y <= b.until);
}

export function gradeOf(intensity: number) {
  const g = C.GRADE_BANDS.find((b) => intensity < b.max)!;
  return { grade: g.grade, label: g.label };
}

const round = (n: number, step = 1) => Math.round(n / step) * step;
const range = (mid: number, spread: number): Range => ({ low: mid * (1 - spread), mid, high: mid * (1 + spread) });
const scale = (r: Range, k: number): Range => ({ low: r.low * k, mid: r.mid * k, high: r.high * k });

// 모델 기반 단위면적당 소요량 (+ 고지서가 있으면 보정)
export function estimateIntensity(b: BuildingForDiagnosis, bills?: Bills | null) {
  const band = C.AGE_BANDS[ageBandIndex(b.approvalDate)];
  const model = band.baseIntensity * (C.STRUCTURE_FACTOR[b.structure] ?? 1) * (C.USAGE_FACTOR[b.usage] ?? 1);

  let fromBills: number | null = null;
  if (bills?.gas || bills?.electric) {
    const heatKwh = ((bills.gas ?? 0) * C.GAS_ANNUAL_MONTH_EQUIV) / C.GAS_WON_PER_KWH;
    const coolKwh = ((bills.electric ?? 0) * 12 * C.ELECTRIC_COOLING_SHARE) / C.ELECTRIC_WON_PER_KWH;
    const unitArea = b.grossArea / Math.max(1, b.households);
    const perM2 = (heatKwh + coolKwh) / unitArea;
    // 고지서가 한쪽만 있거나 비현실적이면 모델을 더 믿는다
    if (perM2 > 20 && perM2 < 600) fromBills = perM2;
  }
  const mid = fromBills == null ? model : model * (1 - C.BILL_WEIGHT) + fromBills * C.BILL_WEIGHT;
  return { mid, model, fromBills, band };
}

export function measuresFor(b: BuildingForDiagnosis, annualKwhMid: number) {
  const band = C.AGE_BANDS[ageBandIndex(b.approvalDate)];
  return TRADES.map((trade): MeasureResult => {
    const base = C.MEASURE_SAVINGS[trade];
    const k = band.savingFactor * (trade === "ROOF" && b.usage === "DETACHED" ? C.ROOF_DETACHED_BONUS : 1);
    const pct = { low: Math.min(base.low * k, 0.6), high: Math.min(base.high * k, 0.6) };
    return toMeasure(trade, pct, annualKwhMid);
  });
}

export function toMeasure(trade: string, pct: { low: number; high: number }, annualKwhMid: number): MeasureResult {
  const kwh = { low: round(annualKwhMid * pct.low, 10), high: round(annualKwhMid * pct.high, 10) };
  return { trade, pct, kwh, won: { low: round(kwh.low * C.ENERGY_WON_PER_KWH, 1000), high: round(kwh.high * C.ENERGY_WON_PER_KWH, 1000) } };
}

// 여러 공종을 함께 하면 효과가 단순 합보다 작다: 1 - Π(1 - s)
export function combine(measures: MeasureResult[], trades: string[], annualKwhMid: number) {
  const chosen = measures.filter((m) => trades.includes(m.trade));
  if (chosen.length === 0) return null;
  const f = (k: "low" | "high") => Math.min(1 - chosen.reduce((p, m) => p * (1 - m.pct[k]), 1), C.COMBINED_CAP);
  return { ...toMeasure("COMBINED", { low: f("low"), high: f("high") }, annualKwhMid), trades: chosen.map((m) => m.trade) };
}

export function preciseRecommendation(b: BuildingForDiagnosis, grade: string, trades: string[]) {
  const reasons: string[] = [];
  const age = b.approvalDate ? new Date().getFullYear() - b.approvalDate.getFullYear() : null;
  if (age != null && age >= C.PRECISE_RULES.minAgeYears) reasons.push(`지은 지 ${age}년이 넘은 건물이에요.`);
  if (C.PRECISE_RULES.grades.includes(grade)) reasons.push(`간이 등급이 ${grade}로 개선 여지가 커요.`);
  if (trades.length >= C.PRECISE_RULES.minTrades) reasons.push(`필요한 공사가 ${trades.length}가지로 여러 공종을 함께 검토해야 해요.`);
  if (b.households >= C.PRECISE_RULES.minHouseholds) reasons.push(`${b.households}세대가 사는 건물이라 세대별 상황이 달라요.`);
  return { recommended: reasons.length > 0, reasons };
}

export function finalize(partial: Omit<DiagnosisResult, "annualKwh" | "annualCostWon" | "grade" | "version"> & { version?: string }): DiagnosisResult {
  const annualKwh = scale(partial.intensity, partial.grossArea);
  return {
    ...partial,
    version: partial.version ?? C.DIAGNOSIS_VERSION,
    annualKwh: { low: round(annualKwh.low, 10), mid: round(annualKwh.mid, 10), high: round(annualKwh.high, 10) },
    annualCostWon: {
      low: round(annualKwh.low * C.ENERGY_WON_PER_KWH, 10000),
      mid: round(annualKwh.mid * C.ENERGY_WON_PER_KWH, 10000),
      high: round(annualKwh.high * C.ENERGY_WON_PER_KWH, 10000),
    },
    grade: gradeOf(partial.intensity.mid),
  };
}

// ── 간이 진단 (규칙 기반) ──
export function diagnoseSimple(
  b: BuildingForDiagnosis,
  bills: Bills | null,
  demandTrades: string[],
  peer: DiagnosisResult["peer"],
): DiagnosisResult {
  const est = estimateIntensity(b, bills);
  const spread = est.fromBills == null ? C.RANGE_WITHOUT_BILLS : C.RANGE_WITH_BILLS;
  const intensity = range(est.mid, spread);
  intensity.low = round(intensity.low);
  intensity.mid = round(intensity.mid);
  intensity.high = round(intensity.high);
  const annualMid = est.mid * b.grossArea;
  const measures = measuresFor(b, annualMid);
  const comboTrades = demandTrades.length ? demandTrades : [...TRADES];
  const grade = gradeOf(intensity.mid).grade;

  const notes = [
    `사용승인연도(${est.band.label})·구조·집 유형으로 추정한 간이 결과예요. 실제 소요량과 다를 수 있어요.`,
    est.fromBills != null
      ? "입력하신 전기·가스 요금을 반영해 범위를 좁혔어요."
      : "전기·가스 요금을 입력하면 더 정확해져요.",
    `절감액은 1kWh당 ${C.ENERGY_WON_PER_KWH}원으로 환산한 가정치예요.`,
    "등급은 그린토피아 간이 구간이며 공식 건축물 에너지효율등급이 아니에요.",
  ];

  return finalize({
    mode: "SIMPLE",
    grossArea: b.grossArea,
    intensity,
    peer,
    measures,
    combined: combine(measures, comboTrades, annualMid),
    precise: preciseRecommendation(b, grade, demandTrades),
    calibratedWithBills: est.fromBills != null,
    notes,
  });
}

// ── GR-AI 결과 직접 입력 ──
export type GraiInput = { baselineKwh: number; scenarios: Partial<Record<string, number>> };

export function diagnoseFromGrai(b: BuildingForDiagnosis, input: GraiInput, demandTrades: string[], peer: DiagnosisResult["peer"]): DiagnosisResult {
  const mid = input.baselineKwh / b.grossArea;
  const measures: MeasureResult[] = [];
  for (const trade of TRADES) {
    const s = input.scenarios[trade];
    if (s == null) continue;
    const p = Math.max(0, 1 - s / input.baselineKwh);
    measures.push(toMeasure(trade, { low: p, high: p }, input.baselineKwh));
  }
  const combinedKwh = input.scenarios.COMBINED;
  const combined =
    combinedKwh != null
      ? (() => {
          const p = Math.max(0, 1 - combinedKwh / input.baselineKwh);
          return { ...toMeasure("COMBINED", { low: p, high: p }, input.baselineKwh), trades: measures.map((m) => m.trade) };
        })()
      : null;
  const grade = gradeOf(mid).grade;
  return finalize({
    mode: "GRAI_LINK",
    grossArea: b.grossArea,
    intensity: { low: round(mid), mid: round(mid), high: round(mid) },
    peer,
    measures,
    combined,
    precise: preciseRecommendation(b, grade, demandTrades),
    calibratedWithBills: false,
    notes: ["GR-AI 시뮬레이션 결과를 직접 입력하신 값이에요.", `절감액은 1kWh당 ${C.ENERGY_WON_PER_KWH}원으로 환산한 가정치예요.`],
  });
}
