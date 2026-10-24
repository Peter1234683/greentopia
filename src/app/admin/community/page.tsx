import type { Metadata } from "next";
import { db } from "@/lib/db";
import { moderateComment, moderatePost, rejectReport } from "@/app/actions/community";
import { authorName, categoryOf, type Board } from "@/lib/community/service";
import { PostForm } from "@/components/community/Client";
import { Badge, Button, Card } from "@/components/ui";
import { CONTRACTOR_CATEGORIES, OWNER_CATEGORIES } from "@/lib/constants";
import { timeAgo } from "@/lib/community/mask";

export const metadata: Metadata = { title: "커뮤니티 관리" };

const BOARD_LABEL: Record<string, string> = { OWNER: "이웃 커뮤니티", CONTRACTOR: "파트너 라운지" };
const author = { select: { id: true, name: true, role: true, contractorProfile: { select: { id: true, companyName: true, grade: true } } } } as const;

function PostOps({ id, ops }: { id: string; ops: [string, string, "primary" | "outline"][] }) {
  return (
    <form action={moderatePost} className="mt-2 flex flex-wrap gap-2">
      <input type="hidden" name="postId" value={id} />
      {ops.map(([op, label, variant]) => (
        <Button key={op} name="op" value={op} variant={variant} className="px-3 py-1.5 text-sm">{label}</Button>
      ))}
    </form>
  );
}

export default async function AdminCommunity(props: PageProps<"/admin/community">) {
  const { created } = await props.searchParams;
  const [heldPosts, heldComments, reports, recent] = await Promise.all([
    db.communityPost.findMany({ where: { status: "HELD" }, include: { author }, orderBy: { createdAt: "desc" } }),
    db.communityComment.findMany({ where: { status: "HELD" }, include: { author, post: { select: { title: true, boardType: true } } }, orderBy: { createdAt: "desc" } }),
    db.communityReport.findMany({
      where: { status: "OPEN" },
      include: { post: { select: { id: true, title: true, body: true, boardType: true, status: true } }, comment: { select: { id: true, body: true, status: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.communityPost.findMany({
      where: { status: { not: "HELD" } },
      include: { author, _count: { select: { reactions: { where: { kind: "LIKE" } }, comments: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  return (
    <div className="space-y-8">
      {created && <p role="status" className="rounded-2xl bg-forest-800 px-4 py-3 text-sm text-white">✅ 글을 올렸어요.</p>}
      <section>
        <h1 className="mb-1 text-lg font-bold">자동 보류된 글·댓글 ({heldPosts.length + heldComments.length})</h1>
        <p className="mb-3 text-sm text-muted">라운지에서 진행 중 입찰 번호·가격으로 보이는 표현이 감지돼 보류된 항목이에요. 게시하면 담합 감시 플래그가 무혐의 처리되고, 숨기면 플래그는 조사용으로 남아요.</p>
        <div className="space-y-2">
          {heldPosts.length + heldComments.length === 0 && <Card className="text-sm text-muted">보류된 항목이 없어요.</Card>}
          {heldPosts.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge tone="warn">글 보류</Badge>
                <span>{BOARD_LABEL[p.boardType]} · {authorName(p.author)} · {timeAgo(p.createdAt)}</span>
              </div>
              <p className="mt-1 font-bold">{p.title}</p>
              <p className="whitespace-pre-line text-sm">{p.body}</p>
              <p className="mt-1 text-xs text-warn">{p.holdReason}</p>
              <PostOps id={p.id} ops={[["approve", "문제없음 · 게시", "outline"], ["hide", "숨김", "primary"]]} />
            </Card>
          ))}
          {heldComments.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge tone="warn">댓글 보류</Badge>
                <span>{BOARD_LABEL[c.post.boardType]} · &ldquo;{c.post.title}&rdquo; · {authorName(c.author)}</span>
              </div>
              <p className="mt-1 text-sm">{c.body}</p>
              <form action={moderateComment} className="mt-2 flex gap-2">
                <input type="hidden" name="commentId" value={c.id} />
                <Button name="op" value="approve" variant="outline" className="px-3 py-1.5 text-sm">문제없음 · 게시</Button>
                <Button name="op" value="hide" className="px-3 py-1.5 text-sm">숨김</Button>
              </form>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">신고 ({reports.length})</h2>
        <div className="space-y-2">
          {reports.length === 0 && <Card className="text-sm text-muted">처리할 신고가 없어요.</Card>}
          {reports.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge tone="danger">{r.reason}</Badge>
                <span>{r.post ? BOARD_LABEL[r.post.boardType] : ""} · {r.comment ? "댓글" : "글"} · {timeAgo(r.createdAt)}</span>
              </div>
              <p className="mt-1 font-semibold">{r.post?.title}</p>
              <p className="line-clamp-3 text-sm">{r.comment?.body ?? r.post?.body}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {r.comment ? (
                  <form action={moderateComment}>
                    <input type="hidden" name="commentId" value={r.comment.id} />
                    <Button name="op" value="hide" className="px-3 py-1.5 text-sm">댓글 숨김</Button>
                  </form>
                ) : (
                  r.post && (
                    <form action={moderatePost}>
                      <input type="hidden" name="postId" value={r.post.id} />
                      <Button name="op" value="hide" className="px-3 py-1.5 text-sm">글 숨김</Button>
                    </form>
                  )
                )}
                <form action={rejectReport}>
                  <input type="hidden" name="reportId" value={r.id} />
                  <Button variant="outline" className="px-3 py-1.5 text-sm">신고 기각</Button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">최근 글 · BEST · 공지</h2>
        <div className="space-y-2">
          {recent.map((p) => {
            const cat = categoryOf(p.boardType as Board, p.category);
            return (
              <Card key={p.id} className={`p-4 ${p.status === "HIDDEN" ? "opacity-50" : ""}`}>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-forest-700">{BOARD_LABEL[p.boardType]} · {cat?.icon} {cat?.label}</span>
                  {p.isBest && <Badge tone="forest">BEST</Badge>}
                  {p.isNotice && <Badge tone="forest">공지</Badge>}
                  {p.status === "HIDDEN" && <Badge tone="gray">숨김</Badge>}
                  <span className="text-muted">{authorName(p.author)} · 👍 {p._count.reactions} · 💬 {p._count.comments}</span>
                </div>
                <p className="mt-1 font-semibold">{p.title}</p>
                <PostOps
                  id={p.id}
                  ops={[
                    ["best", p.isBest ? "BEST 해제" : "BEST 지정", "outline"],
                    ["notice", p.isNotice ? "공지 해제" : "공지 고정", "outline"],
                    p.status === "HIDDEN" ? ["approve", "다시 게시", "outline"] : ["hide", "숨김", "outline"],
                  ]}
                />
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {(["OWNER", "CONTRACTOR"] as const).map((b) => (
          <details key={b} className="rounded-3xl bg-white p-5 ring-1 ring-line/60">
            <summary className="cursor-pointer font-bold">📢 {BOARD_LABEL[b]} 공지 쓰기</summary>
            <div className="mt-4">
              <PostForm board={b} categories={(b === "OWNER" ? OWNER_CATEGORIES : CONTRACTOR_CATEGORIES).map((c) => ({ ...c }))} hasBuilding={false} defaultCategory="NOTICE" />
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}
