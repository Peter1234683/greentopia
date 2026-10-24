import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { actualUnitRanges } from "@/lib/actualPrices";
import { matchAllForBuilding } from "@/lib/subsidy/service";
import { blur } from "@/lib/geo";
import { TRADE_LABEL, parseJson, type Trade } from "@/lib/constants";
import { neighborNeed } from "@/lib/matching/explain";
import { ButtonLink, Card } from "@/components/ui";
import { JointSimulator } from "./JointSimulator";
import { ClusterCard } from "./ClusterCard";

export const metadata: Metadata = { title: "공동공사" };

export default async function JointPage(props: PageProps<"/customer/joint">) {
  const user = await requireRole("CUSTOMER");
  const { b: selected } = await props.searchParams;
  const buildings = await db.building.findMany({
    where: { ownerId: user.id },
    include: { demands: { where: { status: { in: ["ACTIVE", "MATCHED"] } }, orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "asc" },
  });
  const withDemand = buildings.filter((x) => x.demands.length);
  if (!withDemand.length)
    return (
      <div className="space-y-4 pt-2">
        <h1 className="text-2xl font-extrabold">공동공사</h1>
        <Card className="text-center">
          <div className="text-5xl" aria-hidden="true">🤝</div>
          <p className="mt-3 text-lg font-bold">먼저 필요한 공사를 알려주세요</p>
          <p className="mt-1 text-sm text-muted">우리 집 공사 수요를 등록하면, 같은 공사가 필요한 이웃과 묶어 비용을 비교해 드려요.</p>
          <ButtonLink href={buildings[0] ? `/customer/buildings/${buildings[0].id}/demand` : "/customer/buildings/new"} className="mt-5 w-full">
            {buildings[0] ? "공사 수요 입력하기" : "내 건물 등록하기"}
          </ButtonLink>
        </Card>
      </div>
    );

  const me = withDemand.find((x) => x.id === selected) ?? withDemand[0];
  const demand = me.demands[0];
  const myTrades = parseJson<Trade[]>(demand.tradesJson, []);
  const settings = await getSettings();
  const [actual, neighborDemands, members] = await Promise.all([
    actualUnitRanges(settings.pricing),
    db.retrofitDemand.findMany({
      where: {
        status: { in: ["ACTIVE", "MATCHED"] },
        jointIntent: { notIn: settings.matching.excludedIntents },
        building: { sigungu: me.sigungu, ownerId: { not: user.id } },
      },
      include: { building: true },
    }),
    db.clusterMember.findMany({
      where: { buildingId: me.id, cluster: { status: { notIn: ["CANCELLED"] } } },
      include: {
        cluster: {
          include: {
            members: { include: { building: true } },
            tenders: { orderBy: { createdAt: "desc" }, take: 1, include: { bids: { where: { status: { not: "WITHDRAWN" } }, select: { tierPricesJson: true } } } },
          },
        },
      },
      orderBy: { cluster: { createdAt: "desc" } },
    }),
  ]);
  // 이자지원 예시는 지원금 DB 의 실제 등록 값(이자 지원율·상환 기간)을 쓴다
  const subsidy = await matchAllForBuilding(user.id, me.id);
  const loanProgram = subsidy?.results.find((r) => r.match.rate != null);
  // 아직 묶이지 않은 공종만 "몇 세대 더" 안내
  const clusteredTrades = new Set(members.filter((m) => m.status !== "LEFT").map((m) => m.cluster.trade));
  const needs = await neighborNeed(me.id, myTrades.filter((t) => !clusteredTrades.has(t)));

  return (
    <div className="space-y-5 pt-2">
      <div>
        <h1 className="text-2xl font-extrabold">공동공사</h1>
        <p className="mt-1 text-sm text-muted">혼자 고치면 비싸고, 모아 고치면 싸요.</p>
      </div>

      {withDemand.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {withDemand.map((x) => (
            <Link key={x.id} href={`/customer/joint?b=${x.id}`} className={`shrink-0 rounded-full px-3 py-1.5 text-sm ring-1 ${x.id === me.id ? "bg-forest-800 text-white ring-forest-800" : "bg-white ring-line"}`}>
              {x.nickname ?? x.dong}
            </Link>
          ))}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">🤖 AI가 찾은 공동공사</h2>
        {members.filter((m) => m.status !== "LEFT" || m.cluster.status !== "PROPOSED").length === 0 ? (
          <Card className="text-sm text-muted">
            아직 조건이 맞는 묶음이 없어요. 비슷한 시기·공종의 이웃이 더 등록하면 알려드릴게요.
          </Card>
        ) : (
          members.map((m) => <ClusterCard key={m.id} member={m} meId={me.id} minJoined={settings.matching.minJoinedForTender} tiers={settings.pricing.jointDiscountTiers} />)
        )}
      </section>

      <Link href="/customer/joint/map" className="block">
        <Card className="flex items-center gap-4 hover:ring-mint-300">
          <span className="text-3xl" aria-hidden="true">🗺️</span>
          <div className="flex-1">
            <p className="font-bold">우리 동네 수요 지도</p>
            <p className="text-sm text-muted">
              {needs.length > 0 && needs[0].need > 0
                ? `${TRADE_LABEL[needs[0].trade as Trade]}: ${needs[0].need}세대만 더 모이면 묶음 성사`
                : "공사별로 이웃 수요가 모인 곳을 확인해요"}
            </p>
          </div>
          <span className="text-xl text-muted" aria-hidden="true">›</span>
        </Card>
      </Link>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">💡 같이 하면 얼마나 아낄까?</h2>
        <JointSimulator
          me={me}
          myTrades={myTrades}
          neighbors={neighborDemands.map((d) => ({
            id: d.id,
            lat: blur(d.building.lat),
            lng: blur(d.building.lng),
            sigungu: d.building.sigungu,
            dong: d.building.dong,
            usage: d.building.usage,
            trades: parseJson<string[]>(d.tradesJson, []),
          }))}
          pricing={settings.pricing}
          actual={actual}
          maxClusterSize={settings.matching.maxClusterSize}
          support={
            loanProgram
              ? {
                  name: loanProgram.program.name,
                  exampleLoanRatePct: settings.support.calculator.loanRatePct,
                  exampleSupportRatePct: loanProgram.match.rate!,
                  exampleTermYears: loanProgram.match.maxRepayYears ?? settings.support.calculator.termYears,
                  exampleLoanShare: 1,
                  loanLimit: loanProgram.match.loanLimit,
                  eligible: loanProgram.match.status !== "INELIGIBLE",
                  needsNotice: !loanProgram.program.verifiedAt,
                }
              : null
          }
        />
      </section>
    </div>
  );
}
