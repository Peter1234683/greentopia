// AI 공동공사 매칭 엔진 (순수 함수)
// STEP 1 Hard Filter → STEP 2 적합도 점수(100점) → STEP 3 크기 제약이 있는 탐욕적 군집화
import type { MatchingSettings } from "@/config/matching";

export type MatchNode = {
  buildingId: string;
  demandId: string;
  lat: number;
  lng: number;
  trades: string[];
  desiredStart: Date;
  grossArea: number;
  usage: string;
  structure: string;
  quantity: number; // 대상 공종 물량
  floors?: number;
  households?: number;
};

export type ScoreBreakdown = { trade: number; distance: number; timing: number; scale: number; volume: number; condition: number };
export type Edge = { a: number; b: number; total: number; breakdown: ScoreBreakdown; km: number; months: number };

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export const monthsBetween = (a: Date, b: Date) => Math.abs((a.getFullYear() - b.getFullYear()) * 12 + a.getMonth() - b.getMonth());

export function tradeCompat(a: string, b: string, s: MatchingSettings) {
  if (a === b) return 1;
  return s.tradeCompat[`${a}|${b}`] ?? s.tradeCompat[`${b}|${a}`] ?? 0;
}

// 대상 공종 T에 대해 이 수요가 후보인가 (같은 공종 또는 유사 공종)
export function relevantTo(trades: string[], target: string, s: MatchingSettings) {
  return trades.some((t) => tradeCompat(t, target, s) >= (t === target ? 1 : s.similarTradeMin));
}

// 구조 그룹 (공종별). 그룹 설정이 없으면 모두 같은 그룹.
export function structureGroup(structure: string, target: string, s: MatchingSettings) {
  const groups = s.structureGroups?.[target];
  if (!groups) return 0;
  const i = groups.findIndex((g) => g.includes(structure));
  return i < 0 ? groups.length : i;
}

// 자재 규격 등급 (공종별). 설정이 없거나 정보가 없으면 null (호환으로 본다).
export function specClass(n: Pick<MatchNode, "grossArea" | "floors" | "households">, target: string, s: MatchingSettings) {
  const c = s.specClasses?.[target];
  if (!c) return null;
  const v = c.by === "floors" ? n.floors : n.households ? n.grossArea / n.households : undefined;
  if (v == null) return null;
  const i = c.bounds.findIndex((b) => v <= b);
  return i < 0 ? c.bounds.length : i;
}

export type BlockReason = "DISTANCE" | "TIMING" | "STRUCTURE" | "SPEC";

// STEP 1 Hard Filter: 같은 묶음이 될 수 없는 이유 (없으면 null)
export function blockReason(x: MatchNode, y: MatchNode, target: string, s: MatchingSettings): BlockReason | null {
  if (structureGroup(x.structure, target, s) !== structureGroup(y.structure, target, s)) return "STRUCTURE";
  const cx = specClass(x, target, s);
  const cy = specClass(y, target, s);
  if (cx != null && cy != null && Math.abs(cx - cy) > s.specClasses[target].maxGap) return "SPEC";
  if (haversineKm(x, y) > s.radiusKm) return "DISTANCE";
  if (monthsBetween(x.desiredStart, y.desiredStart) > s.timingMonths) return "TIMING";
  return null;
}

// STEP 1 + STEP 2
export function scorePair(x: MatchNode, y: MatchNode, target: string, s: MatchingSettings): Omit<Edge, "a" | "b"> | null {
  if (blockReason(x, y, target, s)) return null;
  const km = haversineKm(x, y);
  const months = monthsBetween(x.desiredStart, y.desiredStart);
  const w = s.weights;
  const best = (ts: string[]) => Math.max(...ts.map((t) => tradeCompat(t, target, s)));
  const union = new Set([...x.trades, ...y.trades]);
  const inter = x.trades.filter((t) => y.trades.includes(t)).length;
  const jaccard = union.size ? inter / union.size : 0;
  const breakdown: ScoreBreakdown = {
    trade: w.trade * Math.min(best(x.trades), best(y.trades)) * (0.6 + 0.4 * jaccard),
    distance: w.distance * (1 - km / s.radiusKm),
    timing: w.timing * (1 - months / (s.timingMonths + 1)),
    scale: w.scale * (1 - Math.abs(x.grossArea - y.grossArea) / Math.max(x.grossArea, y.grossArea)),
    volume: w.volume * (Math.min(x.quantity, y.quantity) / Math.max(x.quantity, y.quantity, 1)),
    condition: w.condition * ((x.usage === y.usage ? 0.6 : 0.3) + (x.structure === y.structure ? 0.4 : 0.2)),
  };
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return { total, breakdown, km, months };
}

export type ClusterResult = {
  members: number[]; // nodes 인덱스
  avgScore: number;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  maxMonths: number;
  areaSpread: number; // 연면적 최대/최소 - 1
  sameTradeAll: boolean;
};

function centroid(nodes: MatchNode[], idx: number[]) {
  return {
    lat: idx.reduce((s, i) => s + nodes[i].lat, 0) / idx.length,
    lng: idx.reduce((s, i) => s + nodes[i].lng, 0) / idx.length,
  };
}

// STEP 3: 연결 점수 합이 큰 노드를 씨앗으로, 기존 멤버 모두와의 평균 점수가 높은 후보를 하나씩 붙인다.
// 모든 기존 멤버와 Hard Filter를 통과해야 하고(완전 연결), 최대 크기를 넘지 않으며, 최소 크기 미만이면 버린다.
export function buildClusters(nodes: MatchNode[], target: string, s: MatchingSettings) {
  const n = nodes.length;
  const adj = new Map<string, Omit<Edge, "a" | "b">>();
  const key = (i: number, j: number) => (i < j ? `${i}-${j}` : `${j}-${i}`);
  const strength = new Array(n).fill(0);
  const edges: Edge[] = [];
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const e = scorePair(nodes[i], nodes[j], target, s);
      if (!e || e.total < s.edgeThreshold) continue;
      adj.set(key(i, j), e);
      edges.push({ a: i, b: j, ...e });
      strength[i] += e.total;
      strength[j] += e.total;
    }

  const assigned = new Set<number>();
  const clusters: ClusterResult[] = [];
  const order = [...Array(n).keys()].sort((a, b) => strength[b] - strength[a]);
  for (const seed of order) {
    if (assigned.has(seed) || strength[seed] === 0) continue;
    const members = [seed];
    while (members.length < s.maxClusterSize) {
      let bestIdx = -1;
      let bestAvg = 0;
      for (let c = 0; c < n; c++) {
        if (assigned.has(c) || members.includes(c)) continue;
        let sum = 0;
        let ok = true;
        for (const m of members) {
          const e = adj.get(key(c, m));
          if (!e) {
            ok = false;
            break;
          }
          sum += e.total;
        }
        if (!ok) continue;
        const avg = sum / members.length;
        if (avg > bestAvg) {
          bestAvg = avg;
          bestIdx = c;
        }
      }
      if (bestIdx < 0) break;
      members.push(bestIdx);
    }
    if (members.length < s.minClusterSize) continue;
    members.forEach((m) => assigned.add(m));

    let sum = 0;
    let cnt = 0;
    let maxMonths = 0;
    for (let i = 0; i < members.length; i++)
      for (let j = i + 1; j < members.length; j++) {
        const e = adj.get(key(members[i], members[j]))!;
        sum += e.total;
        cnt++;
        maxMonths = Math.max(maxMonths, e.months);
      }
    const c = centroid(nodes, members);
    const areas = members.map((m) => nodes[m].grossArea);
    clusters.push({
      members,
      avgScore: Math.round((sum / cnt) * 10) / 10,
      centerLat: c.lat,
      centerLng: c.lng,
      radiusKm: Math.max(0.1, Math.round(Math.max(...members.map((m) => haversineKm(c, nodes[m]))) * 10) / 10),
      maxMonths,
      areaSpread: Math.max(...areas) / Math.min(...areas) - 1,
      sameTradeAll: members.every((m) => nodes[m].trades.includes(target)),
    });
  }
  return { clusters, edges };
}

// 묶인 이유 체크리스트
export function clusterReasons(c: ClusterResult, tradeLabel: string, s: MatchingSettings) {
  return [
    { label: c.sameTradeAll ? `동일 공종 (${tradeLabel})` : `동일·유사 공종 (${tradeLabel} 중심)`, ok: true },
    { label: c.maxMonths === 0 ? "희망 시기 같음" : `희망 시기 유사 (±${c.maxMonths}개월)`, ok: c.maxMonths <= s.timingMonths },
    { label: `거리 가까움 (반경 ${c.radiusKm}km)`, ok: c.radiusKm <= s.radiusKm },
    { label: c.areaSpread <= 1 ? "규모 유사" : "규모 차이 있음", ok: c.areaSpread <= 1 },
  ];
}

// ── 설명용 (F8) ──

export type Candidate = { status: "WAITLIST" | "EXCLUDED"; reason: string; km: number; months: number; score: number | null };

// 묶음 밖 후보가 왜 함께하지 못했는지, 무엇이 바뀌면 합류할 수 있는지
export function explainCandidate(c: MatchNode, members: MatchNode[], target: string, s: MatchingSettings, full: boolean): Candidate {
  const center = { lat: members.reduce((a, m) => a + m.lat, 0) / members.length, lng: members.reduce((a, m) => a + m.lng, 0) / members.length };
  const km = Math.round(haversineKm(c, center) * 10) / 10;
  const months = Math.max(...members.map((m) => monthsBetween(c.desiredStart, m.desiredStart)));
  const reasons = members.map((m) => blockReason(c, m, target, s));
  if (reasons.includes("STRUCTURE")) return { status: "EXCLUDED", reason: s.structureReason?.[target] ?? "건물 구조가 달라 별도 그룹으로 묶어요", km, months, score: null };
  if (reasons.includes("SPEC")) return { status: "EXCLUDED", reason: `${s.specClasses[target].label}이(가) 달라 같은 자재로 묶기 어려워요`, km, months, score: null };
  const farKm = reasons.includes("DISTANCE");
  const farMonths = reasons.includes("TIMING");
  if (farKm || farMonths) {
    const nearEnough = (!farKm || km <= s.radiusKm + s.waitlistSlack.km) && (!farMonths || months <= s.timingMonths + s.waitlistSlack.months);
    const what = [farKm && `거리가 조금 멀어요 (중심에서 ${km}km)`, farMonths && `희망 시기가 ${months}개월 차이 나요`].filter(Boolean).join(" · ");
    return nearEnough
      ? { status: "WAITLIST", reason: `${what} — ${farMonths ? "시기를 맞추면" : "묶음 범위가 넓어지면"} 합류할 수 있어요`, km, months, score: null }
      : { status: "EXCLUDED", reason: what, km, months, score: null };
  }
  const scores = members.map((m) => scorePair(c, m, target, s)!.total);
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  if (Math.min(...scores) < s.edgeThreshold)
    return { status: "WAITLIST", reason: `적합도 점수가 일부 이웃과 기준(${s.edgeThreshold}점)보다 낮아요 (평균 ${avg}점)`, km, months, score: avg };
  return { status: "WAITLIST", reason: full ? `묶음이 최대 ${s.maxClusterSize}동으로 가득 찼어요 — 자리가 나면 합류할 수 있어요` : "조건이 맞아요 — 다음 매칭 때 합류 후보예요", km, months, score: avg };
}

export type CostParts = { material: number; labor: number; logistics: number; fixed: number };

// 1동 기준 비용 구성: 혼자 vs n동 함께 (가정 모델). materialDiscount 는 물량 구간 할인율(0~1)
export function costBreakdown(soloTotal: number, n: number, materialDiscount: number, s: MatchingSettings): { solo: CostParts; joint: CostParts } {
  const m = s.costModel;
  const solo = {
    material: soloTotal * m.shares.material,
    labor: soloTotal * m.shares.labor,
    logistics: soloTotal * m.shares.logistics,
    fixed: soloTotal * m.shares.fixed,
  };
  const k = Math.max(1, n);
  const joint = {
    material: solo.material * (1 - (k > 1 ? materialDiscount : 0)),
    labor: solo.labor * (1 - Math.min(m.laborSavingMax, m.laborSavingPerBuilding * (k - 1))),
    logistics: solo.logistics / Math.pow(k, m.logisticsExponent),
    fixed: (solo.fixed * (1 + m.fixedOverheadGrowth * (k - 1))) / k,
  };
  const r = (o: CostParts) => Object.fromEntries(Object.entries(o).map(([key, v]) => [key, Math.round(v / 10_000) * 10_000])) as CostParts;
  return { solo: r(solo), joint: r(joint) };
}

export const sumParts = (p: CostParts) => p.material + p.labor + p.logistics + p.fixed;

// 동수별 1동당 비용 곡선과 추천 구간 (최대 절감액의 90%에 처음 닿는 동수까지)
export function sizeCurve(soloTotal: number, discountAt: (n: number) => number, s: MatchingSettings) {
  const points = Array.from({ length: s.maxClusterSize }, (_, i) => {
    const n = i + 1;
    return { n, perBuilding: sumParts(costBreakdown(soloTotal, n, discountAt(n), s).joint) };
  });
  const solo = points[0].perBuilding;
  const best = Math.min(...points.map((p) => p.perBuilding));
  const target = solo - 0.9 * (solo - best);
  const hit = points.find((p) => p.n >= s.minClusterSize && p.perBuilding <= target)?.n ?? s.maxClusterSize;
  return { points, recommended: { from: s.minClusterSize, to: Math.max(s.minClusterSize, hit) } };
}
