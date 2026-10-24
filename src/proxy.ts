import { NextResponse, type NextRequest } from "next/server";
import { decrypt, SESSION_COOKIE } from "@/lib/jwt";

// 낙관적 접근 검사: 로그인 안 된 사용자를 보호 구역에서 로그인 화면으로 보낸다.
// 역할 검사는 각 영역의 layout(requireRole)에서 DB 기준으로 다시 한다.
const PROTECTED = ["/customer", "/contractor", "/admin"];

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  const session = await decrypt(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.redirect(new URL("/login", req.nextUrl));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|sw.js|manifest.webmanifest|icons/|.*\\.png$).*)"],
};
