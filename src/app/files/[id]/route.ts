import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";

// 업로드 파일은 public 이 아닌 storage/ 에 두고, 소유자·운영자만 열람할 수 있게 한다.
export async function GET(_req: Request, ctx: RouteContext<"/files/[id]">) {
  const { id } = await ctx.params;
  const session = await readSession();
  if (!session) return new Response("로그인이 필요해요.", { status: 401 });
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc || (doc.ownerId !== session.userId && session.role !== "ADMIN"))
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
