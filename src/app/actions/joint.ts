"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { getSettings } from "@/lib/settings";
import { createTenderDraft } from "@/lib/bidding/tenders";
import { notify, notifyAdmins } from "@/lib/notify";
import { TRADE_LABEL, type Trade } from "@/lib/constants";

async function myMember(userId: string, memberId: string) {
  const m = await db.clusterMember.findFirst({
    where: { id: memberId, building: { ownerId: userId } },
    include: { cluster: { include: { tenders: true } } },
  });
  if (!m) throw new Error("참여 정보를 찾을 수 없어요.");
  return m;
}

export async function joinCluster(formData: FormData) {
  const user = await requireRole("CUSTOMER");
  const m = await myMember(user.id, String(formData.get("memberId")));
  if (!["PROPOSED", "RECRUITING", "CONFIRMED", "TENDERING"].includes(m.cluster.status)) return;
  await db.clusterMember.update({ where: { id: m.id }, data: { status: "JOINED", joinedAt: new Date() } });
  if (m.demandId) await db.retrofitDemand.update({ where: { id: m.demandId }, data: { status: "MATCHED" } });
  if (m.cluster.status === "PROPOSED") await db.cluster.update({ where: { id: m.clusterId }, data: { status: "RECRUITING" } });

  const settings = await getSettings();
  const joined = await db.clusterMember.findMany({ where: { clusterId: m.clusterId, status: "JOINED" }, include: { building: true } });
  const hasTender = m.cluster.tenders.some((t) => t.status !== "CANCELLED");
  if (!hasTender && joined.length >= settings.matching.minJoinedForTender) {
    const tender = await createTenderDraft(m.clusterId);
    const label = `Cluster #${m.cluster.code} ${TRADE_LABEL[m.cluster.trade as Trade]}`;
    await notify(
      joined.map((j) => j.building.ownerId),
      "공동견적 인원이 모였어요",
      `${label}에 ${joined.length}동이 참여했어요. 운영자 확인 후 입찰 공고가 열려요.`,
      "/customer/joint",
    );
    await notifyAdmins("입찰 방식 확정 필요", `${label} 공고 초안이 만들어졌어요. 추천 방식을 확인해주세요.`, `/admin/tenders/${tender.id}`);
  }
  revalidatePath("/customer", "layout");
}

export async function leaveCluster(formData: FormData) {
  const user = await requireRole("CUSTOMER");
  const m = await myMember(user.id, String(formData.get("memberId")));
  if (["AWARDED", "IN_PROGRESS", "COMPLETED"].includes(m.cluster.status)) return; // 낙찰 이후는 계약 화면에서 참여 여부를 정한다
  await db.clusterMember.update({ where: { id: m.id }, data: { status: "LEFT" } });
  if (m.demandId) await db.retrofitDemand.update({ where: { id: m.demandId }, data: { status: "ACTIVE" } });
  revalidatePath("/customer", "layout");
}
