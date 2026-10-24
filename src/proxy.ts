import { NextResponse, type NextRequest } from "next/server";
import { decrypt, SESSION_COOKIE } from "@/lib/jwt";

// 낙관적 접근 검사: 로그인 안 된 사용자를 보호 구역에서 로그인 화면으로 보낸다.
// 역할 검사는 각 영역의 layout(requireRole)에서 DB 기준으로 다시 한다.
const PROTECTED = ["/customer", "/contractor", "/admin"];

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const res = await guard(req, pathname);
  // ?demo=1 → 헤더에 데모 메뉴 표시 (데모 도구가 켜진 서버에서만 실제로 보인다), ?demo=0 → 숨김
  const demo = req.nextUrl.searchParams.get("demo");
  if (demo === "1") res.cookies.set("gt_demo", "1", { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 });
  if (demo === "0") res.cookies.delete("gt_demo");
  return res;
}

async function guard(req: NextRequest, pathname: string) {
  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  const session = await decrypt(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.redirect(new URL("/login", req.nextUrl));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|sw.js|manifest.webmanifest|icons/|.*\\.png$).*)"],
};
