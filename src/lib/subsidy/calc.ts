// 지원금 계산기 — 원리금균등 상환 기준 (순수 함수)
export type LoanCalcInput = { cost: number; loanLimit: number | null; loanRatePct: number; supportRatePct: number; years: number };

export function monthlyPayment(principal: number, annualRatePct: number, years: number) {
  const n = years * 12;
  const r = annualRatePct / 100 / 12;
  if (principal <= 0 || n <= 0) return 0;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

const r100 = (n: number) => Math.round(n / 100) * 100;

export function loanCalc(i: LoanCalcInput) {
  const principal = Math.max(0, Math.min(i.cost, i.loanLimit ?? i.cost));
  const effective = Math.max(0, i.loanRatePct - i.supportRatePct); // 지원 후 실제 부담 금리
  const n = i.years * 12;
  const mBase = monthlyPayment(principal, i.loanRatePct, i.years);
  const mSupported = monthlyPayment(principal, effective, i.years);
  const interestBase = mBase * n - principal;
  const interestSupported = mSupported * n - principal;
  return {
    principal: r100(principal),
    selfFunded: r100(i.cost - principal), // 대출 외 자기자금
    effectiveRatePct: Math.round(effective * 100) / 100,
    monthlyBase: r100(mBase),
    monthlySupported: r100(mSupported),
    interestBase: r100(interestBase),
    interestSupported: r100(interestSupported),
    interestSaved: r100(interestBase - interestSupported),
    totalBurdenBase: r100(i.cost + interestBase),
    totalBurdenSupported: r100(i.cost + interestSupported),
  };
}
