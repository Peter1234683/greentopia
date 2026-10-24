"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="text-5xl" aria-hidden="true">🛠️</p>
      <h1 className="mt-4 text-xl font-extrabold">잠시 문제가 생겼어요</h1>
      <p className="mt-2 text-muted">{error.message && !error.digest ? error.message : "요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요."}</p>
      <div className="mt-6 flex w-full gap-2">
        <Button onClick={reset} className="flex-1">다시 시도</Button>
        <Link href="/" className="flex flex-1 items-center justify-center rounded-2xl border border-line bg-white font-semibold">처음으로</Link>
      </div>
    </main>
  );
}
