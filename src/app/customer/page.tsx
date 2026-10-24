import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { Badge, ButtonLink, Card, SectionTitle } from "@/components/ui";
import { TRADE_LABEL, USAGE_LABEL, parseJson, type Trade } from "@/lib/constants";
import { loadLearnCards } from "@/lib/content";
import { ensureFollowupReminders } from "@/lib/reviews";
import { matchAllForBuilding } from "@/lib/subsidy/service";

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

  const cards = await loadLearnCards();
  await ensureFollowupReminders(user.id);
  const subsidy = main ? await matchAllForBuilding(user.id, main.id) : null;
  const subsidyCount = subsidy?.results.filter((r) => r.match.status !== "INELIGIBLE").length ?? 0;
  const todos = await db.contract.findMany({
    where: {
      building: { ownerId: user.id },
      OR: [{ status: { in: ["PENDING", "READY"] } }, { status: "SIGNED", project: { status: "COMPLETED", reviews: { none: {} } } }],
    },
    include: { tender: { include: { cluster: true } }, contractor: true },
  });

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

      {todos.length > 0 && (
        <Card className="ring-2 ring-mint-400">
          <p className="font-bold">📌 지금 확인할 일</p>
          <ul className="mt-2 divide-y divide-line">
            {todos.map((t) => (
              <li key={t.id}>
                <Link href={t.status === "SIGNED" ? `/customer/reviews/new?contract=${t.id}` : `/customer/projects/${t.tender?.clusterId}`} className="flex items-center justify-between py-2.5 text-sm">
                  <span>
                    {t.status === "PENDING" ? "업체가 정해졌어요 · 참여 여부 결정" : t.status === "READY" ? "현장확인 완료 · 계약서 서명" : "공사 완료 · 리뷰 남기기"}
                    <span className="block text-xs text-muted">{t.contractor.companyName} · Cluster #{t.tender?.cluster.code}</span>
                  </span>
                  <span aria-hidden="true" className="text-muted">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

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

      <Link href="/customer/subsidy" className="block">
        <Card className="flex items-center gap-4 ring-2 ring-mint-400">
          <span className="text-4xl" aria-hidden="true">💰</span>
          <div className="flex-1">
            <p className="font-bold">숨은 지원금 확인하기</p>
            <p className="text-sm text-muted">
              {main ? (subsidyCount ? `우리 집이 검토해 볼 지원사업 ${subsidyCount}건` : "출처가 확인된 지원사업을 찾아드려요") : "건물을 등록하면 받을 수 있는 지원금을 찾아드려요"}
            </p>
          </div>
          <span className="text-xl text-muted" aria-hidden="true">›</span>
        </Card>
      </Link>

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
        <SectionTitle action={<Link href="/customer/learn" className="text-sm font-semibold text-forest-700">전체 보기 ›</Link>}>
          그린리모델링 알아보기
        </SectionTitle>
        <div className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2">
          {cards.map((c) => (
            <Link
              key={c.slug}
              href={`/customer/learn?topic=${c.slug}`}
              className="w-40 shrink-0 snap-start rounded-3xl bg-white p-4 ring-1 ring-line/60 hover:ring-mint-300"
            >
              <div className="text-3xl" aria-hidden="true">{c.emoji}</div>
              <p className="mt-2 font-bold">{c.title}</p>
              <p className="mt-1 text-sm text-muted">{c.summary}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
