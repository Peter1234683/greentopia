import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { quantityFor, type Quantity } from "@/lib/pricing";
import { nearestRoute } from "@/lib/route";
import { completeSiteCheck, scheduleProject, startProject } from "@/app/actions/contract";
import { MapView } from "@/components/map/MapView";
import { Badge, Button, Card, Input } from "@/components/ui";
import { CONTRACT_STATUS_LABEL, PROJECT_STATUS_LABEL, TRADE_LABEL, parseJson, type Trade } from "@/lib/constants";
import { dateValue, won } from "@/lib/format";
import { CompleteForm } from "./ProjectActions";

export const metadata: Metadata = { title: "시공 관리" };

function MonthCalendar({ events }: { events: { date: Date; label: string }[] }) {
  const base = events.length ? events.reduce((a, e) => (e.date < a ? e.date : a), events[0].date) : new Date();
  const y = base.getFullYear();
  const m = base.getMonth();
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const on = (d: number) => events.filter((e) => e.date.getFullYear() === y && e.date.getMonth() === m && e.date.getDate() === d);
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{y}년 {m + 1}월 시공 일정</p>
      <div className="grid grid-cols-7 gap-1 text-center text-[0.65rem]">
        {["일", "월", "화", "수", "목", "금", "토"].map((d) => <span key={d} className="text-muted">{d}</span>)}
        {cells.map((d, i) => {
          const ev = d ? on(d) : [];
          return (
            <span key={i} title={ev.map((e) => e.label).join(", ")} className={`rounded-md py-1.5 ${ev.length ? "bg-forest-800 font-bold text-white" : d ? "bg-surface" : ""}`}>
              {d ?? ""}
              {ev.length > 1 && <sup>{ev.length}</sup>}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default async function ContractorProjects() {
  const user = await requireRole("CONTRACTOR");
  const settings = await getSettings();
  const contracts = await db.contract.findMany({
    where: { contractorId: user.contractorProfile!.id, tenderId: { not: null } },
    include: { building: { include: { owner: true, clusterMembers: true } }, project: true, tender: { include: { cluster: true } } },
    orderBy: { createdAt: "desc" },
  });
  const groups = new Map<string, typeof contracts>();
  for (const c of contracts) groups.set(c.tenderId!, [...(groups.get(c.tenderId!) ?? []), c]);
  const events = contracts
    .filter((c) => c.project?.scheduledStart && ["CONTRACTED", "IN_PROGRESS"].includes(c.project.status))
    .map((c) => ({ date: c.project!.scheduledStart!, label: c.building.address }));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">시공 관리</h1>
      {contracts.length === 0 && <Card className="text-center text-sm text-muted">아직 낙찰받은 공사가 없어요.</Card>}
      {events.length > 0 && <Card className="p-4"><MonthCalendar events={events} /></Card>}

      {[...groups.values()].map((list) => {
        const t = list[0].tender!;
        const active = list.filter((c) => c.status !== "CANCELLED");
        const route = nearestRoute(active.map((c) => ({ id: c.id, lat: c.building.lat, lng: c.building.lng, address: c.building.address })));
        const done = active.filter((c) => c.project?.status === "COMPLETED").length;
        return (
          <section key={t.id} className="space-y-3">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <p className="font-bold">Cluster #{t.cluster.code} · {TRADE_LABEL[t.cluster.trade as Trade]} · {t.cluster.sigungu}</p>
                <Badge tone="forest">{done}/{active.length} 완료</Badge>
              </div>
              <p className="text-sm text-muted">계약 합계 {won(active.reduce((s, c) => s + c.amount, 0))} · 공사 {t.workStart?.toLocaleDateString("ko-KR")}~</p>
              {active.length > 0 && (
                <div className="mt-3">
                  <MapView
                    center={[t.cluster.centerLat, t.cluster.centerLng]}
                    zoom={15}
                    height={200}
                    path={route.order.map((r) => [r.lat, r.lng])}
                    markers={route.order.map((r, i) => ({ id: r.id, lat: r.lat, lng: r.lng, label: `${i + 1}`, permanent: true, tone: "member" as const }))}
                  />
                  <p className="mt-1 text-xs text-muted">근거리 연속 시공 동선 약 {route.km}km (번호 순서)</p>
                </div>
              )}
            </Card>
            {route.order.map((r, i) => {
              const c = active.find((x) => x.id === r.id)!;
              const member = c.building.clusterMembers.find((m) => m.clusterId === t.clusterId);
              const q = parseJson<Record<string, Quantity>>(member?.quantityJson, {})[t.cluster.trade] ?? quantityFor(c.building, t.cluster.trade, settings.pricing);
              const showContact = c.status !== "PENDING";
              return (
                <Card key={c.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted">{i + 1}번 동선</p>
                      <p className="font-bold">{c.building.address}</p>
                      <p className="text-xs text-muted">
                        {showContact ? `${c.building.owner.name} · ${c.building.owner.phone ?? "-"}` : "건물주 참여 확정 후 연락처가 공개돼요"}
                      </p>
                    </div>
                    <Badge tone={c.status === "SIGNED" ? "forest" : "warn"}>{c.project && c.status === "SIGNED" ? PROJECT_STATUS_LABEL[c.project.status] : CONTRACT_STATUS_LABEL[c.status]}</Badge>
                  </div>
                  <p className="mt-2 text-sm">추정 물량 {Math.round(q.amount)}{q.unit} · 계약 금액 <b className="tabular-nums">{won(c.amount)}</b></p>

                  {c.status === "CONFIRMED" && (
                    <form action={completeSiteCheck} className="mt-3 flex items-end gap-2">
                      <input type="hidden" name="contractId" value={c.id} />
                      <input type="hidden" name="estimatedQty" value={q.amount} />
                      <label className="flex-1 text-sm">
                        <span className="mb-1 block font-semibold">실측 물량({q.unit})</span>
                        <Input name="measuredQty" type="number" step="0.1" defaultValue={q.amount} />
                      </label>
                      <Button className="shrink-0 py-3 text-sm">현장확인 완료</Button>
                    </form>
                  )}
                  {c.status === "READY" && <p className="mt-2 text-sm text-muted">실측 {c.measuredQty}{q.unit} 반영 · 건물주 서명 대기</p>}
                  {c.project && ["CONTRACTED", "IN_PROGRESS"].includes(c.project.status) && c.status === "SIGNED" && (
                    <form action={scheduleProject} className="mt-3 flex items-end gap-2">
                      <input type="hidden" name="contractId" value={c.id} />
                      <label className="flex-1 text-sm">
                        <span className="mb-1 block font-semibold">시공 예정일</span>
                        <Input name="date" type="date" defaultValue={dateValue(c.project.scheduledStart)} />
                      </label>
                      <Button variant="outline" className="shrink-0 py-3 text-sm">일정 저장</Button>
                    </form>
                  )}
                  {c.project?.status === "CONTRACTED" && c.status === "SIGNED" && (
                    <form action={startProject} className="mt-2">
                      <input type="hidden" name="contractId" value={c.id} />
                      <Button className="w-full py-2.5 text-sm">착공</Button>
                    </form>
                  )}
                  {c.project && ["IN_PROGRESS", "AS"].includes(c.project.status) && <CompleteForm contractId={c.id} isAS={c.project.status === "AS"} />}
                  {c.project?.status === "AS" && c.project.completionNote && <p className="mt-2 text-sm text-warn">{c.project.completionNote}</p>}
                </Card>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
