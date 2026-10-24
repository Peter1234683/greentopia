"use client";

import { useActionState, useMemo, useState } from "react";
import { submitBid } from "@/app/actions/bid";
import { Button, Field, Input, inputClass } from "@/components/ui";
import { bidTotal, type MemberQty, type Tier } from "@/lib/bidding/bidMath";
import type { SpecType } from "@/config/pricing";
import { won } from "@/lib/format";

export type BidInitial = {
  table: Record<string, string>;
  lowerTierAdjustPct: string;
  durationDays: string;
  warrantyMonths: string;
  asMonths: string;
  staffPlan: string;
  planSummary: string;
  dumpingReason: string;
};

type Props = {
  tenderId: string;
  unit: string;
  types: SpecType[];
  typeTotals: Record<string, number>;
  members: MemberQty[];
  tierRanges: { min: number; max: number }[];
  priceCap: number | null;
  dumpingFloor: number; // 이 금액 미만이면 저가 사유 필수
  siteVisitPolicy: string;
  eligibility: { failures: string[]; warnings: string[] };
  initial: BidInitial;
};

const STEPS = ["자격 확인", "단가표", "물량 구간", "공사 조건", "미리보기"];

export function BidWizard(p: Props) {
  const [state, action, pending] = useActionState(submitBid, undefined);
  const [step, setStep] = useState(0);
  const [f, setF] = useState<BidInitial>(p.initial);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: Exclude<keyof BidInitial, "table">, v: string) => setF((cur) => ({ ...cur, [k]: v }));
  const setPrice = (code: string, v: string) => setF((cur) => ({ ...cur, table: { ...cur.table, [code]: v } }));
  const usedTypes = p.types.filter((t) => (p.typeTotals[t.code] ?? 0) > 0);

  const table = useMemo(() => Object.fromEntries(usedTypes.map((t) => [t.code, Number(f.table[t.code] || 0)])), [f.table, usedTypes]);
  const tiers: Tier[] = p.tierRanges.map((r, i) => ({ ...r, adjustPct: i === 0 ? 0 : Number(f.lowerTierAdjustPct || 0) }));
  const calc = bidTotal(p.members, table, tiers);
  const lowerTier = tiers[1];
  const lowerCalc = lowerTier ? bidTotal(p.members.slice(0, lowerTier.max), table, tiers) : null;
  const overCap = p.priceCap != null && calc.total > p.priceCap;
  const needReason = calc.total > 0 && calc.total < p.dumpingFloor;

  function next() {
    setErr(null);
    if (step === 1 && usedTypes.some((t) => !(Number(f.table[t.code]) > 0))) return setErr("모든 유형의 단가를 입력해주세요.");
    if (step === 3) {
      if (!(Number(f.durationDays) > 0)) return setErr("공사기간을 입력해주세요.");
      if (Number(f.warrantyMonths) < 12) return setErr("하자보증은 12개월 이상이어야 해요.");
      if (f.staffPlan.trim().length < 2 || f.planSummary.trim().length < 10) return setErr("투입 인력·장비와 시공계획을 적어주세요.");
    }
    setStep((s) => s + 1);
    window.scrollTo({ top: 0 });
  }

  const payload = JSON.stringify({
    tenderId: p.tenderId,
    table,
    lowerTierAdjustPct: Number(f.lowerTierAdjustPct || 0),
    durationDays: Number(f.durationDays),
    warrantyMonths: Number(f.warrantyMonths),
    asMonths: Number(f.asMonths || 0),
    staffPlan: f.staffPlan,
    planSummary: f.planSummary,
    dumpingReason: f.dumpingReason || undefined,
  });

  return (
    <form action={action}>
      <input type="hidden" name="payload" value={payload} />
      <ol className="mb-5 flex gap-1" aria-label="진행 단계">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <span className={`block h-1.5 rounded-full ${i <= step ? "bg-forest-700" : "bg-line"}`} />
            <span className={`mt-1 block text-center text-[0.65rem] ${i === step ? "font-bold text-forest-800" : "text-muted"}`}>{s}</span>
          </li>
        ))}
      </ol>

      <section hidden={step !== 0} className="space-y-3">
        <h2 className="text-lg font-extrabold">참가 자격(PQ) 자동 확인</h2>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-line/60">
          <p className="text-sm font-semibold text-forest-700">✔ 공종 면허·등록, GR 사업자 등록, 하자보증, 행정처분 이력, 리뷰 기반 규칙을 확인했어요.</p>
          {p.eligibility.warnings.map((w) => <p key={w} className="mt-2 text-sm text-warn">{w}</p>)}
        </div>
        <p className="rounded-2xl bg-mint-50 p-3 text-sm">
          현장확인(실측) 비용: {p.siteVisitPolicy === "PLATFORM" ? "플랫폼이 부담해요." : "낙찰 업체가 정산해요."} 낙찰 후 실측으로 물량이 확정되면 단가표 기준으로 금액이 조정돼요.
        </p>
      </section>

      <section hidden={step !== 1} className="space-y-3">
        <h2 className="text-lg font-extrabold">유형·규격별 단가표</h2>
        <p className="text-sm text-muted">개수(EA)가 아니라 {p.unit}당 단가로 받아요. 건물별 금액 = 유형별 물량 × 단가.</p>
        {usedTypes.map((t) => (
          <Field key={t.code} label={`${t.label} (${Math.round(p.typeTotals[t.code]).toLocaleString("ko-KR")}${p.unit})`} hint={`원/${p.unit}`}>
            <Input type="number" inputMode="numeric" value={f.table[t.code] ?? ""} onChange={(e) => setPrice(t.code, e.target.value)} />
          </Field>
        ))}
        <p className="rounded-xl bg-surface p-3 text-sm">현재 {p.members.length}동 기준 총액 <b className="tabular-nums">{won(calc.total)}</b></p>
      </section>

      <section hidden={step !== 2} className="space-y-3">
        <h2 className="text-lg font-extrabold">물량 구간별 단가</h2>
        <p className="text-sm text-muted">참여 건물이 줄어 하위 구간이 되면 아래 가산율이 자동 적용돼요.</p>
        <div className="rounded-2xl bg-white p-4 text-sm ring-1 ring-line/60">
          <p><b>{p.tierRanges[0].min}~{p.tierRanges[0].max}동</b> · 기본 단가 (0%)</p>
          {lowerTier ? (
            <div className="mt-3">
              <Field label={`${lowerTier.min}~${lowerTier.max}동 가산율 (%)`}>
                <Input type="number" inputMode="decimal" value={f.lowerTierAdjustPct} onChange={(e) => set("lowerTierAdjustPct", e.target.value)} />
              </Field>
              {lowerCalc && <p className="mt-2 text-xs text-muted">예: {lowerTier.max}동으로 줄면 총액 {won(lowerCalc.total)}</p>}
            </div>
          ) : (
            <p className="mt-2 text-muted">최소 동수에 가까워 하위 구간이 없어요.</p>
          )}
        </div>
      </section>

      <section hidden={step !== 3} className="space-y-3">
        <h2 className="text-lg font-extrabold">공사 조건</h2>
        <div className="grid grid-cols-3 gap-2">
          <Field label="공사기간(일)"><Input type="number" value={f.durationDays} onChange={(e) => set("durationDays", e.target.value)} /></Field>
          <Field label="하자보증(월)"><Input type="number" value={f.warrantyMonths} onChange={(e) => set("warrantyMonths", e.target.value)} /></Field>
          <Field label="무상 A/S(월)"><Input type="number" value={f.asMonths} onChange={(e) => set("asMonths", e.target.value)} /></Field>
        </div>
        <Field label="투입 인력·장비"><Input value={f.staffPlan} onChange={(e) => set("staffPlan", e.target.value)} placeholder="예: 시공 2개 조(6명), 고소작업차 1대" /></Field>
        <Field label="시공계획 요약">
          <textarea rows={4} className={inputClass} value={f.planSummary} onChange={(e) => set("planSummary", e.target.value)} placeholder="예: 1주차 실측 → 2~3주차 근거리 순서로 하루 1동 시공 → 4주차 마감·점검" />
        </Field>
      </section>

      <section hidden={step !== 4} className="space-y-3">
        <h2 className="text-lg font-extrabold">제출 전 확인</h2>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-line/60">
          <div className="flex items-end justify-between">
            <span className="text-sm text-muted">총액 ({p.members.length}동)</span>
            <span className="text-2xl font-extrabold tabular-nums">{won(calc.total)}</span>
          </div>
          {p.priceCap != null && (
            <p className={`mt-1 text-right text-xs ${overCap ? "font-bold text-danger" : "text-muted"}`}>
              공고 상한 {won(p.priceCap)} {overCap ? "· 상한 초과는 무효예요" : ""}
            </p>
          )}
          <table className="mt-3 w-full text-sm">
            <tbody className="divide-y divide-line">
              {calc.rows.map((r) => (
                <tr key={r.memberId}><td className="py-1.5">{r.label}</td><td className="text-right tabular-nums text-muted">{Math.round(r.amount)}{r.unit}</td><td className="text-right tabular-nums">{won(r.price)}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-sm">공사 {f.durationDays}일 · 하자보증 {f.warrantyMonths}개월 · A/S {f.asMonths}개월</p>
        </div>
        {needReason && (
          <Field label="저가 입찰 사유 (필수)" hint="예상가보다 크게 낮은 금액이에요. 평가 때 균형가격과 비교해 감점될 수 있어요.">
            <textarea rows={3} className={inputClass} value={f.dumpingReason} onChange={(e) => set("dumpingReason", e.target.value)} />
          </Field>
        )}
        <p className="text-xs text-muted">마감 전까지 수정할 수 있고, 마감 후에는 봉인돼요. 다른 업체의 입찰 내용은 공개되지 않아요.</p>
        {state?.message && <p role="alert" className="text-sm font-semibold text-danger">{state.message}</p>}
      </section>

      {err && <p role="alert" className="mt-3 text-sm text-danger">{err}</p>}
      <div className="sticky bottom-20 mt-6 flex gap-2 bg-surface/95 py-2">
        {step > 0 && <Button type="button" variant="outline" onClick={() => { setErr(null); setStep(step - 1); }}>이전</Button>}
        {step < STEPS.length - 1 ? (
          <Button key="next" type="button" className="flex-1" onClick={next}>다음</Button>
        ) : (
          <Button key="submit" type="submit" className="flex-1" disabled={pending || overCap || (needReason && !f.dumpingReason.trim())}>
            {pending ? "제출 중…" : "입찰서 제출"}
          </Button>
        )}
      </div>
    </form>
  );
}
