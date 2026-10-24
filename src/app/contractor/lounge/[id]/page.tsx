import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { getPost } from "@/lib/community/service";
import { PostDetail } from "@/components/community/PostDetail";

export const metadata: Metadata = { title: "파트너 라운지" };

export default async function LoungePost(props: PageProps<"/contractor/lounge/[id]">) {
  const user = await requireRole("CONTRACTOR");
  const p = user.contractorProfile!;
  if (p.reviewStatus !== "APPROVED" || !p.loungeAgreedAt) redirect("/contractor/lounge");
  const { id } = await props.params;
  const sp = await props.searchParams;
  const post = await getPost("CONTRACTOR", id, user);
  if (!post) notFound();
  const flash = sp.reported ? "신고가 접수됐어요. 운영자가 확인할게요." : undefined;
  return (
    <div className="space-y-3">
      <Link href="/contractor/lounge" className="text-sm text-muted">‹ 라운지</Link>
      <PostDetail post={post} board="CONTRACTOR" viewerId={user.id} flash={flash} />
    </div>
  );
}
