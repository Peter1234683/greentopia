import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { AccountActions } from "@/components/AccountActions";
import { Badge, Card } from "@/components/ui";
import { CONTRACTOR_REVIEW_STATUS_LABEL, GRADE_LABEL, TRADE_LABEL, type Grade, type Trade } from "@/lib/constants";

export const metadata: Metadata = { title: "내 업체" };

export default async function CompanyPage() {
  const user = await requireRole("CONTRACTOR");
  const p = await db.contractorProfile.findUniqueOrThrow({
    where: { id: user.contractorProfile!.id },
    include: { trades: true, regions: true, documents: true },
  });
  const rows: [string, string][] = [
    ["대표자", p.ceoName],
    ["사업자등록번호", p.bizRegNo],
    ["연락처", p.phone],
    ["GR 사업자", p.grRegistered ? `등록 (${p.grRegNo ?? "-"})` : "미등록"],
    ["건설업 등록·면허", [p.constructionLicense, p.licenseNo].filter(Boolean).join(" · ") || "-"],
    ["하자보증", p.warrantyAvailable ? "가능" : "불가"],
    ["기술인력", `${p.techStaffCount}명`],
    ["외부 GR 실적", `${p.externalProjectCount}건`],
    ["제출 서류", `${p.documents.length}건`],
  ];
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">내 업체</h1>
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-lg font-bold">{p.companyName}</p>
          <div className="flex gap-1">
            <Badge tone="forest">{GRADE_LABEL[p.grade as Grade]}</Badge>
            <Badge tone={p.reviewStatus === "APPROVED" ? "mint" : "warn"}>{CONTRACTOR_REVIEW_STATUS_LABEL[p.reviewStatus]}</Badge>
          </div>
        </div>
        <dl className="mt-3 divide-y divide-line text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2">
              <dt className="text-muted">{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {p.trades.map((t) => <Badge key={t.id}>{TRADE_LABEL[t.trade as Trade]}</Badge>)}
          {p.regions.map((r) => <Badge key={r.id} tone="gray">{r.sigungu === "전체" ? "대구 전역" : r.sigungu}</Badge>)}
        </div>
      </Card>
      <p className="text-xs text-muted">평판 상세·등급 혜택·리뷰 답글은 마일스톤 8에서 열려요.</p>
      <AccountActions />
    </div>
  );
}
