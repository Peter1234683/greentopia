import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { programBadge } from "@/lib/subsidy/service";
import { setSubsidyStatus } from "@/app/actions/subsidy";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { SUBSIDY_STATUS_LABEL } from "@/lib/constants";

export const metadata: Metadata = { title: "지원금 DB" };

export default async function AdminSubsidies() {
  const programs = await db.subsidyProgram.findMany({ include: { _count: { select: { matches: { where: { status: { not: "INELIGIBLE" } } } } } }, orderBy: { createdAt: "asc" } });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">지원금 DB ({programs.length})</h1>
        <ButtonLink href="/admin/subsidies/new" className="py-2 text-sm">+ 지원사업 추가</ButtonLink>
      </div>
      <p className="text-sm text-muted">출처 링크가 있는 항목만 고객에게 공개할 수 있어요. 공고문 원문을 확인한 뒤 확인일을 기록하면 &lsquo;공고문 확인 필요&rsquo; 배지가 사라져요. 대구시·구 지원사업은 출처를 확인한 뒤 추가하세요.</p>
      {programs.map((p) => {
        const badge = programBadge(p);
        return (
          <Card key={p.id} className="p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={p.status === "ACTIVE" ? "mint" : p.status === "CLOSED" ? "gray" : "warn"}>{SUBSIDY_STATUS_LABEL[p.status]}</Badge>
              {p.status === "ACTIVE" && badge && <Badge tone="warn">{badge.label}</Badge>}
              <span className="text-xs text-muted">{p.region} · 해당 가능·확인 필요 건물 {p._count.matches}동</span>
            </div>
            <Link href={`/admin/subsidies/${p.id}`} className="mt-1 block font-bold underline-offset-4 hover:underline">{p.name}</Link>
            <p className="text-xs text-muted">{p.provider} · 출처 {p.sourceUrl ? <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">링크</a> : "없음"} · 확인일 {p.verifiedAt?.toLocaleDateString("ko-KR") ?? "미확인"}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              {[
                ["verify", "오늘 공고문 확인함"],
                ["close", "마감 처리"],
                ["hide", "검증 필요로 숨기기"],
              ].map(([op, label]) => (
                <form key={op} action={setSubsidyStatus}>
                  <input type="hidden" name="id" value={p.id} />
                  <button name="op" value={op} className="rounded-full px-3 py-1.5 ring-1 ring-line hover:bg-mint-50">{label}</button>
                </form>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
