import Link from "next/link";
import { db } from "@/lib/db";
import { Card } from "./ui";

export function Bell({ href, count, dark = false }: { href: string; count: number; dark?: boolean }) {
  return (
    <Link href={href} aria-label={`알림 ${count}개`} className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full ${dark ? "text-white hover:bg-white/10" : "text-ink hover:bg-white"}`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-danger px-1 text-center text-[0.6rem] font-bold leading-4 text-white">{count > 9 ? "9+" : count}</span>
      )}
    </Link>
  );
}

export const unreadCount = (userId: string) => db.notification.count({ where: { userId, readAt: null } });

export async function NotificationList({ userId }: { userId: string }) {
  const list = await db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 });
  // 목록을 열면 읽음 처리
  await db.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  return (
    <div className="space-y-3 pt-2">
      <h1 className="text-xl font-extrabold">알림</h1>
      {list.length === 0 && <Card className="text-center text-sm text-muted">새 알림이 없어요.</Card>}
      <ul className="space-y-2">
        {list.map((n) => {
          const body = (
            <div className={`rounded-2xl p-4 ring-1 ${n.readAt ? "bg-white ring-line/60" : "bg-mint-50 ring-mint-300"}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{n.title}</p>
                <span className="shrink-0 text-xs text-muted">{n.createdAt.toLocaleDateString("ko-KR")}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{n.body}</p>
            </div>
          );
          return <li key={n.id}>{n.link ? <Link href={n.link}>{body}</Link> : body}</li>;
        })}
      </ul>
    </div>
  );
}
