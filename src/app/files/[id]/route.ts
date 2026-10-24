import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";

// 업로드 파일은 public 이 아닌 storage/ 에 두고, 소유자·운영자만 열람할 수 있게 한다.
export async function GET(_req: Request, ctx: RouteContext<"/files/[id]">) {
  const { id } = await ctx.params;
  const session = await readSession();
  if (!session) return new Response("로그인이 필요해요.", { status: 401 });
  const doc = await db.document.findUnique({
    where: { id },
    include: { building: { select: { ownerId: true } }, contractor: { select: { userId: true } } },
  });
  // 올린 사람·운영자·해당 건물주·해당 업체만. 리뷰·커뮤니티 사진은 로그인한 사용자 모두, 라운지 첨부는 업체만 볼 수 있다.
  const allowed =
    doc &&
    (doc.ownerId === session.userId ||
      session.role === "ADMIN" ||
      doc.building?.ownerId === session.userId ||
      (doc.kind !== "GR_CERT" && doc.kind !== "LICENSE" && doc.contractor?.userId === session.userId) ||
      doc.kind === "REVIEW_PHOTO" ||
      doc.kind === "COMMUNITY_PHOTO" ||
      (doc.kind === "LOUNGE_FILE" && session.role === "CONTRACTOR"));
  if (!doc || !allowed)
    return new Response("파일을 찾을 수 없어요.", { status: 404 });
  const data = await readFile(path.join(process.cwd(), "storage", doc.path));
  return new Response(data, {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
