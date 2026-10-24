// 지원금 자격 매칭 (규칙 기반, AI 없이 동작) — 순수 함수
import { BENEFICIARY_TYPES, TRADE_LABEL, USAGE_LABEL, type Trade } from "@/lib/constants";
import type { Benefit, Conditions } from "./schema";

export type MatchStatus = "ELIGIBLE" | "CHECK" | "INELIGIBLE";
export type Reason = { label: string; state: "ok" | "check" | "no" };

export type MatchInput = {
  sido: string;
  sigungu: string;
  usage: string;
  approvalDate: Date | null;
  trades: string[];
  improvementPct: { low: number; high: number } | null; // 진단 결과 기반 예상 성능개선률 (%)
  beneficiaryTypes: string[];
};
export type ProgramLike = { region: string; targetBuildingTypes: string[]; conditions: Conditions; benefit: Benefit };

const ENERGY_TRADES = ["WINDOW", "EXT_INSULATION", "INT_INSULATION", "BOILER", "ROOF"];
const pct = (n: number) => `${Math.round(n)}%`;
const bLabel = (c: string) => BENEFICIARY_TYPES.find((b) => b.code === c)?.label ?? c;

export function matchProgram(p: ProgramLike, m: MatchInput) {
  const reasons: Reason[] = [];
  const c = p.conditions;

  // 지역
  if (p.region === "전국") reasons.push({ label: "전국 대상 사업", state: "ok" });
  else {
    const ok = p.region === m.sido || p.region === `${m.sido} ${m.sigungu}` || p.region.endsWith(m.sigungu);
    reasons.push({ label: `지역: ${p.region}`, state: ok ? "ok" : "no" });
  }
  // 집 유형
  if (p.targetBuildingTypes.length)
    reasons.push({
      label: `대상 건물: ${p.targetBuildingTypes.map((t) => USAGE_LABEL[t] ?? t).join("·")}`,
      state: p.targetBuildingTypes.includes(m.usage) ? "ok" : "no",
    });
  // 사용승인일
  if (c.approvalBefore) {
    const before = new Date(`${c.approvalBefore}T00:00:00+09:00`);
    reasons.push({
      label: `사용승인일 ${c.approvalBefore.replace(/-/g, ".")} 이전`,
      state: !m.approvalDate ? "check" : m.approvalDate < before ? "ok" : "no",
    });
  }
  if (c.minAgeYears) {
    const age = m.approvalDate ? new Date().getFullYear() - m.approvalDate.getFullYear() : null;
    reasons.push({ label: `지은 지 ${c.minAgeYears}년 이상`, state: age == null ? "check" : age >= c.minAgeYears ? "ok" : "no" });
  }
  // 공사 종류
  if (c.requiresEnergyWork) {
    const has = m.trades.some((t) => ENERGY_TRADES.includes(t));
    reasons.push({
      label: has ? `에너지 성능 공사 포함 (${m.trades.map((t) => TRADE_LABEL[t as Trade] ?? t).join("·")})` : "에너지 성능 공사(창호·단열·보일러 등) 필요",
      state: has ? "ok" : m.trades.length ? "no" : "check",
    });
  }
  // 성능개선률
  if (c.minImprovementPct != null) {
    const ip = m.improvementPct;
    if (!ip) reasons.push({ label: `에너지 성능개선률 ${c.minImprovementPct}% 이상 (진단을 받으면 예상치를 알 수 있어요)`, state: "check" });
    else if (ip.low >= c.minImprovementPct) reasons.push({ label: `예상 성능개선률 ${pct(ip.low)}~${pct(ip.high)} ≥ ${c.minImprovementPct}%`, state: "ok" });
    else if (ip.high >= c.minImprovementPct)
      reasons.push({ label: `예상 성능개선률 ${pct(ip.low)}~${pct(ip.high)} — 기준 ${c.minImprovementPct}% 경계 (정밀 평가 필요)`, state: "check" });
    else reasons.push({ label: `예상 성능개선률 ${pct(ip.high)} 이하 — 기준 ${c.minImprovementPct}% 미달 (공사 범위를 넓히면 달라질 수 있어요)`, state: "no" });
  }

  const status: MatchStatus = reasons.some((r) => r.state === "no") ? "INELIGIBLE" : reasons.some((r) => r.state === "check") ? "CHECK" : "ELIGIBLE";

  // 우대 여부
  const prefReasons: string[] = [];
  if (c.preferentialImprovementPct != null && m.improvementPct && m.improvementPct.low >= c.preferentialImprovementPct)
    prefReasons.push(`성능개선률 ${c.preferentialImprovementPct}% 이상`);
  const prefBen = (c.preferentialBeneficiaries ?? []).filter((b) => m.beneficiaryTypes.includes(b));
  if (prefBen.length) prefReasons.push(prefBen.map(bLabel).join("·"));
  const preferential = prefReasons.length > 0;

  const b = p.benefit;
  const rate = b.interestSupportPct ? (preferential && b.interestSupportPct.preferential != null ? b.interestSupportPct.preferential : b.interestSupportPct.general) : null;
  const loanLimit = b.loanLimit?.[m.usage] ?? null;
  return { status, reasons, preferential, prefReasons, rate, loanLimit, maxRepayYears: b.maxRepayYears ?? null };
}

// 진단 결과의 통합 절감률(0~1) → 성능개선률(%) 범위
export function improvementFromDiagnosis(combined: { pct: { low: number; high: number } } | null | undefined) {
  if (!combined) return null;
  return { low: combined.pct.low * 100, high: combined.pct.high * 100 };
}
