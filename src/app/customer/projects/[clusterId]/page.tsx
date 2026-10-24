import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { soloEstimate, quantityFor, type Quantity } from "@/lib/pricing";
import { memberAmount, tierFor, type Tier, type UnitTable } from "@/lib/bidding/bidMath";
import { initialReputation } from "@/lib/bidding/evaluate";
import { stageIndex } from "@/lib/stages";
import { saveOwnerQuote, requestAS } from "@/app/actions/contract";
import { Timeline } from "@/components/Timeline";
import { Badge, Basis, Button, ButtonLink, Card, Input } from "@/components/ui";
import { CONTRACT_STATUS_LABEL, GRADE_LABEL, PROJECT_STATUS_LABEL, TENDER_METHOD_LABEL, TRADE_LABEL, parseJson, type Grade, type Trade } from "@/lib/constants";
import { won } from "@/lib/format";
import { ConfirmForm, SignForm } from "./ContractActions";

export const metadata: Metadata = { title: "견적 비교 · 계약" };

export default async function ProjectDetail(props: PageProps<"/customer/projects/[clusterId]">) {
  const user = await requireRole("CUSTOMER");
  const { clusterId } = await props.params;
  const member = await db.clusterMember.findFirst({
    where: { clusterId, building: { ownerId: user.id } },
    include: {
      building: true,
      cluster: {
        include: {
          tenders: {
            orderBy: { round: "desc" },
            include: { parentTender: true, bids: { where: { status: { in: ["WON", "LOST"] } }, include: { contractor: true, evaluation: true } }, contracts: { where: { status: { not: "CANCELLED" } } } },
          },
        },
      },
    },
  });
  if (!member) notFound();
  const settings = await getSettings();
  const trade = member.cluster.trade;
  const tender = member.cluster.tenders[0];
  const contract = await db.contract.findFirst({
    where: { buildingId: member.buildingId, tender: { clusterId } },
    include: { contractor: true, project: { include: { reviews: true } } },
    orderBy: { createdAt: "desc" },
  });
  const stage = stageIndex({ clusterStatus: member.cluster.status, tenderStatus: tender?.status ?? null, contractStatus: contract?.status ?? null, projectStatus: contract?.project?.status ?? null });
  const q: Quantity = parseJson<Record<string, Quantity>>(member.quantityJson, {})[trade] ?? quantityFor(member.building, trade, settings.pricing);
  const activeCount = tender?.contracts.length ?? 0;
  const types = settings.pricing.trades[trade].types;

  const rows = (tender?.bids ?? [])
    .filter((b) => b.evaluation)
    .map((b) => {
      const table = parseJson<UnitTable>(b.unitPriceTableJson, {});
      const tiers = parseJson<Tier[]>(b.tierPricesJson, []);
      const tier = tierFor(activeCount, tiers) ?? tiers[tiers.length - 1];
      return {
        b,
        mine: memberAmount({ memberId: "", label: "", ...q }, table, tier?.adjustPct ?? 0),
        rep: initialReputation(b.contractor, settings.reputation),
      };
    })
    .sort((a, b) => (a.b.evaluation!.rank ?? 99) - (b.b.evaluation!.rank ?? 99));
  const winnerBid = tender?.bids.find((b) => b.status === "WON");
  const winTable = parseJson<UnitTable>(winnerBid?.unitPriceTableJson, {});
  const solo = soloEstimate(member.building, trade, settings.pricing);
  const photos = parseJson<string[]>(contract?.project?.photosJson, []);

  return (
    <div className="space-y-5 pt-2">
      <Link href="/customer/projects" className="text-sm text-muted">‹ 내 공사</Link>
      <div>
        <p className="text-xs font-semibold text-forest-700">Cluster #{member.cluster.code} · {member.building.nickname ?? member.building.address}</p>
        <h1 className="text-2xl font-extrabold">{TRADE_LABEL[trade as Trade]} 공동공사</h1>
      </div>
      <Card><Timeline current={stage} /></Card>

      {!tender || ["DRAFT", "OPEN", "EVALUATING", "FAILED"].includes(tender.status) ? (
        <Card>
          <p className="font-bold">
            {!tender || tender.status === "DRAFT" ? "입찰 공고를 준비하고 있어요" : tender.status === "FAILED" ? "유찰되어 재공고를 준비하고 있어요" : "업체들이 입찰하고 있어요"}
          </p>
          {tender?.status === "OPEN" && <p className="mt-1 text-sm text-muted">{TENDER_METHOD_LABEL[tender.method]} · {tender.deadline.toLocaleDateString("ko-KR")} 마감</p>}
          {tender?.failReason && <p className="mt-1 text-sm text-muted">사유: {tender.failReason}</p>}
          <Link href="/customer/joint" className="mt-2 inline-block text-sm text-forest-700 underline">공동공사 화면에서 보기</Link>
        </Card>
      ) : null}

      {rows.length > 0 && (
        <Card>
          <p className="text-lg font-bold">공동견적 비교</p>
          <p className="text-xs text-muted">종합평가 점수 순 · 금액은 우리 건물({Math.round(q.amount)}{q.unit}) 기준</p>
          <div className="mt-3 space-y-2">
            {rows.map(({ b, mine, rep }) => (
              <div key={b.id} className={`rounded-2xl p-3 ring-1 ${b.status === "WON" ? "bg-mint-50 ring-forest-700" : "bg-white ring-line"}`}>
                <div className="flex items-center justify-between">
                  <p className="font-bold">
                    {b.evaluation!.rank}위 · {b.contractor.companyName}
                    {b.status === "WON" && <span className="ml-2 align-middle"><Badge tone="forest">낙찰</Badge></span>}
                  </p>
                  <p className="text-sm tabular-nums">{b.evaluation!.total.toFixed(1)}점</p>
                </div>
                <dl className="mt-2 grid grid-cols-3 gap-1 text-center text-xs">
                  <div><dt className="text-muted">우리 집 금액</dt><dd className="font-bold tabular-nums">{won(mine)}</dd></div>
                  <div><dt className="text-muted">공사기간</dt><dd className="font-bold">{b.durationDays}일</dd></div>
                  <div><dt className="text-muted">하자보증·A/S</dt><dd className="font-bold">{b.warrantyMonths}·{b.asMonths}개월</dd></div>
                  <div><dt className="text-muted">시공 실적</dt><dd className="font-bold">{b.contractor.externalProjectCount}건+</dd></div>
                  <div><dt className="text-muted">평판</dt><dd className="font-bold">{rep.toFixed(0)}점</dd></div>
                  <div><dt className="text-muted">등급</dt><dd className="font-bold">{b.contractor.grade === "GREEN_PARTNER" ? "🌿 그린파트너" : GRADE_LABEL[b.contractor.grade as Grade]}</dd></div>
                </dl>
              </div>
            ))}
          </div>
          <Basis>낙찰은 가격만이 아니라 실적·기간·A/S·평판을 함께 본 종합평가로 정해졌어요.</Basis>
        </Card>
      )}

      {contract && (
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-lg font-bold">우리 집 예상 부담금</p>
            <Badge tone={contract.status === "SIGNED" ? "forest" : "warn"}>{CONTRACT_STATUS_LABEL[contract.status]}</Badge>
          </div>
          <p className="mt-2 text-3xl font-extrabold tabular-nums">{won(contract.amount)}</p>
          <ul className="mt-2 space-y-0.5 text-xs text-muted">
            {Object.entries(q.mix).map(([code, amt]) => (
              <li key={code}>{types.find((t) => t.code === code)?.label} {amt}{q.unit} × {winTable[code]?.toLocaleString("ko-KR")}원</li>
            ))}
            {contract.measuredQty && <li>현장 실측 {contract.measuredQty}{q.unit} 반영</li>}
            <li>현재 {activeCount}동 참여 물량 구간 적용 · 혼자 발주 예상 {won(solo.low)}~{won(solo.high)}</li>
          </ul>
          <form action={saveOwnerQuote} className="mt-4 flex items-end gap-2">
            <input type="hidden" name="contractId" value={contract.id} />
            <label className="flex-1 text-sm">
              <span className="mb-1 block font-semibold">따로 받아본 견적이 있나요?</span>
              <Input name="ownerQuote" inputMode="numeric" defaultValue={contract.ownerQuote ?? ""} placeholder="예: 25000000" />
            </label>
            <Button variant="outline" className="py-3">비교</Button>
          </form>
          {contract.ownerQuote && (
            <p className="mt-2 text-sm">
              개별 견적 {won(contract.ownerQuote)} 대비{" "}
              <b className={contract.ownerQuote > contract.amount ? "text-forest-700" : "text-danger"}>
                {won(Math.abs(contract.ownerQuote - contract.amount))} {contract.ownerQuote > contract.amount ? "저렴해요" : "비싸요"}
              </b>
            </p>
          )}
          <Basis>계약은 우리 건물과 {contract.contractor.companyName} 사이에 개별로 체결돼요. 그린토피아는 공동발주를 대행·중개해요.</Basis>
        </Card>
      )}

      {contract?.isNegotiated && contract.status === "PENDING" && tender && (
        <Card className="ring-amber-200">
          <p className="font-bold">수의계약 전환 안내</p>
          <p className="mt-1 text-sm">{tender.parentTender?.failReason ? `직전 공고 유찰 사유: ${tender.parentTender.failReason}. ` : ""}{tender.recommendationReason}</p>
          <p className="mt-1 text-xs text-muted">금액은 직전 공고 상한({tender.priceCap ? won(tender.priceCap) : "-"})을 넘을 수 없어요.</p>
        </Card>
      )}

      {contract && (
        <Card>
          {contract.status === "PENDING" && (
            <>
              <p className="mb-3 font-bold">참여 여부를 정해주세요</p>
              <ConfirmForm contractId={contract.id} negotiated={contract.isNegotiated} />
            </>
          )}
          {contract.status === "CONFIRMED" && <p className="text-sm">✔ 참여 확정. {contract.contractor.companyName}이(가) 현장확인(실측) 일정을 잡을 거예요.</p>}
          {contract.status === "READY" && (
            <>
              <p className="mb-1 font-bold">현장확인 완료 · 계약서 서명</p>
              <p className="mb-3 text-sm text-muted">실측 물량 {contract.measuredQty}{q.unit} 기준 최종 금액 {won(contract.amount)}</p>
              <SignForm contractId={contract.id} />
            </>
          )}
          {contract.project && contract.status === "SIGNED" && (
            <div className="space-y-2 text-sm">
              <p className="font-bold">{PROJECT_STATUS_LABEL[contract.project.status]}</p>
              {contract.project.scheduledStart && <p>시공 예정일 {contract.project.scheduledStart.toLocaleDateString("ko-KR")}</p>}
              {contract.project.completedAt && <p>완료일 {contract.project.completedAt.toLocaleDateString("ko-KR")}</p>}
              {contract.project.completionNote && <p className="text-muted">{contract.project.completionNote}</p>}
              {photos.length > 0 && (
                <div className="flex gap-2 overflow-x-auto">
                  {photos.map((id) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={id} src={`/files/${id}`} alt="완료 사진" className="h-24 w-24 shrink-0 rounded-xl object-cover ring-1 ring-line" />
                  ))}
                </div>
              )}
              {contract.project.status === "COMPLETED" && (
                <div className="flex flex-col gap-2 pt-2">
                  {contract.project.reviews.length === 0 ? (
                    <ButtonLink href={`/customer/reviews/new?contract=${contract.id}`}>리뷰 남기기</ButtonLink>
                  ) : (
                    <ButtonLink href={`/customer/reviews/new?contract=${contract.id}`} variant="outline">리뷰 보기 · 후속 리뷰</ButtonLink>
                  )}
                  <form action={requestAS} className="flex gap-2">
                    <input type="hidden" name="contractId" value={contract.id} />
                    <Input name="note" placeholder="A/S가 필요한 내용" />
                    <Button variant="outline" className="shrink-0 py-3">A/S 요청</Button>
                  </form>
                </div>
              )}
            </div>
          )}
          {contract.status === "CANCELLED" && <p className="text-sm text-muted">이번 공동공사에는 참여하지 않기로 했어요.</p>}
        </Card>
      )}
    </div>
  );
}
