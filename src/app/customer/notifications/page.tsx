import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";
import { NotificationList } from "@/components/Notifications";

export const metadata: Metadata = { title: "알림" };

export default async function Page() {
  const user = await requireRole("CUSTOMER");
  return <NotificationList userId={user.id} />;
}
