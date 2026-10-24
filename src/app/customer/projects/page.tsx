import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { matchAllForBuilding } from "@/lib/subsidy/service";
import { stageIndex } from "@/lib/stages";
import { Timeline } from "@/components/Timeline";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { CONTRACT_STATUS_LABEL, PROJECT_STAGES, TRADE_LABEL, type Trade } from "@/lib/constants";
import { won } from "@/lib/format";
import { toggleChecklist } from "@/app/actions/photo";
import { PHASE_LABEL } from "@/lib/photo/guide";

export const metadata: Metadata = { title: "내 공사" };

export default async function MyProjects(props: PageProps<"/customer/projects">) {
  const user = await requireRole("CUSTOMER");
  const { checklist: imported } = await props.searchParams;
  const todos = await db.checklistItem.findMany({
    where: { building: { ownerId: user.id } },
    include: { building: { select: { nickname: true, dong: true } } },
    orderBy: [{ done: "asc" }, { createdAt: "asc" }],
  });
  const [buildings] = await Promise.all([
    db.building.findMany({
      where: { ownerId: user.id },
      include: {
        demands: { orderBy: { createdAt: "desc" }, take: 1 },
        clusterMembers: {
          where: { status: "JOINED" },
          include: { cluster: { include: { tenders: { orderBy: { createdAt: "desc" }, take: 1 } } } },
        },
        contracts: { where: { status: { not: "CANCELLED" } }, include: { project: { include: { reviews: true } }, contractor: true, tender: true } },
      },
    }),
  ]);
  const subsidies = (await Promise.all(buildings.map((b) => matchAllForBuilding(user.id, b.id)))).filter((x) => x !== null);
  const items = buildings.flatMap((b) =>
    b.clusterMembers.map((m) => {
      const tender = m.cluster.tenders[0] ?? null;
      const contract = b.contracts.find((c) => c.tender?.clusterId === m.clusterId) ?? null;
      return { b, m, tender, contract, stage: stageIndex({ clusterStatus: m.cluster.status, tenderStatus: tender?.status ?? null, contractStatus: contract?.status ?? null, projectStatus: contract?.project?.status ?? null }) };
    }),
  );

  return (
    <div className="space-y-5 pt-2">
      <h1 className="text-2xl font-extrabold">내 공사</h1>
      {imported && <p role="status" className="rounded-2xl bg-forest-800 px-4 py-3 text-sm text-white">✅ 성공 가이드 체크리스트를 할 일로 가져왔어요.</p>}
      {items.length === 0 && (
        <Card className="text-center">
          <div className="text-5xl" aria-hidden="true">📋</div>
          <p className="mt-3 font-bold">아직 진행 중인 공사가 없어요</p>
          <p className="mt-1 text-sm text-muted">공동공사에 참여하면 이곳에서 입찰·계약·시공 과정을 볼 수 있어요.</p>
          <ButtonLink href="/customer/joint" className="mt-4 w-full">공동공사 보러 가기</ButtonLink>
        </Card>
      )}
      {items.map(({ b, m, contract, stage }) => {
        const needsAction = contract && (["PENDING", "READY"].includes(contract.status) || (contract.project?.status === "COMPLETED" && contract.project.reviews.length === 0));
        return (
          <Link key={m.id} href={`/customer/projects/${m.clusterId}`} className="block">
            <Card className="hover:ring-mint-300">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-forest-700">Cluster #{m.cluster.code} · {b.nickname ?? b.dong}</p>
                  <p className="text-lg font-bold">{TRADE_LABEL[m.cluster.trade as Trade]} 공동공사</p>
                </div>
                {needsAction ? <Badge tone="warn">확인 필요</Badge> : <Badge>{PROJECT_STAGES[stage].label}</Badge>}
              </div>
              <div className="mt-4"><Timeline current={stage} /></div>
              {contract && (
                <p className="mt-3 text-sm">
                  {contract.contractor.companyName} · <b className="tabular-nums">{won(contract.amount)}</b> · {CONTRACT_STATUS_LABEL[contract.status]}
                </p>
              )}
            </Card>
          </Link>
        );
      })}

      {todos.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <h2 className="text-lg font-bold">✅ 공사 할 일</h2>
            <span className="text-sm text-muted">{todos.filter((t) => t.done).length}/{todos.length} 완료</span>
          </div>
          {(["BEFORE", "DURING", "AFTER"] as const).map((ph) => {
            const list = todos.filter((t) => t.phase === ph);
            if (!list.length) return null;
            return (
              <Card key={ph} className="p-4">
                <p className="font-bold">{PHASE_LABEL[ph]}</p>
                <ul className="mt-2 space-y-1">
                  {list.map((t) => (
                    <li key={t.id}>
                      <form action={toggleChecklist}>
                        <input type="hidden" name="itemId" value={t.id} />
                        <button aria-pressed={t.done} className="flex w-full items-start gap-2 rounded-xl px-1 py-1.5 text-left text-sm hover:bg-mint-50">
                          <span aria-hidden="true" className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1 ${t.done ? "bg-forest-700 text-white ring-forest-700" : "ring-line"}`}>{t.done ? "✓" : ""}</span>
                          <span className={`flex-1 ${t.done ? "text-muted line-through" : ""}`}>{t.title}</span>
                          {t.importance === "HIGH" && !t.done && <Badge tone="danger">중요</Badge>}
                          {t.expertCheck && <Badge tone="forest">전문가 확인</Badge>}
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">🎁 지원사업 안내</h2>
        {subsidies.map((m) =>
          m.results.map(({ program: p, match }) => (
            <Card key={`${m.building.id}-${p.id}`} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold">{p.name}</p>
                <Badge tone={match.status === "ELIGIBLE" ? "mint" : match.status === "CHECK" ? "warn" : "gray"}>
                  {match.status === "ELIGIBLE" ? "해당 가능" : match.status === "CHECK" ? "조건 확인 필요" : "해당 없음"}
                </Badge>
              </div>
              <p className="text-xs text-muted">{m.building.nickname ?? m.building.address}{p.badge ? ` · ${p.badge.label}` : ""}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {match.reasons.map((r) => (
                  <li key={r.label} className="flex gap-2">
                    <span className={r.state === "ok" ? "text-forest-700" : r.state === "no" ? "text-danger" : "text-warn"} aria-hidden="true">{r.state === "ok" ? "✔" : r.state === "no" ? "✕" : "?"}</span>
                    {r.label}
                  </li>
                ))}
              </ul>
              <Link href={`/customer/subsidy?b=${m.building.id}`} className="mt-2 inline-block text-sm text-forest-700 underline">자세히 · 계산기 · 상담</Link>
            </Card>
          )),
        )}
        <p className="text-xs text-muted">※ 지원금 DB 기준 규칙 대조 결과예요. 실제 적용 여부는 공고문과 관할 기관 확인이 필요합니다.</p>
      </section>
    </div>
  );
}
