import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { reputationDetail } from "@/lib/reputationView";
import { RATING_KEYS } from "@/lib/reputation";
import { reportReview } from "@/app/actions/review";
import { ReviewCard } from "@/components/ReviewCard";
import { Badge, Card } from "@/components/ui";
import { GRADE_LABEL, TRADE_LABEL, type Grade, type Trade } from "@/lib/constants";

export const metadata: Metadata = { title: "업체 정보" };

export default async function ContractorProfile(props: PageProps<"/customer/contractors/[id]">) {
  await requireRole("CUSTOMER");
  const { id } = await props.params;
  if (!(await db.contractorProfile.count({ where: { id, reviewStatus: "APPROVED" } }))) notFound();
  const { p, rep, reviews, sproutScore } = await reputationDetail(id);
  const trades = await db.contractorTrade.findMany({ where: { contractorId: id } });
  return (
    <div className="space-y-4 pt-2">
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-extrabold">{p.companyName}</h1>
            <div className="mt-1 flex flex-wrap gap-1">{trades.map((t) => <Badge key={t.id}>{TRADE_LABEL[t.trade as Trade]}</Badge>)}</div>
          </div>
          <Badge tone="forest">{p.grade === "GREEN_PARTNER" ? "🌿 그린파트너" : GRADE_LABEL[p.grade as Grade]}</Badge>
        </div>
        <p className="mt-3 text-3xl font-extrabold tabular-nums">{rep ? rep.score.toFixed(1) : sproutScore.toFixed(0)}<span className="ml-1 text-sm font-normal text-muted">/ 100 {rep ? `평판 · 리뷰 ${rep.reviewCount}건` : "신규 업체 초기 점수"}</span></p>
        {rep && (
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {RATING_KEYS.map(([k, , l]) => <div key={k} className="flex justify-between"><dt className="text-muted">{l}</dt><dd className="tabular-nums">{rep.categoryAvg[k]?.toFixed(1)}</dd></div>)}
            <div className="flex justify-between"><dt className="text-muted">하자 처리율</dt><dd>{Math.round(rep.defectRate * 100)}%</dd></div>
            <div className="flex justify-between"><dt className="text-muted">기간 준수율</dt><dd>{Math.round(rep.scheduleRate * 100)}%</dd></div>
          </dl>
        )}
        <p className="mt-3 text-xs text-muted">GR 사업자 {p.grRegistered ? "등록" : "미등록"} · 하자보증 {p.warrantyAvailable ? "가능" : "불가"} · 외부 실적 {p.externalProjectCount}건</p>
      </Card>
      <h2 className="font-bold">이웃들의 리뷰</h2>
      {reviews.filter((r) => r.status !== "HIDDEN").map((r) => (
        <ReviewCard key={r.id} r={r} author={`${r.project.contract.building.dong} ${r.author.name.slice(0, 1)}○○`}>
          {r.status === "VISIBLE" && (
            <form action={reportReview} className="mt-2 text-right">
              <input type="hidden" name="reviewId" value={r.id} />
              <input type="hidden" name="reason" value="고객 신고: 허위·비방 의심" />
              <button className="text-xs text-muted underline">신고</button>
            </form>
          )}
        </ReviewCard>
      ))}
    </div>
  );
}
