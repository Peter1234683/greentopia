import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getOrCreateInvite } from "@/lib/invite";
import { tierProgress, type BidTier } from "@/lib/matching/progress";
import { InviteShare } from "@/components/InviteShare";
import { Basis, Card } from "@/components/ui";
import { TRADE_LABEL, parseJson, type Trade } from "@/lib/constants";

export const metadata: Metadata = { title: "이웃 초대" };

export default async function InvitePage(props: PageProps<"/customer/invite">) {
  const user = await requireRole("CUSTOMER");
  const { c } = await props.searchParams;
  // 내가 속한 묶음일 때만 묶음 초대, 아니면 동네 초대
  const member = typeof c === "string" ? await db.clusterMember.findFirst({ where: { clusterId: c, building: { ownerId: user.id } } }) : null;
  const cluster = member
    ? await db.cluster.findUnique({
        where: { id: member.clusterId },
        include: { members: { where: { status: { not: "LEFT" } } }, tenders: { orderBy: { createdAt: "desc" }, take: 1, include: { bids: { where: { status: { not: "WITHDRAWN" } }, select: { tierPricesJson: true } } } } },
      })
    : null;
  const invite = await getOrCreateInvite(user.id, cluster?.id ?? null);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const url = `${origin}/invite/${invite.code}`;
  const qr = await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#072419", light: "#ffffff" } });
  const settings = await getSettings();
  const [accepted, rewarded] = await Promise.all([
    db.invite.count({ where: { inviterId: user.id, acceptedById: { not: null } } }),
    db.invite.count({ where: { inviterId: user.id, rewarded: true } }),
  ]);

  const joined = cluster?.members.filter((m) => m.status === "JOINED").length ?? 0;
  const bidTiers = cluster?.tenders[0]?.bids.map((b) => parseJson<BidTier[]>(b.tierPricesJson, [])) ?? [];
  const p = cluster ? tierProgress(joined, bidTiers.length ? bidTiers : null, settings.pricing.jointDiscountTiers) : null;
  const text = cluster
    ? `우리 동네 ${TRADE_LABEL[cluster.trade as Trade]} 공동공사에 함께해요! 이웃이 모일수록 공사비를 아낄 수 있어요.`
    : "그린토피아에서 우리 동네 이웃과 그린리모델링 공동공사를 알아봐요!";

  return (
    <div className="space-y-5 pt-2">
      <Link href="/customer/joint" className="text-sm text-muted">‹ 공동공사</Link>
      <div>
        <h1 className="text-2xl font-extrabold">🙌 이웃 초대하기</h1>
        <p className="mt-1 text-sm text-muted">{cluster ? `Cluster #${cluster.code} ${TRADE_LABEL[cluster.trade as Trade]}` : `${invite.dong ?? "우리 동네"} 공동공사`}에 이웃을 초대해요. 초대받은 이웃이 가입해 공사 수요를 등록하면 묶음 우선 후보가 돼요.</p>
      </div>

      {p && (
        <Card>
          <div className="flex items-end justify-between">
            <p className="font-bold">공동구매 진행</p>
            <p className="text-sm"><b className="text-forest-700">현재 {p.count}동</b> 참여</p>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={p.count} aria-valuemin={0} aria-valuemax={p.max}>
            <div className="h-full rounded-full bg-forest-700" style={{ width: `${(p.count / Math.max(1, p.max)) * 100}%` }} />
          </div>
          <p className="mt-2 text-sm">
            {p.next == null
              ? "가장 큰 물량 구간에 도달했어요."
              : <>{p.need}동 더 모이면 다음 물량 구간({p.next}동~){p.nextDiscount && <> · 예상 할인 {Math.round(p.nextDiscount.low * 100)}~{Math.round(p.nextDiscount.high * 100)}%</>}</>}
          </p>
          <Basis>{p.source === "bids" ? "업체들이 입찰한 물량 구간 기준이에요. 구간별 단가는 낙찰 전까지 공개하지 않아요." : "예상: 설정의 물량 구간 가정치예요. 실제 할인은 입찰로 정해져요."}</Basis>
        </Card>
      )}

      <Card className="space-y-4">
        <div className="mx-auto w-48" aria-label="초대 QR코드" role="img" dangerouslySetInnerHTML={{ __html: qr }} />
        <InviteShare url={url} text={text} />
      </Card>

      <Card className="text-sm">
        <p className="font-bold">내 초대 현황</p>
        <p className="mt-1">가입한 이웃 <b>{accepted}명</b> · 수요 등록 완료 <b>{rewarded}명</b></p>
        <p className="mt-1 text-muted">이웃이 공사 수요를 등록하면 {settings.growth.invite.rewardPoints.toLocaleString()}P를 드려요 (최대 {settings.growth.invite.maxRewardsPerInviter}명). 포인트는 리뷰 포인트와 같은 체계예요.</p>
      </Card>
    </div>
  );
}
