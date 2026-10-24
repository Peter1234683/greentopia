import Link from "next/link";
import { acceptAnswer, expressInterest, reportContent, toggleReaction } from "@/app/actions/community";
import { Badge, Button, Card, cx } from "@/components/ui";
import { CommentForm, ShareButton } from "./Client";
import { PlaceLine } from "./Bits";
import { TRADE_LABEL, type Trade } from "@/lib/constants";
import { timeAgo } from "@/lib/community/mask";
import { categoryOf, type Board, type PostView } from "@/lib/community/service";

const PHOTO_LABEL = { BEFORE: "시공 전", AFTER: "시공 후", ETC: "사진" };

function Report({ postId, commentId }: { postId: string; commentId?: string }) {
  return (
    <details className="inline-block text-xs">
      <summary className="cursor-pointer list-none text-muted hover:text-danger">신고</summary>
      <form action={reportContent} className="mt-1 flex gap-1">
        <input type="hidden" name="postId" value={postId} />
        {commentId && <input type="hidden" name="commentId" value={commentId} />}
        <select name="reason" aria-label="신고 사유" className="rounded-lg border border-line px-2 py-1">
          <option>광고·홍보</option>
          <option>욕설·비방</option>
          <option>개인정보 노출</option>
          <option>입찰 담합 의심</option>
          <option>허위 정보</option>
        </select>
        <button className="rounded-lg bg-danger px-2 py-1 text-white">신고하기</button>
      </form>
    </details>
  );
}

export function PostDetail({ post, board, viewerId, flash }: { post: PostView; board: Board; viewerId: string; flash?: string }) {
  const cat = categoryOf(board, post.category);
  const isAuthor = post.authorId === viewerId;
  const isQuestion = board === "CONTRACTOR" && post.category !== "NOTICE";
  const before = post.photos.filter((p) => p.label === "BEFORE");
  const after = post.photos.filter((p) => p.label === "AFTER");
  const etc = post.photos.filter((p) => p.label === "ETC");

  return (
    <div className="space-y-4">
      {flash && <p role="status" className="rounded-2xl bg-forest-800 px-4 py-3 text-sm text-white">{flash}</p>}
      {post.status === "HELD" && (
        <Card className="bg-warn-bg p-4 text-sm ring-warn/30">
          <p className="font-bold text-warn">⏸ 운영자 검토 중이에요</p>
          <p className="mt-1">{post.holdReason}</p>
          <p className="mt-1 text-muted">검토가 끝나기 전까지는 작성자에게만 보여요. 진행 중 입찰의 가격·참여 여부는 라운지에서 논의할 수 없어요.</p>
        </Card>
      )}

      <article className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-semibold text-forest-700">{cat?.icon} {cat?.label}</span>
          {post.isBest && <Badge tone="forest">BEST</Badge>}
          {post.isNotice && <Badge tone="forest">공지</Badge>}
        </div>
        <h1 className="text-xl font-extrabold leading-snug">{post.title}</h1>
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="font-semibold">{post.authorLabel}</span>
          {post.badges.map((b) => <Badge key={b.label} tone={b.tone}>{b.label}</Badge>)}
          <span className="text-xs text-muted">· {timeAgo(post.createdAt)} · 조회 {post.viewCount}</span>
        </div>
        <PlaceLine {...post} />

        {(before.length > 0 || after.length > 0) && (
          <div className="grid grid-cols-2 gap-2">
            {[...before, ...after].map((p) => (
              <figure key={p.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/files/${p.id}`} alt={PHOTO_LABEL[p.label]} className="aspect-square w-full rounded-2xl object-cover" />
                <figcaption className={cx("absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-bold", p.label === "AFTER" ? "bg-mint-400 text-forest-950" : "bg-black/60 text-white")}>{PHOTO_LABEL[p.label]}</figcaption>
              </figure>
            ))}
          </div>
        )}
        {etc.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.id} src={`/files/${p.id}`} alt="첨부 사진" className="w-full rounded-2xl" />
        ))}

        <p className="whitespace-pre-line leading-relaxed">{post.body}</p>

        {post.tips.length > 0 && (
          <Card className="bg-mint-50 p-4 ring-mint-100">
            <p className="text-sm font-bold">💡 핵심 꿀팁</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{post.tips.map((t) => <li key={t}>{t}</li>)}</ol>
          </Card>
        )}
        {(post.works.length > 0 || post.savingsAmount) && (
          <div className="flex flex-wrap gap-2 text-sm">
            {post.works.map((w) => <Badge key={w} tone="gray">{TRADE_LABEL[w as Trade]}</Badge>)}
            {post.savingsAmount != null && (
              <span className="text-forest-700"><b>{post.savingsAmount.toLocaleString()}원</b> 아낌 <span className="text-xs text-muted">(작성자 입력 · 건물마다 달라요)</span></span>
            )}
          </div>
        )}
        {post.attachments.length > 0 && (
          <ul className="space-y-1 text-sm">
            {post.attachments.map((a) => (
              <li key={a.id}><a href={`/files/${a.id}`} target="_blank" rel="noreferrer" className="text-forest-700 underline">📎 {a.name}</a></li>
            ))}
          </ul>
        )}
      </article>

      {post.recruit && board === "OWNER" && (
        <Card className="bg-forest-900 text-white ring-0">
          <p className="text-xs text-mint-300">🤝 이웃 모집 · {post.recruit.sigungu.replace("대구광역시 ", "")} {post.recruit.dong}</p>
          <p className="mt-1 text-lg font-bold">{TRADE_LABEL[post.recruit.trade as Trade]} 같이 하실 분</p>
          <p className="mt-1 text-sm text-white/80">관심을 누르면 내 공사 수요에 이 공사가 추가되고, AI가 가까운 이웃과 다시 묶어봐요. 계약은 건물별로 따로 맺어요.</p>
          <p className="mt-2 text-sm">현재 관심 이웃 <b>{post.interests}명</b></p>
          {!isAuthor &&
            (post.interested ? (
              <p className="mt-3 rounded-2xl bg-white/10 px-4 py-3 text-center text-sm font-semibold">✔ 관심 표시했어요 · <Link href="/customer/joint" className="underline">공동공사 보기</Link></p>
            ) : (
              <form action={expressInterest} className="mt-3">
                <input type="hidden" name="postId" value={post.id} />
                <Button variant="mint" className="w-full">이 묶음에 관심 있어요</Button>
              </form>
            ))}
        </Card>
      )}

      {post.status === "PUBLISHED" && (
        <div className="flex flex-wrap items-center gap-2">
          <form action={toggleReaction}>
            <input type="hidden" name="postId" value={post.id} />
            <button name="kind" value="LIKE" aria-pressed={post.liked} className={cx("rounded-full px-3 py-2 text-sm font-semibold ring-1", post.liked ? "bg-mint-100 ring-mint-400" : "ring-line")}>
              👍 {board === "OWNER" ? "도움돼요" : "공감"} {post.likes}
            </button>
          </form>
          <form action={toggleReaction}>
            <input type="hidden" name="postId" value={post.id} />
            <button name="kind" value="BOOKMARK" aria-pressed={post.saved} className={cx("rounded-full px-3 py-2 text-sm font-semibold ring-1", post.saved ? "bg-mint-100 ring-mint-400" : "ring-line")}>
              {post.saved ? "★ 저장됨" : "☆ 저장"}
            </button>
          </form>
          <ShareButton title={post.title} />
          <span className="ml-auto">{!isAuthor && <Report postId={post.id} />}</span>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="font-bold">댓글 {post.roots.length + post.roots.reduce((s, c) => s + post.repliesOf(c.id).length, 0)}</h2>
        {post.roots.map((c) => {
          const accepted = post.acceptedCommentId === c.id;
          return (
            <div key={c.id} className={cx("rounded-2xl bg-white p-3 ring-1 ring-line/60", accepted && "ring-2 ring-mint-400")}>
              <div className="flex flex-wrap items-center gap-1.5 text-sm">
                <b>{c.authorLabel}</b>
                {c.badges.map((b) => <Badge key={b.label} tone={b.tone}>{b.label}</Badge>)}
                {accepted && <Badge tone="forest">✔ 채택된 답변</Badge>}
                {c.status === "HELD" && <Badge tone="warn">검토 중</Badge>}
                <span className="text-xs text-muted">{timeAgo(c.createdAt)}</span>
              </div>
              <p className="mt-1 whitespace-pre-line text-sm">{c.body}</p>
              <div className="mt-1 flex items-center gap-3">
                {isQuestion && isAuthor && !post.acceptedCommentId && c.authorId !== viewerId && c.status === "PUBLISHED" && (
                  <form action={acceptAnswer}>
                    <input type="hidden" name="postId" value={post.id} />
                    <button name="commentId" value={c.id} className="text-xs font-semibold text-forest-700">이 답변 채택</button>
                  </form>
                )}
                {c.authorId !== viewerId && <Report postId={post.id} commentId={c.id} />}
              </div>
              <div className="mt-2 space-y-2 border-l-2 border-line pl-3">
                {post.repliesOf(c.id).map((r) => (
                  <div key={r.id} className="text-sm">
                    <span className="font-semibold">↳ {r.authorLabel}</span>{" "}
                    {r.status === "HELD" && <Badge tone="warn">검토 중</Badge>} <span className="text-xs text-muted">{timeAgo(r.createdAt)}</span>
                    <p className="whitespace-pre-line">{r.body}</p>
                  </div>
                ))}
                {post.status === "PUBLISHED" && (
                  <details>
                    <summary className="cursor-pointer text-xs text-muted">답글 달기</summary>
                    <div className="mt-1"><CommentForm postId={post.id} parentId={c.id} placeholder="답글을 남겨주세요" /></div>
                  </details>
                )}
              </div>
            </div>
          );
        })}
        {post.status === "PUBLISHED" ? <CommentForm postId={post.id} /> : <p className="text-sm text-muted">검토가 끝나면 댓글을 달 수 있어요.</p>}
        {isQuestion && <p className="text-xs text-muted">※ 답변 채택은 평판 점수에 반영되지 않고, 프로필에 &apos;기술 공유&apos; 배지로만 표시돼요.</p>}
      </section>
    </div>
  );
}
