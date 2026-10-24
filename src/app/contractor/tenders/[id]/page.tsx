import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { loadTenderView, myContractor } from "@/lib/bidding/view";
import { tierRanges } from "@/lib/bidding/bidMath";
import { withdrawBid } from "@/app/actions/bid";
import { MapView } from "@/components/map/MapView";
import { Badge, Basis, Button, ButtonLink, Card } from "@/components/ui";
import { MethodBadge, dDay, qtyText } from "@/components/contractor/TenderBits";
import { blur } from "@/lib/geo";
import { TRADE_LABEL, USAGE_LABEL, parseJson, type Trade } from "@/lib/constants";
import { won } from "@/lib/format";

export const metadata: Metadata = { title: "공고 상세" };

export default async function TenderDetail(props: PageProps<"/contractor/tenders/[id]">) {
  const user = await requireRole("CONTRACTOR");
  const { id } = await props.params;
  const me = await myContractor(user.contractorProfile!.id);
  const v = await loadTenderView(id, me);
  if (!v) notFound();
  const { tender: t, members, eligibility, myBid, pricing } = v;
  const qual = parseJson<Record<string, unknown>>(t.qualificationJson, {});
  const tiers = tierRanges(members.length, v.minClusterSize, v.bidding.tierUpperShare, v.bidding.tierExtra);
  const totalQty = members.reduce((s, m) => s + m.amount, 0);
  const activeBid = myBid && myBid.status !== "WITHDRAWN" ? myBid : null;

  return (
    <div className="space-y-4">
      <Link href="/contractor/tenders" className="text-sm text-muted">‹ 입찰 공고</Link>
      <div>
        <div className="flex items-center gap-2">
          <MethodBadge method={t.method} />
          <span className="text-sm font-bold text-danger">{dDay(t.deadline)}</span>
          {t.round > 1 && <Badge tone="warn">{t.round}차 공고</Badge>}
        </div>
        <h1 className="mt-1 text-xl font-extrabold">
          Cluster #{t.cluster.code} · {TRADE_LABEL[v.trade as Trade]} 공동시공
        </h1>
        <p className="text-sm text-muted">{t.cluster.sigungu} 일대 · {members.length}동 · 반경 {t.cluster.radiusKm}km · 평균 적합도 {Math.round(t.cluster.avgScore)}점</p>
      </div>

      <Card className="p-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted">총 물량</dt><dd className="text-right font-semibold">{qtyText(totalQty, pricing.unit)}</dd>
          <dt className="text-muted">공고 상한</dt><dd className="text-right font-semibold">{t.priceCap ? won(t.priceCap) : "없음"}</dd>
          <dt className="text-muted">희망 공사기간</dt><dd className="text-right">{t.workStart?.toLocaleDateString("ko-KR")} ~ {t.workEnd?.toLocaleDateString("ko-KR")}</dd>
          <dt className="text-muted">입찰 마감</dt><dd className="text-right">{t.deadline.toLocaleString("ko-KR")}</dd>
          <dt className="text-muted">현장확인 비용</dt><dd className="text-right">{t.siteVisitCostPolicy === "PLATFORM" ? "플랫폼 부담" : "낙찰업체 정산"}</dd>
        </dl>
        {t.performanceSpec && (
          <p className="mt-3 rounded-xl bg-mint-50 p-3 text-sm"><b>공통 GR 성능조건</b><br />{t.performanceSpec}</p>
        )}
        {t.method === "RESTRICTED" && (
          <p className="mt-3 rounded-xl bg-warn-bg p-3 text-sm text-warn">
            제한경쟁 조건: 실적 {String(qual.minProjects ?? "-")}건 이상 · 기술인력 {String(qual.minTechStaff ?? "-")}명 이상{qual.regionOnly ? ` · ${t.cluster.sigungu} 권역 업체` : ""}
          </p>
        )}
        {t.recommendationReason && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-forest-700">입찰 방식 결정 근거</summary>
            <p className="mt-1 whitespace-pre-line text-muted">{t.recommendationReason}</p>
          </details>
        )}
      </Card>

      <Card className="p-4">
        <p className="mb-2 font-bold">참여 건물</p>
        <MapView
          center={[t.cluster.centerLat, t.cluster.centerLng]}
          zoom={15}
          height={180}
          circles={[{ lat: t.cluster.centerLat, lng: t.cluster.centerLng, radiusM: t.cluster.radiusKm * 1000 }]}
          markers={members.map((m) => ({ id: m.memberId, lat: blur(m.lat), lng: blur(m.lng), label: m.label }))}
        />
        <table className="mt-3 w-full text-sm">
          <thead className="text-xs text-muted">
            <tr><th className="py-1 text-left font-normal">건물</th><th className="text-left font-normal">유형</th><th className="text-right font-normal">사용승인</th><th className="text-right font-normal">물량</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {members.map((m) => (
              <tr key={m.memberId}>
                <td className="py-1.5">{m.label}</td>
                <td>{USAGE_LABEL[m.usage]}</td>
                <td className="text-right tabular-nums">{m.approvalYear ?? "-"}</td>
                <td className="text-right tabular-nums">{qtyText(m.amount, m.unit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted">
          유형별 물량: {Object.entries(v.typeTotals).map(([code, q]) => `${pricing.types.find((x) => x.code === code)?.label} ${qtyText(q, pricing.unit)}`).join(" · ")}
        </p>
        <Basis>주소는 낙찰 후 계약 단계에서 공개돼요. 물량은 추정치이며 현장확인(실측)으로 확정해요.</Basis>
      </Card>

      <Card className="p-4">
        <p className="font-bold">물량 구간</p>
        <ul className="mt-2 space-y-1 text-sm">
          {tiers.map((r, i) => (
            <li key={i} className="flex justify-between">
              <span>{r.min}~{r.max}동</span>
              <span className="text-muted">{i === 0 ? "기본 단가 (현재 참여 기준)" : "참여 이탈 시 가산율 적용"}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className={`p-4 ${eligibility.eligible ? "" : "ring-red-200"}`}>
        <p className="font-bold">참가 자격 (PQ) 확인</p>
        {eligibility.eligible ? (
          <p className="mt-1 text-sm text-forest-700">✔ 모든 참가 자격을 충족해요.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-sm text-danger">{eligibility.failures.map((f) => <li key={f}>✕ {f}</li>)}</ul>
        )}
        {eligibility.warnings.map((w) => <p key={w} className="mt-1 text-sm text-warn">{w}</p>)}
      </Card>

      {activeBid && (
        <Card className="bg-mint-50 p-4 ring-mint-300">
          <p className="font-bold">제출한 입찰서</p>
          <p className="mt-1 text-sm">총액 <b>{won(activeBid.totalPrice)}</b> · 공사기간 {activeBid.durationDays}일 · 하자보증 {activeBid.warrantyMonths}개월</p>
          <p className="mt-1 text-xs text-muted">{v.isOpen ? "마감 전까지 수정할 수 있어요." : "마감되어 봉인됐어요."}</p>
        </Card>
      )}

      {v.isOpen && eligibility.eligible && (
        <div className="space-y-2">
          <ButtonLink href={`/contractor/tenders/${t.id}/bid`} className="w-full">
            {activeBid ? "입찰서 수정하기" : "입찰하기"}
          </ButtonLink>
          {activeBid && (
            <form action={withdrawBid}>
              <input type="hidden" name="tenderId" value={t.id} />
              <Button variant="ghost" className="w-full text-sm text-muted">입찰 철회</Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
