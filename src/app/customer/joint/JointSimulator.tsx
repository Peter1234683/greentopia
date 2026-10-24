"use client";

import { useMemo, useState } from "react";
import { MapView } from "@/components/map/MapView";
import { Basis, Card } from "@/components/ui";
import { interestExample, jointEstimate, soloEstimate, type ActualUnitRange, type QuantityBuilding } from "@/lib/pricing";
import type { PricingSettings } from "@/config/pricing";
import type { SupportSettings } from "@/config/support";
import { TRADE_LABEL, USAGE_LABEL, type Trade } from "@/lib/constants";
import { won } from "@/lib/format";

export type Neighbor = { id: string; lat: number; lng: number; sigungu: string; dong: string; usage: string; trades: string[] };

type Props = {
  me: QuantityBuilding & { lat: number; lng: number; sigungu: string; dong: string; usage: string };
  myTrades: Trade[];
  neighbors: Neighbor[];
  pricing: PricingSettings;
  actual: Record<string, ActualUnitRange>;
  maxClusterSize: number;
  support: SupportSettings["interestSupport"] & { eligible: boolean };
};

function Toggle({ on, onClick, label, sub }: { on: boolean; onClick: () => void; label: string; sub: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={`flex-1 rounded-2xl px-2 py-2.5 text-center ring-1 transition ${on ? "bg-forest-800 text-white ring-forest-800" : "bg-white text-ink ring-line"}`}
    >
      <span className="block text-sm font-bold">{label}</span>
      <span className={`block text-[0.7rem] ${on ? "text-mint-300" : "text-muted"}`}>{sub}</span>
    </button>
  );
}

export function JointSimulator({ me, myTrades, neighbors, pricing, actual, maxClusterSize, support }: Props) {
  const [area, setArea] = useState<"dong" | "sigungu">("dong");
  const [sameUsage, setSameUsage] = useState(false);
  const [sameTrade, setSameTrade] = useState(true);

  const filtered = useMemo(
    () =>
      neighbors.filter(
        (n) =>
          (area === "dong" ? n.dong === me.dong && n.sigungu === me.sigungu : n.sigungu === me.sigungu) &&
          (!sameUsage || n.usage === me.usage) &&
          (!sameTrade || n.trades.some((t) => myTrades.includes(t as Trade))),
      ),
    [neighbors, area, sameUsage, sameTrade, me, myTrades],
  );

  const rows = myTrades.map((trade) => {
    const peers = filtered.filter((n) => n.trades.includes(trade)).length;
    const n = Math.min(peers + 1, maxClusterSize);
    const solo = soloEstimate(me, trade, pricing);
    const joint = jointEstimate(me, trade, n, pricing, actual[trade]);
    return { trade, n, solo, joint };
  });
  const sum = (k: "solo" | "joint", side: "low" | "high") => rows.reduce((s, r) => s + r[k][side], 0);
  const soloMid = (sum("solo", "low") + sum("solo", "high")) / 2;
  const jointMid = (sum("joint", "low") + sum("joint", "high")) / 2;
  const saveLow = Math.max(0, sum("solo", "low") - sum("joint", "high"));
  const saveHigh = Math.max(0, sum("solo", "high") - sum("joint", "low"));
  const interest = interestExample(jointMid * support.exampleLoanShare, support.exampleLoanRatePct, support.exampleSupportRatePct, support.exampleTermYears);
  const anyActual = rows.some((r) => r.joint.basis === "ACTUAL");

  return (
    <div className="space-y-4">
      <Card>
        <p className="mb-3 text-sm font-semibold text-muted">어떤 이웃과 묶어볼까요?</p>
        <div className="flex gap-2">
          <Toggle on={area === "dong"} onClick={() => setArea(area === "dong" ? "sigungu" : "dong")} label="같은 동네" sub={area === "dong" ? me.dong : `${me.sigungu} 전체`} />
          <Toggle on={sameUsage} onClick={() => setSameUsage(!sameUsage)} label="같은 집 유형" sub={USAGE_LABEL[me.usage]} />
          <Toggle on={sameTrade} onClick={() => setSameTrade(!sameTrade)} label="같은 공종" sub={myTrades.map((t) => TRADE_LABEL[t]).join("·")} />
        </div>
        <div className="mt-4 flex items-end justify-between">
          <p className="text-sm text-muted">조건에 맞는 공동공사 희망 이웃</p>
          <p className="text-3xl font-extrabold tabular-nums text-forest-900">{filtered.length}<span className="text-base">동</span></p>
        </div>
        <div className="mt-3">
          <MapView
            center={[me.lat, me.lng]}
            markers={[
              { id: "me", lat: me.lat, lng: me.lng, tone: "me", label: "우리 집" },
              ...filtered.map((n) => ({ id: n.id, lat: n.lat, lng: n.lng, tone: "member" as const })),
            ]}
            height={220}
          />
        </div>
        <Basis>이웃 위치는 개인정보 보호를 위해 약 100m 단위로 흐리게 표시해요.</Basis>
      </Card>

      <Card>
        <p className="text-lg font-bold">혼자 할 때 vs 같이 할 때</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-surface p-3">
            <p className="text-xs text-muted">혼자 발주하면</p>
            <p className="mt-1 text-lg font-extrabold tabular-nums">{won(sum("solo", "low")).replace(" 원", "")}~{won(sum("solo", "high"))}</p>
          </div>
          <div className="rounded-2xl bg-mint-50 p-3 ring-1 ring-mint-300">
            <p className="text-xs text-forest-800">같이 발주하면</p>
            <p className="mt-1 text-lg font-extrabold tabular-nums text-forest-900">{won(sum("joint", "low")).replace(" 원", "")}~{won(sum("joint", "high"))}</p>
          </div>
        </div>
        {soloMid > jointMid && (
          <p className="mt-3 text-center text-sm">
            예상 절감 <b className="text-forest-700">{won(saveLow).replace(" 원", "")}~{won(saveHigh)}</b>
          </p>
        )}
        <table className="mt-4 w-full text-sm">
          <thead className="text-xs text-muted">
            <tr><th className="py-1 text-left font-normal">공종</th><th className="text-right font-normal">함께</th><th className="text-right font-normal">혼자</th><th className="text-right font-normal">같이</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.trade}>
                <td className="py-2">{TRADE_LABEL[r.trade]}{r.joint.basis === "ACTUAL" && <span className="ml-1 rounded bg-mint-100 px-1 text-[0.65rem] font-semibold text-forest-800">실제 낙찰가</span>}</td>
                <td className="text-right tabular-nums">{r.n}동</td>
                <td className="text-right tabular-nums text-muted">{won((r.solo.low + r.solo.high) / 2)}</td>
                <td className="text-right font-semibold tabular-nums">{won((r.joint.low + r.joint.high) / 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 rounded-xl bg-warn-bg p-3 text-xs font-semibold text-warn">
          가정 기반 예상치이며 실제 가격은 입찰로 확정됩니다.
        </p>
        <Basis>
          혼자 발주 예상가는 공종별 단가 가정치 × 우리 집 물량(추정)이에요.
          {anyActual
            ? " '실제 낙찰가' 표시 공종은 비슷한 공동공사의 실제 계약 단가 범위(25~75%)를 썼어요."
            : " 같이 발주 예상가는 참여 동수별 할인 가정치를 적용했어요."}
        </Basis>
      </Card>

      <Card>
        <p className="font-bold">💳 지원제도를 쓰면 (예시)</p>
        {support.eligible ? (
          <>
            <p className="mt-2 text-sm">
              같이 발주 예상가(약 {won(jointMid)})를 대출로 진행하면, {support.exampleTermYears}년간 이자 약 {won(interest.interest)} 중{" "}
              <b className="text-forest-700">약 {won(interest.supported)}</b>을 {support.name}으로 지원받을 수 있어요.
            </p>
            <p className="mt-2 text-sm">
              최종 자기부담 예시: 공사비 약 {won(jointMid)} + 이자 약 {won(interest.net)}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">우리 집은 예시 요건(사용승인일 {support.approvalBefore} 이전 등)에 해당하지 않아요. 내 공사 화면에서 자세히 확인할 수 있어요.</p>
        )}
        <Basis>
          대출 금리 {support.exampleLoanRatePct}%, 지원 {support.exampleSupportRatePct}%p, {support.exampleTermYears}년 원금균등 상환을 가정한 예시예요. 실제 지원 비율·한도는 공고를 확인하세요.
        </Basis>
      </Card>
    </div>
  );
}
