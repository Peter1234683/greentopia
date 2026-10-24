import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { runSimpleDiagnosis } from "@/app/actions/diagnosis";
import { Badge, Basis, Button, ButtonLink, Card, SectionTitle } from "@/components/ui";
import { GradeMeter } from "@/components/customer/GradeMeter";
import { SavingsChart, type SavingsRow } from "@/components/customer/SavingsChart";
import { GR_CONSULTING_LABEL, GR_CONSULTING_URL, GRAI_URL } from "@/config/diagnosis";
import { TRADE_LABEL, parseJson, type Trade } from "@/lib/constants";
import { won } from "@/lib/format";
import type { DiagnosisResult } from "@/lib/diagnosis/types";

export const metadata: Metadata = { title: "에너지 진단 결과" };

const pct = (n: number) => Math.round(n * 100);
const wonRange = (lo: number, hi: number) => (lo === hi ? won(lo) : `${won(lo).replace(" 원", "")}~${won(hi)}`);

export default async function DiagnosisResultPage(props: PageProps<"/customer/buildings/[id]/diagnosis">) {
  const user = await requireRole("CUSTOMER");
  const { id } = await props.params;
  const { d } = await props.searchParams;
  const b = await db.building.findFirst({
    where: { id, ownerId: user.id },
    include: {
      diagnoses: { orderBy: { createdAt: "desc" } },
      demands: { where: { status: { in: ["ACTIVE", "MATCHED"] } }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!b) notFound();
  if (b.diagnoses.length === 0) redirect("/customer/diagnosis");
  const diag = b.diagnoses.find((x) => x.id === d) ?? b.diagnoses[0];
  const r = parseJson<DiagnosisResult | null>(diag.resultJson, null);
  if (!r) notFound();

  const demandTrades = b.demands[0] ? parseJson<Trade[]>(b.demands[0].tradesJson, []) : [];
  const simple = r.mode === "SIMPLE";
  const rows: SavingsRow[] = r.measures.map((m) => ({
    key: m.trade,
    name: TRADE_LABEL[m.trade as Trade],
    low: pct(m.pct.low),
    high: pct(m.pct.high),
    wonLow: m.won.low,
    wonHigh: m.won.high,
    highlight: demandTrades.includes(m.trade as Trade),
  }));
  if (r.combined)
    rows.push({
      key: "COMBINED",
      name: "통합 개선",
      low: pct(r.combined.pct.low),
      high: pct(r.combined.pct.high),
      wonLow: r.combined.won.low,
      wonHigh: r.combined.won.high,
      highlight: false,
      combined: true,
    });

  const peerDiff = r.peer ? Math.round(((r.intensity.mid - r.peer.intensity) / r.peer.intensity) * 100) : null;

  return (
    <div className="space-y-5 pt-2">
      <div>
        <Link href="/customer/diagnosis" className="text-sm text-muted">‹ 내 집 진단</Link>
        <div className="mt-3 flex items-center gap-2">
          <Badge tone={simple ? "warn" : "mint"}>{simple ? "간이 추정" : "GR-AI 결과 입력"}</Badge>
          <span className="text-xs text-muted">{diag.createdAt.toLocaleDateString("ko-KR")} 진단</span>
        </div>
        <h1 className="mt-1 text-2xl font-extrabold">{b.nickname ?? b.dong} 에너지 진단</h1>
      </div>

      <Card>
        <GradeMeter result={r} />
        {r.peer && peerDiff != null && (
          <p className="rounded-2xl bg-surface p-3 text-sm">
            같은 연식·유형(<b>{r.peer.label}</b>) 평균보다{" "}
            <b className={peerDiff > 0 ? "text-danger" : "text-forest-700"}>
              {Math.abs(peerDiff)}% {peerDiff > 0 ? "더 쓰는" : "덜 쓰는"}
            </b>{" "}
            편이에요.
          </p>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-2xl bg-surface p-3">
            <dt className="text-xs text-muted">건물 전체 연간 냉난방 에너지</dt>
            <dd className="mt-1 text-lg font-extrabold tabular-nums">
              {r.annualKwh.low === r.annualKwh.high
                ? `${r.annualKwh.mid.toLocaleString("ko-KR")}`
                : `${Math.round(r.annualKwh.low / 1000)}~${Math.round(r.annualKwh.high / 1000)}천`}
              kWh
            </dd>
          </div>
          <div className="rounded-2xl bg-surface p-3">
            <dt className="text-xs text-muted">연간 냉난방비 환산</dt>
            <dd className="mt-1 text-lg font-extrabold tabular-nums">{wonRange(r.annualCostWon.low, r.annualCostWon.high)}</dd>
          </div>
        </dl>
        <Basis>
          {simple ? "간이 추정 범위예요. " : "GR-AI 결과 입력값 기준이에요. "}
          {r.peer?.basis === "DB" ? `평균은 등록된 비슷한 건물 ${r.peer.sampleSize}동의 간이 추정값이에요.` : "평균은 설정 기준값(가정치)이에요."}
        </Basis>
      </Card>

      {r.combined && (
        <Card className="bg-forest-900 text-white ring-0">
          <p className="text-sm text-mint-300">
            {demandTrades.length ? `우리 집에 필요한 공사(${r.combined.trades.map((t) => TRADE_LABEL[t as Trade]).join("·")})를 함께 하면` : "모든 공사를 함께 하면"}
          </p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums">
            연 {wonRange(r.combined.won.low, r.combined.won.high)}
          </p>
          <p className="mt-1 text-sm text-white/80">
            냉난방 에너지 {pct(r.combined.pct.low) === pct(r.combined.pct.high) ? pct(r.combined.pct.low) : `${pct(r.combined.pct.low)}~${pct(r.combined.pct.high)}`}% 절감 예상
          </p>
          <p className="mt-2 text-[0.7rem] text-white/60">※ 여러 공사의 효과는 단순 합계보다 작게 계산했어요. 실제 절감액은 생활 습관·요금에 따라 달라져요.</p>
        </Card>
      )}

      {rows.length > 0 && (
        <Card>
          <SectionTitle>공사별 예상 절감률</SectionTitle>
          <p className="-mt-2 mb-3 flex items-center gap-2 text-xs text-muted">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "#1a6347" }} /> 우리 집에 필요한 공사
            <span className="ml-2 inline-block h-3 w-3 rounded-sm" style={{ background: "#9fd2bb" }} /> 그 밖의 공사
          </p>
          <SavingsChart rows={rows} />
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-forest-700">표로 보기</summary>
            <table className="mt-2 w-full text-left text-sm">
              <thead className="text-xs text-muted">
                <tr><th className="py-1 font-normal">공사</th><th className="font-normal">절감률</th><th className="text-right font-normal">연간 절감액</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td className="py-1.5">{row.name}{row.highlight && <span className="ml-1 text-xs text-forest-700">· 필요</span>}</td>
                    <td className="tabular-nums">{row.low === row.high ? row.low : `${row.low}~${row.high}`}%</td>
                    <td className="text-right tabular-nums">{wonRange(row.wonLow, row.wonHigh)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          <Basis>절감액은 위 냉난방 에너지에 공사별 절감률(가정치)을 곱해 환산했어요.</Basis>
        </Card>
      )}

      {r.precise.recommended && (
        <Card className="ring-mint-300">
          <p className="text-lg font-bold">🔎 이런 경우 정밀 진단을 추천해요</p>
          <ul className="mt-2 space-y-1 text-sm">
            {r.precise.reasons.map((x) => <li key={x}>• {x}</li>)}
          </ul>
          <p className="mt-3 text-sm text-muted">전문가가 직접 방문해 진단하는 무료 컨설팅을 받아보세요.</p>
          <a href={GR_CONSULTING_URL} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center justify-center rounded-2xl bg-mint-400 px-5 py-3.5 font-semibold text-forest-950">
            {GR_CONSULTING_LABEL} 신청 안내 ↗
          </a>
        </Card>
      )}

      <Card>
        <p className="font-bold">더 정확하게 알고 싶다면</p>
        <p className="mt-1 text-sm text-muted">
          GR-AI에서 창호·단열·보일러 성능을 바꿔가며 우리 집 에너지 소요량을 시뮬레이션할 수 있어요.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a href={GRAI_URL} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center rounded-2xl border border-line bg-white px-3 py-3 text-sm font-semibold hover:bg-mint-50">
            GR-AI 열기 ↗
          </a>
          <ButtonLink href={`/customer/buildings/${b.id}/diagnosis/grai`} variant="outline" className="px-3 py-3 text-sm">
            결과 입력하기
          </ButtonLink>
        </div>
      </Card>

      <div className="space-y-1">
        {r.notes.map((n) => <Basis key={n}>{n}</Basis>)}
      </div>

      <form action={runSimpleDiagnosis}>
        <input type="hidden" name="buildingId" value={b.id} />
        <Button variant="ghost" className="w-full">간이 진단 다시 하기</Button>
      </form>

      {b.diagnoses.length > 1 && (
        <section>
          <p className="mb-2 text-sm font-semibold text-muted">지난 진단</p>
          <ul className="space-y-1.5">
            {b.diagnoses.map((x) => {
              const xr = parseJson<DiagnosisResult | null>(x.resultJson, null);
              return (
                <li key={x.id}>
                  <Link
                    href={`/customer/buildings/${b.id}/diagnosis?d=${x.id}`}
                    aria-current={x.id === diag.id ? "page" : undefined}
                    className={`flex justify-between rounded-xl px-3 py-2 text-sm ring-1 ${x.id === diag.id ? "bg-mint-50 ring-mint-300" : "bg-white ring-line"}`}
                  >
                    <span>{x.createdAt.toLocaleDateString("ko-KR")} · {x.mode === "SIMPLE" ? "간이" : "GR-AI"}</span>
                    <span className="font-semibold">{xr?.grade.grade}등급</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
