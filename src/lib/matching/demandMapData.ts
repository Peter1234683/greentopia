import "server-only";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { parseJson } from "@/lib/constants";
import { demandGrid } from "./demandMap";

// 수요 지도용 데이터: 진행 중 수요를 격자 칸으로 모은다 (건물 위치는 내보내지 않음)
export async function loadDemandCells(trade?: string, sigungu?: string) {
  const settings = await getSettings();
  const demands = await db.retrofitDemand.findMany({
    where: { status: { in: ["ACTIVE", "MATCHED"] }, ...(sigungu ? { building: { sigungu } } : {}) },
    select: { tradesJson: true, building: { select: { lat: true, lng: true } } },
  });
  const pts = demands.map((d) => ({ lat: d.building.lat, lng: d.building.lng, trades: parseJson<string[]>(d.tradesJson, []) }));
  const { gridDeg, minCellCount } = settings.matching.demandMap;
  const cells = demandGrid(pts, gridDeg, minCellCount, trade);
  const max = Math.max(1, ...cells.map((c) => c.count));
  // 칸 크기의 절반 정도 반지름 (위도 1도 ≈ 111km)
  const radiusM = Math.round((gridDeg * 111_000) / 2);
  return { cells, max, radiusM, total: pts.filter((p) => !trade || p.trades.includes(trade)).length };
}
