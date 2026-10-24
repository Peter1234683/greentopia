import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { loadDemandCells } from "@/lib/matching/demandMapData";
import { demandInsights } from "@/lib/insights";
import { MapView } from "@/components/map/MapView";
import { Badge, Card } from "@/components/ui";
import { TRADE_LABEL, parseJson, type Trade } from "@/lib/constants";

export const metadata: Metadata = { title: "권역 수요 인사이트" };

export default async function Insights() {
  const user = await requireRole("CONTRACTOR");
  const id = user.contractorProfile!.id;
  const [trades, regions, settings] = await Promise.all([
    db.contractorTrade.findMany({ where: { contractorId: id } }),
    db.contractorRegion.findMany({ where: { contractorId: id } }),
    getSettings(),
  ]);
  const myTrades = trades.map((t) => t.trade);
  const all = regions.some((r) => r.sigungu === "전체");
  const sigungus = regions.map((r) => r.sigungu).filter((s) => s !== "전체");
  const where = all ? {} : { building: { sigungu: { in: sigungus } } };
  const now = new Date();
  const [demands, clusters, map] = await Promise.all([
    db.retrofitDemand.findMany({ where: { status: { in: ["ACTIVE", "MATCHED"] }, ...where }, select: { tradesJson: true, building: { select: { sigungu: true, dong: true, usage: true, structure: true, approvalDate: true } } } }),
    db.cluster.findMany({
      where: { status: { in: ["PROPOSED", "RECRUITING", "CONFIRMED"] }, trade: { in: myTrades }, ...(all ? {} : { sigungu: { in: sigungus } }), tenders: { none: { status: { in: ["OPEN", "EVALUATING", "AWARDED"] } } } },
      include: { members: { where: { status: { not: "LEFT" } }, select: { status: true } } },
    }),
    loadDemandCells(undefined, all ? undefined : sigungus),
  ]);
  const ins = demandInsights(
    demands.map((d) => ({ trades: parseJson<string[]>(d.tradesJson, []), sigungu: d.building.sigungu, dong: d.building.dong, usage: d.building.usage, structure: d.building.structure, age: d.building.approvalDate ? now.getFullYear() - d.building.approvalDate.getFullYear() : null })),
    myTrades,
  );
  const minJoined = settings.matching.minJoinedForTender;
  // 곧 공고될 가능성이 높은 묶음: 참여 확정 동수가 공고 기준에 가까운 순 (개별 건물 정보는 비공개)
  const soon = clusters
    .map((c) => ({ c, joined: c.members.filter((m) => m.status === "JOINED").length, size: c.members.length }))
    .sort((a, b) => (minJoined - a.joined) - (minJoined - b.joined) || b.size - a.size)
    .slice(0, 5);
  const maxTrade = Math.max(1, ...Object.values(ins.byTrade));

  return (
    <div className="space-y-4">
      <Link href="/contractor" className="text-sm text-muted">‹ 홈</Link>
      <div>
        <h1 className="text-xl font-extrabold">📈 권역 수요 인사이트</h1>
        <p className="text-sm text-muted">{all ? "대구 전역" : sigungus.join(" · ")} · 내 공종 {myTrades.map((t) => TRADE_LABEL[t as Trade]).join(", ")}</p>
      </div>

      <Card>
        <p className="font-bold">공종별 진행 중 수요</p>
        <ul className="mt-2 space-y-1.5 text-sm">
          {Object.entries(ins.byTrade).map(([t, n]) => (
            <li key={t} className="flex items-center gap-2">
              <span className="w-16 shrink-0">{TRADE_LABEL[t as Trade]}</span>
              <span className="h-2 flex-1 rounded-full bg-line"><span className="block h-2 rounded-full bg-forest-700" style={{ width: `${(n / maxTrade) * 100}%` }} /></span>
              <b className="w-10 text-right tabular-nums">{n}곳</b>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="font-bold">수요 집중 동네 Top 3</p>
          <ol className="mt-2 space-y-1 text-sm">{ins.topDongs.map((d, i) => <li key={d.name}><b>{i + 1}.</b> {d.name.replace("대구광역시 ", "")} <span className="text-muted">{d.count}곳</span></li>)}</ol>
        </Card>
        <Card className="p-4">
          <p className="font-bold">건물 유형</p>
          <ul className="mt-2 space-y-1 text-sm">{ins.types.slice(0, 4).map((t) => <li key={t.label}>{t.label} <span className="text-muted">{Math.round(t.ratio * 100)}%</span></li>)}</ul>
        </Card>
      </div>

      <Card className="p-4">
        <p className="mb-2 font-bold">수요 밀도 지도</p>
        <MapView center={[35.8714, 128.6014]} zoom={11} fit={map.cells.length > 1} height={260} markers={[]} bubbles={map.cells.map((c) => ({ lat: c.lat, lng: c.lng, radiusM: map.radiusM, intensity: c.count / map.max }))} />
        <p className="mt-1 text-xs text-muted">약 {Math.round((settings.matching.demandMap.gridDeg * 111_000) / 100) * 100}m 격자 단위 · 개별 건물 위치는 보여주지 않아요.</p>
      </Card>

      <section className="space-y-2">
        <h2 className="font-bold">곧 공고될 가능성이 높은 묶음</h2>
        {soon.length === 0 && <Card className="text-sm text-muted">지금은 공고 준비 중인 묶음이 없어요.</Card>}
        {soon.map(({ c, joined, size }) => (
          <Card key={c.id} className="flex items-center justify-between gap-2 p-4">
            <div>
              <p className="font-bold">{TRADE_LABEL[c.trade as Trade]} · {c.sigungu}</p>
              <p className="text-sm text-muted">후보 {size}동 · 참여 확정 {joined}동 / 공고 기준 {minJoined}동</p>
            </div>
            <Badge tone={joined >= minJoined ? "forest" : "mint"}>{joined >= minJoined ? "공고 준비" : `${minJoined - joined}동 남음`}</Badge>
          </Card>
        ))}
        <p className="text-xs text-muted">※ 개별 건물 정보는 공고가 열리기 전까지 공개하지 않아요. 라운지에서 특정 묶음의 가격·참여를 논의하는 것은 금지예요.</p>
      </section>
    </div>
  );
}
