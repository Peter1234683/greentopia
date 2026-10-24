import type { Metadata } from "next";
import Link from "next/link";
import { loadLearnCards } from "@/lib/content";
import { LearnDeck } from "./LearnDeck";

export const metadata: Metadata = { title: "그린리모델링 알아보기" };

export default async function LearnPage(props: PageProps<"/customer/learn">) {
  const { topic } = await props.searchParams;
  const cards = await loadLearnCards();
  const start = Math.max(0, cards.findIndex((c) => c.slug === topic));
  return (
    <div className="pt-2">
      <Link href="/customer" className="text-sm text-muted">‹ 홈</Link>
      <h1 className="mt-3 mb-4 text-2xl font-extrabold">그린리모델링 알아보기</h1>
      <LearnDeck cards={cards} start={start} />
    </div>
  );
}
