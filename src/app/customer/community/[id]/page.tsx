import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { getPost } from "@/lib/community/service";
import { PostDetail } from "@/components/community/PostDetail";

export const metadata: Metadata = { title: "이웃 커뮤니티" };

export default async function CommunityPost(props: PageProps<"/customer/community/[id]">) {
  const user = await requireRole("CUSTOMER");
  const { id } = await props.params;
  const sp = await props.searchParams;
  const post = await getPost("OWNER", id, user);
  if (!post) notFound();
  const flash = sp.interest ? "✅ 관심을 표시했어요. 내 공사 수요에 추가하고 AI 매칭을 다시 돌렸어요." : sp.reported ? "신고가 접수됐어요. 운영자가 확인할게요." : undefined;
  return (
    <div className="space-y-3 pt-2">
      <Link href="/customer/community" className="text-sm text-muted">‹ 커뮤니티</Link>
      <PostDetail post={post} board="OWNER" viewerId={user.id} flash={flash} />
    </div>
  );
}
