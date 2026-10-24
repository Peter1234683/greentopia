import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { pqCandidates, reviewAnomalies } from "@/lib/pqCandidates";
import { addPQRuleFromCandidate, resolveReport, resolveReviewFlag, updatePQRule } from "@/app/actions/admin";
import { ReviewCard } from "@/components/ReviewCard";
import { Badge, Button, Card } from "@/components/ui";

export const metadata: Metadata = { title: "리뷰 · PQ" };

export default async function AdminReviews() {
  const settings = await getSettings();
  const [flagged, reports, candidates, rules, anomalies] = await Promise.all([
    db.review.findMany({ where: { flags: { some: { resolved: false } } }, include: { contractor: true, flags: { where: { resolved: false } } }, orderBy: { createdAt: "desc" } }),
    db.reviewReport.findMany({ where: { status: "OPEN" }, include: { review: { include: { contractor: true } }, reporter: true }, orderBy: { createdAt: "asc" } }),
    pqCandidates(),
    db.pQRule.findMany({ orderBy: { createdAt: "asc" } }),
    reviewAnomalies(),
  ]);
  const pc = settings.reputation.pqCandidate;
  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-1 text-lg font-bold">교차 검증 필요 리뷰 ({flagged.length})</h1>
        <p className="mb-3 text-sm text-muted">같은 묶음 이웃 세대 평점과 크게 다르거나 짧은 기간에 몰린 후기예요. 확인 전까지 평판 점수에 반영하지 않아요.</p>
        {flagged.length === 0 && <Card className="text-sm text-muted">확인할 리뷰가 없어요.</Card>}
        <div className="space-y-3">
          {flagged.map((r) => (
            <Card key={r.id} className="p-4">
              <p className="text-sm font-bold">{r.contractor.companyName}</p>
              <ul className="mt-1 text-sm text-warn">{r.flags.map((f) => <li key={f.id}>⚠️ {f.detail}</li>)}</ul>
              <div className="mt-2"><ReviewCard r={r} pendingCheck /></div>
              <form action={resolveReviewFlag} className="mt-3 flex gap-2">
                <input type="hidden" name="reviewId" value={r.id} />
                <Button name="resolution" value="INCLUDE" className="py-2 text-sm">확인 · 평판 반영</Button>
                <Button name="resolution" value="EXCLUDE" variant="outline" className="py-2 text-sm">평판에서 제외</Button>
              </form>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">리뷰 신고 ({reports.length})</h2>
        {reports.length === 0 && <Card className="text-sm text-muted">처리할 신고가 없어요.</Card>}
        <div className="space-y-3">
          {reports.map((rp) => (
            <Card key={rp.id} className="p-4">
              <p className="text-sm"><b>{rp.review.contractor.companyName}</b> 리뷰 · 신고자 {rp.reporter.name} ({rp.reporter.role === "CONTRACTOR" ? "업체" : "고객"}) · 사유: {rp.reason}</p>
              <div className="mt-2"><ReviewCard r={rp.review} /></div>
              <form action={resolveReport} className="mt-3 flex gap-2">
                <input type="hidden" name="reportId" value={rp.id} />
                <Button name="decision" value="accept" className="py-2 text-sm">신고 인정 · 숨김</Button>
                <Button name="decision" value="reject" variant="outline" className="py-2 text-sm">기각 · 유지</Button>
              </form>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold">리뷰에서 자주 나온 불만 → PQ 규칙 후보</h2>
        <p className="mb-3 text-sm text-muted">리뷰 {pc.minReviews}건 이상 업체 중 같은 불만 태그가 {Math.round(pc.tagRatio * 100)}% 이상인 경우</p>
        {candidates.length === 0 && <Card className="text-sm text-muted">새 후보가 없어요.</Card>}
        <div className="space-y-3">
          {candidates.map((c) => (
            <Card key={c.tag} className="p-4">
              <div className="flex items-center justify-between">
                <p className="font-bold">{c.label} <span className="text-sm font-normal text-muted">(전체 {c.total}회)</span></p>
                <Badge tone="warn">{c.hits.length}개 업체 해당</Badge>
              </div>
              <ul className="mt-1 text-sm text-muted">
                {c.hits.map((h) => <li key={h.name}>{h.name}: 리뷰 {h.reviews}건 중 {Math.round(h.ratio * 100)}%</li>)}
              </ul>
              <form action={addPQRuleFromCandidate} className="mt-3 flex flex-wrap gap-2">
                <input type="hidden" name="tag" value={c.tag} />
                <input type="hidden" name="label" value={c.label} />
                <input type="hidden" name="ratio" value={pc.tagRatio} />
                <input type="hidden" name="minReviews" value={pc.minReviews} />
                <Button name="ruleAction" value="WARN" variant="outline" className="py-2 text-sm">경고 규칙으로 추가</Button>
                <Button name="ruleAction" value="FAIL" className="py-2 text-sm">PQ 탈락 규칙으로 추가</Button>
              </form>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">PQ 규칙 ({rules.length})</h2>
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line/60">
          <table className="w-full text-sm">
            <thead className="bg-surface text-xs text-muted"><tr><th className="px-3 py-2 text-left">규칙</th><th>출처</th><th>조치</th><th>상태</th></tr></thead>
            <tbody className="divide-y divide-line">
              {rules.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2"><p className="font-medium">{r.name}</p><p className="text-xs text-muted">{r.description}</p></td>
                  <td className="text-center text-xs">{r.source === "REVIEW_CANDIDATE" ? "리뷰 후보" : "기본"}</td>
                  <td className="text-center">
                    <form action={updatePQRule}><input type="hidden" name="ruleId" value={r.id} /><input type="hidden" name="op" value="action" />
                      <button className="underline-offset-4 hover:underline"><Badge tone={r.action === "FAIL" ? "danger" : "warn"}>{r.action === "FAIL" ? "탈락" : "경고"}</Badge></button>
                    </form>
                  </td>
                  <td className="text-center">
                    <form action={updatePQRule}><input type="hidden" name="ruleId" value={r.id} /><input type="hidden" name="op" value="toggle" />
                      <button className="text-xs underline">{r.active ? "사용 중 · 끄기" : "꺼짐 · 켜기"}</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">PQ는 통과/탈락 기준(있다/없다)이고, 종합평가는 수준(얼마나 잘하나)을 봐요. 같은 항목을 두 번 반영하지 않아요.</p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">리뷰 이상치</h2>
        {anomalies.length === 0 ? (
          <Card className="text-sm text-muted">짧은 기간에 몰린 리뷰가 없어요.</Card>
        ) : (
          <ul className="space-y-2">{anomalies.map((a) => (
            <li key={a.name}><Card className="p-3 text-sm">⚠ {a.name}: {a.from.toLocaleDateString("ko-KR")}~{a.to.toLocaleDateString("ko-KR")} 사이 리뷰 {a.count}건</Card></li>
          ))}</ul>
        )}
      </section>
    </div>
  );
}
