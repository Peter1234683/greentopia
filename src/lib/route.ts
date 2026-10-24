import { haversineKm } from "./matching/engine";

// 근거리 연속 시공 동선: 가장 가까운 다음 건물을 고르는 단순 최근접 이웃 경로
export function nearestRoute<T extends { lat: number; lng: number }>(points: T[]): { order: T[]; km: number } {
  if (points.length <= 1) return { order: points, km: 0 };
  const left = [...points];
  // 출발점: 가장 서쪽 건물
  left.sort((a, b) => a.lng - b.lng);
  const order = [left.shift()!];
  let km = 0;
  while (left.length) {
    const cur = order[order.length - 1];
    let bi = 0;
    for (let i = 1; i < left.length; i++) if (haversineKm(cur, left[i]) < haversineKm(cur, left[bi])) bi = i;
    km += haversineKm(cur, left[bi]);
    order.push(left.splice(bi, 1)[0]);
  }
  return { order, km: Math.round(km * 10) / 10 };
}
