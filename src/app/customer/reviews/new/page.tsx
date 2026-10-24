import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { followupDue } from "@/lib/reviews";
import { ReviewCard } from "@/components/ReviewCard";
import { Card } from "@/components/ui";
import { ReviewForm } from "./ReviewForm";

export const metadata: Metadata = { title: "리뷰" };

export default async function NewReview(props: PageProps<"/customer/reviews/new">) {
  const user = await requireRole("CUSTOMER");
  const sp = await props.searchParams;
  const contractId = typeof sp.contract === "string" ? sp.contract : "";
  const c = await db.contract.findFirst({
    where: { id: contractId, building: { ownerId: user.id } },
    include: { contractor: true, building: true, tender: true, project: { include: { reviews: { orderBy: { createdAt: "asc" } } } } },
  });
  if (!c || !c.project) notFound();
  const settings = await getSettings();
  const reviews = c.project.reviews;
  const hasInitial = reviews.some((r) => r.kind === "INITIAL");
  const nextFollowup = settings.reputation.followupMonths
    .map((m) => ({ m, kind: `FOLLOWUP_${m}M` as "FOLLOWUP_6M" | "FOLLOWUP_12M" }))
    .find((f) => !reviews.some((r) => r.kind === f.kind));
  const canWrite = c.status === "SIGNED" && ["COMPLETED", "AS"].includes(c.project.status);
  const kind = !hasInitial ? "INITIAL" : nextFollowup && followupDue(c.project.completedAt, nextFollowup.m) ? nextFollowup.kind : null;

  return (
    <div className="space-y-5 pt-2">
      <Link href={c.tender ? `/customer/projects/${c.tender.clusterId}` : "/customer/projects"} className="text-sm text-muted">‹ 공사 상세</Link>
      <div>
        <p className="text-sm text-muted">{c.building.nickname ?? c.building.address}</p>
        <h1 className="text-2xl font-extrabold">{c.contractor.companyName} 리뷰</h1>
      </div>
      {sp.done && (
        <p role="status" className="rounded-2xl bg-forest-800 px-4 py-3 text-sm text-white">
          ✅ 리뷰가 등록됐어요.{sp.done === "INITIAL" && ` ${settings.reputation.reviewPoints.toLocaleString("ko-KR")}P를 드렸어요.`} 업체 평판에 반영돼요.
        </p>
      )}
      {reviews.map((r) => <ReviewCard key={r.id} r={r} />)}
      {!canWrite ? (
        <Card className="text-sm text-muted">공사 완료와 계약이 확인된 뒤 리뷰를 남길 수 있어요.</Card>
      ) : kind ? (
        <section>
          <h2 className="mb-3 text-lg font-bold">{kind === "INITIAL" ? "시공은 어떠셨나요?" : `공사 ${kind === "FOLLOWUP_6M" ? "6개월" : "1년"} 후, 하자는 없나요?`}</h2>
          <ReviewForm contractId={c.id} kind={kind} />
        </section>
      ) : (
        nextFollowup && (
          <Card className="text-sm text-muted">
            {c.project.completedAt?.toLocaleDateString("ko-KR")} 완료 기준 {nextFollowup.m}개월 뒤에 하자 여부를 묻는 후속 리뷰 알림을 보내드려요.
          </Card>
        )
      )}
    </div>
  );
}
