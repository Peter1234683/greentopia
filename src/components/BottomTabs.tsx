"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type Tab = { href: string; label: string; icon: string };

export function BottomTabs({ tabs, root }: { tabs: Tab[]; root: string }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="주요 메뉴"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-md">
        {tabs.map((t) => {
          const active = t.href === root ? pathname === root : pathname.startsWith(t.href);
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[0.72rem] font-semibold ${
                  active ? "text-forest-800" : "text-gray-400"
                }`}
              >
                <span className={`text-xl leading-none ${active ? "" : "grayscale opacity-70"}`} aria-hidden="true">
                  {t.icon}
                </span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
