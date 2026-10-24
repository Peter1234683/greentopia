import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { loadContractors, loadPQRules } from "@/lib/bidding/contractors";
import { checkEligibility } from "@/lib/bidding/eligibility";
import { clusterEstimate } from "@/lib/bidding/tenders";
import { closeTenderAction, confirmTenderAction } from "@/app/actions/admin";
import { Badge, Button, Card } from "@/components/ui";
import { MethodBadge } from "@/components/contractor/TenderBits";
import { CONTRACT_STATUS_LABEL, GRADE_LABEL, TENDER_METHOD_LABEL, TENDER_STATUS_LABEL, TRADE_LABEL, parseJson, type Grade, type Trade } from "@/lib/constants";
import { won } from "@/lib/format";

export const metadata: Metadata = { title: "공고 상세" };

const SCORE_KEYS = [["price", "가격"], ["record", "실적"], ["duration", "기간"], ["warranty", "A/S"], ["reputation", "평판"]] as const;

export default async function AdminTender(props: PageProps<"/admin/tenders/[id]">) {
  const { id } = await props.params;
  const t = await db.tender.findUnique({
    where: { id },
    include: {
      cluster: true,
      nominations: true,
      parentTender: { include: { bids: { include: { evaluation: true } } } },
      reannouncements: true,
      bids: { where: { status: { not: "WITHDRAWN" } }, include: { contractor: true, evaluation: true } },
      contracts: { include: { building: true, contractor: true } },
    },
  });
  if (!t) notFound();
  const [settings, contractors, rules, est] = await Promise.all([getSettings(), loadContractors(), loadPQRules(), clusterEstimate(t.clusterId)]);
  const qual = parseJson<Record<string, unknown>>(t.qualificationJson, {});
  const basicQualified = contractors.filter((c) => checkEligibility(c, { method: "OPEN", trade: t.cluster.trade, sigungu: t.cluster.sigungu, qualification: { expandedRegion: true }, nominatedIds: [] }, rules).eligible);
  const allContracts = await db.contract.groupBy({ by: ["contractorId", "isNegotiated"], _count: true });
  const negShare = (cid: string) => {
    const rows = allContracts.filter((r) => r.contractorId === cid);
    const total = rows.reduce((s, r) => s + r._count, 0);
    const neg = rows.filter((r) => r.isNegotiated).reduce((s, r) => s + r._count, 0);
    return total ? neg / total : 0;
  };
  // 수의계약 추천 업체: 직전 공고 최고 순위 → 없으면 평판 순
  const prevBest = t.parentTender?.bids.filter((b) => b.evaluation?.rank).sort((a, b) => a.evaluation!.rank! - b.evaluation!.rank!)[0]?.contractorId;
  const negDefault = prevBest ?? [...basicQualified].sort((a, b) => (b.reputationScore ?? 0) - (a.reputationScore ?? 0))[0]?.id;
  const sorted = [...t.bids].sort((a, b) => (a.evaluation?.rank ?? 99) - (b.evaluation?.rank ?? 99));
  const balanced = parseJson<{ balancedPrice?: number }>(sorted[0]?.evaluation?.pqDetailsJson, {}).balancedPrice;

  return (
    <div className="space-y-5">
      <Link href="/admin/tenders" className="text-sm text-muted">‹ 입찰 관리</Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-extrabold">Cluster #{t.cluster.code} · {TRADE_LABEL[t.cluster.trade as Trade]} · {t.round}차 공고</h1>
        <MethodBadge method={t.method} />
        <Badge tone="gray">{TENDER_STATUS_LABEL[t.status]}</Badge>
      </div>
      <Card>
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div className="flex justify-between"><dt className="text-muted">지역 · 참여</dt><dd>{t.cluster.sigungu} · {est.n}동</dd></div>
          <div className="flex justify-between"><dt className="text-muted">예상 공사비 (가정)</dt><dd>{won(est.low)} ~ {won(est.high)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">공고 상한</dt><dd>{t.priceCap ? won(t.priceCap) : "-"}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">평가 방식</dt><dd>{est.mid >= settings.bidding.largeClusterAmount ? "전체 항목 평가" : "소형 간이 평가"}</dd></div>
          {t.status !== "DRAFT" && <div className="flex justify-between"><dt className="text-muted">마감</dt><dd>{t.deadline.toLocaleString("ko-KR")}</dd></div>}
          {t.failReason && <div className="flex justify-between text-danger"><dt>유찰 사유</dt><dd>{t.failReason}</dd></div>}
        </dl>
        {t.reannouncements.map((r) => (
          <Link key={r.id} href={`/admin/tenders/${r.id}`} className="mt-2 block text-sm font-semibold text-forest-700">→ {r.round}차 공고로 이동</Link>
        ))}
      </Card>

      <Card>
        <p className="font-bold">🤖 입찰 방식 추천: {TENDER_METHOD_LABEL[t.recommendedMethod ?? t.method]}</p>
        <ul className="mt-2 space-y-1 text-sm">{(t.recommendationReason ?? "").split("\n").map((r) => <li key={r}>• {r}</li>)}</ul>
        {t.method === "RESTRICTED" && <p className="mt-2 text-sm text-warn">조건: 실적 {String(qual.minProjects)}건 · 기술인력 {String(qual.minTechStaff)}명 · 권역 한정 {qual.regionOnly ? "예" : "아니요"}</p>}
      </Card>

      {t.status === "DRAFT" && (
        <Card className="ring-mint-300">
          <p className="mb-3 font-bold">입찰 방식 확정</p>
          <form action={confirmTenderAction} className="space-y-4">
            <input type="hidden" name="tenderId" value={t.id} />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Object.entries(TENDER_METHOD_LABEL).map(([k, l]) => (
                <label key={k} className="cursor-pointer">
                  <input type="radio" name="method" value={k} defaultChecked={k === t.method} className="peer sr-only" />
                  <span className="block rounded-xl py-2.5 text-center text-sm ring-1 ring-line peer-checked:bg-forest-800 peer-checked:font-semibold peer-checked:text-white">{l}</span>
                </label>
              ))}
            </div>
            <fieldset className="rounded-xl bg-surface p-3">
              <legend className="px-1 text-sm font-semibold">지명경쟁 시 지명 업체 (2곳 이상)</legend>
              <div className="mt-1 grid gap-1 sm:grid-cols-2">
                {basicQualified.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="nominatedIds" value={c.id} defaultChecked={t.nominations.some((n) => n.contractorId === c.id)} />
                    {c.name} <span className="text-xs text-muted">{GRADE_LABEL[c.grade as Grade]} · {c.reputationScore?.toFixed(0) ?? "신규"}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="rounded-xl bg-surface p-3">
              <legend className="px-1 text-sm font-semibold">수의계약 시 업체</legend>
              <select name="contractorId" defaultValue={negDefault} className="mt-1 w-full rounded-lg border border-line bg-white p-2 text-sm">
                {basicQualified.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — 수의계약 비중 {Math.round(negShare(c.id) * 100)}%{negShare(c.id) >= settings.bidding.negotiatedShareAlert ? " ⚠" : ""}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-muted">
                안전장치: 직전 공고 상한({t.priceCap ? won(t.priceCap) : "-"})을 넘을 수 없음 · 전환 사유를 건물주에게 공개 · 건물주별 동의 후 계약 · 업체별 수의계약 비중 모니터링
              </p>
            </fieldset>
            <Button className="w-full">확정하고 공고 열기</Button>
          </form>
          <p className="mt-2 text-xs text-muted">자격 업체 {basicQualified.length}곳 (권역 확대 기준)</p>
        </Card>
      )}

      {t.status === "OPEN" && (
        <Card>
          <p className="font-bold">입찰 진행 중 · {t.bids.length}건 제출 (봉인)</p>
          <p className="mt-1 text-sm text-muted">마감 전에는 입찰 금액을 볼 수 없어요.</p>
          <form action={closeTenderAction} className="mt-3">
            <input type="hidden" name="tenderId" value={t.id} />
            <Button variant="outline" className="w-full py-2.5">지금 마감하고 평가 실행</Button>
          </form>
        </Card>
      )}

      {sorted.some((b) => b.evaluation) && (
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <p className="font-bold">종합평가 결과</p>
            {balanced && <p className="text-xs text-muted">균형가격 {won(balanced)}</p>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted">
                <tr><th className="py-1 text-left">순위</th><th className="text-left">업체</th><th className="text-right">총액</th>{SCORE_KEYS.map(([, l]) => <th key={l} className="text-right">{l}</th>)}<th className="text-right">합계</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sorted.map((b) => {
                  const sc = parseJson<Record<string, number>>(b.evaluation?.scoresJson, {});
                  const pq = parseJson<{ failures?: string[]; overCap?: boolean; dumping?: boolean }>(b.evaluation?.pqDetailsJson, {});
                  return (
                    <tr key={b.id} className={b.status === "WON" ? "bg-mint-50" : ""}>
                      <td className="py-1.5">{b.evaluation?.rank ?? "–"}</td>
                      <td>
                        {b.contractor.companyName}
                        {!b.evaluation?.pqPassed && <span className="ml-1 text-xs text-danger">PQ 탈락</span>}
                        {pq.overCap && <span className="ml-1 text-xs text-danger">상한 초과</span>}
                        {pq.dumping && <span className="ml-1 text-xs text-warn">저가{b.dumpingReason ? "(사유 제출)" : ""}</span>}
                      </td>
                      <td className="text-right tabular-nums">{won(b.totalPrice)}</td>
                      {SCORE_KEYS.map(([k]) => <td key={k} className="text-right tabular-nums">{sc[k]?.toFixed(1) ?? "-"}</td>)}
                      <td className="text-right font-bold tabular-nums">{b.evaluation?.total.toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {t.contracts.length > 0 && (
        <Card>
          <p className="mb-2 font-bold">건물별 계약 ({t.contracts[0].contractor.companyName})</p>
          <ul className="divide-y divide-line text-sm">
            {t.contracts.map((c) => (
              <li key={c.id} className="flex justify-between py-1.5">
                <span>{c.building.address}</span>
                <span className="tabular-nums">{won(c.amount)} · {CONTRACT_STATUS_LABEL[c.status]}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
