import type { Metadata } from "next";
import { WorkTabs } from "@/components/contractor/WorkTabs";
import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { Badge, Card } from "@/components/ui";
import { MethodBadge } from "@/components/contractor/TenderBits";
import { TRADE_LABEL, parseJson, type Trade } from "@/lib/constants";
import { won } from "@/lib/format";

export const metadata: Metadata = { title: "내 입찰" };

const SCORE_LABEL: Record<string, string> = { price: "가격", record: "실적", duration: "공사기간", warranty: "A/S·하자보증", reputation: "평판" };

function statusOf(bid: { status: string }, tender: { status: string; deadline: Date }) {
  if (bid.status === "WITHDRAWN") return { label: "철회", tone: "gray" as const };
  if (bid.status === "WON") return { label: "낙찰", tone: "forest" as const };
  if (bid.status === "LOST") return { label: "탈락", tone: "gray" as const };
  if (tender.status === "FAILED") return { label: "유찰", tone: "warn" as const };
  if (tender.status === "EVALUATING" || tender.deadline < new Date()) return { label: "평가 중", tone: "warn" as const };
  return { label: "제출", tone: "mint" as const };
}

export default async function MyBids(props: PageProps<"/contractor/bids">) {
  const user = await requireRole("CONTRACTOR");
  const { submitted } = await props.searchParams;
  const bids = await db.bid.findMany({
    where: { contractorId: user.contractorProfile!.id },
    include: { tender: { include: { cluster: true, _count: { select: { bids: { where: { status: { not: "WITHDRAWN" } } } } } } }, evaluation: true },
    orderBy: { updatedAt: "desc" },
  });
  return (
    <div className="space-y-4">
      <WorkTabs current="bids" />
      <h1 className="text-xl font-extrabold">내 입찰</h1>
      {submitted && <p role="status" className="rounded-2xl bg-forest-800 px-4 py-3 text-sm text-white">✅ 입찰서를 제출했어요. 마감 전까지 수정할 수 있어요.</p>}
      {bids.length === 0 && (
        <Card className="text-center text-sm text-muted">
          아직 제출한 입찰서가 없어요. <Link href="/contractor/tenders" className="text-forest-700 underline">입찰 공고 보기</Link>
        </Card>
      )}
      {bids.map((b) => {
        const st = statusOf(b, b.tender);
        const scores = b.evaluation ? parseJson<Record<string, number>>(b.evaluation.scoresJson, {}) : null;
        const pq = b.evaluation ? parseJson<{ failures?: string[] }>(b.evaluation.pqDetailsJson, {}) : null;
        return (
          <Card key={b.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/contractor/tenders/${b.tenderId}`}>
                <p className="text-xs font-semibold text-forest-700">Cluster #{b.tender.cluster.code} · {b.tender.cluster.sigungu}{b.tender.round > 1 && ` · ${b.tender.round}차`}</p>
                <p className="font-bold">{TRADE_LABEL[b.tender.cluster.trade as Trade]} 공동시공</p>
              </Link>
              <div className="flex flex-col items-end gap-1"><Badge tone={st.tone}>{st.label}</Badge><MethodBadge method={b.tender.method} /></div>
            </div>
            <p className="mt-2 text-sm">
              입찰 총액 <b className="tabular-nums">{won(b.totalPrice)}</b> · {b.durationDays}일 · 하자보증 {b.warrantyMonths}개월
            </p>
            <p className="text-xs text-muted">마감 {b.tender.deadline.toLocaleDateString("ko-KR")} · 참여 업체 {b.tender._count.bids}곳</p>
            {b.evaluation && scores && (
              <div className="mt-3 rounded-2xl bg-surface p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">평가 결과 {b.evaluation.rank && `· ${b.evaluation.rank}위`}</p>
                  <p className="text-lg font-extrabold tabular-nums">{b.evaluation.total.toFixed(1)}점</p>
                </div>
                {!b.evaluation.pqPassed && <p className="mt-1 text-sm text-danger">PQ 탈락: {pq?.failures?.join(", ")}</p>}
                <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {Object.entries(scores).map(([k, v]) => (
                    <li key={k} className="flex justify-between"><span className="text-muted">{SCORE_LABEL[k] ?? k}</span><span className="tabular-nums">{v.toFixed(1)}</span></li>
                  ))}
                </ul>
                {b.evaluation.dumpingPenalty > 0 && <p className="mt-1 text-xs text-warn">저가 입찰 감점 −{b.evaluation.dumpingPenalty.toFixed(1)}점</p>}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
