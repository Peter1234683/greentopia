import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./ui";

export function AppHeader({ home, right, dark = false, wide = false }: { home: string; right?: ReactNode; dark?: boolean; wide?: boolean }) {
  return (
    <header className={`sticky top-0 z-20 ${dark ? "bg-forest-900" : "bg-surface/90 backdrop-blur"}`}>
      <div className={`mx-auto flex ${wide ? "max-w-4xl" : "max-w-md"} items-center justify-between px-5 py-3`}>
        <Link href={home} aria-label="홈으로"><Logo light={dark} /></Link>
        {right}
      </div>
    </header>
  );
}
