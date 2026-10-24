import type { Metadata } from "next";
import { db } from "@/lib/db";
import { reviewContractor } from "@/app/actions/admin";
import { Badge, Button, Card, inputClass } from "@/components/ui";
import { GRADE_LABEL, TRADE_LABEL, type Grade, type Trade } from "@/lib/constants";

export const metadata: Metadata = { title: "업체 심사" };

const DOC_LABEL: Record<string, string> = { GR_CERT: "GR 등록 증빙", LICENSE: "면허 증빙" };

export default async function ContractorReview() {
  const [pending, approved] = await Promise.all([
    db.contractorProfile.findMany({
      where: { reviewStatus: "PENDING" },
      include: { trades: true, regions: true, documents: true, user: true },
      orderBy: { createdAt: "asc" },
    }),
    db.contractorProfile.findMany({ where: { reviewStatus: { not: "PENDING" } }, orderBy: { companyName: "asc" }, include: { trades: true } }),
  ]);

  return (
    <div className="space-y-8">


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

      <section>
        <h2 className="mb-3 text-lg font-bold">등록 업체 <span className="text-muted">({approved.length})</span></h2>
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line/60">
          <table className="w-full text-sm">
            <thead className="bg-surface text-xs text-muted">
              <tr><th className="px-3 py-2 text-left">업체</th><th className="text-left">공종</th><th>등급</th><th>평판</th><th>GR</th><th>상태</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {approved.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 font-medium">{c.companyName}</td>
                  <td className="text-xs">{c.trades.map((t) => TRADE_LABEL[t.trade as Trade]).join("·")}</td>
                  <td className="text-center">{GRADE_LABEL[c.grade as Grade]}</td>
                  <td className="text-center tabular-nums">{c.reputationScore?.toFixed(1) ?? "-"}</td>
                  <td className="text-center">{c.grRegistered ? "✔" : "✕"}</td>
                  <td className="text-center">{c.reviewStatus === "APPROVED" ? <Badge>승인</Badge> : <Badge tone="danger">반려</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
