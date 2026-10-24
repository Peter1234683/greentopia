import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "./db";
import { readSession } from "./session";
import { ROLE_HOME, type Role } from "./constants";

export const getCurrentUser = cache(async () => {
  const session = await readSession();
  if (!session) return null;
  return db.user.findUnique({
    where: { id: session.userId },
    include: { customerProfile: true, contractorProfile: true },
  });
});

// 역할이 맞지 않으면 각자의 홈으로 돌려보낸다.
export async function requireRole(role: Role) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== role) redirect(ROLE_HOME[user.role as Role]);
  return user;
}
