import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { PostForm } from "@/components/community/Client";
import { CONTRACTOR_CATEGORIES } from "@/lib/constants";

export const metadata: Metadata = { title: "라운지 글쓰기" };

export default async function NewLoungePost() {
  const user = await requireRole("CONTRACTOR");
  const p = user.contractorProfile!;
  if (p.reviewStatus !== "APPROVED" || !p.loungeAgreedAt) redirect("/contractor/lounge");
  const categories = CONTRACTOR_CATEGORIES.filter((c) => c.code !== "NOTICE").map((c) => ({ ...c }));
  return (
    <div className="space-y-4">
      <Link href="/contractor/lounge" className="text-sm text-muted">‹ 라운지</Link>
      <h1 className="text-xl font-extrabold">라운지 글쓰기</h1>
      <PostForm board="CONTRACTOR" categories={categories} hasBuilding={false} />
    </div>
  );
}
