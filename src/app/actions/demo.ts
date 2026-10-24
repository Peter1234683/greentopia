"use server";

import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { createSession } from "@/lib/session";
import { demoToolsEnabled } from "@/lib/demo";
import { DEMO_ACCOUNTS, type DemoRole } from "@/lib/demoMode";
import { ROLE_HOME, type Role } from "@/lib/constants";

const run = promisify(execFile);

async function loginAs(email: string) {
  const u = await db.user.findUnique({ where: { email } });
  if (!u || !email.endsWith("@demo.kr")) throw new Error("데모 계정을 찾을 수 없어요.");
  await createSession({ userId: u.id, role: u.role as Role });
  return u;
}

const safePath = (to: string) => (to.startsWith("/") && !to.startsWith("//") ? to : null);

// 역할 빠른 전환 · 시나리오 바로가기 (데모 계정만)
export async function demoSwitch(formData: FormData) {
  if (!demoToolsEnabled()) return;
  const role = String(formData.get("role") ?? "") as DemoRole;
  const email = String(formData.get("email") ?? "") || DEMO_ACCOUNTS[role];
  if (!email) return;
  const u = await loginAs(email);
  redirect(safePath(String(formData.get("to") ?? "")) ?? ROLE_HOME[u.role as Role]);
}

// 시드 데이터 초기화 후 고른 역할로 다시 로그인
export async function demoReset(formData: FormData) {
  if (!demoToolsEnabled()) return;
  await run(process.execPath, ["--conditions=react-server", "--import", "tsx", path.join("prisma", "seed.ts")], { cwd: process.cwd(), timeout: 180_000, env: process.env });
  revalidatePath("/", "layout");
  const role = (String(formData.get("role") ?? "CUSTOMER") as DemoRole) || "CUSTOMER";
  const u = await loginAs(DEMO_ACCOUNTS[role] ?? DEMO_ACCOUNTS.CUSTOMER);
  redirect(`${ROLE_HOME[u.role as Role]}?reset=1`);
}

export async function markOnboarded() {
  const user = await requireRole("CUSTOMER");
  await db.customerProfile.update({ where: { userId: user.id }, data: { onboardedAt: new Date() } });
  redirect("/customer");
}
