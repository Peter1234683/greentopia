import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { actualUnitRanges } from "@/lib/actualPrices";
import { checkSupports } from "@/lib/support";
import { blur } from "@/lib/geo";
import { parseJson, type Trade } from "@/lib/constants";
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
            tenders: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
      orderBy: { cluster: { createdAt: "desc" } },
    }),
  ]);
  const support = checkSupports(me, myTrades, settings.support)[0];

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
          members.map((m) => <ClusterCard key={m.id} member={m} meId={me.id} minJoined={settings.matching.minJoinedForTender} />)
        )}
      </section>

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
          support={{ ...settings.support.interestSupport, eligible: support.eligible }}
        />
      </section>
    </div>
  );
}
