import "server-only";
import { cookies } from "next/headers";
import { encrypt, decrypt, SESSION_COOKIE, SESSION_MAX_AGE_SEC, type SessionPayload } from "./jwt";

// 자체 구현 세션: 서명된 JWT를 httpOnly 쿠키에 저장한다.
// 추후 NextAuth/Supabase Auth로 교체할 때 jwt.ts·session.ts·dal.ts만 바꾸면 된다.

export async function createSession(payload: SessionPayload) {
  (await cookies()).set(SESSION_COOKIE, await encrypt(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export async function deleteSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function readSession() {
  return decrypt((await cookies()).get(SESSION_COOKIE)?.value);
}
