import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { reputationDetail } from "@/lib/reputationView";
import { RATING_KEYS } from "@/lib/reputation";
import { replyReview, reportReview } from "@/app/actions/review";
import { AccountActions } from "@/components/AccountActions";
import { ReviewCard } from "@/components/ReviewCard";
import { Badge, Button, Card, Input } from "@/components/ui";
import { COMPLAINT_TAGS, CONTRACTOR_REVIEW_STATUS_LABEL, GRADE_LABEL, TRADE_LABEL, type Grade, type Trade } from "@/lib/constants";

export const metadata: Metadata = { title: "내 업체" };

function Bar({ label, value, max = 5 }: { label: string; value: number; max?: number }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-24 shrink-0 text-muted">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <span className="block h-full rounded-full bg-forest-700" style={{ width: `${(value / max) * 100}%` }} />
      </span>
      <span className="w-8 text-right tabular-nums">{value.toFixed(1)}</span>
    </div>
  );
}

export default async function CompanyPage() {
  const user = await requireRole("CONTRACTOR");
  const { p, rep, reviews, benefits, next, sproutScore } = await reputationDetail(user.contractorProfile!.id);
  const extra = await db.contractorProfile.findUniqueOrThrow({ where: { id: p.id }, include: { trades: true, regions: true, documents: true } });
  const rows: [string, string][] = [
    ["대표자", p.ceoName],
    ["사업자등록번호", p.bizRegNo],
    ["GR 사업자", p.grRegistered ? `등록 (${p.grRegNo ?? "-"})` : "미등록"],
    ["건설업 등록·면허", [p.constructionLicense, p.licenseNo].filter(Boolean).join(" · ") || "-"],
    ["하자보증", p.warrantyAvailable ? "가능" : "불가"],
    ["기술인력 / 외부 실적", `${p.techStaffCount}명 / ${p.externalProjectCount}건`],
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">내 업체</h1>
      <Card className="bg-forest-900 p-5 text-white ring-0">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-lg font-bold">{p.companyName}</p>
            <p className="text-sm text-white/70">{CONTRACTOR_REVIEW_STATUS_LABEL[p.reviewStatus]}</p>
          </div>
          <span className="rounded-full bg-mint-400 px-3 py-1 text-sm font-bold text-forest-950">{p.grade === "GREEN_PARTNER" ? "🌿 " : ""}{GRADE_LABEL[p.grade as Grade]}</span>
        </div>
        <p className="mt-4 text-4xl font-extrabold tabular-nums">
          {rep ? rep.score.toFixed(1) : sproutScore.toFixed(0)}
          <span className="ml-1 text-base font-normal text-white/70">/ 100 {rep ? "평판 점수" : "새싹 트랙 초기 점수"}</span>
        </p>
        {next && (
          <p className="mt-1 text-sm text-mint-300">
            다음 등급 {GRADE_LABEL[next.grade as Grade]}: {next.minScore}점 이상 · 리뷰 {next.minReviews}건 이상 (현재 {rep?.reviewCount ?? 0}건)
          </p>
        )}
      </Card>

      <Card className="p-4">
        <p className="mb-2 font-bold">등급 혜택</p>
        {benefits.length ? (
          <ul className="space-y-1 text-sm">{benefits.map((b) => <li key={b.id}>✔ {b.description}</li>)}</ul>
        ) : (
          <p className="text-sm text-muted">현재 등급에는 별도 혜택이 없어요. 리뷰를 쌓아 우수 등급에 도전하세요.</p>
        )}
        {p.grade === "SPROUT" && (
          <p className="mt-3 rounded-xl bg-mint-50 p-3 text-sm">
            🌱 새싹 트랙: 아직 리뷰가 없어도 외부 실적({p.externalProjectCount}건)으로 초기 평판 {sproutScore.toFixed(0)}점을 받고, 소형 Cluster 공개경쟁에 우선 노출돼요.
          </p>
        )}
      </Card>

      {rep && (
        <Card className="p-4">
          <p className="mb-3 font-bold">평판 상세 <span className="text-sm font-normal text-muted">(리뷰 {rep.reviewCount}건)</span></p>
          <div className="space-y-1.5">
            {RATING_KEYS.map(([k, , l]) => <Bar key={k} label={l} value={rep.categoryAvg[k] ?? 0} />)}
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl bg-surface p-2"><dt className="text-muted">하자 처리율</dt><dd className="text-base font-bold">{Math.round(rep.defectRate * 100)}%</dd><dd className="text-muted">하자 {rep.defectCount}건</dd></div>
            <div className="rounded-xl bg-surface p-2"><dt className="text-muted">기간 준수율</dt><dd className="text-base font-bold">{Math.round(rep.scheduleRate * 100)}%</dd></div>
            <div className="rounded-xl bg-surface p-2"><dt className="text-muted">불만 태그 감점</dt><dd className="text-base font-bold text-danger">−{rep.tagPenalty}</dd></div>
          </dl>
          {Object.keys(rep.tagCounts).length > 0 && (
            <div className="mt-3">
              <p className="text-sm text-muted">자주 나온 불만</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {Object.entries(rep.tagCounts).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
                  <Badge key={t} tone="danger">{COMPLAINT_TAGS.find((x) => x.code === t)?.label} {n}</Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="font-bold">받은 리뷰 ({reviews.length})</h2>
        {reviews.length === 0 && <Card className="text-sm text-muted">아직 받은 리뷰가 없어요.</Card>}
        {reviews.map((r) => (
          <ReviewCard key={r.id} r={r} author={r.author.name.slice(0, 1) + "○○"}>
            {!r.reply && (
              <form action={replyReview} className="mt-3 flex gap-2">
                <input type="hidden" name="reviewId" value={r.id} />
                <Input name="reply" placeholder="답글 남기기" className="py-2 text-sm" />
                <Button variant="outline" className="shrink-0 px-3 py-2 text-sm">등록</Button>
              </form>
            )}
            {r.status === "VISIBLE" && (
              <form action={reportReview} className="mt-2 text-right">
                <input type="hidden" name="reviewId" value={r.id} />
                <input type="hidden" name="reason" value="업체 신고: 허위·비방 의심" />
                <button className="text-xs text-muted underline">허위·비방 신고</button>
              </form>
            )}
          </ReviewCard>
        ))}
      </section>

      <Card className="p-4">
        <p className="mb-2 font-bold">업체 정보</p>
        <dl className="divide-y divide-line text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
          ))}
        </dl>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {extra.trades.map((t) => <Badge key={t.id}>{TRADE_LABEL[t.trade as Trade]}</Badge>)}
          {extra.regions.map((r) => <Badge key={r.id} tone="gray">{r.sigungu === "전체" ? "대구 전역" : r.sigungu}</Badge>)}
        </div>
      </Card>
      <AccountActions />
    </div>
  );
}
