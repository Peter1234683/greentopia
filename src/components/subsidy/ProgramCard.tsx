import type { ProgramView } from "@/lib/subsidy/service";
import type { matchProgram } from "@/lib/subsidy/match";
import { Badge, Card } from "@/components/ui";
import { USAGE_LABEL } from "@/lib/constants";
import { won } from "@/lib/format";

const STATUS = {
  ELIGIBLE: { label: "해당 가능", tone: "mint" as const },
  CHECK: { label: "조건 확인 필요", tone: "warn" as const },
  INELIGIBLE: { label: "해당 없음", tone: "gray" as const },
};
const ICON = { ok: "✔", check: "?", no: "✕" };
const COLOR = { ok: "text-forest-700", check: "text-warn", no: "text-danger" };

export function ProgramCard({ program: p, match: m, usage }: { program: ProgramView; match: ReturnType<typeof matchProgram>; usage: string }) {
  const st = STATUS[m.status];
  const b = p.benefit;
  return (
    <Card className={m.status === "ELIGIBLE" ? "ring-2 ring-mint-400" : ""}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={st.tone}>{st.label}</Badge>
        {m.preferential && <Badge tone="forest">우대 조건</Badge>}
        {p.badge && <Badge tone="warn">{p.badge.label}</Badge>}
      </div>
      <h3 className="mt-2 text-lg font-bold leading-snug">{p.name}</h3>
      <p className="text-xs text-muted">{p.provider} · {p.region}</p>
      <p className="mt-2 text-sm">{p.summary}</p>

      {(b.interestSupportPct || b.loanLimit || b.services) && (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
          {m.rate != null && (
            <div className="rounded-xl bg-surface p-2">
              <dt className="text-muted">이자 지원율</dt>
              <dd className="text-lg font-extrabold text-forest-800">연 {m.rate}%</dd>
              <dd className="text-muted">{m.preferential ? `우대 (${m.prefReasons.join(", ")})` : `일반${b.interestSupportPct?.preferential ? ` · 우대 ${b.interestSupportPct.preferential}%` : ""}`}</dd>
            </div>
          )}
          {m.loanLimit != null && (
            <div className="rounded-xl bg-surface p-2">
              <dt className="text-muted">{USAGE_LABEL[usage]} 대출 한도</dt>
              <dd className="text-lg font-extrabold text-forest-800">{won(m.loanLimit)}</dd>
              {m.maxRepayYears && <dd className="text-muted">상환 최대 {m.maxRepayYears}년</dd>}
            </div>
          )}
          {b.services && (
            <div className="col-span-2 rounded-xl bg-surface p-2 text-left">
              {b.services.map((s) => <p key={s}>· {s}</p>)}
            </div>
          )}
        </dl>
      )}

      <div className="mt-3">
        <p className="text-sm font-semibold">판단 근거</p>
        <ul className="mt-1 space-y-1 text-sm">
          {m.reasons.map((r) => (
            <li key={r.label} className="flex gap-2">
              <span aria-hidden="true" className={`w-4 shrink-0 text-center font-bold ${COLOR[r.state]}`}>{ICON[r.state]}</span>
              <span>{r.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {p.applySteps.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-semibold text-forest-700">신청 방법 {p.applySteps.length}단계</summary>
          <ol className="mt-2 list-decimal space-y-0.5 pl-5">{p.applySteps.map((s) => <li key={s}>{s}</li>)}</ol>
          {p.applyPeriod && <p className="mt-1 text-xs text-muted">신청 기간: {p.applyPeriod}</p>}
        </details>
      )}

      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {p.applyUrl && <a href={p.applyUrl} target="_blank" rel="noopener noreferrer" className="rounded-full bg-forest-800 px-3 py-1.5 font-semibold text-white">공식 신청 안내 ↗</a>}
        {p.sourceUrl && <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="rounded-full px-3 py-1.5 text-forest-700 ring-1 ring-line">출처 ↗</a>}
      </div>
      <p className="mt-2 text-[0.7rem] text-muted">
        {p.verifiedAt ? `공고문 확인일 ${p.verifiedAt.toLocaleDateString("ko-KR")}` : "공고문 원문 확인 전 정보예요."} {p.sourceNote}
      </p>
    </Card>
  );
}
