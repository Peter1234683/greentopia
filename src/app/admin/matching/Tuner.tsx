"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { simulateMatchingAction } from "@/app/actions/admin";
import { Card } from "@/components/ui";
import { TRADE_LABEL, type Trade } from "@/lib/constants";
import type { SimParams } from "@/lib/matching/simulate";

type Result = Awaited<ReturnType<typeof simulateMatchingAction>>;
const W_LABEL: Record<string, string> = { trade: "공종", distance: "거리", timing: "시기", scale: "규모", volume: "물량", condition: "건물 조건" };

function Slider({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  return (
    <label className="block text-sm">
      <span className="flex justify-between"><span>{label}</span><b className="tabular-nums">{value}{unit}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-forest-700" aria-label={label} />
    </label>
  );
}

export function Tuner({ initial, first }: { initial: SimParams; first: Result }) {
  const [p, setP] = useState(initial);
  const [r, setR] = useState(first);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRun = useRef(true);

  // 슬라이더를 움직이면 0.3초 뒤 다시 계산
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => start(async () => setR(await simulateMatchingAction(p))), 300);
  }, [p]);

  const wSum = Object.values(p.weights).reduce((a, b) => a + b, 0);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="space-y-3">
        <p className="font-bold">파라미터</p>
        <Slider label="반경" value={p.radiusKm} min={0.5} max={8} step={0.5} unit="km" onChange={(v) => setP({ ...p, radiusKm: v })} />
        <Slider label="희망 시기 허용 차이" value={p.timingMonths} min={0} max={6} step={1} unit="개월" onChange={(v) => setP({ ...p, timingMonths: v })} />
        <Slider label="최소 성사 동수" value={p.minClusterSize} min={2} max={10} step={1} unit="동" onChange={(v) => setP({ ...p, minClusterSize: v })} />
        <Slider label="연결 기준 점수" value={p.edgeThreshold} min={30} max={95} step={1} unit="점" onChange={(v) => setP({ ...p, edgeThreshold: v })} />
        <p className="pt-2 text-sm font-semibold">가중치 (합 {wSum}{wSum !== 100 && <span className="text-warn"> · 100이 아니면 점수 기준도 함께 바뀌어요</span>})</p>
        {Object.entries(p.weights).map(([k, v]) => (
          <Slider key={k} label={W_LABEL[k]} value={v} min={0} max={50} step={1} unit="" onChange={(x) => setP({ ...p, weights: { ...p.weights, [k]: x } })} />
        ))}
        <button type="button" onClick={() => setP(initial)} className="text-sm text-forest-700 underline">현재 설정으로 되돌리기</button>
      </Card>
      <Card className="space-y-3" aria-busy={pending ? "true" : undefined} aria-live="polite">
        <p className="font-bold">결과 {pending && <span className="text-sm font-normal text-muted">계산 중…</span>}</p>
        <p className="text-sm">후보 {r.totalCandidates}건 중 <b className="text-forest-700" data-testid="matched">{r.totalMatched}건</b> 묶임</p>
        <ul className="space-y-2 text-sm">
          {r.byTrade.map((t) => (
            <li key={t.trade} className="rounded-xl bg-surface p-2">
              <div className="flex justify-between"><b>{TRADE_LABEL[t.trade as Trade]}</b><span>{t.clusters.length}개 묶음 · {t.matched}/{t.candidates}</span></div>
              {t.clusters.length > 0 && <p className="text-xs text-muted">{t.clusters.map((c) => `${c.size}동(${Math.round(c.avgScore)}점, ${c.radiusKm}km)`).join(" · ")}</p>}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">미리보기만 하고 실제 묶음은 바꾸지 않아요. 적용하려면 설정 › AI 매칭에서 값을 저장하세요.</p>
      </Card>
    </div>
  );
}
