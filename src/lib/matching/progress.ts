// 공동구매 진행바 (F6): 지금 몇 동이 모였고, 몇 동 더 모이면 다음 물량 구간인지 (순수 함수)
export type Tier = { min: number; max: number; low?: number; high?: number };
export type BidTier = { minBuildings: number; maxBuildings: number; factor?: number };

export function tierProgress(count: number, bidTiers: BidTier[][] | null, configTiers: Tier[]) {
  // 업체가 입찰한 물량 구간이 있으면 그 경계(여러 업체의 경계 합집합)를, 없으면 가정 구간을 쓴다
  const fromBids = bidTiers && bidTiers.some((t) => t.length > 0);
  const mins = fromBids
    ? [...new Set(bidTiers!.flat().map((t) => t.minBuildings))].sort((a, b) => a - b)
    : configTiers.map((t) => t.min).sort((a, b) => a - b);
  const next = mins.find((m) => m > count) ?? null;
  const cfgNext = next == null ? null : configTiers.find((t) => next >= t.min && next <= t.max) ?? null;
  return {
    source: fromBids ? ("bids" as const) : ("assumed" as const),
    count,
    next,
    need: next == null ? 0 : next - count,
    // 가정 구간일 때만 예상 할인 범위를 보여준다 (입찰 단가는 낙찰 전 비공개)
    nextDiscount: !fromBids && cfgNext && cfgNext.high ? { low: cfgNext.low ?? 0, high: cfgNext.high } : null,
    max: Math.max(next ?? count, ...mins, count),
  };
}
