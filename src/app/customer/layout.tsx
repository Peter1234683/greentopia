import { requireRole } from "@/lib/dal";
import { AppHeader } from "@/components/AppHeader";
import { BottomTabs, type Tab } from "@/components/BottomTabs";
import Link from "next/link";
import { Bell, unreadCount } from "@/components/Notifications";

const TABS: Tab[] = [
  { href: "/customer", label: "홈", icon: "🏠", also: ["/customer/learn"] },
  { href: "/customer/diagnosis", label: "진단", icon: "🔍", also: ["/customer/buildings"] },
  { href: "/customer/joint", label: "공동공사", icon: "🤝" },
  { href: "/customer/community", label: "커뮤니티", icon: "💬" },
  { href: "/customer/projects", label: "내 공사", icon: "📋", also: ["/customer/reviews", "/customer/contractors"] },
];

export default async function CustomerLayout({ children }: LayoutProps<"/customer">) {
  const user = await requireRole("CUSTOMER");
  const unread = await unreadCount(user.id);
  return (
    <>
      <AppHeader home="/customer" right={
          <span className="flex items-center gap-1">
            <Bell href="/customer/notifications" count={unread} />
            <Link href="/customer/my" aria-label="마이 페이지" className="inline-flex h-9 w-9 items-center justify-center rounded-full text-lg hover:bg-white">
              👤
            </Link>
          </span>
        } />
      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-28 pt-2">{children}</main>
      <BottomTabs tabs={TABS} root="/customer" />
    </>
  );
}
