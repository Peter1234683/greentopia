import "server-only";
import { db } from "./db";
import { quantityFor, type ActualUnitRange } from "./pricing";
import type { PricingSettings } from "@/config/pricing";

// 공종별 실제 낙찰(계약) 단가 범위: 계약금액 ÷ 해당 건물 물량. 사분위(25~75%)로 극단값을 줄인다.
export async function actualUnitRanges(p: PricingSettings): Promise<Record<string, ActualUnitRange>> {
  const contracts = await db.contract.findMany({
    where: { status: "SIGNED", tender: { isNot: null } },
    include: { building: true, tender: { include: { cluster: { select: { trade: true } } } } },
  });
  const byTrade = new Map<string, number[]>();
  for (const c of contracts) {
    const trade = c.tender!.cluster.trade;
    const q = quantityFor(c.building, trade, p).amount;
    if (q <= 0) continue;
    byTrade.set(trade, [...(byTrade.get(trade) ?? []), c.amount / q]);
  }
  const out: Record<string, ActualUnitRange> = {};
  for (const [trade, arr] of byTrade) {
    const sorted = arr.sort((a, b) => a - b);
    const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * q)))];
    out[trade] = { trade, low: Math.round(at(0.25)), high: Math.round(at(0.75)), samples: sorted.length };
  }
  return out;
}
