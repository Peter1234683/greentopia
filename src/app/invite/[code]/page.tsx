import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { ButtonLink, Card, Logo } from "@/components/ui";
import { TRADE_LABEL, type Trade } from "@/lib/constants";

export const metadata: Metadata = { title: "공동공사 초대" };

// 로그인 없이 볼 수 있는 초대 화면. 초대한 사람 이름·정확한 주소는 보여주지 않는다.
export default async function InviteLanding(props: PageProps<"/invite/[code]">) {
  const { code } = await props.params;
  const inv = await db.invite.findUnique({
    where: { code },
    include: { inviter: { select: { id: true } } },
  });
  if (!inv) notFound();
  const cluster = inv.clusterId ? await db.cluster.findUnique({ where: { id: inv.clusterId }, include: { members: { where: { status: "JOINED" } } } }) : null;
  const user = await getCurrentUser();
  const place = [inv.sigungu, inv.dong].filter(Boolean).join(" ") || "우리 동네";
  const trade = inv.trade ? TRADE_LABEL[inv.trade as Trade] : "그린리모델링";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-5 px-5 py-10">
      <Logo />
      <div>
        <p className="text-sm font-semibold text-forest-700">🙌 이웃의 초대</p>
        <h1 className="mt-1 text-2xl font-extrabold leading-snug">{place} 이웃이<br />{trade} 공동공사에 초대했어요</h1>
      </div>
      <Card className="space-y-2 text-sm">
        {cluster && <p>현재 <b>{cluster.members.length}동</b>이 공동견적에 참여 중이에요.</p>}
        <p>같은 공사가 필요한 이웃끼리 모이면 자재·장비·인력을 함께 써서 비용을 줄일 수 있어요.</p>
        <p className="text-muted">계약은 건물마다 따로 맺고, 참여해도 계약 의무는 없어요.</p>
      </Card>
      {user ? (
        <Card className="text-sm">
          이미 로그인되어 있어요. <Link href="/customer/joint" className="font-semibold text-forest-700 underline">공동공사 보러 가기</Link>
        </Card>
      ) : (
        <div className="space-y-2">
          <ButtonLink href={`/signup/customer?invite=${inv.code}`} className="w-full">가입하고 함께하기</ButtonLink>
          <ButtonLink href="/login" variant="outline" className="w-full">이미 회원이에요</ButtonLink>
        </div>
      )}
    </main>
  );
}
