import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { myContractor } from "@/lib/bidding/view";
import { loadPQRules } from "@/lib/bidding/contractors";
import { checkEligibility } from "@/lib/bidding/eligibility";
import { tenderEligInput } from "@/lib/bidding/tenders";
import { db } from "@/lib/db";
import { Badge, Card } from "@/components/ui";
import { GRADE_LABEL, TRADE_LABEL, type Grade, type Trade } from "@/lib/constants";

const won = (n: number) => (n >= 1e8 ? `${(n / 1e8).toFixed(1)}억` : `${Math.round(n / 1e4).toLocaleString()}만`) + "원";

export default async function ContractorHome() {
  const user = await requireRole("CONTRACTOR");
  const p = await db.contractorProfile.findUniqueOrThrow({
    where: { id: user.contractorProfile!.id },
    include: { trades: true, regions: true, documents: true },
  });

  if (p.reviewStatus !== "APPROVED") {
    const checks: [string, boolean][] = [
      ["시공 공종·활동 권역", p.trades.length > 0 && p.regions.length > 0],
      ["GR 사업자 등록 + 증빙", p.grRegistered && p.documents.some((d) => d.kind === "GR_CERT")],
      ["건설업 등록·면허", !!p.constructionLicense],
      ["하자보증 가능", p.warrantyAvailable],
    ];
    return (
      <div className="space-y-4">
        <Card className={p.reviewStatus === "REJECTED" ? "ring-red-200" : "bg-warn-bg ring-amber-200"}>
          <p className="text-lg font-bold">
            {p.reviewStatus === "REJECTED" ? "가입 심사에서 반려되었어요" : "가입 심사를 기다리고 있어요"}
          </p>
          <p className="mt-1 text-sm text-ink/80">
            {p.reviewStatus === "REJECTED"
              ? `사유: ${p.reviewNote ?? "운영자에게 문의해주세요."}`
              : "운영자가 제출 서류(PQ 1차)를 확인하면 입찰 공고에 참여할 수 있어요. 보통 1~2 영업일이 걸려요."}
          </p>
        </Card>
        <Card>
          <p className="mb-3 font-bold">제출한 자격 정보</p>
          <ul className="space-y-2 text-sm">
            {checks.map(([label, ok]) => (
              <li key={label} className="flex items-center justify-between">
                <span>{label}</span>
                <Badge tone={ok ? "mint" : "warn"}>{ok ? "제출됨" : "미제출"}</Badge>
              </li>
            ))}
          </ul>
          {!p.grRegistered && (
            <p className="mt-3 text-xs text-muted">GR 사업자 미등록 업체는 승인 후에도 대부분의 공고에 참가 자격이 없어요.</p>
          )}
        </Card>
      </div>
    );
  }

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [monthly, inProgress, waiting, totalContracts] = await Promise.all([
    db.contract.aggregate({ _sum: { amount: true }, where: { contractorId: p.id, status: "SIGNED", signedAt: { gte: monthStart } } }),
    db.project.count({ where: { contract: { contractorId: p.id }, status: { in: ["SITE_CHECK", "CONTRACTED", "IN_PROGRESS"] } } }),
    db.bid.count({ where: { contractorId: p.id, status: "SUBMITTED" } }),
    db.contract.count({ where: { contractorId: p.id, status: "SIGNED" } }),
  ]);
  const trades = p.trades.map((t) => t.trade);
  const sigungu = p.regions.map((r) => r.sigungu);
  const [me, rules, openTenders] = await Promise.all([
    myContractor(p.id),
    loadPQRules(),
    db.tender.findMany({ where: { status: "OPEN", deadline: { gt: new Date() } }, include: { cluster: true, nominations: true, bids: { where: { contractorId: p.id } } } }),
  ]);
  const eligibleOpen = openTenders.filter((t) => checkEligibility(me, tenderEligInput(t), rules).eligible);
  const newTenders = eligibleOpen.filter((t) => t.bids.length === 0).length;
  const priority = ["GREEN_PARTNER", "EXCELLENT"].includes(p.grade);

  const kpis: [string, string][] = [
    ["이번 달 수주", won(monthly._sum.amount ?? 0)],
    ["진행 중 공사", `${inProgress}건`],
    ["결과 대기 입찰", `${waiting}건`],
    ["누적 계약", `${totalContracts}건`],
  ];

  return (
    <div className="space-y-4">
      <Link href="/contractor/tenders" className="flex items-center justify-between rounded-2xl bg-forest-800 px-4 py-3 text-white">
        <span className="text-sm">
          📢 참가 가능한 신규 공고
          {priority && <span className="ml-2 rounded-full bg-mint-400 px-2 py-0.5 text-[0.65rem] font-bold text-forest-950">우선 알림</span>}
        </span>
        <span className="text-lg font-extrabold text-mint-300">{newTenders}건 ›</span>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        {kpis.map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <p className="font-bold">내 평판 등급</p>
          <Badge tone="forest">{GRADE_LABEL[p.grade as Grade]}</Badge>
        </div>
        <p className="mt-2 text-3xl font-extrabold tabular-nums">
          {p.reputationScore != null ? p.reputationScore.toFixed(1) : "—"}
          <span className="ml-1 text-sm font-normal text-muted">/ 100</span>
        </p>
        <p className="mt-1 text-xs text-muted">
          {p.reputationScore != null ? "고객 리뷰 기반 평판 점수" : "아직 리뷰가 없어요. 외부 실적으로 새싹 트랙 초기 점수가 부여됩니다."}
          {" "}등급별 혜택은 마일스톤 8에서 열려요.
        </p>
      </Card>

      <Card className="p-4">
        <p className="mb-2 font-bold">내 시공 분야</p>
        <div className="flex flex-wrap gap-1.5">
          {trades.map((t) => <Badge key={t}>{TRADE_LABEL[t as Trade]}</Badge>)}
          {sigungu.map((s) => <Badge key={s} tone="gray">{s === "전체" ? "대구 전역" : s}</Badge>)}
        </div>
      </Card>
    </div>
  );
}
