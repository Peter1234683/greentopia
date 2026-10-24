import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/ui";

export const metadata: Metadata = { title: "회원 유형 선택" };

const CHOICES = [
  {
    href: "/signup/customer",
    icon: "🏠",
    title: "내 집을 고치고 싶어요",
    who: "건물주 · 집주인",
    desc: "우리 집 에너지 상태를 확인하고, 이웃과 함께 공사해 비용을 아껴요.",
    tone: "bg-white text-ink ring-line",
  },
  {
    href: "/signup/contractor",
    icon: "🛠️",
    title: "공사를 수주하고 싶어요",
    who: "그린리모델링 시공업체",
    desc: "내 주변에 모인 공사 물량에 입찰하고, 좋은 평판으로 혜택을 받아요.",
    tone: "bg-forest-900 text-white ring-forest-900",
  },
];

export default function Onboarding() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 py-10">
      <Logo />
      <h1 className="mt-8 text-2xl font-extrabold">어떤 일로 오셨어요?</h1>
      <p className="mt-2 text-muted">회원 유형에 따라 보이는 화면이 달라져요.</p>

      <div className="mt-8 space-y-4">
        {CHOICES.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className={`block rounded-3xl p-6 shadow-sm ring-1 transition hover:-translate-y-0.5 hover:shadow-md ${c.tone}`}
          >
            <div className="flex items-start gap-4">
              <span className="text-4xl" aria-hidden="true">{c.icon}</span>
              <div className="flex-1">
                <p className="text-sm opacity-70">{c.who}</p>
                <p className="mt-0.5 text-xl font-bold">{c.title}</p>
                <p className="mt-2 text-sm leading-relaxed opacity-80">{c.desc}</p>
              </div>
              <span className="self-center text-2xl opacity-60" aria-hidden="true">›</span>
            </div>
          </Link>
        ))}
      </div>

      <p className="mt-auto pt-10 text-center text-sm text-muted">
        이미 회원이신가요?{" "}
        <Link href="/login" className="font-semibold text-forest-700 underline underline-offset-4">
          로그인
        </Link>
      </p>
    </main>
  );
}
