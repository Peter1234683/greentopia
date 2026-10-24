import Link from "next/link";
import { Badge, cx } from "@/components/ui";
import { TRADE_LABEL, USAGE_LABEL, type Trade } from "@/lib/constants";
import { timeAgo } from "@/lib/community/mask";
import { categoryOf, type Board, type Photo } from "@/lib/community/service";

type Row = {
  id: string;
  category: string;
  title: string;
  body: string;
  status: string;
  isNotice: boolean;
  isBest: boolean;
  sigungu: string | null;
  dong: string | null;
  createdAt: Date;
  viewCount: number;
  authorLabel: string;
  likes: number;
  comments: number;
  photos: Photo[];
  works: string[];
  savingsAmount: number | null;
  acceptedCommentId: string | null;
  recruitJson: string | null;
};

export function PostRow({ p, board, base }: { p: Row; board: Board; base: string }) {
  const cat = categoryOf(board, p.category);
  const thumb = p.photos.find((x) => x.label === "AFTER") ?? p.photos[0];
  return (
    <Link href={`${base}/${p.id}`} className="block">
      <article className={cx("flex gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-line/60 hover:ring-mint-300", p.isNotice && "bg-mint-50")}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-semibold text-forest-700">{cat?.icon} {cat?.label}</span>
            {p.isBest && <Badge tone="forest">BEST</Badge>}
            {p.status === "HELD" && <Badge tone="warn">검토 중</Badge>}
            {p.recruitJson && <Badge>모집 중</Badge>}
            {board === "CONTRACTOR" && p.category !== "NOTICE" && (p.acceptedCommentId ? <Badge tone="gray">채택 완료</Badge> : null)}
          </div>
          <h3 className="mt-1 line-clamp-1 font-bold">{p.title}</h3>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted">{p.body}</p>
          {(p.works.length > 0 || p.savingsAmount) && (
            <p className="mt-1 text-xs text-forest-700">
              {p.works.map((w) => TRADE_LABEL[w as Trade]).join("·")}
              {p.savingsAmount ? ` · ${p.savingsAmount.toLocaleString()}원 아낌(작성자 입력)` : ""}
            </p>
          )}
          <p className="mt-1.5 text-xs text-muted">
            {p.authorLabel}
            {p.sigungu ? ` · ${p.sigungu.replace("대구광역시 ", "")}${p.dong ? ` ${p.dong}` : ""}` : ""} · {timeAgo(p.createdAt)} · 👍 {p.likes} · 💬 {p.comments} · 조회 {p.viewCount}
          </p>
        </div>
        {thumb && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/files/${thumb.id}`} alt="" className="h-20 w-20 shrink-0 rounded-2xl object-cover" />
        )}
      </article>
    </Link>
  );
}

export function Chips({ items, current, href }: { items: { code: string; label: string; icon?: string }[]; current?: string; href: (code?: string) => string }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist">
      <Link href={href()} role="tab" aria-selected={!current} className={chip(!current)}>전체</Link>
      {items.map((c) => (
        <Link key={c.code} href={href(c.code)} role="tab" aria-selected={current === c.code} className={chip(current === c.code)}>
          {c.icon} {c.label}
        </Link>
      ))}
    </div>
  );
}

const chip = (on: boolean) =>
  cx("shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold ring-1", on ? "bg-forest-800 text-white ring-forest-800" : "bg-white text-ink ring-line");

export function PlaceLine({ sigungu, dong, buildingType, buildingAge }: { sigungu: string | null; dong: string | null; buildingType: string | null; buildingAge: number | null }) {
  const parts = [sigungu && `${sigungu}${dong ? ` ${dong}` : ""}`, buildingType && USAGE_LABEL[buildingType], buildingAge != null && `${buildingAge}년 차`].filter(Boolean);
  if (!parts.length) return null;
  return <p className="text-xs text-muted">🏠 {parts.join(" · ")}</p>;
}
