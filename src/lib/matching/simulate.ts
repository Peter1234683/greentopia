import "server-only";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { quantityFor } from "@/lib/pricing";
import { parseJson, TRADES } from "@/lib/constants";
import type { MatchingSettings } from "@/config/matching";
import { buildClusters, relevantTo, type MatchNode } from "./engine";

export type SimParams = Pick<MatchingSettings, "radiusKm" | "timingMonths" | "minClusterSize" | "edgeThreshold" | "weights">;

// 파라미터를 바꿔 매칭을 다시 계산만 한다 (DB 는 바꾸지 않음). 진행 중 묶음과 상관없이 활성 수요 전체 기준.
export async function simulateMatching(p: SimParams) {
  const settings = await getSettings();
  const s: MatchingSettings = { ...settings.matching, ...p, weights: { ...settings.matching.weights, ...p.weights } };
  const demands = await db.retrofitDemand.findMany({
    where: { status: { in: ["ACTIVE", "MATCHED"] }, jointIntent: { notIn: s.excludedIntents } },
    include: { building: true },
  });
  const byTrade = TRADES.map((trade) => {
    const nodes: MatchNode[] = demands
      .filter((d) => relevantTo(parseJson<string[]>(d.tradesJson, []), trade, s))
      .map((d) => ({
        buildingId: d.buildingId,
        demandId: d.id,
        lat: d.building.lat,
        lng: d.building.lng,
        trades: parseJson<string[]>(d.tradesJson, []),
        desiredStart: d.desiredStart,
        grossArea: d.building.grossArea,
        usage: d.building.usage,
        structure: d.building.structure,
        quantity: quantityFor(d.building, trade, settings.pricing).amount,
        floors: d.building.floors,
        households: d.building.households,
      }));
    const { clusters } = buildClusters(nodes, trade, s);
    const matched = clusters.reduce((a, c) => a + c.members.length, 0);
    return {
      trade,
      candidates: nodes.length,
      matched,
      clusters: clusters.map((c) => ({ size: c.members.length, avgScore: c.avgScore, radiusKm: c.radiusKm })),
    };
  });
  return { byTrade, totalCandidates: byTrade.reduce((a, t) => a + t.candidates, 0), totalMatched: byTrade.reduce((a, t) => a + t.matched, 0) };
}
