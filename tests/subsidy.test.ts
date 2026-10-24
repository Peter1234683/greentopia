import { test } from "node:test";
import assert from "node:assert/strict";
import { matchProgram, type MatchInput } from "../src/lib/subsidy/match";
import { loanCalc, monthlyPayment } from "../src/lib/subsidy/calc";
import { ruleAnswer, sourcesFooter, DISCLAIMER } from "../src/lib/subsidy/advisor";
import { conditionsSchema } from "../src/lib/subsidy/schema";

const program = {
  region: "전국",
  targetBuildingTypes: ["DETACHED", "MULTI_HOUSEHOLD", "MULTIPLEX"],
  conditions: { minImprovementPct: 20, preferentialImprovementPct: 30, preferentialBeneficiaries: ["NEWLYWED"], requiresEnergyWork: true },
  benefit: { interestSupportPct: { general: 4.5, preferential: 5.5 }, loanLimit: { MULTIPLEX: 30_000_000, DETACHED: 100_000_000 }, maxRepayYears: 5 },
};
const base: MatchInput = { sido: "대구광역시", sigungu: "남구", usage: "MULTIPLEX", approvalDate: new Date(1994, 0, 1), trades: ["WINDOW"], improvementPct: { low: 22, high: 34 }, beneficiaryTypes: [] };

test("지원금 매칭: 요건 충족 · 경계 · 미달 · 진단 전", () => {
  assert.equal(matchProgram(program, base).status, "ELIGIBLE");
  assert.equal(matchProgram(program, { ...base, improvementPct: { low: 15, high: 25 } }).status, "CHECK");
  assert.equal(matchProgram(program, { ...base, improvementPct: { low: 8, high: 15 } }).status, "INELIGIBLE");
  assert.equal(matchProgram(program, { ...base, improvementPct: null }).status, "CHECK");
  assert.equal(matchProgram(program, { ...base, trades: [] }).status, "CHECK");
  assert.equal(matchProgram({ ...program, region: "대구광역시 수성구" }, base).status, "INELIGIBLE");
});

test("지원금 매칭: 우대 조건과 집 유형별 한도", () => {
  const general = matchProgram(program, base);
  assert.equal(general.rate, 4.5);
  assert.equal(general.loanLimit, 30_000_000);
  const pref = matchProgram(program, { ...base, beneficiaryTypes: ["NEWLYWED"] });
  assert.equal(pref.rate, 5.5);
  assert.ok(pref.preferential);
  assert.equal(matchProgram(program, { ...base, improvementPct: { low: 31, high: 40 } }).rate, 5.5);
  assert.equal(matchProgram(program, { ...base, usage: "DETACHED" }).loanLimit, 100_000_000);
});

test("계산기: 원리금균등 · 한도 · 지원 후 금리", () => {
  assert.equal(Math.round(monthlyPayment(12_000_000, 0, 1)), 1_000_000);
  const r = loanCalc({ cost: 40_000_000, loanLimit: 30_000_000, loanRatePct: 5, supportRatePct: 4.5, years: 5 });
  assert.equal(r.principal, 30_000_000);
  assert.equal(r.selfFunded, 10_000_000);
  assert.equal(r.effectiveRatePct, 0.5);
  assert.ok(r.interestSaved > 3_000_000 && r.interestSaved < 4_000_000);
  assert.equal(loanCalc({ cost: 1e7, loanLimit: null, loanRatePct: 3, supportRatePct: 5, years: 3 }).effectiveRatePct, 0);
});

test("상담 템플릿: 등록된 정보만, 항상 면책 문구와 출처", () => {
  const view = { id: "p", name: "이자지원", provider: "", region: "전국", targetBuildingTypes: [], conditions: program.conditions, benefit: program.benefit, summary: "", applySteps: ["신청", "심사"], applyPeriod: null, applyUrl: null, sourceUrl: "https://example.com/src", sourceNote: null, verifiedAt: null, status: "ACTIVE", badge: null };
  const items = [{ program: view, match: matchProgram(program, base) }];
  assert.match(ruleAnswer("대출 한도는?", items as never, base), /3,000만 원/);
  assert.match(ruleAnswer("중복으로 받을 수 있나요", items as never, base), /공고문에 정해져/);
  assert.match(ruleAnswer("신청 순서", items as never, base), /1\. 신청/);
  const f = sourcesFooter(items as never);
  assert.ok(f.includes(DISCLAIMER) && f.includes("https://example.com/src") && f.includes("공고문 확인 필요"));
});

test("요건 스키마는 모르는 키를 거부", () => {
  assert.equal(conditionsSchema.safeParse({ minImprovementPct: 20 }).success, true);
  assert.equal(conditionsSchema.safeParse({ tenPercentBonus: true }).success, false);
});
