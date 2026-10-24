import Link from "next/link";
import type { ReactNode } from "react";

export function SignupShell({ icon, title, subtitle, children }: { icon: string; title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-md px-6 pb-16 pt-6">
      <Link href="/onboarding" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        ‹ 회원 유형 다시 고르기
      </Link>
      <div className="mt-6 flex items-center gap-3">
        <span className="text-4xl" aria-hidden="true">{icon}</span>
        <div>
          <h1 className="text-2xl font-extrabold">{title}</h1>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
      </div>
      {children}
    </main>
  );
}
