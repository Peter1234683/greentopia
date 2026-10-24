import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";
import { listPosts } from "@/lib/community/service";
import { Chips, PostRow } from "@/components/community/Bits";
import { ButtonLink, Card, cx } from "@/components/ui";
import { CONTRACTOR_CATEGORIES } from "@/lib/constants";
import { LoungeGate } from "./Gate";
import Link from "next/link";

export const metadata: Metadata = { title: "파트너 라운지" };

export default async function Lounge(props: PageProps<"/contractor/lounge">) {
  const user = await requireRole("CONTRACTOR");
  const p = user.contractorProfile!;
  const sp = await props.searchParams;
  if (p.reviewStatus !== "APPROVED")
    return <Card className="text-center text-sm text-muted">서류 심사가 승인되면 파트너 라운지를 이용할 수 있어요.</Card>;
  if (!p.loungeAgreedAt) return <LoungeGate need={sp.need === "1"} />;

  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const f = { category: one("cat"), sort: one("sort") ?? "latest", mine: one("mine") === "1", saved: one("saved") === "1" };
  const { notices, posts } = await listPosts("CONTRACTOR", user, f);
  const href = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ cat: f.category, sort: f.sort === "latest" ? undefined : f.sort, mine: f.mine ? "1" : undefined, saved: f.saved ? "1" : undefined, ...patch }))
      if (v) q.set(k, v);
    const s = q.toString();
    return `/contractor/lounge${s ? `?${s}` : ""}`;
  };
  const toggle = (on: boolean) => cx("rounded-full px-3 py-1.5 text-sm font-semibold ring-1", on ? "bg-mint-100 ring-mint-400" : "ring-line");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">파트너 라운지</h1>
        <p className="text-sm text-muted">승인 업체끼리 기술·실무를 나눠요. 진행 중 입찰 이야기는 금지예요.</p>
      </div>
      <Chips items={[...CONTRACTOR_CATEGORIES]} current={f.category} href={(c) => href({ cat: c })} />
      <div className="flex flex-wrap gap-2">
        <Link href={href({ sort: f.sort === "popular" ? undefined : "popular" })} className={toggle(f.sort === "popular")}>인기순</Link>
        <Link href={href({ mine: f.mine ? undefined : "1" })} className={toggle(f.mine)}>내 글</Link>
        <Link href={href({ saved: f.saved ? undefined : "1" })} className={toggle(f.saved)}>저장한 글</Link>
      </div>
      <div className="space-y-2">
        {notices.map((x) => <PostRow key={x.id} p={x} board="CONTRACTOR" base="/contractor/lounge" />)}
        {posts.map((x) => <PostRow key={x.id} p={x} board="CONTRACTOR" base="/contractor/lounge" />)}
        {posts.length === 0 && <Card className="text-center text-sm text-muted">글이 없어요.</Card>}
      </div>
      <ButtonLink href="/contractor/lounge/new" className="fixed bottom-24 right-5 z-20 rounded-full px-5 shadow-lg">✏️ 글쓰기</ButtonLink>
    </div>
  );
}
