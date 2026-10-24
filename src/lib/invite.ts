import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { notify } from "@/lib/notify";
import { haversineKm } from "@/lib/matching/engine";
import { parseJson } from "@/lib/constants";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => [...randomBytes(8)].map((b) => ALPHABET[b % ALPHABET.length]).join("");

// 같은 묶음(또는 동네)용 초대 링크는 하나만 만들어 재사용한다.
export async function getOrCreateInvite(userId: string, clusterId: string | null) {
  const existing = await db.invite.findFirst({ where: { inviterId: userId, clusterId, acceptedById: null }, orderBy: { createdAt: "desc" } });
  if (existing) return existing;
  const b = await db.building.findFirst({ where: { ownerId: userId }, orderBy: { createdAt: "asc" } });
  const cluster = clusterId ? await db.cluster.findUnique({ where: { id: clusterId } }) : null;
  return db.invite.create({ data: { code: newCode(), inviterId: userId, clusterId, sigungu: b?.sigungu ?? null, dong: b?.dong ?? null, trade: cluster?.trade ?? null } });
}

// 초대 링크로 가입: 링크 한 개로 여러 이웃이 가입할 수 있어, 가입마다 수락 기록을 따로 남긴다.
export async function acceptInvite(code: string, userId: string) {
  const inv = await db.invite.findUnique({ where: { code } });
  if (!inv || inv.inviterId === userId) return;
  const data = { acceptedById: userId, acceptedAt: new Date() };
  if (!inv.acceptedById) await db.invite.update({ where: { id: inv.id }, data });
  else await db.invite.create({ data: { ...data, code: `${inv.code}-${newCode().slice(0, 4)}`, inviterId: inv.inviterId, clusterId: inv.clusterId, sigungu: inv.sigungu, dong: inv.dong, trade: inv.trade } });
  await notify([inv.inviterId], "초대한 이웃이 가입했어요", "이웃이 공사 수요를 등록하면 초대 포인트를 드려요.", "/customer/invite");
}

// 초대받은 사람이 처음 공사 수요를 등록하면: 초대한 사람에게 포인트, 초대받은 묶음에 우선 후보로 연결
export async function onDemandSaved(userId: string, buildingId: string) {
  const inv = await db.invite.findFirst({ where: { acceptedById: userId, rewarded: false } });
  if (!inv) return;
  const settings = await getSettings();
  const given = await db.invite.count({ where: { inviterId: inv.inviterId, rewarded: true } });
  await db.invite.update({ where: { id: inv.id }, data: { rewarded: true } });
  if (given < settings.growth.invite.maxRewardsPerInviter) {
    await db.customerProfile.updateMany({ where: { userId: inv.inviterId }, data: { points: { increment: settings.growth.invite.rewardPoints } } });
    await notify([inv.inviterId], "초대 포인트가 쌓였어요", `초대한 이웃이 공사 수요를 등록해 ${settings.growth.invite.rewardPoints.toLocaleString()}P를 드렸어요.`, "/customer/invite");
  }

  // 모집 중인 묶음(AI 제안 단계는 다음 매칭에서 자연스럽게 반영)에 조건이 맞으면 후보로 넣는다
  if (!inv.clusterId) return;
  const [cluster, building, demand] = await Promise.all([
    db.cluster.findUnique({ where: { id: inv.clusterId }, include: { members: { where: { status: { not: "LEFT" } } } } }),
    db.building.findUnique({ where: { id: buildingId } }),
    db.retrofitDemand.findFirst({ where: { buildingId, status: { in: ["ACTIVE", "MATCHED"] } }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!cluster || !building || !demand || !["RECRUITING", "CONFIRMED"].includes(cluster.status)) return;
  const s = settings.matching;
  const fits =
    parseJson<string[]>(demand.tradesJson, []).includes(cluster.trade) &&
    haversineKm({ lat: cluster.centerLat, lng: cluster.centerLng }, building) <= s.radiusKm &&
    cluster.members.length < s.maxClusterSize &&
    !cluster.members.some((m) => m.buildingId === buildingId);
  if (!fits) return;
  await db.clusterMember.create({ data: { clusterId: cluster.id, buildingId, demandId: demand.id, status: "PROPOSED" } });
  await notify([userId], "초대받은 공동공사 후보가 됐어요", `Cluster #${cluster.code}에 후보로 연결됐어요. 참여 여부를 골라주세요.`, "/customer/joint");
}
