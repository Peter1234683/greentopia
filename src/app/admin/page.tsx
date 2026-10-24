import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { closeDueTendersAction, runMatchingAction } from "@/app/actions/admin";
import { Button, Card } from "@/components/ui";

export const metadata: Metadata = { title: "운영자" };

export default async function AdminHome() {
  const [customers, buildings, demands, approved, reviews, pendingC, drafts, open, dueOpen, reports, flags, clusters] = await Promise.all([
    db.user.count({ where: { role: "CUSTOMER" } }),
    db.building.count(),
    db.retrofitDemand.count({ where: { status: { in: ["ACTIVE", "MATCHED"] } } }),
    db.contractorProfile.count({ where: { reviewStatus: "APPROVED" } }),
    db.review.count(),
    db.contractorProfile.count({ where: { reviewStatus: "PENDING" } }),
    db.tender.count({ where: { status: "DRAFT" } }),
    db.tender.count({ where: { status: "OPEN" } }),
    db.tender.count({ where: { status: "OPEN", deadline: { lte: new Date() } } }),
    db.reviewReport.count({ where: { status: "OPEN" } }),
    db.collusionFlag.count({ where: { status: "OPEN" } }),
    db.cluster.count({ where: { status: { in: ["PROPOSED", "RECRUITING"] } } }),
  ]);
  const [intents, active, contractorAll, rejectedC, bySigungu, closed, quotes, heldPosts, flaggedReviews] = await Promise.all([
    db.retrofitDemand.groupBy({ by: ["jointIntent"], where: { status: { in: ["ACTIVE", "MATCHED"] } }, _count: true }),
    db.cluster.count({ where: { status: { in: ["RECRUITING", "CONFIRMED", "TENDERING"] } } }),
    db.contractorProfile.count(),
    db.contractorProfile.count({ where: { reviewStatus: "REJECTED" } }),
    db.building.groupBy({ by: ["sigungu"], _count: true }),
    db.tender.groupBy({ by: ["status"], where: { status: { in: ["AWARDED", "FAILED"] } }, _count: true }),
    db.contract.findMany({ where: { ownerQuote: { not: null }, status: { not: "CANCELLED" } }, select: { amount: true, ownerQuote: true } }),
    db.communityPost.count({ where: { status: "HELD" } }),
    db.reviewFlag.count({ where: { resolved: false } }),
  ]);
  const intentTotal = intents.reduce((a, r) => a + r._count, 0);
  const willing = intents.filter((r) => r.jointIntent !== "NO").reduce((a, r) => a + r._count, 0);
  const awarded = closed.find((r) => r.status === "AWARDED")?._count ?? 0;
  const failed = closed.find((r) => r.status === "FAILED")?._count ?? 0;
  const vsQuote = quotes.length ? quotes.reduce((a, q) => a + q.amount / q.ownerQuote!, 0) / quotes.length : null;
  const regions = bySigungu.sort((a, b) => b._count - a._count);
  const maxRegion = Math.max(1, ...regions.map((r) => r._count));
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const pilot: [string, string, string][] = [
    ["등록 건물", `${buildings}`, `건물주 ${customers}명`],
    ["공동공사 참여 의향률", intentTotal ? pct(willing / intentTotal) : "-", `수요 ${intentTotal}건 중 함께/고민 ${willing}`],
    ["가동 예정 Cluster", `${active}`, `AI 제안 ${clusters}`],
    ["업체 가입 · 승인 · 대기", `${contractorAll} · ${approved} · ${pendingC}`, rejectedC ? `반려 ${rejectedC}` : "반려 0"],
    ["입찰 성사율", awarded + failed ? pct(awarded / (awarded + failed)) : "-", `낙찰 ${awarded} · 유찰 ${failed}`],
    ["낙찰가 vs 개별 견적", vsQuote == null ? "데이터 없음" : `${pct(vsQuote)}`, vsQuote == null ? "건물주가 개별 견적을 입력하면 계산돼요" : `개별 견적 입력 ${quotes.length}건 평균`],
  ];
  const stats: [string, number][] = [["진행 중 수요", demands], ["리뷰", reviews]];
  const todos: [string, number, string][] = [
    ["사업자 가입 심사", pendingC, "/admin/contractors"],
    ["입찰 방식 확정 대기", drafts, "/admin/tenders?status=DRAFT"],
    ["마감 지난 공고 (평가 필요)", dueOpen, "/admin/tenders?status=OPEN"],
    ["리뷰 신고", reports, "/admin/reviews"],
    ["담합 의심 플래그", flags, "/admin/monitoring"],
    ["라운지 보류 글 · 커뮤니티 신고", heldPosts, "/admin/community"],
    ["리뷰 교차 검증", flaggedReviews, "/admin/reviews"],
  ];
  return (
    <div className="space-y-6">
      <section>
        <h1 className="mb-3 text-lg font-bold">파일럿 현황 (대구)</h1>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="pilot">
          {pilot.map(([label, v, sub]) => (
            <Card key={label} className="p-4">
              <p className="text-xs text-muted">{label}</p>
              <p className="text-2xl font-extrabold tabular-nums">{v}</p>
              <p className="text-xs text-muted">{sub}</p>
            </Card>
          ))}
          {stats.map(([label, n]) => (
            <Card key={label} className="p-4">
              <p className="text-xs text-muted">{label}</p>
              <p className="text-2xl font-extrabold tabular-nums">{n}</p>
            </Card>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-bold">지역별 등록 건물</h2>
        <Card className="space-y-1.5 p-4">
          {regions.map((r) => (
            <div key={r.sigungu} className="flex items-center gap-2 text-sm">
              <span className="w-16 shrink-0">{r.sigungu.replace("대구광역시 ", "")}</span>
              <span className="h-2 flex-1 rounded-full bg-line"><span className="block h-2 rounded-full bg-forest-700" style={{ width: `${(r._count / maxRegion) * 100}%` }} /></span>
              <b className="w-8 text-right tabular-nums">{r._count}</b>
            </div>
          ))}
        </Card>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-bold">처리할 일</h2>
        <ul className="divide-y divide-line rounded-2xl bg-white ring-1 ring-line/60">
          {todos.map(([label, n, href]) => (
            <li key={label}>
              <Link href={href} className="flex items-center justify-between px-4 py-3 hover:bg-mint-50">
                <span>{label}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${n ? "bg-warn-bg text-warn" : "bg-surface text-muted"}`}>{n}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="font-bold">AI 매칭 다시 실행</p>
          <p className="mt-1 text-sm text-muted">AI 제안 단계 Cluster {clusters}개 · 진행 중 Cluster 는 유지돼요.</p>
          <form action={runMatchingAction} className="mt-3"><Button className="w-full py-2.5">매칭 실행</Button></form>
        </Card>
        <Card>
          <p className="font-bold">마감 공고 일괄 평가</p>
          <p className="mt-1 text-sm text-muted">진행 중 공고 {open}건 · 마감 지남 {dueOpen}건</p>
          <form action={closeDueTendersAction} className="mt-3"><Button className="w-full py-2.5" disabled={!dueOpen}>마감 공고 평가</Button></form>
        </Card>
      </section>
    </div>
  );
}
