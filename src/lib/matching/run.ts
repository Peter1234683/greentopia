import "server-only";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { quantityFor } from "@/lib/pricing";
import { parseJson, TRADES, TRADE_LABEL, type Trade } from "@/lib/constants";
import { buildClusters, clusterReasons, relevantTo, type MatchNode } from "./engine";

// 진행 중인(이미 참여가 시작된) Cluster 는 건드리지 않고, AI 제안 단계(PROPOSED)만 다시 계산한다.
export async function runMatching() {
  const settings = await getSettings();
  const s = settings.matching;

  const demands = await db.retrofitDemand.findMany({
    where: { status: "ACTIVE", jointIntent: { notIn: s.excludedIntents } },
    include: { building: true },
  });

  // 진행 중 Cluster 에 묶인 (건물, 공종) 은 제외
  const locked = await db.clusterMember.findMany({
    where: { status: { not: "LEFT" }, cluster: { status: { notIn: ["PROPOSED", "CANCELLED", "COMPLETED"] } } },
    include: { cluster: { select: { trade: true } } },
  });
  const lockedKey = new Set(locked.map((m) => `${m.buildingId}|${m.cluster.trade}`));

  const old = await db.cluster.findMany({ where: { status: "PROPOSED" }, include: { members: true } });
  const oldSets = old.map((c) => ({ code: c.code, trade: c.trade, ids: new Set(c.members.map((m) => m.buildingId)) }));
  await db.cluster.deleteMany({ where: { status: "PROPOSED" } });
  let nextCode = ((await db.cluster.aggregate({ _max: { code: true } }))._max.code ?? 0) + 1;
  const usedOldCodes = new Set<number>();

  const created: { code: number; trade: string; size: number }[] = [];
  for (const trade of TRADES) {
    const nodes: MatchNode[] = demands
      .map((d) => ({ d, trades: parseJson<string[]>(d.tradesJson, []) }))
      .filter(({ d, trades }) => relevantTo(trades, trade, s) && !lockedKey.has(`${d.buildingId}|${trade}`))
      .map(({ d, trades }) => ({
        buildingId: d.buildingId,
        demandId: d.id,
        lat: d.building.lat,
        lng: d.building.lng,
        trades,
        desiredStart: d.desiredStart,
        grossArea: d.building.grossArea,
        usage: d.building.usage,
        structure: d.building.structure,
        quantity: quantityFor(d.building, trade, settings.pricing).amount,
        floors: d.building.floors,
        households: d.building.households,
      }));
    // 한 건물이 같은 공종으로 두 번 들어가지 않도록
    const seen = new Set<string>();
    const unique = nodes.filter((n) => (seen.has(n.buildingId) ? false : (seen.add(n.buildingId), true)));

    const { clusters, edges } = buildClusters(unique, trade, s);
    for (const c of clusters) {
      const ids = c.members.map((i) => unique[i].buildingId);
      // 이전 제안과 절반 이상 겹치면 같은 번호를 유지해 사용자 혼란을 줄인다
      const prev = oldSets
        .filter((o) => o.trade === trade && !usedOldCodes.has(o.code))
        .map((o) => ({ o, overlap: ids.filter((id) => o.ids.has(id)).length }))
        .sort((a, b) => b.overlap - a.overlap)[0];
      const code = prev && prev.overlap * 2 >= ids.length ? prev.o.code : nextCode++;
      usedOldCodes.add(code);

      const sigunguCount = new Map<string, number>();
      for (const i of c.members) {
        const sg = demands.find((d) => d.buildingId === unique[i].buildingId)!.building.sigungu;
        sigunguCount.set(sg, (sigunguCount.get(sg) ?? 0) + 1);
      }
      const sigungu = [...sigunguCount.entries()].sort((a, b) => b[1] - a[1])[0][0];

      await db.cluster.create({
        data: {
          code,
          trade,
          status: "PROPOSED",
          radiusKm: c.radiusKm,
          avgScore: c.avgScore,
          centerLat: c.centerLat,
          centerLng: c.centerLng,
          sigungu,
          reasonsJson: JSON.stringify(clusterReasons(c, TRADE_LABEL[trade as Trade], s)),
          members: {
            create: c.members.map((i) => ({
              buildingId: unique[i].buildingId,
              demandId: unique[i].demandId,
              quantityJson: JSON.stringify({ [trade]: quantityFor(demands.find((d) => d.id === unique[i].demandId)!.building, trade, settings.pricing) }),
            })),
          },
        },
      });

      // 군집 내부 쌍의 적합도 저장 (설명·학습용)
      const inCluster = new Set(c.members);
      for (const e of edges) {
        if (!inCluster.has(e.a) || !inCluster.has(e.b)) continue;
        const [a, b] = [unique[e.a].buildingId, unique[e.b].buildingId].sort();
        await db.compatibilityScore.upsert({
          where: { buildingAId_buildingBId_trade: { buildingAId: a, buildingBId: b, trade } },
          create: { buildingAId: a, buildingBId: b, trade, total: e.total, breakdownJson: JSON.stringify(e.breakdown) },
          update: { total: e.total, breakdownJson: JSON.stringify(e.breakdown), computedAt: new Date() },
        });
      }
      created.push({ code, trade, size: c.members.length });
    }
  }
  return created;
}
