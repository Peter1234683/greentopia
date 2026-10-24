"use client";

import { useState } from "react";
import { loanCalc } from "@/lib/subsidy/calc";
import { Basis, Card, Field, Input } from "@/components/ui";
import { won } from "@/lib/format";

export function Calculator(p: { cost: number; costBasis: string; loanRatePct: number; supportRatePct: number | null; years: number; loanLimit: number | null; programName: string | null }) {
  const [cost, setCost] = useState(String(p.cost));
  const [rate, setRate] = useState(String(p.loanRatePct));
  const [support, setSupport] = useState(String(p.supportRatePct ?? 0));
  const [years, setYears] = useState(String(p.years));
  const r = loanCalc({ cost: Number(cost) || 0, loanLimit: p.loanLimit, loanRatePct: Number(rate) || 0, supportRatePct: Number(support) || 0, years: Math.max(1, Number(years) || 1) });

  return (
    <Card>
      <p className="text-lg font-bold">🧮 지원금 계산기</p>
      <p className="text-xs text-muted">{p.programName ? `${p.programName} 기준` : "이자 지원율을 직접 넣어 계산해요"}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="공사비 (원)" hint={p.costBasis}><Input type="number" inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
        <Field label="대출 기간 (년)"><Input type="number" inputMode="numeric" value={years} onChange={(e) => setYears(e.target.value)} /></Field>
        <Field label="대출 금리 (%)" hint="시중 금리 가정치"><Input type="number" step="0.1" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
        <Field label="이자 지원율 (%p)" hint="지원금 DB 값"><Input type="number" step="0.1" value={support} onChange={(e) => setSupport(e.target.value)} /></Field>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-2xl bg-surface p-3">
          <p className="text-xs text-muted">지원 없이 월 상환</p>
          <p className="text-lg font-extrabold tabular-nums">{won(r.monthlyBase)}</p>
          <p className="text-xs text-muted">총 이자 {won(r.interestBase)}</p>
        </div>
        <div className="rounded-2xl bg-mint-50 p-3 ring-1 ring-mint-300">
          <p className="text-xs text-forest-800">이자 지원 시 월 상환</p>
          <p className="text-lg font-extrabold tabular-nums text-forest-900">{won(r.monthlySupported)}</p>
          <p className="text-xs text-forest-800">총 이자 {won(r.interestSupported)}</p>
        </div>
      </div>
      <p className="mt-3 text-center text-sm">
        이자 절감 예상 <b className="text-forest-700">{won(r.interestSaved)}</b> · 실제 부담 금리 연 {r.effectiveRatePct}%
      </p>
      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between"><dt className="text-muted">대출 원금{p.loanLimit ? ` (한도 ${won(p.loanLimit)})` : ""}</dt><dd className="tabular-nums">{won(r.principal)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">대출 외 자기자금</dt><dd className="tabular-nums">{won(r.selfFunded)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">총 부담 (공사비 + 이자)</dt><dd className="tabular-nums">{won(r.totalBurdenBase)} → <b>{won(r.totalBurdenSupported)}</b></dd></div>
      </dl>
      <Basis>원리금균등 상환으로 계산했어요. 월 상환액 = 원금 × r ÷ (1 − (1 + r)^−n), r = 연 금리 ÷ 12, n = 개월 수. 지원 후 금리 = 대출 금리 − 이자 지원율. 대출 금리는 가정치이고 실제 금리·한도는 협약은행 심사로 정해져요.</Basis>
    </Card>
  );
}
