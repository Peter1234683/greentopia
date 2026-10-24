import { requireRole } from "@/lib/dal";
import { AppHeader } from "@/components/AppHeader";
import { BottomTabs, type Tab } from "@/components/BottomTabs";
import { Bell, unreadCount } from "@/components/Notifications";

const TABS: Tab[] = [
  { href: "/customer", label: "홈", icon: "🏠", also: ["/customer/learn"] },
  { href: "/customer/diagnosis", label: "내 집 진단", icon: "🔍", also: ["/customer/buildings"] },
  { href: "/customer/joint", label: "공동공사", icon: "🤝" },
  { href: "/customer/projects", label: "내 공사", icon: "📋" },
  { href: "/customer/my", label: "마이", icon: "👤" },
];

export default async function CustomerLayout({ children }: LayoutProps<"/customer">) {
  const user = await requireRole("CUSTOMER");
  const unread = await unreadCount(user.id);
  return (
    <>
      <AppHeader home="/customer" right={<Bell href="/customer/notifications" count={unread} />} />
      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-28 pt-2">{children}</main>
      <BottomTabs tabs={TABS} root="/customer" />
    </>
  );
}
