import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { explainCluster } from "@/lib/matching/explain";
import { sumParts } from "@/lib/matching/engine";
import { CostBreakdownChart, SizeCurveChart } from "@/components/customer/ExplainCharts";
import { Badge, Basis, ButtonLink, Card } from "@/components/ui";
import { TRADE_LABEL, parseJson, type Trade } from "@/lib/constants";
import { won } from "@/lib/format";

export const metadata: Metadata = { title: "매칭 설명" };

const BREAK_LABEL: Record<string, string> = { trade: "공종", distance: "거리", timing: "시기", scale: "규모", volume: "물량", condition: "건물 조건" };

export default async function WhyPage(props: PageProps<"/customer/joint/why/[id]">) {
  const user = await requireRole("CUSTOMER");
  const { id } = await props.params;
  const mine = await db.clusterMember.findFirst({ where: { clusterId: id, building: { ownerId: user.id } } });
  if (!mine) notFound();
  const x = await explainCluster(id, mine.buildingId);
  if (!x) notFound();
  const { cluster, settings: s } = x;
  const reasons = parseJson<{ label: string; ok: boolean }[]>(cluster.reasonsJson, []);
  const soloSum = sumParts(x.breakdown.solo);
  const jointSum = sumParts(x.breakdown.joint);
  const waitlist = x.candidates.filter((c) => c.status === "WAITLIST");
  const excluded = x.candidates.filter((c) => c.status === "EXCLUDED");

  return (
    <div className="space-y-5 pt-2">
      <Link href="/customer/joint" className="text-sm text-muted">‹ 공동공사</Link>
      <div>
        <p className="text-xs font-semibold text-forest-700">Cluster #{cluster.code} · {TRADE_LABEL[x.trade as Trade]}</p>
        <h1 className="text-2xl font-extrabold">왜 이렇게 묶였나요?</h1>
      </div>

      <Card className="bg-mint-50 p-4 text-sm ring-mint-100">
        <p className="font-bold">🤖 이렇게 묶어요</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>꼭 맞아야 하는 조건: 반경 {s.radiusKm}km · 희망 시기 ±{s.timingMonths}개월 · 건물 구조 · 자재 규격</li>
          <li>적합도 100점: 공종 {s.weights.trade} · 거리 {s.weights.distance} · 시기 {s.weights.timing} · 규모 {s.weights.scale} · 물량 {s.weights.volume} · 건물 조건 {s.weights.condition}</li>
          <li>{s.edgeThreshold}점 이상인 이웃끼리 {s.minClusterSize}~{s.maxClusterSize}동으로 묶어요</li>
        </ol>
        <p className="mt-2 text-muted">왜 이 방식? {s.algorithmNote}</p>
      </Card>

      <Card>
        <p className="font-bold">묶인 이유</p>
        <ul className="mt-2 grid grid-cols-2 gap-1.5 text-sm">
          {reasons.map((r) => <li key={r.label}>{r.ok ? "✔" : "–"} {r.label}</li>)}
        </ul>
        {x.myPairs.length > 0 && (
          <>
            <p className="mt-4 text-sm font-bold">우리 집과 이웃의 적합도</p>
            <ul className="mt-2 space-y-2 text-sm">
              {x.myPairs.map((p) => {
                const other = p.a === "우리 집" ? p.b : p.a;
                return (
                  <li key={other}>
                    <div className="flex justify-between"><span>{other}</span><b className="tabular-nums">{p.score ?? "-"}점</b></div>
                    <div className="mt-1 h-1.5 rounded-full bg-line"><div className="h-1.5 rounded-full bg-forest-700" style={{ width: `${p.score ?? 0}%` }} /></div>
                    {p.breakdown && (
                      <p className="mt-0.5 text-xs text-muted">
                        {Object.entries(p.breakdown).map(([k, v]) => `${BREAK_LABEL[k]} ${Math.round(v)}`).join(" · ")}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>

      <Card>
        <p className="font-bold">💰 1동 기준 비용 구성: 혼자 vs 함께</p>
        <p className="mt-1 text-sm">
          혼자 약 <b>{won(soloSum)}</b> → {x.n}동 함께 약 <b className="text-forest-700">{won(jointSum)}</b>
          <span className="text-muted"> ({Math.round((1 - jointSum / soloSum) * 100)}% 차이)</span>
        </p>
        <CostBreakdownChart solo={x.breakdown.solo} joint={x.breakdown.joint} n={x.n} />
        <ul className="mt-2 space-y-0.5 text-xs text-muted">
          <li>자재비: 물량 구간 할인 가정치 적용</li>
          <li>인건비: 연속 시공으로 1동마다 {Math.round(s.costModel.laborSavingPerBuilding * 100)}% (최대 {Math.round(s.costModel.laborSavingMax * 100)}%) 절감 가정</li>
          <li>이동·물류비: 함께 나눔 · 고정비(사다리차·비계): 1/N로 나눔</li>
        </ul>
        <Basis>모든 계수는 설정의 가정치예요. 실제 가격은 입찰로 정해지고, 확정 할인이 아니에요.</Basis>
      </Card>

      <Card>
        <p className="font-bold">📈 몇 동이 함께하면 좋을까?</p>
        <p className="mt-1 text-sm text-muted">
          추천 규모 <b className="text-ink">{x.curve.recommended.from}~{x.curve.recommended.to}동</b> (초록 구간) · 이 정도면 최대 절감 효과의 90%에 닿아요. 지금 {x.n}동.
        </p>
        <SizeCurveChart points={x.curve.points} from={x.curve.recommended.from} to={x.curve.recommended.to} current={x.n} />
        <Basis>같은 가정 모델로 계산한 1동당 예상 비용이에요.</Basis>
      </Card>

      <Card>
        <p className="font-bold">⏳ 대기 풀 · 조건이 바뀌면 합류 가능 ({waitlist.length})</p>
        {waitlist.length === 0 ? <p className="mt-1 text-sm text-muted">지금은 대기 중인 이웃이 없어요.</p> : (
          <ul className="mt-2 space-y-2 text-sm">
            {waitlist.map((c) => (
              <li key={c.id} className="rounded-xl bg-surface p-2"><b>{c.id}</b> <span className="text-muted">· {c.dong}</span><br />{c.reason}</li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <p className="font-bold">🚫 근처지만 함께하지 못한 이유 ({excluded.length})</p>
        {excluded.length === 0 ? <p className="mt-1 text-sm text-muted">근처에 제외된 이웃이 없어요.</p> : (
          <ul className="mt-2 space-y-2 text-sm">
            {excluded.map((c) => (
              <li key={c.id} className="flex gap-2"><Badge tone="gray">{c.id}</Badge><span>{c.reason} <span className="text-muted">· {c.dong}</span></span></li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted">※ 이웃 정보는 동 단위까지만 보여드려요.</p>
      </Card>

      <ButtonLink href={`/customer/invite?c=${cluster.id}`} variant="mint" className="w-full">🙌 이웃 초대하기</ButtonLink>
    </div>
  );
}
