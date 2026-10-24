import "server-only";
import { db } from "@/lib/db";
import { getSettings, type Settings } from "@/lib/settings";
import { discountFor, quantityFor, soloEstimate } from "@/lib/pricing";
import { parseJson } from "@/lib/constants";
import { costBreakdown, explainCandidate, haversineKm, relevantTo, scorePair, sizeCurve, type MatchNode } from "./engine";
import { tierProgress, type BidTier } from "./progress";

type DemandWithBuilding = Awaited<ReturnType<typeof loadDemands>>[number];

function loadDemands(s: Settings) {
  return db.retrofitDemand.findMany({
    where: { status: { in: ["ACTIVE", "MATCHED"] }, jointIntent: { notIn: s.matching.excludedIntents } },
    include: { building: true },
  });
}

function toNode(d: DemandWithBuilding, trade: string, s: Settings): MatchNode {
  return {
    buildingId: d.buildingId,
    demandId: d.id,
    lat: d.building.lat,
    lng: d.building.lng,
    trades: parseJson<string[]>(d.tradesJson, []),
    desiredStart: d.desiredStart,
    grossArea: d.building.grossArea,
    usage: d.building.usage,
    structure: d.building.structure,
    quantity: quantityFor(d.building, trade, s.pricing).amount,
    floors: d.building.floors,
    households: d.building.households,
  };
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// 한 Cluster 의 매칭 설명: 구성원 적합도, 주변 후보의 제외 사유·대기 풀, 비용 구성, 규모 곡선, 진행바
export async function explainCluster(clusterId: string, viewerBuildingId: string | null) {
  const settings = await getSettings();
  const s = settings.matching;
  const cluster = await db.cluster.findUnique({
    where: { id: clusterId },
    include: {
      members: { where: { status: { not: "LEFT" } }, include: { building: true, demand: true } },
      tenders: { orderBy: { createdAt: "desc" }, take: 1, include: { bids: { where: { status: { not: "WITHDRAWN" } }, select: { tierPricesJson: true } } } },
    },
  });
  if (!cluster) return null;
  const trade = cluster.trade;
  const demands = await loadDemands(settings);
  const byBuilding = new Map(demands.map((d) => [d.buildingId, d]));

  const memberNodes = cluster.members
    .map((m) => byBuilding.get(m.buildingId) ?? (m.demand ? { ...m.demand, building: m.building } : null))
    .filter((d): d is DemandWithBuilding => !!d)
    .map((d) => toNode(d, trade, settings));
  const memberIds = new Set(cluster.members.map((m) => m.buildingId));
  const label = (buildingId: string, i: number) => (buildingId === viewerBuildingId ? "우리 집" : `이웃 ${LETTERS[i % 26]}`);
  const labels = new Map(cluster.members.map((m, i) => [m.buildingId, label(m.buildingId, i)]));

  // 구성원끼리 적합도
  const pairs = [];
  for (let i = 0; i < memberNodes.length; i++)
    for (let j = i + 1; j < memberNodes.length; j++) {
      const e = scorePair(memberNodes[i], memberNodes[j], trade, s);
      pairs.push({ a: labels.get(memberNodes[i].buildingId)!, b: labels.get(memberNodes[j].buildingId)!, score: e ? Math.round(e.total) : null, breakdown: e?.breakdown ?? null, km: e?.km ?? null });
    }
  const mine = viewerBuildingId ? memberNodes.find((n) => n.buildingId === viewerBuildingId) : null;
  const myPairs = mine ? pairs.filter((p) => p.a === "우리 집" || p.b === "우리 집") : [];

  // 같은 공종의 다른 활성 Cluster 에 묶인 건물은 후보에서 뺀다
  const otherMembers = await db.clusterMember.findMany({
    where: { status: { not: "LEFT" }, cluster: { trade, id: { not: clusterId }, status: { notIn: ["CANCELLED", "COMPLETED"] } } },
    select: { buildingId: true },
  });
  const taken = new Set(otherMembers.map((m) => m.buildingId));
  const center = { lat: cluster.centerLat, lng: cluster.centerLng };
  const reach = s.radiusKm + s.waitlistSlack.km;
  const full = memberNodes.length >= s.maxClusterSize;
  const candidates = demands
    .filter((d) => !memberIds.has(d.buildingId) && !taken.has(d.buildingId) && relevantTo(parseJson<string[]>(d.tradesJson, []), trade, s))
    .filter((d) => haversineKm(center, d.building) <= reach)
    .map((d) => ({ dong: d.building.dong, ...explainCandidate(toNode(d, trade, settings), memberNodes, trade, s, full) }))
    .sort((a, b) => (a.status === b.status ? a.km - b.km : a.status === "WAITLIST" ? -1 : 1))
    .slice(0, 12)
    .map((c, i) => ({ ...c, id: `후보 ${i + 1}` }));

  // 비용 구성 (구성원 평균 개별 견적 기준)
  const solos = cluster.members.map((m) => soloEstimate(m.building, trade, settings.pricing));
  const soloTotal = solos.reduce((a, r) => a + (r.low + r.high) / 2, 0) / Math.max(1, solos.length);
  const discountAt = (n: number) => {
    const t = discountFor(n, settings.pricing);
    return (t.low + t.high) / 2;
  };
  const n = memberNodes.length;
  const breakdown = costBreakdown(soloTotal, n, discountAt(n), s);
  const curve = sizeCurve(soloTotal, discountAt, s);

  const joined = cluster.members.filter((m) => m.status === "JOINED").length;
  const bidTiers = cluster.tenders[0]?.bids.map((b) => parseJson<BidTier[]>(b.tierPricesJson, [])) ?? null;
  const progress = tierProgress(joined, bidTiers?.length ? bidTiers : null, settings.pricing.jointDiscountTiers);

  return { cluster, settings: s, trade, n, pairs, myPairs, candidates, breakdown, curve, progress, joined };
}

// 내 건물 기준: 반경 안에서 같이 묶일 수 있는 이웃 수와, 묶음 성사까지 몇 동 더 필요한지
export async function neighborNeed(buildingId: string, trades: string[]) {
  const settings = await getSettings();
  const s = settings.matching;
  const demands = await loadDemands(settings);
  const me = demands.find((d) => d.buildingId === buildingId);
  if (!me) return [];
  return trades.map((trade) => {
    const meNode = toNode(me, trade, settings);
    const near = demands.filter((d) => d.buildingId !== buildingId && relevantTo(parseJson<string[]>(d.tradesJson, []), trade, s)).filter((d) => scorePair(meNode, toNode(d, trade, settings), trade, s) != null).length;
    return { trade, near, need: Math.max(0, s.minClusterSize - 1 - near) };
  });
}
