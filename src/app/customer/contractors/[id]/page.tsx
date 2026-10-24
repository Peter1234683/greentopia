import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { reputationDetail } from "@/lib/reputationView";
import { RATING_KEYS } from "@/lib/reputation";
import { tagStats } from "@/lib/reviewTrust";
import { reportReview } from "@/app/actions/review";
import { ReviewCard } from "@/components/ReviewCard";
import { Badge, Basis, Card } from "@/components/ui";
import { COMPLAINT_TAGS, GRADE_LABEL, SAFETY_PLEDGE_ITEMS, TRADE_LABEL, parseJson, type Grade, type Trade } from "@/lib/constants";

export const metadata: Metadata = { title: "업체 정보" };

const pct = (x: number) => `${Math.round(x * 100)}%`;

export default async function ContractorProfile(props: PageProps<"/customer/contractors/[id]">) {
  await requireRole("CUSTOMER");
  const { id } = await props.params;
  if (!(await db.contractorProfile.count({ where: { id, reviewStatus: "APPROVED" } }))) notFound();
  const { p, rep, reviews, sproutScore, pending } = await reputationDetail(id);
  const [trades, pledge, completed] = await Promise.all([
    db.contractorTrade.findMany({ where: { contractorId: id } }),
    db.safetyPledge.findUnique({ where: { contractorId: id } }),
    db.contract.findMany({ where: { contractorId: id, status: "SIGNED", project: { status: { in: ["COMPLETED", "AS"] } } }, select: { project: { select: { id: true } } } }),
  ]);
  const pledged = parseJson<string[]>(pledge?.itemsJson, []);
  const visible = reviews.filter((r) => r.status !== "HIDDEN");
  const trusted = visible.filter((r) => !pending(r));
  const stats = tagStats(trusted.map((r) => ({ projectId: r.projectId, kind: r.kind, tags: parseJson<string[]>(r.complaintTagsJson, []), replied: !!r.reply, defectOccurred: r.defectOccurred, defectResolved: r.defectResolved })));
  const safetyIssues = new Set(trusted.filter((r) => parseJson<string[]>(r.complaintTagsJson, []).includes("SAFETY")).map((r) => r.projectId));
  const accidentFree = completed.filter((c) => c.project && !safetyIssues.has(c.project.id)).length;
  const defects = trusted.filter((r) => r.defectOccurred);
  const defectRate = defects.length ? defects.filter((r) => r.defectResolved).length / defects.length : null;

  const info: [string, string, boolean | null][] = [
    ["사업자", `${p.companyName} · 대표 ${p.ceoName} · ${p.bizRegNo}`, null],
    ["전문건설업 면허", `${p.constructionLicense ?? "-"}${p.licenseNo ? ` (${p.licenseNo})` : ""}`, !!p.constructionLicense],
    ["GR 사업자 등록", p.grRegistered ? `등록${p.grRegNo ? ` (${p.grRegNo})` : ""}` : "미등록", p.grRegistered],
    ["영업배상 책임보험", p.liabilityInsurance ? "가입" : "미가입", p.liabilityInsurance],
    ["하자보수 보증", p.warrantyAvailable ? "보증증권 발급 가능" : "불가", p.warrantyAvailable],
    ["기술 인력", `${p.techStaffCount}명`, null],
  ];

  return (
    <div className="space-y-4 pt-2">
      <Card>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-extrabold">{p.companyName}</h1>
            <div className="mt-1 flex flex-wrap gap-1">{trades.map((t) => <Badge key={t.id}>{TRADE_LABEL[t.trade as Trade]}</Badge>)}</div>
          </div>
          <Badge tone="forest">{p.grade === "GREEN_PARTNER" ? "🌿 그린파트너" : GRADE_LABEL[p.grade as Grade]}</Badge>
        </div>
        <p className="mt-3 text-3xl font-extrabold tabular-nums">{rep ? rep.score.toFixed(1) : sproutScore.toFixed(0)}<span className="ml-1 text-sm font-normal text-muted">/ 100 {rep ? `평판 · 리뷰 ${rep.reviewCount}건` : "신규 업체 초기 점수"}</span></p>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          {[
            ["누적 완공", `${completed.length + p.externalProjectCount}건`, `플랫폼 ${completed.length} · 외부 ${p.externalProjectCount}`],
            ["무사고 시공", `${accidentFree}건`, "플랫폼 완공 중 안전 불만 없음"],
            ["하자보수 이행률", defectRate == null ? "-" : pct(defectRate), defects.length ? `하자 ${defects.length}건 중` : "후속 점검 하자 없음"],
          ].map(([k, v, sub]) => (
            <div key={k} className="rounded-xl bg-surface px-1 py-2">
              <dt className="text-muted">{k}</dt>
              <dd className="mt-0.5 text-base font-bold text-ink">{v}</dd>
              <dd className="text-[0.6rem] text-muted">{sub}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {pledged.length > 0 && (
        <Card className="bg-forest-900 text-white ring-0">
          <p className="font-bold text-mint-300">🛡️ 안심 보장제 참여</p>
          <ul className="mt-2 space-y-1 text-sm">{SAFETY_PLEDGE_ITEMS.filter((i) => pledged.includes(i.code)).map((i) => <li key={i.code}>✔ {i.label}</li>)}</ul>
          <p className="mt-2 text-xs text-white/70">업체가 스스로 약속한 항목이에요. 계약서에도 같은 내용을 적어두세요.</p>
        </Card>
      )}

      <Card>
        <p className="font-bold">사업자 정보</p>
        <dl className="mt-2 divide-y divide-line text-sm">
          {info.map(([k, v, okv]) => (
            <div key={k} className="flex gap-3 py-2">
              <dt className="w-28 shrink-0 text-muted">{k}</dt>
              <dd className="flex-1">{okv === true ? "✔ " : okv === false ? "– " : ""}{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {rep && (
        <Card>
          <p className="font-bold">항목별 평점</p>
          <dl className="mt-2 space-y-1.5 text-sm">
            {RATING_KEYS.map(([k, , l]) => (
              <div key={k} className="flex items-center gap-2">
                <dt className="w-28 shrink-0 text-muted">{l}</dt>
                <dd className="h-2 flex-1 rounded-full bg-line"><div className="h-2 rounded-full bg-forest-700" style={{ width: `${((rep.categoryAvg[k] ?? 0) / 5) * 100}%` }} /></dd>
                <dd className="w-8 text-right tabular-nums">{rep.categoryAvg[k]?.toFixed(1)}</dd>
              </div>
            ))}
            <div className="flex justify-between pt-1"><dt className="text-muted">기간 준수율</dt><dd>{pct(rep.scheduleRate)}</dd></div>
          </dl>
        </Card>
      )}

      <Card>
        <p className="font-bold">불만 태그와 사후 해결률</p>
        {stats.length === 0 ? (
          <p className="mt-1 text-sm text-muted">리뷰에서 나온 불만 태그가 없어요.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {stats.map((s) => (
              <li key={s.tag}>
                <div className="flex justify-between">
                  <span>{COMPLAINT_TAGS.find((t) => t.code === s.tag)?.label ?? s.tag}</span>
                  <span className="text-muted">후기의 {pct(s.ratio)} · 해결 <b className="text-ink">{pct(s.resolvedRate)}</b></span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-red-50"><div className="h-1.5 rounded-full bg-forest-700" style={{ width: `${s.resolvedRate * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        )}
        <Basis>해결 = 업체가 답글로 대응했고, 같은 공사의 후속 점검에서 하자가 없거나 처리됐다고 응답한 경우예요.</Basis>
      </Card>

      <h2 className="font-bold">이웃들의 리뷰</h2>
      {visible.map((r) => (
        <ReviewCard
          key={r.id}
          r={r}
          author={`${r.project.contract.building.dong} ${r.author.name.slice(0, 1)}○○`}
          verified={r.project.contract.milestones.some((m) => m.stage === "COMPLETION" && m.status === "RELEASED")}
          pendingCheck={pending(r)}
        >
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
