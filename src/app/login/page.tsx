import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "로그인" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 py-10">
      <Link href="/"><Logo /></Link>
      <h1 className="mt-8 text-2xl font-extrabold">다시 오셨네요</h1>
      <p className="mt-2 text-muted">가입한 이메일로 로그인해주세요.</p>
      <LoginForm showDemo={process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_ACCOUNTS === "1"} />
      <p className="mt-8 text-center text-sm text-muted">
        처음이신가요?{" "}
        <Link href="/onboarding" className="font-semibold text-forest-700 underline underline-offset-4">
          회원가입
        </Link>
      </p>
    </main>
  );
}
