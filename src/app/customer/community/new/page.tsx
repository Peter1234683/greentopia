import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { PostForm } from "@/components/community/Client";
import { OWNER_CATEGORIES } from "@/lib/constants";

export const metadata: Metadata = { title: "글쓰기" };

export default async function NewCommunityPost(props: PageProps<"/customer/community/new">) {
  const user = await requireRole("CUSTOMER");
  const { cat } = await props.searchParams;
  const hasBuilding = (await db.building.count({ where: { ownerId: user.id } })) > 0;
  const categories = OWNER_CATEGORIES.filter((c) => c.code !== "NOTICE").map((c) => ({ ...c }));
  return (
    <div className="space-y-4 pt-2">
      <Link href="/customer/community" className="text-sm text-muted">‹ 커뮤니티</Link>
      <h1 className="text-2xl font-extrabold">글쓰기</h1>
      <PostForm board="OWNER" categories={categories} hasBuilding={hasBuilding} defaultCategory={typeof cat === "string" && cat !== "NOTICE" ? cat : undefined} />
    </div>
  );
}
