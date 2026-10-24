// 수요 지도 (F7): 개별 건물 위치 대신 격자 칸 단위로 모아 보여준다 (순수 함수)
export type DemandPoint = { lat: number; lng: number; trades: string[]; usage?: string; structure?: string; age?: number | null; dong?: string };
export type DemandCell = { lat: number; lng: number; count: number; byTrade: Record<string, number> };

export function demandGrid(points: DemandPoint[], gridDeg: number, minCount: number, trade?: string): DemandCell[] {
  const cells = new Map<string, { sumLat: number; sumLng: number; count: number; byTrade: Record<string, number>; i: number; j: number }>();
  for (const p of points) {
    if (trade && !p.trades.includes(trade)) continue;
    const i = Math.floor(p.lat / gridDeg);
    const j = Math.floor(p.lng / gridDeg);
    const k = `${i}:${j}`;
    const c = cells.get(k) ?? { sumLat: 0, sumLng: 0, count: 0, byTrade: {}, i, j };
    c.count++;
    for (const t of p.trades) c.byTrade[t] = (c.byTrade[t] ?? 0) + 1;
    cells.set(k, c);
  }
  // 칸의 중심 좌표만 쓴다 (실제 건물 평균 위치가 아니라 격자 중심 → 위치 추정 방지)
  return [...cells.values()]
    .filter((c) => c.count >= minCount)
    .map((c) => ({ lat: +((c.i + 0.5) * gridDeg).toFixed(5), lng: +((c.j + 0.5) * gridDeg).toFixed(5), count: c.count, byTrade: c.byTrade }));
}
