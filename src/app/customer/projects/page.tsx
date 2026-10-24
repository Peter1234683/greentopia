import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { checkSupports } from "@/lib/support";
import { stageIndex } from "@/lib/stages";
import { Timeline } from "@/components/Timeline";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { CONTRACT_STATUS_LABEL, PROJECT_STAGES, TRADE_LABEL, parseJson, type Trade } from "@/lib/constants";
import { won } from "@/lib/format";

export const metadata: Metadata = { title: "내 공사" };

export default async function MyProjects() {
  const user = await requireRole("CUSTOMER");
  const [settings, buildings] = await Promise.all([
    getSettings(),
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

      <section className="space-y-3">
        <h2 className="text-lg font-bold">🎁 지원사업 안내</h2>
        {buildings.map((b) => {
          const trades = parseJson<string[]>(b.demands[0]?.tradesJson, []);
          return checkSupports(b, trades, settings.support).map((s) => (
            <Card key={`${b.id}-${s.name}`} className="p-4">
              <div className="flex items-center justify-between">
                <p className="font-bold">{s.name}</p>
                <Badge tone={s.eligible ? "mint" : "gray"}>{s.eligible ? "해당 가능성 높음" : "요건 확인 필요"}</Badge>
              </div>
              <p className="text-xs text-muted">{b.nickname ?? b.address}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {s.checks.map((c) => (
                  <li key={c.label} className="flex gap-2"><span className={c.ok ? "text-forest-700" : "text-danger"} aria-hidden="true">{c.ok ? "✔" : "✕"}</span>{c.label}</li>
                ))}
              </ul>
              <a href={s.infoUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-forest-700 underline">공고 확인하기 ↗</a>
            </Card>
          ));
        })}
        <p className="text-xs text-muted">※ 규칙 기반 요건 대조 결과예요. 실제 지원 여부는 해당 기관 심사로 결정돼요.</p>
      </section>
    </div>
  );
}
