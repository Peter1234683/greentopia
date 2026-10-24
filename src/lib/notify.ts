import "server-only";
import { db } from "./db";

export async function notify(userIds: string[], title: string, body: string, link?: string) {
  if (!userIds.length) return;
  await db.notification.createMany({ data: [...new Set(userIds)].map((userId) => ({ userId, title, body, link })) });
}

export async function notifyAdmins(title: string, body: string, link?: string) {
  const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  await notify(admins.map((a) => a.id), title, body, link);
}
