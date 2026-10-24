import Link from "next/link";
import type { Building, Cluster, ClusterMember, Tender } from "@prisma/client";
import { joinCluster, leaveCluster } from "@/app/actions/joint";
import { MapView } from "@/components/map/MapView";
import { Badge, Button, Card } from "@/components/ui";
import { blur } from "@/lib/geo";
import { TENDER_METHOD_LABEL, TENDER_STATUS_LABEL, TRADE_LABEL, parseJson, type Trade } from "@/lib/constants";

type Member = ClusterMember & {
  cluster: Cluster & { members: (ClusterMember & { building: Building })[]; tenders: Tender[] };
};

const TITLE: Record<string, string> = {
  WINDOW: "고성능 창호 공동교체",
  EXT_INSULATION: "외단열 공동시공",
  INT_INSULATION: "내단열 공동보강",
  BOILER: "콘덴싱 보일러 공동교체",
  ROOF: "지붕 단열 공동시공",
};

const STATUS: Record<string, { label: string; tone: "mint" | "gray" | "warn" | "forest" }> = {
  PROPOSED: { label: "AI 제안", tone: "mint" },
  RECRUITING: { label: "참여 모집 중", tone: "mint" },
  CONFIRMED: { label: "공고 준비 중", tone: "warn" },
  TENDERING: { label: "입찰 진행 중", tone: "forest" },
  AWARDED: { label: "낙찰 완료", tone: "forest" },
  IN_PROGRESS: { label: "시공 중", tone: "forest" },
  COMPLETED: { label: "완료", tone: "gray" },
};

export function ClusterCard({ member, meId, minJoined }: { member: Member; meId: string; minJoined: number }) {
  const c = member.cluster;
  const active = c.members.filter((m) => m.status !== "LEFT");
  const joined = active.filter((m) => m.status === "JOINED").length;
  const reasons = parseJson<{ label: string; ok: boolean }[]>(c.reasonsJson, []);
  const tender = c.tenders[0];
  const st = STATUS[c.status] ?? { label: c.status, tone: "gray" as const };
  const canChange = ["PROPOSED", "RECRUITING", "CONFIRMED", "TENDERING"].includes(c.status);

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-forest-700">Cluster #{c.code}</p>
          <p className="text-lg font-bold">{TITLE[c.trade] ?? TRADE_LABEL[c.trade as Trade]}</p>
          <p className="text-sm text-muted">
            {active.length}동 · 반경 {c.radiusKm}km · 평균 적합도 <b className="text-ink">{Math.round(c.avgScore)}점</b>
          </p>
        </div>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-1.5 text-sm">
        {reasons.map((r) => (
          <li key={r.label} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={r.ok ? "text-forest-700" : "text-muted"}>{r.ok ? "✔" : "–"}</span>
            {r.label}
          </li>
        ))}
      </ul>

      <div className="mt-3">
        <MapView
          center={[c.centerLat, c.centerLng]}
          zoom={15}
          circles={[{ lat: c.centerLat, lng: c.centerLng, radiusM: c.radiusKm * 1000 }]}
          markers={active.map((m) =>
            m.buildingId === meId
              ? { id: m.id, lat: m.building.lat, lng: m.building.lng, tone: "me" as const, label: "우리 집" }
              : { id: m.id, lat: blur(m.building.lat), lng: blur(m.building.lng), tone: m.status === "JOINED" ? ("member" as const) : ("other" as const) },
          )}
          height={180}
        />
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-sm">
          <span>공동견적 참여</span>
          <span className="font-semibold tabular-nums">{joined} / {active.length}동</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={joined} aria-valuemin={0} aria-valuemax={active.length}>
          <div className="h-full rounded-full bg-forest-700" style={{ width: `${(joined / Math.max(1, active.length)) * 100}%` }} />
        </div>
        <p className="mt-1 text-xs text-muted">
          {joined >= minJoined ? "입찰을 열 수 있는 인원이 모였어요." : `${minJoined}동 이상 참여하면 입찰 공고가 열려요. (${Math.max(0, minJoined - joined)}동 더 필요)`}
        </p>
      </div>

      {tender && (
        <div className="mt-3 rounded-2xl bg-surface p-3 text-sm">
          <p>
            입찰 공고 {tender.round > 1 && `${tender.round}차 `}·{" "}
            <b>{TENDER_METHOD_LABEL[tender.method]}</b> ·{" "}
            {tender.status === "DRAFT" ? "운영자 확인 중" : tender.status === "OPEN" ? `${tender.deadline.toLocaleDateString("ko-KR")} 마감` : tender.status === "AWARDED" ? "낙찰 완료" : tender.status === "FAILED" ? "유찰 · 재공고 준비" : TENDER_STATUS_LABEL[tender.status]}
          </p>
          {["AWARDED", "EVALUATING"].includes(tender.status) && (
            <Link href={`/customer/projects/${c.id}`} className="mt-1 inline-block font-semibold text-forest-700">견적 비교 보기 ›</Link>
          )}
        </div>
      )}

      {canChange && (
        <div className="mt-4">
          {member.status === "JOINED" ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-forest-700">✔ 참여 중이에요</span>
              {!tender || tender.status === "DRAFT" ? (
                <form action={leaveCluster}>
                  <input type="hidden" name="memberId" value={member.id} />
                  <Button variant="ghost" className="px-3 py-2 text-sm text-muted">참여 취소</Button>
                </form>
              ) : null}
            </div>
          ) : (
            <form action={joinCluster}>
              <input type="hidden" name="memberId" value={member.id} />
              <Button className="w-full">{member.status === "LEFT" ? "다시 참여하기" : "공동견적 참여하기"}</Button>
              <p className="mt-2 text-center text-xs text-muted">참여해도 계약 의무는 없어요. 업체가 정해진 뒤 최종 결정해요.</p>
            </form>
          )}
        </div>
      )}
    </Card>
  );
}
