import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { Badge, Button, ButtonLink, Card } from "@/components/ui";
import { runSimpleDiagnosis } from "@/app/actions/diagnosis";
import type { DiagnosisResult } from "@/lib/diagnosis/types";
import { JOINT_INTENT_LABEL, STRUCTURE_LABEL, SYMPTOMS, TRADE_LABEL, USAGE_LABEL, parseJson, type Trade } from "@/lib/constants";
import { buildingAge, monthLabel, won } from "@/lib/format";
import { BUDGET_OPTIONS } from "@/config/building";

export const metadata: Metadata = { title: "내 집 진단" };

export default async function DiagnosisHub(props: PageProps<"/customer/diagnosis">) {
  const user = await requireRole("CUSTOMER");
  const { saved } = await props.searchParams;
  const buildings = await db.building.findMany({
    where: { ownerId: user.id },
    include: {
      demands: { where: { status: { in: ["ACTIVE", "MATCHED"] } }, orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { documents: { where: { kind: "BILL" } } } },
      diagnoses: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "asc" },
  });

  if (buildings.length === 0)
    return (
      <div className="space-y-4 pt-2">
        <h1 className="text-2xl font-extrabold">내 집 진단</h1>
        <Card className="text-center">
          <div className="text-5xl" aria-hidden="true">🏠</div>
          <p className="mt-3 text-lg font-bold">먼저 우리 집을 등록해주세요</p>
          <p className="mt-1 text-sm text-muted">주소만 넣으면 건물 정보를 불러오고, 몇 가지 질문으로 필요한 공사를 찾아드려요.</p>
          <ButtonLink href="/customer/buildings/new" className="mt-5 w-full">내 건물 등록하기</ButtonLink>
        </Card>
      </div>
    );

  return (
    <div className="space-y-5 pt-2">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-extrabold">내 집 진단</h1>
        <Link href="/customer/buildings/new" className="text-sm font-semibold text-forest-700">+ 건물 추가</Link>
      </div>

      {buildings.map((b) => {
        const dm = b.demands[0];
        const age = buildingAge(b.approvalDate);
        const trades = dm ? parseJson<Trade[]>(dm.tradesJson, []) : [];
        const symptoms = dm ? parseJson<string[]>(dm.symptomsJson, []) : [];
        const budget = dm ? BUDGET_OPTIONS.find((o) => o.min === dm.budgetMin && o.max === dm.budgetMax) : null;
        const lastDiag = b.diagnoses[0];
        const lastResult = lastDiag ? parseJson<DiagnosisResult | null>(lastDiag.resultJson, null) : null;
        return (
          <div key={b.id} className="space-y-3">
            {saved === b.id && (
              <p role="status" className="rounded-2xl bg-forest-800 px-4 py-3 text-sm text-white">
                ✅ 공사 수요가 저장됐어요. 비슷한 이웃이 모이면 공동공사를 제안해 드릴게요.{" "}
                <Link href={`/customer/subsidy?b=${b.id}`} className="font-semibold text-mint-300 underline">받을 수 있는 지원금 보기</Link>
              </p>
            )}
            <Card>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-bold">{b.nickname ?? b.dong}</p>
                  <p className="text-sm text-muted">{b.address}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge>{USAGE_LABEL[b.usage]}</Badge>
                  {b.registrySource === "MOCK" && <Badge tone="warn">가상 대장</Badge>}
                  {b.registrySource === "MANUAL" && <Badge tone="gray">직접 입력</Badge>}
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
                {[
                  ["지은 지", age != null ? `${age}년` : "-"],
                  ["구조", STRUCTURE_LABEL[b.structure] ?? "-"],
                  ["연면적", `${Math.round(b.grossArea)}㎡`],
                  ["층·세대", `${b.floors}층·${b.households}세대`],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-surface px-1 py-2">
                    <dt className="text-muted">{k}</dt>
                    <dd className="mt-0.5 font-bold text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
              <Link href={`/customer/buildings/${b.id}/edit`} className="mt-3 inline-block text-sm text-forest-700 underline underline-offset-4">
                건물 정보 수정
              </Link>
            </Card>

            {dm ? (
              <Card>
                <div className="flex items-center justify-between">
                  <p className="font-bold">우리 집에 필요한 공사</p>
                  <Link href={`/customer/buildings/${b.id}/demand`} className="text-sm text-forest-700">수정 ›</Link>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {trades.map((t) => <Badge key={t} tone="forest">{TRADE_LABEL[t]}</Badge>)}
                </div>
                {symptoms.length > 0 && (
                  <p className="mt-3 text-sm text-muted">
                    불편한 점: {symptoms.map((s) => SYMPTOMS.find((x) => x.code === s)?.label).filter(Boolean).join(", ")}
                  </p>
                )}
                <dl className="mt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between"><dt className="text-muted">희망 시기</dt><dd>{monthLabel(dm.desiredStart)}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted">예상 예산</dt><dd>{budget?.label ?? "-"}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted">공동공사</dt><dd>{JOINT_INTENT_LABEL[dm.jointIntent]}</dd></div>
                  <div className="flex justify-between">
                    <dt className="text-muted">월 요금</dt>
                    <dd>
                      {[dm.billElectric != null && `전기 ${won(dm.billElectric)}`, dm.billGas != null && `가스 ${won(dm.billGas)}`, b._count.documents > 0 && `고지서 ${b._count.documents}장`]
                        .filter(Boolean)
                        .join(" · ") || "입력 안 함"}
                    </dd>
                  </div>
                </dl>
              </Card>
            ) : (
              <Card className="bg-forest-900 text-white ring-0">
                <p className="text-sm text-mint-300">거의 다 왔어요</p>
                <p className="mt-1 text-lg font-bold">몇 가지 질문으로 필요한 공사를 찾아볼까요?</p>
                <ButtonLink href={`/customer/buildings/${b.id}/demand`} variant="mint" className="mt-4 w-full">
                  공사 수요 입력하기
                </ButtonLink>
              </Card>
            )}

            {lastResult ? (
              <Link href={`/customer/buildings/${b.id}/diagnosis`} className="block">
                <Card className="flex items-center gap-4 hover:ring-mint-300">
                  <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-forest-900 text-white">
                    <span className="text-2xl font-extrabold leading-none">{lastResult.grade.grade}</span>
                    <span className="text-[0.6rem] text-mint-300">간이 등급</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold">에너지 진단 결과 · {lastResult.grade.label}</p>
                    <p className="text-sm text-muted">
                      {lastDiag.mode === "SIMPLE" ? "간이 추정" : "GR-AI 입력"} · {lastDiag.createdAt.toLocaleDateString("ko-KR")}
                      {lastResult.combined && ` · 연 최대 ${won(lastResult.combined.won.high)} 절감 예상`}
                    </p>
                  </div>
                  <span className="text-xl text-muted" aria-hidden="true">›</span>
                </Card>
              </Link>
            ) : (
              <Card>
                <p className="font-bold">🔍 우리 집 에너지 진단</p>
                <p className="mt-1 text-sm text-muted">
                  건물 정보{dm?.billGas != null || dm?.billElectric != null ? "와 입력하신 요금" : ""}으로 바로 간이 진단을 해드려요. 결과는 추정 범위로 보여드려요.
                </p>
                <form action={runSimpleDiagnosis} className="mt-3">
                  <input type="hidden" name="buildingId" value={b.id} />
                  <Button className="w-full">간이 진단 받기</Button>
                </form>
                <Link href={`/customer/buildings/${b.id}/diagnosis/grai`} className="mt-2 block text-center text-sm text-forest-700 underline underline-offset-4">
                  GR-AI 정밀 시뮬레이션 결과가 있어요
                </Link>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Link href={`/customer/buildings/${b.id}/photo`} className="block">
                <Card className="h-full p-4 hover:ring-mint-300">
                  <p className="text-2xl" aria-hidden="true">📷</p>
                  <p className="mt-1 font-bold">사진으로 진단</p>
                  <p className="text-xs text-muted">결로·곰팡이·창틀 사진으로 부위별 상태 확인</p>
                </Card>
              </Link>
              <Link href={`/customer/buildings/${b.id}/guide`} className="block">
                <Card className="h-full p-4 hover:ring-mint-300">
                  <p className="text-2xl" aria-hidden="true">📘</p>
                  <p className="mt-1 font-bold">성공 가이드</p>
                  <p className="text-xs text-muted">숨은 리스크와 단계별 체크리스트</p>
                </Card>
              </Link>
            </div>
          </div>
        );
      })}

      <Link href="/customer/learn" className="block">
        <Card className="flex items-center gap-4 bg-mint-50 ring-mint-100">
          <span className="text-3xl" aria-hidden="true">📚</span>
          <div className="flex-1">
            <p className="font-bold">그린리모델링 알아보기</p>
            <p className="text-sm text-muted">창호·단열·보일러, 지원 제도까지 쉽게 정리했어요.</p>
          </div>
          <span className="text-xl text-muted" aria-hidden="true">›</span>
        </Card>
      </Link>
    </div>
  );
}
