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

// STEP 1 + STEP 2
export function scorePair(x: MatchNode, y: MatchNode, target: string, s: MatchingSettings): Omit<Edge, "a" | "b"> | null {
  const km = haversineKm(x, y);
  const months = monthsBetween(x.desiredStart, y.desiredStart);
  if (km > s.radiusKm || months > s.timingMonths) return null;
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
