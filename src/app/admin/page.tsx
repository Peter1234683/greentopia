import type { Metadata } from "next";
import { db } from "@/lib/db";
import { reviewContractor } from "@/app/actions/admin";
import { Badge, Button, Card, inputClass } from "@/components/ui";
import { TRADE_LABEL, type Trade } from "@/lib/constants";

export const metadata: Metadata = { title: "운영자" };

const DOC_LABEL: Record<string, string> = { GR_CERT: "GR 등록 증빙", LICENSE: "면허 증빙" };

export default async function AdminHome() {
  const [pending, counts] = await Promise.all([
    db.contractorProfile.findMany({
      where: { reviewStatus: "PENDING" },
      include: { trades: true, regions: true, documents: true, user: true },
      orderBy: { createdAt: "asc" },
    }),
    Promise.all([
      db.user.count({ where: { role: "CUSTOMER" } }),
      db.building.count(),
      db.retrofitDemand.count({ where: { status: "ACTIVE" } }),
      db.contractorProfile.count({ where: { reviewStatus: "APPROVED" } }),
      db.review.count(),
    ]),
  ]);
  const stats = ["건물주", "등록 건물", "활성 공사 수요", "승인 업체", "리뷰"].map((l, i) => [l, counts[i]] as const);

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map(([label, n]) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-muted">{label}</p>
            <p className="text-2xl font-extrabold tabular-nums">{n}</p>
          </Card>
        ))}
      </section>

      <section>
        <h1 className="mb-3 text-xl font-extrabold">사업자 가입 심사 <span className="text-muted">({pending.length})</span></h1>
        {pending.length === 0 && <Card className="text-muted">심사 대기 중인 업체가 없어요.</Card>}
        <div className="space-y-4">
          {pending.map((p) => (
            <Card key={p.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-bold">{p.companyName}</p>
                  <p className="text-sm text-muted">
                    {p.ceoName} · {p.bizRegNo} · {p.phone} · {p.user.email}
                  </p>
                </div>
                <p className="text-xs text-muted">신청일 {p.createdAt.toLocaleDateString("ko-KR")}</p>
              </div>
              <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <div><dt className="inline text-muted">GR 사업자: </dt><dd className="inline">{p.grRegistered ? `등록 (${p.grRegNo})` : <Badge tone="warn">미등록</Badge>}</dd></div>
                <div><dt className="inline text-muted">면허: </dt><dd className="inline">{p.constructionLicense} {p.licenseNo}</dd></div>
                <div><dt className="inline text-muted">하자보증: </dt><dd className="inline">{p.warrantyAvailable ? "가능" : <Badge tone="warn">불가</Badge>}</dd></div>
                <div><dt className="inline text-muted">기술인력 / 외부실적: </dt><dd className="inline">{p.techStaffCount}명 / {p.externalProjectCount}건</dd></div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.trades.map((t) => <Badge key={t.id}>{TRADE_LABEL[t.trade as Trade]}</Badge>)}
                {p.regions.map((r) => <Badge key={r.id} tone="gray">{r.sigungu === "전체" ? "대구 전역" : r.sigungu}</Badge>)}
              </div>
              {p.portfolio && <p className="mt-3 whitespace-pre-line rounded-xl bg-surface p-3 text-sm">{p.portfolio}</p>}
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                {p.documents.length === 0 && <span className="text-warn">제출 서류 없음</span>}
                {p.documents.map((d) => (
                  <a key={d.id} href={`/files/${d.id}`} target="_blank" className="rounded-full bg-mint-50 px-3 py-1 text-forest-800 underline-offset-4 hover:underline">
                    📎 {DOC_LABEL[d.kind] ?? d.kind} · {d.originalName}
                  </a>
                ))}
              </div>
              <form action={reviewContractor} className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input type="hidden" name="contractorId" value={p.id} />
                <input name="note" placeholder="메모 / 반려 사유" className={`${inputClass} sm:flex-1`} />
                <Button name="decision" value="approve" className="py-3">승인</Button>
                <Button name="decision" value="reject" variant="outline" className="py-3">반려</Button>
              </form>
            </Card>
          ))}
        </div>
      </section>

      <p className="text-sm text-muted">Cluster·입찰 방식 확정, PQ 규칙·배점 설정, 리뷰 신고, 담합 감시는 이후 마일스톤에서 추가돼요.</p>
    </div>
  );
}
