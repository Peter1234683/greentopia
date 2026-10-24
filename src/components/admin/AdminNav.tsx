"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/contractors", label: "업체 심사" },
  { href: "/admin/clusters", label: "Cluster" },
  { href: "/admin/tenders", label: "입찰" },
  { href: "/admin/subsidies", label: "지원금" },
  { href: "/admin/reviews", label: "리뷰·PQ" },
  { href: "/admin/community", label: "커뮤니티" },
  { href: "/admin/monitoring", label: "담합 감시" },
  { href: "/admin/settings", label: "설정" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="운영 메뉴" className="border-b border-line bg-white">
      <ul className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-3">
        {ITEMS.map((i) => {
          const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={`block whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold ${active ? "border-forest-700 text-forest-800" : "border-transparent text-muted hover:text-ink"}`}
              >
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
