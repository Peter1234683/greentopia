import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { CONTRACTOR_CATEGORIES, GRADE_LABEL, OWNER_CATEGORIES, parseJson, type Grade, type Role } from "@/lib/constants";
import { maskName } from "./mask";

export type Board = "OWNER" | "CONTRACTOR";
export const BOARD_BASE: Record<Board, string> = { OWNER: "/customer/community", CONTRACTOR: "/contractor/lounge" };
export const categoriesOf = (board: Board) => (board === "OWNER" ? OWNER_CATEGORIES : CONTRACTOR_CATEGORIES);
export const categoryOf = (board: Board, code: string) => categoriesOf(board).find((c) => c.code === code);

export type Viewer = { id: string; role: Role | string };
export type Photo = { id: string; label: "BEFORE" | "AFTER" | "ETC" };
export type Attachment = { id: string; name: string };
export type Recruit = { trade: string; sigungu: string; dong: string };

// 게시 상태별 열람 범위: 보류·숨김 글은 작성자와 운영자만 본다.
export function visibleWhere(viewer: Viewer): Prisma.CommunityPostWhereInput {
  if (viewer.role === "ADMIN") return {};
  return { OR: [{ status: "PUBLISHED" }, { status: "HELD", authorId: viewer.id }] };
}

const authorSelect = {
  id: true,
  name: true,
  role: true,
  contractorProfile: { select: { id: true, companyName: true, grade: true } },
} satisfies Prisma.UserSelect;

type AuthorRow = Prisma.UserGetPayload<{ select: typeof authorSelect }>;

// 작성자 표시: 건물주는 이름 마스킹, 업체는 상호(사업자 공개 정보), 운영자는 "그린토피아"
export function authorName(a: AuthorRow) {
  if (a.role === "ADMIN") return "그린토피아 운영팀";
  if (a.role === "CONTRACTOR") return a.contractorProfile?.companyName ?? maskName(a.name);
  return maskName(a.name);
}

// 작성자 배지 계산 (평판 점수와 무관한 표시용)
export async function authorBadges(authorIds: string[]) {
  const ids = [...new Set(authorIds)];
  const [completed, accepted, users] = await Promise.all([
    db.contract.findMany({
      where: { building: { ownerId: { in: ids } }, project: { status: "COMPLETED" } },
      select: { building: { select: { ownerId: true } } },
    }),
    db.communityPost.findMany({ where: { acceptedCommentId: { not: null } }, select: { acceptedCommentId: true } }),
    db.user.findMany({ where: { id: { in: ids } }, select: authorSelect }),
  ]);
  const acceptedAuthors = new Set(
    (
      await db.communityComment.findMany({
        where: { id: { in: accepted.map((a) => a.acceptedCommentId!) } },
        select: { authorId: true },
      })
    ).map((c) => c.authorId),
  );
  const verified = new Set(completed.map((c) => c.building.ownerId));
  const out: Record<string, { label: string; tone: "mint" | "forest" | "gray" }[]> = {};
  for (const u of users) {
    const b: { label: string; tone: "mint" | "forest" | "gray" }[] = [];
    if (u.role === "ADMIN") b.push({ label: "운영자", tone: "forest" });
    if (verified.has(u.id)) b.push({ label: "✔ 시공 완료 인증", tone: "mint" });
    const g = u.contractorProfile?.grade as Grade | undefined;
    if (g === "GREEN_PARTNER" || g === "EXCELLENT") b.push({ label: GRADE_LABEL[g], tone: "forest" });
    if (acceptedAuthors.has(u.id)) b.push({ label: "🛠️ 기술 공유", tone: "gray" });
    out[u.id] = b;
  }
  return out;
}

export type ListFilter = { category?: string; gu?: string; work?: string; sort?: string; saved?: boolean; mine?: boolean };

export async function listPosts(board: Board, viewer: Viewer, f: ListFilter) {
  const where: Prisma.CommunityPostWhereInput = {
    boardType: board,
    AND: [
      visibleWhere(viewer),
      f.category ? { category: f.category } : {},
      f.gu ? { sigungu: f.gu } : {},
      f.work ? { workTypesJson: { contains: `"${f.work}"` } } : {},
      f.saved ? { reactions: { some: { userId: viewer.id, kind: "BOOKMARK" } } } : {},
      f.mine ? { authorId: viewer.id } : {},
      f.sort === "best" ? { isBest: true } : {},
    ],
  };
  const rows = await db.communityPost.findMany({
    where,
    include: {
      author: { select: authorSelect },
      _count: { select: { comments: { where: { status: "PUBLISHED" } }, reactions: { where: { kind: "LIKE" } } } },
      reactions: { where: { userId: viewer.id }, select: { kind: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const posts = rows.map((p) => ({
    ...p,
    authorLabel: authorName(p.author),
    likes: p._count.reactions,
    comments: p._count.comments,
    mine: new Set(p.reactions.map((r) => r.kind)),
    photos: parseJson<Photo[]>(p.photosJson, []),
    works: parseJson<string[]>(p.workTypesJson, []),
  }));
  // 인기순: 공감 ×3 + 댓글 ×2 + 조회수/10
  if (f.sort === "popular") posts.sort((a, b) => b.likes * 3 + b.comments * 2 + b.viewCount / 10 - (a.likes * 3 + a.comments * 2 + a.viewCount / 10));
  const notices = f.category || f.saved || f.mine ? [] : posts.filter((p) => p.isNotice).slice(0, 2);
  return { notices, posts: posts.filter((p) => !notices.includes(p)) };
}

export async function getPost(board: Board, id: string, viewer: Viewer) {
  const post = await db.communityPost.findFirst({
    where: { id, boardType: board, AND: [visibleWhere(viewer)] },
    include: {
      author: { select: authorSelect },
      reactions: { select: { kind: true, userId: true } },
      comments: {
        where: viewer.role === "ADMIN" ? {} : { OR: [{ status: "PUBLISHED" }, { status: "HELD", authorId: viewer.id }] },
        include: { author: { select: authorSelect } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!post) return null;
  if (post.authorId !== viewer.id) await db.communityPost.update({ where: { id }, data: { viewCount: { increment: 1 } } });
  const badges = await authorBadges([post.authorId, ...post.comments.map((c) => c.authorId)]);
  const count = (k: string) => post.reactions.filter((r) => r.kind === k).length;
  const has = (k: string) => post.reactions.some((r) => r.kind === k && r.userId === viewer.id);
  const comments = post.comments.map((c) => ({ ...c, authorLabel: authorName(c.author), badges: badges[c.authorId] ?? [] }));
  return {
    ...post,
    authorLabel: authorName(post.author),
    badges: badges[post.authorId] ?? [],
    likes: count("LIKE"),
    interests: count("INTEREST"),
    liked: has("LIKE"),
    saved: has("BOOKMARK"),
    interested: has("INTEREST"),
    photos: parseJson<Photo[]>(post.photosJson, []),
    attachments: parseJson<Attachment[]>(post.attachmentsJson, []),
    tips: parseJson<string[]>(post.keyTipsJson, []),
    works: parseJson<string[]>(post.workTypesJson, []),
    recruit: parseJson<Recruit | null>(post.recruitJson, null),
    roots: comments.filter((c) => !c.parentId),
    repliesOf: (id: string) => comments.filter((c) => c.parentId === id),
  };
}

export type PostView = NonNullable<Awaited<ReturnType<typeof getPost>>>;
