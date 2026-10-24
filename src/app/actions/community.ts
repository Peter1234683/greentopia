"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, requireRole } from "@/lib/dal";
import { notify, notifyAdmins } from "@/lib/notify";
import { runMatching } from "@/lib/matching/run";
import { saveUpload, validateUpload } from "@/lib/uploads";
import { echo, fieldErrors, optionalNumber, type FormState } from "@/lib/forms";
import { detectBidTalk, holdReasonOf } from "@/lib/community/guard";
import { hasExactAddress } from "@/lib/community/mask";
import { BOARD_BASE, categoriesOf, type Board } from "@/lib/community/service";
import { TRADES, parseJson, type Trade } from "@/lib/constants";

const LOUNGE_RULES_VERSION = 1;

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// 게시판 접근: 건물주 → 이웃 커뮤니티, 승인된 업체(규칙 동의) → 라운지, 운영자 → 둘 다
async function boardUser(board: Board) {
  const user = await requireUser();
  if (user.role === "ADMIN") return user;
  if (board === "OWNER" && user.role === "CUSTOMER") return user;
  if (board === "CONTRACTOR" && user.role === "CONTRACTOR") {
    const p = user.contractorProfile!;
    if (p.reviewStatus !== "APPROVED") throw new Error("서류 심사 승인 후 라운지를 이용할 수 있어요.");
    if (!p.loungeAgreedAt) redirect("/contractor/lounge");
    return user;
  }
  throw new Error("이 게시판을 이용할 수 없어요.");
}

function boardOf(v: FormDataEntryValue | null): Board {
  return v === "CONTRACTOR" ? "CONTRACTOR" : "OWNER";
}

function refresh(board: Board, postId?: string) {
  revalidatePath(BOARD_BASE[board]);
  if (postId) revalidatePath(`${BOARD_BASE[board]}/${postId}`);
  revalidatePath("/admin/community");
}

// 라운지 가드에 걸리면 담합 감시에 올리고 운영자에게 알린다.
async function flagBoard(userId: string, hold: string, postId: string, commentId?: string) {
  const p = await db.contractorProfile.findUnique({ where: { userId }, select: { id: true, companyName: true } });
  await db.collusionFlag.create({
    data: {
      source: "BOARD",
      kind: "BOARD_KEYWORD",
      postId,
      commentId: commentId ?? null,
      contractorIdsJson: JSON.stringify(p ? [p.id] : []),
      tenderIdsJson: "[]",
      detail: `라운지 ${commentId ? "댓글" : "글"} 게시 보류: ${hold}`,
    },
  });
  await notifyAdmins("라운지 게시 보류", `${p?.companyName ?? "업체"}의 ${commentId ? "댓글" : "글"}이 자동 보류됐어요. 검토해주세요.`, "/admin/community");
}

// ── 글쓰기 ──
const postSchema = z.object({
  board: z.enum(["OWNER", "CONTRACTOR"]),
  category: z.string().min(1, "카테고리를 골라주세요."),
  title: z.string().trim().min(2, "제목을 2자 이상 입력해주세요.").max(80, "제목은 80자까지 쓸 수 있어요."),
  body: z.string().trim().min(5, "내용을 5자 이상 입력해주세요.").max(3000, "내용은 3,000자까지 쓸 수 있어요."),
  disclose: z.enum(["DONG", "GU", "NONE"]).default("DONG"),
  savingsAmount: optionalNumber(z.number({ message: "숫자로 입력해주세요." }).int().min(0).max(100_000_000, "금액을 다시 확인해주세요.")),
  recruitTrade: z.string().optional(),
});

export async function createPost(_: FormState, formData: FormData): Promise<FormState> {
  const board = boardOf(formData.get("board"));
  const user = await boardUser(board);
  const values = echo(formData);
  const parsed = postSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const d = parsed.data;

  const allowed = categoriesOf(board)
    .map((c) => c.code as string)
    .filter((c) => c !== "NOTICE" || user.role === "ADMIN");
  if (!allowed.includes(d.category)) return { errors: { category: "카테고리를 다시 골라주세요." }, values };

  const tips = formData.getAll("tips").map((t) => String(t).trim().slice(0, 60)).filter(Boolean).slice(0, 3);
  const works = formData.getAll("works").map(String).filter((t) => (TRADES as readonly string[]).includes(t));
  const text = [d.title, d.body, ...tips].join("\n");
  if (board === "OWNER" && hasExactAddress(text))
    return { errors: { body: "정확한 주소(번지·도로명 번호·동호수)는 지워주세요. 이웃에게는 동 단위까지만 보여요." }, values };

  // 사진(건물주: 시공 전/후) · 첨부(라운지: PDF)
  const files: { file: File; label: string; kind: "COMMUNITY_PHOTO" | "LOUNGE_FILE" }[] = [];
  for (const [field, label] of [["before", "BEFORE"], ["after", "AFTER"], ["photos", "ETC"]] as const)
    for (const f of formData.getAll(field))
      if (f instanceof File && f.size > 0) files.push({ file: f, label, kind: "COMMUNITY_PHOTO" });
  for (const f of formData.getAll("attachments"))
    if (board === "CONTRACTOR" && f instanceof File && f.size > 0) files.push({ file: f, label: "FILE", kind: "LOUNGE_FILE" });
  if (files.filter((f) => f.kind === "COMMUNITY_PHOTO").length > 6) return { errors: { photos: "사진은 6장까지 올릴 수 있어요." }, values };
  if (files.filter((f) => f.kind === "LOUNGE_FILE").length > 2) return { errors: { attachments: "첨부는 2개까지 올릴 수 있어요." }, values };
  for (const f of files) {
    const err = validateUpload(f.file);
    if (err) return { errors: { [f.kind === "LOUNGE_FILE" ? "attachments" : "photos"]: err }, values };
    if (f.kind === "COMMUNITY_PHOTO" && !f.file.type.startsWith("image/")) return { errors: { photos: "사진은 이미지 파일만 올릴 수 있어요." }, values };
  }

  // 건물 정보는 작성자가 고른 범위까지만 (동 / 구 / 비공개). 정확한 주소는 저장하지 않는다.
  let place: { sigungu: string | null; dong: string | null; buildingType: string | null; buildingAge: number | null } = { sigungu: null, dong: null, buildingType: null, buildingAge: null };
  let recruit: { trade: string; sigungu: string; dong: string } | null = null;
  if (board === "OWNER" && user.role === "CUSTOMER") {
    const b = await db.building.findFirst({ where: { ownerId: user.id }, orderBy: { createdAt: "asc" } });
    if (b && d.disclose !== "NONE") {
      const age = b.approvalDate ? new Date().getFullYear() - b.approvalDate.getFullYear() : null;
      place = { sigungu: b.sigungu, dong: d.disclose === "DONG" ? b.dong : null, buildingType: b.usage, buildingAge: age };
    }
    if (d.category === "RECRUIT") {
      if (!d.recruitTrade || !(TRADES as readonly string[]).includes(d.recruitTrade)) return { errors: { recruitTrade: "함께할 공사를 골라주세요." }, values };
      if (!b) return { errors: { recruitTrade: "이웃 모집은 내 건물을 등록한 뒤에 할 수 있어요." }, values };
      recruit = { trade: d.recruitTrade, sigungu: b.sigungu, dong: b.dong };
      place = { ...place, sigungu: b.sigungu, dong: b.dong };
      if (!works.includes(d.recruitTrade)) works.push(d.recruitTrade);
    }
  }

  const guard = board === "CONTRACTOR" && user.role !== "ADMIN" ? detectBidTalk(text) : { hit: false, hits: [] };
  const hold = guard.hit ? holdReasonOf(guard.hits) : null;

  const docs: { id: string; label: string; name: string; kind: string }[] = [];
  for (const f of files) {
    const saved = await saveUpload(f.file);
    const doc = await db.document.create({ data: { ...saved, kind: f.kind, ownerId: user.id } });
    docs.push({ id: doc.id, label: f.label, name: saved.originalName, kind: f.kind });
  }

  const post = await db.communityPost.create({
    data: {
      boardType: board,
      authorId: user.id,
      category: d.category,
      title: d.title,
      body: d.body,
      ...place,
      workTypesJson: JSON.stringify(works),
      savingsAmount: board === "OWNER" ? (d.savingsAmount ?? null) : null,
      keyTipsJson: JSON.stringify(tips),
      photosJson: JSON.stringify(docs.filter((x) => x.kind === "COMMUNITY_PHOTO").map((x) => ({ id: x.id, label: x.label }))),
      attachmentsJson: JSON.stringify(docs.filter((x) => x.kind === "LOUNGE_FILE").map((x) => ({ id: x.id, name: x.name }))),
      recruitJson: recruit ? JSON.stringify(recruit) : null,
      isNotice: d.category === "NOTICE",
      status: hold ? "HELD" : "PUBLISHED",
      holdReason: hold,
    },
  });
  if (hold) await flagBoard(user.id, hold, post.id);
  refresh(board);
  redirect(user.role === "ADMIN" ? "/admin/community?created=1" : `${BOARD_BASE[board]}/${post.id}${hold ? "?held=1" : ""}`);
}

// ── 공감·저장 ──
export async function toggleReaction(formData: FormData) {
  const user = await requireUser();
  const postId = String(formData.get("postId") ?? "");
  const kind = String(formData.get("kind") ?? "");
  if (!["LIKE", "BOOKMARK"].includes(kind)) return;
  const post = await db.communityPost.findFirst({ where: { id: postId, status: "PUBLISHED" } });
  if (!post) return;
  await boardUser(post.boardType as Board);
  const key = { postId_userId_kind: { postId, userId: user.id, kind } };
  const existing = await db.communityReaction.findUnique({ where: key });
  if (existing) await db.communityReaction.delete({ where: key });
  else await db.communityReaction.create({ data: { postId, userId: user.id, kind } });
  refresh(post.boardType as Board, postId);
}

// ── 댓글 ──
export type CommentState = { error?: string; held?: boolean; ok?: number } | undefined;

export async function addComment(prev: CommentState, formData: FormData): Promise<CommentState> {
  const postId = String(formData.get("postId") ?? "");
  const parentId = String(formData.get("parentId") ?? "") || null;
  const body = String(formData.get("body") ?? "").trim();
  const post = await db.communityPost.findFirst({ where: { id: postId, status: "PUBLISHED" } });
  if (!post) return { error: "글을 찾을 수 없어요." };
  const board = post.boardType as Board;
  const user = await boardUser(board);
  if (body.length < 2) return { error: "댓글을 2자 이상 입력해주세요." };
  if (body.length > 1000) return { error: "댓글은 1,000자까지 쓸 수 있어요." };
  if (board === "OWNER" && hasExactAddress(body)) return { error: "정확한 주소(번지·도로명 번호·동호수)는 지워주세요." };
  if (parentId) {
    const parent = await db.communityComment.findFirst({ where: { id: parentId, postId, parentId: null } });
    if (!parent) return { error: "답글을 달 댓글을 찾을 수 없어요." };
  }
  const guard = board === "CONTRACTOR" && user.role !== "ADMIN" ? detectBidTalk(body) : { hit: false, hits: [] };
  const comment = await db.communityComment.create({
    data: { postId, parentId, authorId: user.id, body, status: guard.hit ? "HELD" : "PUBLISHED" },
  });
  if (guard.hit) await flagBoard(user.id, holdReasonOf(guard.hits), postId, comment.id);
  else if (post.authorId !== user.id)
    await notify([post.authorId], "새 댓글", `"${post.title.slice(0, 20)}"에 댓글이 달렸어요.`, `${BOARD_BASE[board]}/${postId}`);
  refresh(board, postId);
  return { held: guard.hit, ok: (prev?.ok ?? 0) + 1 };
}

// ── 신고 ──
export async function reportContent(formData: FormData) {
  const user = await requireUser();
  const postId = String(formData.get("postId") ?? "");
  const commentId = String(formData.get("commentId") ?? "") || null;
  const reason = String(formData.get("reason") ?? "기타").slice(0, 100);
  const post = await db.communityPost.findUnique({ where: { id: postId } });
  if (!post) return;
  await boardUser(post.boardType as Board);
  const dup = await db.communityReport.findFirst({ where: { reporterId: user.id, postId, commentId, status: "OPEN" } });
  if (!dup) {
    await db.communityReport.create({ data: { postId, commentId, reporterId: user.id, reason } });
    await notifyAdmins("커뮤니티 신고 접수", `"${post.title.slice(0, 20)}" ${commentId ? "댓글" : "글"} 신고: ${reason}`, "/admin/community");
  }
  redirect(`${BOARD_BASE[post.boardType as Board]}/${postId}?reported=1`);
}

// ── 라운지: 답변 채택 (평판 점수와 무관, 배지만) ──
export async function acceptAnswer(formData: FormData) {
  const user = await requireRole("CONTRACTOR");
  const postId = String(formData.get("postId") ?? "");
  const commentId = String(formData.get("commentId") ?? "");
  const post = await db.communityPost.findFirst({ where: { id: postId, authorId: user.id, boardType: "CONTRACTOR" } });
  const c = await db.communityComment.findFirst({ where: { id: commentId, postId, status: "PUBLISHED" } });
  if (!post || !c || c.authorId === user.id) return;
  await db.communityPost.update({ where: { id: postId }, data: { acceptedCommentId: commentId } });
  await notify([c.authorId], "답변이 채택됐어요", `"${post.title.slice(0, 20)}" 글에서 내 답변이 채택돼 '기술 공유' 배지가 붙었어요.`, `/contractor/lounge/${postId}`);
  refresh("CONTRACTOR", postId);
}

// ── 라운지 규칙 동의 ──
export async function agreeLoungeRules(formData: FormData) {
  const user = await requireRole("CONTRACTOR");
  if (user.contractorProfile!.reviewStatus !== "APPROVED") return;
  const checks = formData.getAll("agree");
  if (checks.length < 3) redirect("/contractor/lounge?need=1");
  await db.$transaction([
    db.contractorProfile.update({ where: { userId: user.id }, data: { loungeAgreedAt: new Date() } }),
    db.boardRuleAgreement.upsert({
      where: { userId_boardType_version: { userId: user.id, boardType: "CONTRACTOR", version: LOUNGE_RULES_VERSION } },
      create: { userId: user.id, boardType: "CONTRACTOR", version: LOUNGE_RULES_VERSION },
      update: { agreedAt: new Date() },
    }),
  ]);
  redirect("/contractor/lounge");
}

// ── 이웃 모집: "이 묶음에 관심 있어요" → 내 수요에 공종 추가 후 매칭 다시 실행 ──
export async function expressInterest(formData: FormData) {
  const user = await requireRole("CUSTOMER");
  const postId = String(formData.get("postId") ?? "");
  const post = await db.communityPost.findFirst({ where: { id: postId, boardType: "OWNER", status: "PUBLISHED", recruitJson: { not: null } } });
  if (!post) return;
  const recruit = parseJson<{ trade: Trade } | null>(post.recruitJson, null);
  if (!recruit) return;
  const building = await db.building.findFirst({ where: { ownerId: user.id }, orderBy: { createdAt: "asc" } });
  if (!building) redirect(`/customer/buildings/new?from=community`);

  await db.communityReaction.upsert({
    where: { postId_userId_kind: { postId, userId: user.id, kind: "INTEREST" } },
    create: { postId, userId: user.id, kind: "INTEREST" },
    update: {},
  });
  const demand = await db.retrofitDemand.findFirst({ where: { buildingId: building.id, status: { in: ["ACTIVE", "MATCHED"] } }, orderBy: { createdAt: "desc" } });
  if (demand) {
    const trades = parseJson<string[]>(demand.tradesJson, []);
    await db.retrofitDemand.update({
      where: { id: demand.id },
      data: { tradesJson: JSON.stringify([...new Set([...trades, recruit.trade])]), jointIntent: demand.jointIntent === "NO" ? "MAYBE" : demand.jointIntent },
    });
  } else {
    const now = new Date();
    await db.retrofitDemand.create({
      data: {
        buildingId: building.id,
        tradesJson: JSON.stringify([recruit.trade]),
        symptomsJson: "[]",
        desiredStart: new Date(now.getFullYear(), now.getMonth() + 3, 1),
        jointIntent: "YES",
      },
    });
  }
  if (post.authorId !== user.id) await notify([post.authorId], "이웃이 관심을 보였어요", `"${post.title.slice(0, 20)}" 모집글에 관심 이웃이 생겼어요.`, `/customer/community/${postId}`);
  await runMatching();
  revalidatePath("/customer", "layout");
  redirect(`/customer/community/${postId}?interest=1`);
}

// ── 운영자 ──
export async function moderatePost(formData: FormData) {
  await requireRole("ADMIN");
  const postId = String(formData.get("postId") ?? "");
  const op = String(formData.get("op") ?? "");
  const post = await db.communityPost.findUnique({ where: { id: postId } });
  if (!post) return;
  const data: Record<string, unknown> =
    op === "approve" ? { status: "PUBLISHED", holdReason: null }
    : op === "hide" ? { status: "HIDDEN" }
    : op === "best" ? { isBest: !post.isBest }
    : op === "notice" ? { isNotice: !post.isNotice }
    : {};
  if (!Object.keys(data).length) return;
  await db.communityPost.update({ where: { id: postId }, data });
  // 보류 글을 문제없다고 게시하면 관련 플래그는 무혐의, 숨기면 조사 대상으로 남긴다.
  if (op === "approve") await db.collusionFlag.updateMany({ where: { postId, commentId: null, status: "OPEN" }, data: { status: "DISMISSED" } });
  if (op === "hide") await db.communityReport.updateMany({ where: { postId, commentId: null, status: "OPEN" }, data: { status: "ACCEPTED" } });
  if (op === "approve" || op === "hide")
    await notify([post.authorId], op === "approve" ? "글이 게시됐어요" : "글이 숨김 처리됐어요", `"${post.title.slice(0, 20)}"`, op === "approve" ? `${BOARD_BASE[post.boardType as Board]}/${postId}` : undefined);
  refresh(post.boardType as Board, postId);
}

export async function moderateComment(formData: FormData) {
  await requireRole("ADMIN");
  const commentId = String(formData.get("commentId") ?? "");
  const op = String(formData.get("op") ?? "");
  const c = await db.communityComment.findUnique({ where: { id: commentId }, include: { post: true } });
  if (!c || !["approve", "hide"].includes(op)) return;
  await db.communityComment.update({ where: { id: commentId }, data: { status: op === "approve" ? "PUBLISHED" : "HIDDEN" } });
  if (op === "approve") await db.collusionFlag.updateMany({ where: { commentId, status: "OPEN" }, data: { status: "DISMISSED" } });
  else await db.communityReport.updateMany({ where: { commentId, status: "OPEN" }, data: { status: "ACCEPTED" } });
  refresh(c.post.boardType as Board, c.postId);
}

export async function rejectReport(formData: FormData) {
  await requireRole("ADMIN");
  await db.communityReport.update({ where: { id: String(formData.get("reportId") ?? "") }, data: { status: "REJECTED" } });
  revalidatePath("/admin/community");
}
