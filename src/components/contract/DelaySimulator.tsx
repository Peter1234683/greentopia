"use client";

import { useState } from "react";
import { delayPenalty } from "@/lib/payments";
import { won } from "@/lib/format";

export function DelaySimulator({ amount, cfg, plannedEnd }: { amount: number; cfg: { ratePerDayPermil: number; maxRatio: number }; plannedEnd: string | null }) {
  const [days, setDays] = useState(7);
  const r = delayPenalty(amount, days, cfg);
  return (
    <div className="space-y-2">
      <label className="block text-sm">
        <span className="flex justify-between"><span>공사가 늦어진 날</span><b className="tabular-nums">{days}일</b></span>
        <input type="range" min={0} max={120} value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-full accent-forest-700" aria-label="지연 일수" />
      </label>
      <p className="text-sm">
        예상 지체상금 <b className="text-forest-700 tabular-nums" data-testid="penalty">{won(r.amount)}</b>
        {r.capped && <span className="text-xs text-warn"> (상한 {won(r.cap)} 적용)</span>}
      </p>
      <p className="text-xs text-muted">
        계약금액 × 1일 {cfg.ratePerDayPermil}/1000 × 지연 일수, 최대 계약금액의 {Math.round(cfg.maxRatio * 100)}% (가정치){plannedEnd ? ` · 준공 예정 ${plannedEnd}` : ""}
      </p>
    </div>
  );
}
