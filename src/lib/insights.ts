// 권역 수요 인사이트 (F12, 순수 함수): 공종별 수요, 수요 집중 동네, 건물 유형 분포
export type InsightDemand = { trades: string[]; sigungu: string; dong: string; usage: string; structure: string; age: number | null };

const MASONRY = new Set(["BRICK", "MASONRY"]);

export function demandInsights(demands: InsightDemand[], myTrades: string[]) {
  const mine = demands.filter((d) => d.trades.some((t) => myTrades.includes(t)));
  const byTrade = Object.fromEntries(myTrades.map((t) => [t, demands.filter((d) => d.trades.includes(t)).length]));
  const dongCount = new Map<string, number>();
  for (const d of mine) dongCount.set(`${d.sigungu} ${d.dong}`, (dongCount.get(`${d.sigungu} ${d.dong}`) ?? 0) + 1);
  const topDongs = [...dongCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => ({ name, count }));
  const bucket = (d: InsightDemand) => `${d.age != null && d.age >= 30 ? "30년 이상" : "30년 미만"} ${MASONRY.has(d.structure) ? "조적조" : "철근콘크리트 등"}`;
  const typeCount = new Map<string, number>();
  for (const d of mine) typeCount.set(bucket(d), (typeCount.get(bucket(d)) ?? 0) + 1);
  const types = [...typeCount.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count, ratio: mine.length ? count / mine.length : 0 }));
  return { total: mine.length, byTrade, topDongs, types };
}
