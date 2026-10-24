import { SignJWT, jwtVerify } from "jose";
import type { Role } from "./constants";

// proxy.ts 에서도 쓰므로 next/headers·server-only 에 의존하지 않는다.
export const SESSION_COOKIE = "gt_session";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

export type SessionPayload = { userId: string; role: Role };

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET 환경변수가 필요합니다.");
  return new TextEncoder().encode(secret);
}

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SEC}s`)
    .sign(key());
}

export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return { userId: payload.userId as string, role: payload.role as Role };
  } catch {
    return null;
  }
}
