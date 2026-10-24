import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { loadDemandCells } from "@/lib/matching/demandMapData";
import { neighborNeed } from "@/lib/matching/explain";
import { MapView } from "@/components/map/MapView";
import { Chips } from "@/components/community/Bits";
import { ButtonLink, Card } from "@/components/ui";
import { TRADES, TRADE_LABEL, parseJson, type Trade } from "@/lib/constants";

export const metadata: Metadata = { title: "우리 동네 수요 지도" };

export default async function DemandMapPage(props: PageProps<"/customer/joint/map">) {
  const user = await requireRole("CUSTOMER");
  const { t } = await props.searchParams;
  const trade = typeof t === "string" && (TRADES as readonly string[]).includes(t) ? t : undefined;
  const settings = await getSettings();
  const b = await db.building.findFirst({
    where: { ownerId: user.id },
    include: { demands: { where: { status: { in: ["ACTIVE", "MATCHED"] } }, orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "asc" },
  });
  const { cells, max, radiusM, total } = await loadDemandCells(trade);
  const myTrades = parseJson<string[]>(b?.demands[0]?.tradesJson, []);
  const needs = b && myTrades.length ? await neighborNeed(b.id, trade ? myTrades.filter((x) => x === trade) : myTrades) : [];
  const center: [number, number] = b ? [b.lat, b.lng] : [35.8714, 128.6014];

  return (
    <div className="space-y-4 pt-2">
      <Link href="/customer/joint" className="text-sm text-muted">‹ 공동공사</Link>
      <div>
        <h1 className="text-2xl font-extrabold">🗺️ 우리 동네 수요 지도</h1>
        <p className="mt-1 text-sm text-muted">진할수록 같은 공사를 원하는 이웃이 많은 곳이에요. 개인정보 보호를 위해 약 {Math.round((settings.matching.demandMap.gridDeg * 111_000) / 100) * 100}m 격자로 묶어 보여드려요.</p>
      </div>
      <Chips items={TRADES.map((x) => ({ code: x, label: TRADE_LABEL[x] }))} current={trade} href={(c) => (c ? `/customer/joint/map?t=${c}` : "/customer/joint/map")} />
      <MapView
        center={center}
        zoom={13}
        fit={false}
        height={360}
        bubbles={cells.map((c) => ({ lat: c.lat, lng: c.lng, radiusM, intensity: c.count / max, label: `${c.count}곳 · ${Object.entries(c.byTrade).map(([k, v]) => `${TRADE_LABEL[k as Trade]} ${v}`).join(", ")}` }))}
        circles={b ? [{ lat: b.lat, lng: b.lng, radiusM: settings.matching.radiusKm * 1000 }] : []}
        markers={b ? [{ id: "me", lat: b.lat, lng: b.lng, tone: "me", label: "우리 집" }] : []}
      />
      <p className="text-xs text-muted">대구 전체 {trade ? TRADE_LABEL[trade as Trade] : "공사"} 수요 {total}곳 · 점선 원: 우리 집 반경 {settings.matching.radiusKm}km (매칭 범위)</p>

      {needs.map((n) => (
        <Card key={n.trade} className="flex items-center gap-3 p-4">
          <div className="flex-1">
            <p className="font-bold">{TRADE_LABEL[n.trade as Trade]}</p>
            <p className="text-sm">
              {n.need === 0
                ? <>반경 안에 함께할 수 있는 이웃 <b>{n.near}곳</b> — 묶음 조건을 채웠어요.</>
                : <>함께할 수 있는 이웃 {n.near}곳 · <b className="text-forest-700">{n.need}세대만 더 모이면</b> 묶음이 성사돼요.</>}
            </p>
          </div>
        </Card>
      ))}
      {!b && <Card className="text-sm text-muted">내 건물을 등록하면 우리 집 기준 반경과 필요한 이웃 수를 보여드려요.</Card>}
      <ButtonLink href="/customer/invite" variant="mint" className="w-full">🙌 이웃 초대하기</ButtonLink>
    </div>
  );
}
