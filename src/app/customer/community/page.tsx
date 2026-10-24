import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { listPosts } from "@/lib/community/service";
import { Chips, PostRow } from "@/components/community/Bits";
import { ButtonLink, Card, cx } from "@/components/ui";
import { OWNER_CATEGORIES, TRADES, TRADE_LABEL } from "@/lib/constants";

export const metadata: Metadata = { title: "이웃 커뮤니티" };

const SORTS = [
  { code: "latest", label: "최신순" },
  { code: "popular", label: "인기순" },
  { code: "best", label: "BEST" },
];

export default async function Community(props: PageProps<"/customer/community">) {
  const user = await requireRole("CUSTOMER");
  const sp = await props.searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const f = { category: one("cat"), gu: one("gu"), work: one("work"), sort: one("sort") ?? "latest", saved: one("saved") === "1" };
  const [{ notices, posts }, gus] = await Promise.all([
    listPosts("OWNER", user, f),
    db.communityPost.findMany({ where: { boardType: "OWNER", sigungu: { not: null } }, select: { sigungu: true }, distinct: ["sigungu"] }),
  ]);
  const href = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ cat: f.category, gu: f.gu, work: f.work, sort: f.sort === "latest" ? undefined : f.sort, saved: f.saved ? "1" : undefined, ...patch }))
      if (v) q.set(k, v);
    const s = q.toString();
    return `/customer/community${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">이웃 커뮤니티</h1>
          <p className="text-sm text-muted">대구 이웃들의 진짜 시공 경험</p>
        </div>
        <Link href={href({ saved: f.saved ? undefined : "1" })} className={cx("rounded-full px-3 py-1.5 text-sm font-semibold ring-1", f.saved ? "bg-mint-100 ring-mint-400" : "ring-line")}>
          {f.saved ? "★ 저장한 글" : "☆ 저장한 글"}
        </Link>
      </div>

      <Chips items={[...OWNER_CATEGORIES]} current={f.category} href={(c) => href({ cat: c })} />

      <form className="grid grid-cols-3 gap-2 text-sm" action="/customer/community">
        {f.category && <input type="hidden" name="cat" value={f.category} />}
        {f.saved && <input type="hidden" name="saved" value="1" />}
        <select name="gu" defaultValue={f.gu ?? ""} aria-label="지역" className="rounded-xl border border-line bg-white px-2 py-2">
          <option value="">전체 지역</option>
          {gus.map((g) => <option key={g.sigungu} value={g.sigungu!}>{g.sigungu!.replace("대구광역시 ", "")}</option>)}
        </select>
        <select name="work" defaultValue={f.work ?? ""} aria-label="공사 종류" className="rounded-xl border border-line bg-white px-2 py-2">
          <option value="">전체 공사</option>
          {TRADES.map((t) => <option key={t} value={t}>{TRADE_LABEL[t]}</option>)}
        </select>
        <select name="sort" defaultValue={f.sort} aria-label="정렬" className="rounded-xl border border-line bg-white px-2 py-2">
          {SORTS.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
        </select>
        <button className="col-span-3 rounded-xl bg-white py-2 font-semibold ring-1 ring-line">필터 적용</button>
      </form>

      <div className="space-y-2">
        {notices.map((p) => <PostRow key={p.id} p={p} board="OWNER" base="/customer/community" />)}
        {posts.map((p) => <PostRow key={p.id} p={p} board="OWNER" base="/customer/community" />)}
        {posts.length === 0 && (
          <Card className="text-center text-sm text-muted">
            {f.saved ? "저장한 글이 없어요." : "조건에 맞는 글이 없어요. 첫 글을 남겨보세요!"}
          </Card>
        )}
      </div>

      <ButtonLink href={f.category ? `/customer/community/new?cat=${f.category}` : "/customer/community/new"} className="fixed bottom-24 right-5 z-20 rounded-full px-5 shadow-lg">
        ✏️ 글쓰기
      </ButtonLink>
    </div>
  );
}
