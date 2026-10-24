import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStatuses, delayPenalty, splitAmounts, type PayContext } from "../src/lib/payments";
import { applyAi, buildChecklist, crossCheck, manualInspection, passRate } from "../src/lib/inspection";
import { CONTRACT_DEFAULTS } from "../src/config/contract";

const L = { DEPOSIT: "LOCKED", INTERIM: "LOCKED", COMPLETION: "LOCKED", RETENTION: "LOCKED" } as const;
const ctx = (o: Partial<PayContext> = {}): PayContext => ({ signed: true, materialsDelivered: false, inspectionApproved: false, openAS: false, releaseAt: null, now: new Date(2026, 5, 1), ...o });

test("지급 상태 머신: 앞 단계 지급 처리 + 조건 충족 시에만 다음 단계 열림", () => {
  assert.deepEqual(computeStatuses({ ...L }, ctx({ signed: false })), L);
  const a = computeStatuses({ ...L }, ctx({ materialsDelivered: true }));
  assert.equal(a.DEPOSIT, "READY");
  assert.equal(a.INTERIM, "LOCKED", "착공금 승인 전에는 중도금이 열리지 않음");
  const b = computeStatuses({ ...L, DEPOSIT: "RELEASED" }, ctx({ materialsDelivered: true }));
  assert.equal(b.INTERIM, "READY");
  const c = computeStatuses({ ...L, DEPOSIT: "RELEASED", INTERIM: "RELEASED" }, ctx({ inspectionApproved: true, releaseAt: new Date(2026, 8, 1) }));
  assert.equal(c.COMPLETION, "READY");
  const d = computeStatuses({ DEPOSIT: "RELEASED", INTERIM: "RELEASED", COMPLETION: "RELEASED", RETENTION: "LOCKED" }, ctx({ inspectionApproved: true, releaseAt: new Date(2026, 4, 1) }));
  assert.equal(d.RETENTION, "READY");
  const e = computeStatuses({ DEPOSIT: "RELEASED", INTERIM: "RELEASED", COMPLETION: "RELEASED", RETENTION: "LOCKED" }, ctx({ inspectionApproved: true, releaseAt: new Date(2026, 4, 1), openAS: true }));
  assert.equal(e.RETENTION, "LOCKED", "처리 안 된 A/S 가 있으면 유보금 보류");
});

test("금액 분할 30/40/25/5 합계 일치 · 지체상금 상한", () => {
  const parts = splitAmounts(23_456_789, CONTRACT_DEFAULTS.stages);
  assert.equal(parts.reduce((a, b) => a + b, 0), 23_456_789);
  assert.equal(parts[0], 7_037_000);
  assert.equal(delayPenalty(20_000_000, 10, CONTRACT_DEFAULTS.delayPenalty).amount, 100_000);
  const big = delayPenalty(20_000_000, 1000, CONTRACT_DEFAULTS.delayPenalty);
  assert.ok(big.capped && big.amount === 2_000_000);
});

test("준공 검측: 규격 항목 자동 생성 · 수동 모드 · 통과율 · 교차 검증", () => {
  const items = buildChecklist("WINDOW", ["PVC 이중창 (일반)"], CONTRACT_DEFAULTS.checklist);
  assert.equal(items[0].spec, "PVC 이중창 (일반)");
  assert.equal(items.length, 1 + CONTRACT_DEFAULTS.checklist.WINDOW.length);
  const manual = applyAi(items, manualInspection(items));
  assert.equal(passRate(manual), null);
  const judged = manual.map((x, i) => ({ ...x, ownerCheck: i === 0 ? ("X" as const) : ("O" as const) }));
  assert.equal(passRate(judged), 0.8);
  assert.equal(crossCheck(0.5, [1, 0.9, 1], 0.25).flagged, true);
  assert.equal(crossCheck(0.9, [1, 0.9, 1], 0.25).flagged, false);
  assert.equal(crossCheck(0.1, [1], 0.25).flagged, false, "비교 세대가 1곳이면 판단하지 않음");
});
