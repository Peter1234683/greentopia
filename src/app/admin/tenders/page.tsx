import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui";
import { MethodBadge } from "@/components/contractor/TenderBits";
import { TENDER_STATUS_LABEL, TRADE_LABEL, type Trade } from "@/lib/constants";
import { won } from "@/lib/format";

export const metadata: Metadata = { title: "입찰 관리" };


export default async function AdminTenders(props: PageProps<"/admin/tenders">) {
  const { status } = await props.searchParams;
  const tenders = await db.tender.findMany({
    where: typeof status === "string" && status ? { status } : undefined,
    include: { cluster: true, _count: { select: { bids: { where: { status: { not: "WITHDRAWN" } } } } } },
    orderBy: [{ createdAt: "desc" }],
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-extrabold">입찰 관리</h1>
        {["", "DRAFT", "OPEN", "AWARDED", "FAILED"].map((s) => (
          <Link key={s} href={s ? `/admin/tenders?status=${s}` : "/admin/tenders"} className={`rounded-full px-3 py-1 text-sm ring-1 ${status === s || (!status && !s) ? "bg-forest-800 text-white ring-forest-800" : "bg-white ring-line"}`}>
            {s ? TENDER_STATUS_LABEL[s] : "전체"}
          </Link>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line/60">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs text-muted">
            <tr><th className="px-3 py-2 text-left">Cluster</th><th className="text-left">공종</th><th>회차</th><th>방식</th><th>상태</th><th>입찰</th><th className="text-right">상한</th><th className="px-3 text-right">마감</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {tenders.map((t) => (
              <tr key={t.id} className="hover:bg-mint-50">
                <td className="px-3 py-2"><Link href={`/admin/tenders/${t.id}`} className="font-semibold text-forest-700 underline-offset-4 hover:underline">#{t.cluster.code} {t.cluster.sigungu}</Link></td>
                <td>{TRADE_LABEL[t.cluster.trade as Trade]}</td>
                <td className="text-center">{t.round}</td>
                <td className="text-center"><MethodBadge method={t.method} /></td>
                <td className="text-center"><Badge tone={t.status === "DRAFT" || t.status === "FAILED" ? "warn" : t.status === "AWARDED" ? "forest" : "mint"}>{TENDER_STATUS_LABEL[t.status]}</Badge></td>
                <td className="text-center tabular-nums">{t._count.bids}</td>
                <td className="text-right tabular-nums">{t.priceCap ? won(t.priceCap) : "-"}</td>
                <td className="px-3 text-right text-xs">{t.status === "DRAFT" ? "-" : t.deadline.toLocaleDateString("ko-KR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {tenders.length === 0 && <p className="p-6 text-center text-sm text-muted">공고가 없어요.</p>}
      </div>
    </div>
  );
}
