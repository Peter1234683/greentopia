import { test } from "node:test";
import assert from "node:assert/strict";
import { enrichPhotoResult, photoAiSchema, rulePhotoDiagnosis, standardsCompare } from "../src/lib/photo/diagnose";
import { enforceExpertCheck, guideSchema, ruleGuide } from "../src/lib/photo/guide";
import { PRICING_DEFAULTS } from "../src/config/pricing";

const b = { usage: "MULTI_HOUSEHOLD", structure: "BRICK", approvalDate: new Date(1991, 4, 1), grossArea: 240, floors: 3, households: 5, windowArea: null };

test("사진 진단 규칙 결과: 스키마 통과 · 메모 증상 반영 · 비용은 설정 단가로", () => {
  const r = rulePhotoDiagnosis(b, [{ part: "WALL", note: "벽 모서리에 곰팡이와 결로" }, { part: "WINDOW", note: null }], "");
  assert.equal(photoAiSchema.safeParse(r).success, true);
  assert.notEqual(r.defects[0].severity, "LOW");
  assert.match(r.summary, /규칙 기반/);
  const e = enrichPhotoResult({ ...r, recommendations: [...r.recommendations, { trade: "WINDOW", priority: 5, why: "중복" }] }, b, PRICING_DEFAULTS as never);
  assert.equal(new Set(e.recommendations.map((x) => x.trade)).size, e.recommendations.length, "중복 공사 제거");
  for (const x of e.recommendations) assert.ok(x.cost.low > 0 && x.cost.high >= x.cost.low);
});

test("단열 기준 비교: 1991년 → 1988~2000년 구간, 현행보다 몇 배", () => {
  const s = standardsCompare(b)!;
  assert.equal(s.era.label, "1988~2000년");
  assert.ok(s.wallTimes! > 1);
  assert.equal(standardsCompare({ approvalDate: null }), null);
});

test("성공 가이드 규칙 결과: 스키마 통과 · 3단계 · 위험 항목 전문가 확인", () => {
  for (const s of ["COST", "PERFORMANCE", "PHASED"] as const) {
    const g = ruleGuide({ usage: "MULTI_HOUSEHOLD", structure: "BRICK", age: 35, floors: 3, households: 5 }, s, ["WINDOW", "BOILER"]);
    assert.equal(guideSchema.safeParse(g).success, true, s);
    assert.deepEqual(new Set(g.checklist.map((c) => c.phase)), new Set(["BEFORE", "DURING", "AFTER"]));
    assert.ok(g.checklist.find((c) => /석면/.test(c.title))?.expertCheck);
  }
  const g = enforceExpertCheck({ ...ruleGuide({ usage: "DETACHED", structure: "RC", age: 10, floors: 1, households: 1 }, "COST", []), checklist: [{ phase: "DURING", title: "가스 배관 연결 확인", importance: "HIGH", expertCheck: false }] });
  assert.equal(g.checklist[0].expertCheck, true);
});
