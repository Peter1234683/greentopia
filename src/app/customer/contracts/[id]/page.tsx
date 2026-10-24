import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { syncMilestones } from "@/lib/contractFlow";
import { demoToolsEnabled } from "@/lib/demo";
import { approveMilestone, demoElapseRetention } from "@/app/actions/payment";
import { DelaySimulator } from "@/components/contract/DelaySimulator";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, Basis, ButtonLink, Card } from "@/components/ui";
import { CONTRACT_STATUS_LABEL, TRADE_LABEL, parseJson, type Trade } from "@/lib/constants";
import { won } from "@/lib/format";

export const metadata: Metadata = { title: "계약 요약 · 단계별 지급" };

const ST = { LOCKED: { label: "대기", tone: "gray" }, READY: { label: "승인 가능", tone: "warn" }, RELEASED: { label: "승인 완료", tone: "forest" } } as const;

export default async function ContractPage(props: PageProps<"/customer/contracts/[id]">) {
  const user = await requireRole("CUSTOMER");
  const { id } = await props.params;
  await syncMilestones(id);
  const c = await db.contract.findFirst({
    where: { id, building: { ownerId: user.id } },
    include: {
      building: true,
      contractor: { include: { safetyPledge: true } },
      bid: true,
      tender: { include: { cluster: true } },
      project: { include: { inspection: true } },
      milestones: { orderBy: { seq: "asc" } },
    },
  });
  if (!c) notFound();
  const { contract: cfg, pricing } = await getSettings();
  const trade = c.tender?.cluster.trade ?? "";
  const table = parseJson<Record<string, number>>(c.bid?.unitPriceTableJson, {});
  const specs = (pricing.trades[trade]?.types ?? []).filter((t) => table[t.code] != null).map((t) => t.label);
  const p = c.project;
  const plannedEnd = p?.plannedEnd ?? (p?.scheduledStart && c.bid ? new Date(p.scheduledStart.getTime() + c.bid.durationDays * 864e5) : null);
  const stageLabel = Object.fromEntries(cfg.stages.map((s) => [s.code, s.label]));

  const rows: [string, React.ReactNode][] = [
    ["건물주", `${user.name} (${c.building.dong} · 개별 계약)`],
    ["시공업체", `${c.contractor.companyName} · 대표 ${c.contractor.ceoName} · ${c.contractor.bizRegNo}`],
    ["공사 범위", `${TRADE_LABEL[trade as Trade] ?? trade}${c.measuredQty ? ` · 실측 ${c.measuredQty}` : ""}`],
    ["자재 규격", specs.join(", ") || "-"],
    ["공사 기간", c.bid ? `${c.bid.durationDays}일${plannedEnd ? ` (준공 예정 ${plannedEnd.toLocaleDateString("ko-KR")})` : ""}` : "-"],
    ["계약 금액", <b key="a" className="tabular-nums">{won(c.amount)}</b>],
    ["하자보수", c.bid ? `${c.bid.warrantyMonths}개월 · 하자보수 보증증권 제출 (보증기관 무관)` : "-"],
    ["무상 A/S", c.bid ? `${c.bid.asMonths}개월` : "-"],
    ["지체상금", `1일 계약금액의 ${cfg.delayPenalty.ratePerDayPermil}/1000, 최대 ${Math.round(cfg.delayPenalty.maxRatio * 100)}%`],
    ["A/S 유보금", `${Math.round((cfg.stages.find((s) => s.code === "RETENTION")?.ratio ?? 0) * 100)}% · 준공 후 ${cfg.retentionDays}일 보류`],
  ];

  return (
    <div className="space-y-5 pt-2">
      <Link href={c.tender ? `/customer/projects/${c.tender.clusterId}` : "/customer/projects"} className="text-sm text-muted">‹ 공사 상세</Link>
      <div>
        <div className="flex gap-2"><Badge tone="warn">데모</Badge><Badge tone={c.status === "SIGNED" ? "forest" : "gray"}>{CONTRACT_STATUS_LABEL[c.status]}</Badge></div>
        <h1 className="mt-2 text-2xl font-extrabold">계약 요약서</h1>
        <p className="text-sm text-muted">{cfg.standardContractLabel}</p>
      </div>

      <Card className="p-4">
        <dl className="divide-y divide-line text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex gap-3 py-2"><dt className="w-20 shrink-0 text-muted">{k}</dt><dd className="flex-1">{v}</dd></div>
          ))}
        </dl>
        {c.contractor.safetyPledge && <p className="mt-2 text-xs text-forest-700">🛡️ 이 업체는 안심 보장제에 참여하고 있어요.</p>}
        <Basis>요약은 이해를 돕기 위한 것이고, 효력은 실제 서명한 계약서 원문을 따라요. 계약은 건물별로 개별 체결되며 그린토피아는 중개자예요.</Basis>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">💳 단계별 지급</h2>
        <p className="rounded-2xl bg-warn-bg px-4 py-3 text-sm text-warn">{cfg.escrowNote}</p>
        {c.milestones.length === 0 && <Card className="text-sm text-muted">계약서에 서명하면 지급 단계가 만들어져요.</Card>}
        <ol className="space-y-2">
          {c.milestones.map((m) => {
            const st = ST[m.status as keyof typeof ST] ?? ST.LOCKED;
            return (
              <li key={m.id}>
                <Card className="p-4" data-stage={m.stage}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold">{m.seq}. {stageLabel[m.stage] ?? m.stage} <span className="text-sm font-normal text-muted">{Math.round(m.ratio * 100)}%</span></p>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  <p className="mt-1 text-lg font-extrabold tabular-nums">{won(m.amount)}</p>
                  <p className="text-xs text-muted">조건: {m.condition}{m.stage === "RETENTION" && m.releaseAt ? ` · 해제 예정 ${m.releaseAt.toLocaleDateString("ko-KR")}` : ""}</p>
                  {m.approvedAt && <p className="text-xs text-forest-700">✔ {m.approvedAt.toLocaleDateString("ko-KR")} 건물주 승인 (지급 처리 기록 · 데모)</p>}
                  {m.status === "READY" && (
                    <form action={approveMilestone} className="mt-3">
                      <input type="hidden" name="contractId" value={c.id} />
                      <input type="hidden" name="stage" value={m.stage} />
                      <SubmitButton pendingLabel="처리 중…" className="w-full py-3">{stageLabel[m.stage]} 승인하기</SubmitButton>
                    </form>
                  )}
                  {m.stage === "INTERIM" && m.status === "LOCKED" && !p?.materialsDeliveredAt && <p className="mt-1 text-xs text-muted">업체가 자재 입고를 보고하면 검수 후 승인할 수 있어요.</p>}
                  {m.stage === "COMPLETION" && m.status === "LOCKED" && p?.inspection && !p.inspection.ownerApproved && (
                    <Link href={`/customer/contracts/${c.id}/inspection`} className="mt-1 inline-block text-sm font-semibold text-forest-700">준공 검측 확인하러 가기 ›</Link>
                  )}
                  {m.stage === "RETENTION" && m.status === "LOCKED" && m.releaseAt && demoToolsEnabled() && (
                    <form action={demoElapseRetention} className="mt-2">
                      <input type="hidden" name="contractId" value={c.id} />
                      <button className="text-xs text-muted underline">데모: 유보 기간 경과 처리</button>
                    </form>
                  )}
                </Card>
              </li>
            );
          })}
        </ol>
      </section>

      {p?.inspection && (
        <ButtonLink href={`/customer/contracts/${c.id}/inspection`} variant={p.inspection.ownerApproved ? "outline" : "primary"} className="w-full">
          {p.inspection.ownerApproved ? "준공 검측 결과 보기" : "📋 준공 검측 확인·승인"}
        </ButtonLink>
      )}

      <Card>
        <p className="font-bold">⏱️ 지체상금 계산해보기</p>
        <div className="mt-3"><DelaySimulator amount={c.amount} cfg={cfg.delayPenalty} plannedEnd={plannedEnd?.toLocaleDateString("ko-KR") ?? null} /></div>
      </Card>
    </div>
  );
}
