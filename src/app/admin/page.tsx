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
  const stats: [string, number][] = [["건물주", customers], ["등록 건물", buildings], ["진행 중 수요", demands], ["승인 업체", approved], ["리뷰", reviews]];
  const todos: [string, number, string][] = [
    ["사업자 가입 심사", pendingC, "/admin/contractors"],
    ["입찰 방식 확정 대기", drafts, "/admin/tenders?status=DRAFT"],
    ["마감 지난 공고 (평가 필요)", dueOpen, "/admin/tenders?status=OPEN"],
    ["리뷰 신고", reports, "/admin/reviews"],
    ["담합 의심 플래그", flags, "/admin/monitoring"],
  ];
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map(([label, n]) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-muted">{label}</p>
            <p className="text-2xl font-extrabold tabular-nums">{n}</p>
          </Card>
        ))}
      </section>
      <section>
        <h1 className="mb-3 text-lg font-bold">처리할 일</h1>
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
