import Link from "next/link";
import { cx } from "@/components/ui";

// "내 입찰·시공" 탭 안의 두 화면 전환
export function WorkTabs({ current }: { current: "bids" | "projects" }) {
  const item = (key: "bids" | "projects", href: string, label: string) => (
    <Link href={href} aria-current={current === key ? "page" : undefined} className={cx("flex-1 rounded-xl py-2 text-center text-sm font-semibold", current === key ? "bg-white shadow-sm" : "text-muted")}>
      {label}
    </Link>
  );
  return (
    <nav aria-label="입찰·시공 전환" className="flex gap-1 rounded-2xl bg-gray-100 p-1">
      {item("bids", "/contractor/bids", "📝 내 입찰")}
      {item("projects", "/contractor/projects", "🏗️ 시공 관리")}
    </nav>
  );
}
