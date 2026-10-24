import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { Badge, ButtonLink, Card, SectionTitle } from "@/components/ui";
import { TRADE_LABEL, USAGE_LABEL, parseJson, type Trade } from "@/lib/constants";

export default async function CustomerHome(props: PageProps<"/customer">) {
  const user = await requireRole("CUSTOMER");
  const { address } = await props.searchParams;
  const buildings = await db.building.findMany({
    where: { ownerId: user.id },
    include: { demands: { where: { status: { in: ["ACTIVE", "MATCHED"] } }, orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "asc" },
  });
  const main = buildings[0];
  const neighborDemand = main
    ? await db.retrofitDemand.count({
        where: { status: "ACTIVE", jointIntent: { in: ["YES", "MAYBE"] }, building: { sigungu: main.sigungu, id: { not: main.id } } },
      })
    : 0;

  return (
    <div className="space-y-6">
      <section className="pt-2">
        <p className="text-muted">{user.name}님, 안녕하세요 👋</p>
        <h1 className="mt-1 text-2xl font-extrabold leading-snug">
          우리 집, 이웃과 함께 고치면
          <br />
          <span className="text-forest-700">얼마나 아낄 수 있을까요?</span>
        </h1>
      </section>

      {main ? (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted">내 건물</p>
              <p className="mt-0.5 text-lg font-bold">{main.nickname ?? main.address}</p>
              <p className="text-sm text-muted">{main.address}</p>
            </div>
            <Badge>{USAGE_LABEL[main.usage] ?? main.usage}</Badge>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-surface py-3">
              <dt className="text-xs text-muted">지은 지</dt>
              <dd className="text-xl font-extrabold">
                {main.approvalDate ? `${new Date().getFullYear() - main.approvalDate.getFullYear()}년` : "-"}
              </dd>
            </div>
            <div className="rounded-2xl bg-surface py-3">
              <dt className="text-xs text-muted">연면적</dt>
              <dd className="text-xl font-extrabold">{Math.round(main.grossArea)}㎡</dd>
            </div>
            <div className="rounded-2xl bg-surface py-3">
              <dt className="text-xs text-muted">세대</dt>
              <dd className="text-xl font-extrabold">{main.households}</dd>
            </div>
          </dl>
          {main.demands[0] ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {parseJson<Trade[]>(main.demands[0].tradesJson, []).map((t) => (
                <Badge key={t} tone="forest">{TRADE_LABEL[t]} 필요</Badge>
              ))}
            </div>
          ) : (
            <ButtonLink href={`/customer/buildings/${main.id}/demand`} variant="outline" className="mt-4 w-full py-3">
              필요한 공사 알려주기
            </ButtonLink>
          )}
        </Card>
      ) : (
        <Card className="bg-forest-900 text-white ring-0">
          <p className="text-sm text-mint-300">3분이면 충분해요</p>
          <p className="mt-1 text-xl font-bold">우리 집을 등록하고 에너지 상태를 확인해보세요</p>
          {address && <p className="mt-2 text-sm text-white/70">가입할 때 입력한 주소: {address}</p>}
          <ButtonLink
            href={address ? `/customer/buildings/new?address=${encodeURIComponent(String(address))}` : "/customer/buildings/new"}
            variant="mint"
            className="mt-5 w-full"
          >
            내 건물 등록하기
          </ButtonLink>
        </Card>
      )}

      {main && (
        <Card className="flex items-center gap-4 bg-mint-50 ring-mint-100">
          <span className="text-4xl" aria-hidden="true">🤝</span>
          <div className="flex-1">
            <p className="text-sm text-forest-800">{main.sigungu}에서 공동공사를 원하는 이웃</p>
            <p className="text-3xl font-extrabold text-forest-900">{neighborDemand}동</p>
          </div>
          <Link href="/customer/joint" className="text-sm font-semibold text-forest-700">자세히 ›</Link>
        </Card>
      )}

      <section>
        <SectionTitle>그린리모델링, 이런 거예요</SectionTitle>
        <div className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2">
          {[
            ["🪟", "창호만 바꿔도", "겨울 외풍과 결로가 확 줄어요"],
            ["🧱", "단열을 보강하면", "여름엔 시원하고 겨울엔 따뜻해요"],
            ["🔥", "보일러를 바꾸면", "같은 난방에 가스가 덜 들어요"],
          ].map(([icon, t, d]) => (
            <div key={t} className="w-44 shrink-0 snap-start rounded-3xl bg-white p-4 ring-1 ring-line/60">
              <div className="text-3xl" aria-hidden="true">{icon}</div>
              <p className="mt-2 font-bold">{t}</p>
              <p className="mt-1 text-sm text-muted">{d}</p>
            </div>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">자세한 안내는 마일스톤 3에서 &lsquo;그린리모델링 알아보기&rsquo;로 제공돼요.</p>
      </section>
    </div>
  );
}
