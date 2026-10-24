import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { runCollusionAction, updateFlag } from "@/app/actions/admin";
import { Badge, Button, Card } from "@/components/ui";
import { parseJson } from "@/lib/constants";

export const metadata: Metadata = { title: "담합 감시" };

const KIND: Record<string, string> = { ROTATION: "낙찰 순환", CLOSE_PRICES: "입찰가 근접" };

export default async function Monitoring() {
  const settings = await getSettings();
  const [flags, contractors, contracts] = await Promise.all([
    db.collusionFlag.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }] }),
    db.contractorProfile.findMany({ select: { id: true, companyName: true } }),
    db.contract.groupBy({ by: ["contractorId", "isNegotiated"], where: { status: { not: "CANCELLED" } }, _count: true }),
  ]);
  const name = (id: string) => contractors.find((c) => c.id === id)?.companyName ?? id;
  const share = contractors
    .map((c) => {
      const rows = contracts.filter((r) => r.contractorId === c.id);
      const total = rows.reduce((s, r) => s + r._count, 0);
      const neg = rows.filter((r) => r.isNegotiated).reduce((s, r) => s + r._count, 0);
      return { ...c, total, neg, share: total ? neg / total : 0 };
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => b.share - a.share);
  const alert = settings.bidding.negotiatedShareAlert;

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-bold">담합 의심 플래그</h1>
          <form action={runCollusionAction}><Button variant="outline" className="py-2 text-sm">지금 점검</Button></form>
        </div>
        <p className="mb-3 text-sm text-muted">
          규칙: 같은 두 업체가 {settings.bidding.collusion.minSharedTenders}건 이상 함께 입찰하며 번갈아 낙찰 · 한 공고에서 입찰가 차이 {settings.bidding.collusion.closePriceGap * 100}% 이하
        </p>
        {flags.length === 0 && <Card className="text-sm text-muted">의심 패턴이 없어요.</Card>}
        <div className="space-y-2">
          {flags.map((f) => (
            <Card key={f.id} className={`p-4 ${f.status !== "OPEN" ? "opacity-60" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge tone={f.kind === "ROTATION" ? "danger" : "warn"}>{KIND[f.kind]}</Badge>
                  <span className="text-sm font-semibold">{parseJson<string[]>(f.contractorIdsJson, []).map(name).join(" · ")}</span>
                </div>
                <span className="text-xs text-muted">{f.status === "OPEN" ? "검토 필요" : f.status === "CONFIRMED" ? "확인됨" : "무혐의"}</span>
              </div>
              <p className="mt-1 text-sm">{f.detail}</p>
              {f.status === "OPEN" && (
                <form action={updateFlag} className="mt-2 flex gap-2">
                  <input type="hidden" name="flagId" value={f.id} />
                  <Button name="status" value="CONFIRMED" className="py-2 text-sm">조사 대상 확정</Button>
                  <Button name="status" value="DISMISSED" variant="outline" className="py-2 text-sm">무혐의 처리</Button>
                </form>
              )}
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">업체별 수의계약 비중</h2>
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line/60">
          <table className="w-full text-sm">
            <thead className="bg-surface text-xs text-muted"><tr><th className="px-3 py-2 text-left">업체</th><th>전체 계약</th><th>수의계약</th><th>비중</th></tr></thead>
            <tbody className="divide-y divide-line">
              {share.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2">{c.companyName}</td>
                  <td className="text-center tabular-nums">{c.total}</td>
                  <td className="text-center tabular-nums">{c.neg}</td>
                  <td className="text-center">{c.share >= alert ? <Badge tone="danger">{Math.round(c.share * 100)}% ⚠</Badge> : `${Math.round(c.share * 100)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">경고선 {Math.round(alert * 100)}% (설정 → bidding.negotiatedShareAlert)</p>
      </section>
    </div>
  );
}
