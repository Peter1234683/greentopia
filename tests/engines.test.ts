// 순수 계산 엔진 단위 테스트: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { MATCHING_DEFAULTS } from "../src/config/matching";
import { PRICING_DEFAULTS } from "../src/config/pricing";
import { BIDDING_DEFAULTS } from "../src/config/bidding";
import { REPUTATION_DEFAULTS } from "../src/config/reputation";
import { buildClusters, scorePair, type MatchNode } from "../src/lib/matching/engine";
import { discountFor, jointEstimate, quantityFor, soloEstimate } from "../src/lib/pricing";
import { bidTotal, tierRanges } from "../src/lib/bidding/bidMath";
import { balancedPrice, evaluateBids } from "../src/lib/bidding/evaluate";
import { checkEligibility } from "../src/lib/bidding/eligibility";
import { recommendMethod } from "../src/lib/bidding/recommend";
import { computeReputation, gradeFor } from "../src/lib/reputation";
import { detectCollusion } from "../src/lib/collusion";
import { validateShape } from "../src/lib/settingsValidate";
import { diagnoseSimple } from "../src/lib/diagnosis/engine";
import { stageIndex } from "../src/lib/stages";
import { parseDaeguAddress } from "../src/lib/adapters/buildingRegistry";

const node = (id: string, lat: number, lng: number, month = 3, trades = ["WINDOW"]): MatchNode => ({
  buildingId: id, demandId: id, lat, lng, trades, desiredStart: new Date(2027, month, 1), grossArea: 300, usage: "MULTIPLEX", structure: "RC", quantity: 45,
});

test("매칭: 반경·시기 Hard Filter 를 벗어나면 점수가 없다", () => {
  assert.equal(scorePair(node("a", 35.85, 128.58), node("b", 35.95, 128.58), "WINDOW", MATCHING_DEFAULTS), null); // ~11km
  assert.equal(scorePair(node("a", 35.85, 128.58, 1), node("b", 35.851, 128.58, 8), "WINDOW", MATCHING_DEFAULTS), null); // 7개월 차
  const e = scorePair(node("a", 35.85, 128.58), node("b", 35.851, 128.581), "WINDOW", MATCHING_DEFAULTS)!;
  assert.ok(e.total > 90 && e.total <= 100);
});

test("매칭: 가까운 같은 공종 수요는 최소·최대 크기 안에서 묶인다", () => {
  const near = Array.from({ length: 15 }, (_, i) => node(`n${i}`, 35.85 + i * 0.0005, 128.58));
  const far = [node("x", 35.95, 128.7), node("y", 35.951, 128.7)];
  const { clusters } = buildClusters([...near, ...far], "WINDOW", MATCHING_DEFAULTS);
  assert.ok(clusters.length >= 1);
  for (const c of clusters) {
    assert.ok(c.members.length >= MATCHING_DEFAULTS.minClusterSize && c.members.length <= MATCHING_DEFAULTS.maxClusterSize);
    assert.ok(!c.members.some((m) => m >= 15), "멀리 떨어진 2동은 묶이지 않는다");
  }
});

test("가격: 혼자면 할인 없음, 함께하면 가정 할인, 실제 낙찰 표본이 충분하면 실제 단가", () => {
  const b = { grossArea: 300, floors: 3, households: 6, windowArea: 45 };
  assert.equal(quantityFor(b, "BOILER", PRICING_DEFAULTS).amount, 6);
  assert.equal(jointEstimate(b, "WINDOW", 1, PRICING_DEFAULTS).basis, "SOLO");
  const solo = soloEstimate(b, "WINDOW", PRICING_DEFAULTS);
  const joint = jointEstimate(b, "WINDOW", 8, PRICING_DEFAULTS);
  assert.ok(joint.high < solo.high && joint.basis === "ASSUMPTION");
  assert.equal(discountFor(8, PRICING_DEFAULTS).min, 5);
  const actual = jointEstimate(b, "WINDOW", 8, PRICING_DEFAULTS, { trade: "WINDOW", low: 400_000, high: 450_000, samples: 5 });
  assert.equal(actual.basis, "ACTUAL");
  assert.equal(actual.low, 45 * 400_000);
});

test("입찰: 참여 동수가 줄면 하위 구간 가산율이 자동 적용된다", () => {
  const ranges = tierRanges(8, 4, 0.75, 3);
  assert.deepEqual(ranges, [{ min: 6, max: 11 }, { min: 4, max: 5 }]);
  const tiers = ranges.map((r, i) => ({ ...r, adjustPct: i ? 10 : 0 }));
  const m = (i: number) => ({ memberId: `${i}`, label: "", amount: 10, mix: { A: 10 }, unit: "㎡" });
  const full = bidTotal(Array.from({ length: 8 }, (_, i) => m(i)), { A: 100_000 }, tiers);
  const few = bidTotal(Array.from({ length: 5 }, (_, i) => m(i)), { A: 100_000 }, tiers);
  assert.equal(full.rows[0].price, 1_000_000);
  assert.equal(few.rows[0].price, 1_100_000);
});

const base = { reviewStatus: "APPROVED", grRegistered: true, constructionLicense: "실내건축", warrantyAvailable: true, recentSanction: false, techStaffCount: 5, externalProjectCount: 10, platformProjects: 2, trades: ["WINDOW"], regions: ["서구"], reviewCount: 0, tagCounts: {}, grade: "STANDARD", reputationScore: 75 };
const rules = [{ id: "r", name: "GR", kind: "REQUIRE_GR", params: {}, action: "FAIL", active: true }];
const tender = { method: "OPEN", trade: "WINDOW", sigungu: "서구", qualification: null, nominatedIds: [] };

test("PQ: GR 미등록·지명 제외·리뷰 불만 비율 규칙", () => {
  assert.equal(checkEligibility(base as never, tender, rules).eligible, true);
  assert.match(checkEligibility({ ...base, grRegistered: false } as never, tender, rules).failures[0], /GR/);
  assert.equal(checkEligibility(base as never, { ...tender, method: "NOMINATED", nominatedIds: ["x"] }, rules).eligible, false);
  const tagRule = { id: "t", name: "", kind: "COMPLAINT_TAG_RATIO", params: { tag: "DEFECT_DELAY", ratio: 0.3, minReviews: 3 }, action: "FAIL", active: true };
  assert.equal(checkEligibility({ ...base, reviewCount: 4, tagCounts: { DEFECT_DELAY: 2 } } as never, tender, [tagRule]).eligible, false);
});

test("평가: 덤핑 입찰은 감점되고 다른 업체의 가격 기준이 되지 않는다", () => {
  const cs = new Map(["a", "b", "c"].map((id) => [id, { ...base, id }]));
  const bid = (id: string, price: number) => ({ id, contractorId: id, totalPrice: price, durationDays: 30, warrantyMonths: 24, asMonths: 12, dumpingReason: null });
  const r = evaluateBids([bid("a", 100e6), bid("b", 98e6), bid("c", 60e6)], cs as never, { ...tender, priceCap: 120e6, estimatedAmount: 400e6 }, rules as never, BIDDING_DEFAULTS, REPUTATION_DEFAULTS, {});
  const c = r.results.find((x) => x.bidId === "c")!;
  const b = r.results.find((x) => x.bidId === "b")!;
  assert.equal(c.dumping, true);
  assert.ok(c.dumpingPenalty > 0);
  assert.equal(b.scores.price, BIDDING_DEFAULTS.weights.price); // 덤핑을 뺀 최저가가 만점
  assert.equal(balancedPrice([1, 2, 3, 4, 100], 0.2), 3);
});

test("입찰 방식 추천: 고난도 공종은 제한경쟁, 재유찰은 수의계약", () => {
  const input = { trade: "EXT_INSULATION", estimatedAmount: 1e8, qualifiedCount: 8, regionQualifiedCount: 5, failedRounds: 0, buildingAges: [30, 31], nominationPool: [] };
  assert.equal(recommendMethod(input, BIDDING_DEFAULTS).method, "RESTRICTED");
  assert.equal(recommendMethod({ ...input, trade: "WINDOW" }, BIDDING_DEFAULTS).method, "OPEN");
  assert.equal(recommendMethod({ ...input, failedRounds: 2 }, BIDDING_DEFAULTS).method, "NEGOTIATED");
});

test("평판: 불만 태그·미처리 하자는 점수를 낮추고 등급 기준을 따른다", () => {
  const now = new Date();
  const r = (tags: string[] = [], extra = {}) => ({ kind: "INITIAL", createdAt: now, ratingQuality: 5, ratingSchedule: 5, ratingCleanliness: 5, ratingComm: 5, ratingAS: 5, ratingValue: 5, complaintTags: tags, defectOccurred: null, defectResolved: null, ...extra });
  const good = computeReputation([r(), r(), r(), r()], [], REPUTATION_DEFAULTS, now)!;
  const bad = computeReputation([r(["DEFECT_DELAY"]), r(["DEFECT_DELAY"]), r(), { ...r(), kind: "FOLLOWUP_6M", defectOccurred: true, defectResolved: false }], [], REPUTATION_DEFAULTS, now)!;
  assert.equal(good.score, 100);
  assert.ok(bad.score < good.score - 10);
  assert.equal(gradeFor(good.score, 4, REPUTATION_DEFAULTS), "EXCELLENT");
  assert.equal(gradeFor(null, 0, REPUTATION_DEFAULTS), "SPROUT");
});

test("담합 감시: 번갈아 낙찰 · 근접 입찰가", () => {
  const T = (id: string, bids: [string, number, boolean][]) => ({ id, label: id, bids: bids.map(([c, p, w]) => ({ contractorId: c, totalPrice: p, won: w })) });
  const flags = detectCollusion([T("1", [["a", 100, true], ["b", 110, false]]), T("2", [["a", 105, false], ["b", 100, true]]), T("3", [["a", 100, true], ["b", 100.5, false]])], { a: "A", b: "B" }, BIDDING_DEFAULTS.collusion);
  assert.ok(flags.some((f) => f.kind === "ROTATION"));
  assert.ok(flags.some((f) => f.kind === "CLOSE_PRICES"));
});

test("설정 검증: 타입·알 수 없는 키를 막는다", () => {
  assert.equal(validateShape(MATCHING_DEFAULTS, { ...MATCHING_DEFAULTS, radiusKm: 2 }).length, 0);
  assert.equal(validateShape(MATCHING_DEFAULTS, { ...MATCHING_DEFAULTS, radiusKm: "2" }).length, 1);
  assert.equal(validateShape(MATCHING_DEFAULTS, { ...MATCHING_DEFAULTS, foo: 1 }).length, 1);
});

test("간이 진단: 오래된 집이 더 나쁜 등급, 고지서가 있으면 범위가 좁다", () => {
  const old = { approvalDate: new Date(1985, 0, 1), usage: "DETACHED", structure: "BRICK", grossArea: 120, households: 1 };
  const recent = { ...old, approvalDate: new Date(2014, 0, 1), structure: "RC" };
  assert.ok(diagnoseSimple(old, null, [], null).intensity.mid > diagnoseSimple(recent, null, [], null).intensity.mid);
  const withBills = diagnoseSimple(old, { gas: 150000, electric: 60000 }, [], null);
  const without = diagnoseSimple(old, null, [], null);
  assert.ok(withBills.intensity.high - withBills.intensity.low < without.intensity.high - without.intensity.low);
  assert.ok(without.combined!.pct.high <= 0.55);
});

test("타임라인 단계와 주소 해석", () => {
  assert.equal(stageIndex({ clusterStatus: "TENDERING", tenderStatus: "OPEN", contractStatus: null, projectStatus: null }), 1);
  assert.equal(stageIndex({ clusterStatus: "AWARDED", tenderStatus: "AWARDED", contractStatus: "READY", projectStatus: "SITE_CHECK" }), 3);
  assert.deepEqual(parseDaeguAddress("수성 만촌동 12"), { sido: "대구광역시", sigungu: "수성구", dong: "만촌동", lot: "12" });
  assert.ok("error" in parseDaeguAddress("서울 강남구 역삼동 1"));
});

// ── P5: 매칭 설명 ──
import { blockReason, costBreakdown, explainCandidate, sizeCurve, sumParts } from "../src/lib/matching/engine";
import { demandGrid } from "../src/lib/matching/demandMap";

test("Hard Filter 추가: 창호는 조적조와 철근콘크리트를 따로, 보일러는 세대 면적 규격 차이로 분리", () => {
  const a = { ...node("a", 35.85, 128.58), structure: "BRICK" };
  const b = { ...node("b", 35.851, 128.581), structure: "RC" };
  assert.equal(blockReason(a, b, "WINDOW", MATCHING_DEFAULTS), "STRUCTURE");
  assert.equal(blockReason(a, { ...b, structure: "MASONRY" }, "WINDOW", MATCHING_DEFAULTS), null);
  const small = { ...node("s", 35.85, 128.58, 3, ["BOILER"]), grossArea: 240, households: 4 }; // 60㎡
  const big = { ...node("g", 35.851, 128.58, 3, ["BOILER"]), grossArea: 600, households: 4 }; // 150㎡
  assert.equal(blockReason(small, big, "BOILER", MATCHING_DEFAULTS), "SPEC");
});

test("제외 사유·대기 풀: 구조 다름은 제외, 시기 조금 다름은 대기", () => {
  const members = [0, 1, 2, 3].map((i) => node(`m${i}`, 35.85 + i * 0.001, 128.58));
  const rc = { ...node("x", 35.851, 128.581), structure: "RC" };
  const membersBrick = members.map((m) => ({ ...m, structure: "BRICK" }));
  assert.equal(explainCandidate(rc, membersBrick, "WINDOW", MATCHING_DEFAULTS, false).status, "EXCLUDED");
  const late = node("l", 35.851, 128.581, 6); // 3개월 차이 (기준 ±2)
  const r = explainCandidate(late, members, "WINDOW", MATCHING_DEFAULTS, false);
  assert.equal(r.status, "WAITLIST");
  assert.match(r.reason, /시기/);
});

test("비용 구성: 함께하면 1동당 총액이 줄고, 곡선의 추천 구간은 최소 동수 이상", () => {
  const { solo, joint } = costBreakdown(10_000_000, 6, 0.1, MATCHING_DEFAULTS);
  assert.ok(sumParts(joint) < sumParts(solo));
  assert.ok(joint.fixed < solo.fixed && joint.material < solo.material);
  const c = sizeCurve(10_000_000, (n) => (n >= 5 ? 0.1 : n >= 3 ? 0.06 : 0), MATCHING_DEFAULTS);
  assert.equal(c.points.length, MATCHING_DEFAULTS.maxClusterSize);
  assert.ok(c.recommended.from >= MATCHING_DEFAULTS.minClusterSize && c.recommended.to >= c.recommended.from);
});

test("수요 지도: 격자 중심 좌표만, 적은 칸은 숨김, 공종 필터", () => {
  const pts = [
    { lat: 35.8501, lng: 128.5801, trades: ["WINDOW"] },
    { lat: 35.8502, lng: 128.5803, trades: ["WINDOW", "BOILER"] },
    { lat: 35.9, lng: 128.6, trades: ["WINDOW"] },
  ];
  const cells = demandGrid(pts, 0.004, 2);
  assert.equal(cells.length, 1);
  assert.equal(cells[0].count, 2);
  assert.notEqual(cells[0].lat, 35.8501);
  assert.equal(demandGrid(pts, 0.004, 2, "BOILER").length, 0);
});

import { tierProgress } from "../src/lib/matching/progress";
test("진행바: 입찰 구간이 있으면 그 경계, 없으면 가정 구간(예상)", () => {
  const cfg = [{ min: 1, max: 2, low: 0, high: 0 }, { min: 3, max: 4, low: 0.04, high: 0.08 }, { min: 5, max: 8, low: 0.08, high: 0.13 }];
  const a = tierProgress(4, null, cfg);
  assert.equal(a.source, "assumed");
  assert.equal(a.need, 1);
  assert.deepEqual(a.nextDiscount, { low: 0.08, high: 0.13 });
  const b = tierProgress(5, [[{ minBuildings: 4, maxBuildings: 5 }, { minBuildings: 6, maxBuildings: 9 }]], cfg);
  assert.equal(b.source, "bids");
  assert.equal(b.next, 6);
  assert.equal(b.nextDiscount, null);
  assert.equal(tierProgress(9, null, cfg).next, null);
});
