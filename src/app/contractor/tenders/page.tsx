import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { checkEligibility } from "@/lib/bidding/eligibility";
import { loadPQRules } from "@/lib/bidding/contractors";
import { tenderEligInput } from "@/lib/bidding/tenders";
import { myContractor } from "@/lib/bidding/view";
import { quantityFor, type Quantity } from "@/lib/pricing";
import { MapView } from "@/components/map/MapView";
import { Badge, Card, inputClass } from "@/components/ui";
import { MethodBadge, dDay, qtyText } from "@/components/contractor/TenderBits";
import { TENDER_METHOD_LABEL, TRADES, TRADE_LABEL, parseJson, type Trade } from "@/lib/constants";
import { won } from "@/lib/format";

export const metadata: Metadata = { title: "입찰 공고" };

export default async function TendersPage(props: PageProps<"/contractor/tenders">) {
  const user = await requireRole("CONTRACTOR");
  const sp = await props.searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const scope = one("scope") || "mine";
  const trade = one("trade");
  const method = one("method");
  const minSize = Number(one("minSize") || 0);
  const due = Number(one("due") || 0);

  const now = new Date().getTime();
  const me = await myContractor(user.contractorProfile!.id);
  const [settings, rules] = await Promise.all([getSettings(), loadPQRules()]);
  const tenders = await db.tender.findMany({
    where: { status: "OPEN", deadline: { gt: new Date() } },
    include: {
      nominations: true,
      cluster: { include: { members: { where: { status: "JOINED" }, include: { building: true } } } },
      bids: { where: { contractorId: me.id, status: { not: "WITHDRAWN" } }, select: { id: true } },
    },
    orderBy: { deadline: "asc" },
  });

  const rows = tenders
    .map((t) => {
      const elig = checkEligibility(me, tenderEligInput(t), rules);
      const qty = t.cluster.members.reduce(
        (s, m) => s + (parseJson<Record<string, Quantity>>(m.quantityJson, {})[t.cluster.trade]?.amount ?? quantityFor(m.building, t.cluster.trade, settings.pricing).amount),
        0,
      );
      const inMyArea = me.trades.includes(t.cluster.trade) && (me.regions.includes("전체") || me.regions.includes(t.cluster.sigungu));
      return { t, elig, qty, unit: settings.pricing.trades[t.cluster.trade].unit, inMyArea, size: t.cluster.members.length };
    })
    .filter((r) => (scope === "mine" ? r.inMyArea || r.t.nominations.some((n) => n.contractorId === me.id) : true))
    .filter((r) => (trade ? r.t.cluster.trade === trade : true))
    .filter((r) => (method ? r.t.method === method : true))
    .filter((r) => r.size >= minSize)
    .filter((r) => (due ? r.t.deadline.getTime() - now <= due * 864e5 : true));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">입찰 공고</h1>

      <form className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-3 ring-1 ring-line/60 text-sm" aria-label="공고 필터">
        <select name="scope" defaultValue={scope} className={`${inputClass} py-2 text-sm`} aria-label="범위">
          <option value="mine">내 공종·권역</option>
          <option value="all">전체 공고</option>
        </select>
        <select name="trade" defaultValue={trade} className={`${inputClass} py-2 text-sm`} aria-label="공종">
          <option value="">모든 공종</option>
          {TRADES.map((t) => <option key={t} value={t}>{TRADE_LABEL[t]}</option>)}
        </select>
        <select name="method" defaultValue={method} className={`${inputClass} py-2 text-sm`} aria-label="입찰 방식">
          <option value="">모든 입찰방식</option>
          {Object.entries(TENDER_METHOD_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select name="minSize" defaultValue={String(minSize || "")} className={`${inputClass} py-2 text-sm`} aria-label="규모">
          <option value="">모든 규모</option>
          <option value="5">5동 이상</option>
          <option value="8">8동 이상</option>
        </select>
        <select name="due" defaultValue={String(due || "")} className={`${inputClass} py-2 text-sm`} aria-label="마감일">
          <option value="">모든 마감일</option>
          <option value="3">3일 이내 마감</option>
          <option value="7">7일 이내 마감</option>
        </select>
        <button className="rounded-xl bg-forest-800 py-2 font-semibold text-white">적용</button>
      </form>

      {rows.length > 0 && (
        <MapView
          center={[35.8714, 128.6014]}
          zoom={11}
          height={200}
          markers={rows.map((r) => ({
            id: r.t.id,
            lat: r.t.cluster.centerLat,
            lng: r.t.cluster.centerLng,
            tone: r.elig.eligible ? ("highlight" as const) : ("other" as const),
            label: `#${r.t.cluster.code} ${TRADE_LABEL[r.t.cluster.trade as Trade]} · ${r.size}동`,
          }))}
        />
      )}

      <p className="text-sm text-muted">{rows.length}건</p>
      {rows.length === 0 && (
        <Card className="text-center text-sm text-muted">
          조건에 맞는 공고가 없어요.{scope === "mine" && <> <Link href="/contractor/tenders?scope=all" className="text-forest-700 underline">전체 공고 보기</Link></>}
        </Card>
      )}

      <ul className="space-y-3">
        {rows.map(({ t, elig, qty, unit, size }) => (
          <li key={t.id}>
            <Link href={`/contractor/tenders/${t.id}`} className="block">
              <Card className="p-4 hover:ring-mint-300">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-forest-700">Cluster #{t.cluster.code} · {t.cluster.sigungu}{t.round > 1 && ` · ${t.round}차 공고`}</p>
                    <p className="font-bold">{TRADE_LABEL[t.cluster.trade as Trade]} 공동시공 {size}동</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <MethodBadge method={t.method} />
                    <span className="text-xs font-bold text-danger">{dDay(t.deadline)}</span>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-surface py-2"><dt className="text-muted">총 물량</dt><dd className="font-bold">{qtyText(qty, unit)}</dd></div>
                  <div className="rounded-xl bg-surface py-2"><dt className="text-muted">반경</dt><dd className="font-bold">{t.cluster.radiusKm}km</dd></div>
                  <div className="rounded-xl bg-surface py-2"><dt className="text-muted">상한</dt><dd className="font-bold">{t.priceCap ? won(t.priceCap) : "-"}</dd></div>
                </dl>
                <p className="mt-2 text-xs text-muted">
                  공사 {t.workStart?.toLocaleDateString("ko-KR")} ~ {t.workEnd?.toLocaleDateString("ko-KR")} · 마감 {t.deadline.toLocaleDateString("ko-KR")}
                </p>
                <div className="mt-2">
                  {t.bids.length > 0 ? (
                    <Badge tone="forest">입찰서 제출함</Badge>
                  ) : elig.eligible ? (
                    <Badge tone="mint">참가 가능</Badge>
                  ) : (
                    <p className="text-xs font-semibold text-danger">{elig.failures[0]}</p>
                  )}
                  {elig.warnings.map((w) => <p key={w} className="mt-1 text-xs text-warn">{w}</p>)}
                </div>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
