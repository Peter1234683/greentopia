import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { runMatchingAction } from "@/app/actions/admin";
import { MapView } from "@/components/map/MapView";
import { Badge, Button } from "@/components/ui";
import { TENDER_STATUS_LABEL, TRADE_LABEL, type Trade } from "@/lib/constants";

export const metadata: Metadata = { title: "Cluster" };

const STATUS: Record<string, string> = {
  PROPOSED: "AI 제안", RECRUITING: "모집 중", CONFIRMED: "공고 준비", TENDERING: "입찰 중", AWARDED: "낙찰", IN_PROGRESS: "시공 중", COMPLETED: "완료", CANCELLED: "취소",
};

export default async function AdminClusters() {
  const clusters = await db.cluster.findMany({
    include: { members: true, tenders: { orderBy: { round: "desc" }, take: 1 } },
    orderBy: { code: "desc" },
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">Cluster ({clusters.length})</h1>
        <form action={runMatchingAction}><Button className="py-2 text-sm">AI 매칭 실행</Button></form>
      </div>
      <MapView
        center={[35.8714, 128.6014]}
        zoom={11}
        height={260}
        markers={clusters.map((c) => ({ id: c.id, lat: c.centerLat, lng: c.centerLng, label: `#${c.code} ${TRADE_LABEL[c.trade as Trade]} ${c.members.length}동`, tone: c.status === "COMPLETED" ? ("other" as const) : ("highlight" as const) }))}
        circles={clusters.filter((c) => c.status !== "COMPLETED").map((c) => ({ lat: c.centerLat, lng: c.centerLng, radiusM: c.radiusKm * 1000 }))}
      />
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line/60">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs text-muted">
            <tr><th className="px-3 py-2 text-left">#</th><th className="text-left">공종 · 지역</th><th>상태</th><th>참여</th><th>반경</th><th>적합도</th><th className="px-3">공고</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {clusters.map((c) => {
              const t = c.tenders[0];
              const joined = c.members.filter((m) => m.status === "JOINED").length;
              const active = c.members.filter((m) => m.status !== "LEFT").length;
              return (
                <tr key={c.id}>
                  <td className="px-3 py-2 font-semibold">{c.code}</td>
                  <td>{TRADE_LABEL[c.trade as Trade]} · {c.sigungu}</td>
                  <td className="text-center"><Badge tone={c.status === "PROPOSED" ? "mint" : c.status === "COMPLETED" ? "gray" : "forest"}>{STATUS[c.status]}</Badge></td>
                  <td className="text-center tabular-nums">{joined}/{active}</td>
                  <td className="text-center tabular-nums">{c.radiusKm}km</td>
                  <td className="text-center tabular-nums">{Math.round(c.avgScore)}</td>
                  <td className="px-3 text-center">{t ? <Link href={`/admin/tenders/${t.id}`} className="text-forest-700 underline">{t.round}차 {TENDER_STATUS_LABEL[t.status]}</Link> : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
