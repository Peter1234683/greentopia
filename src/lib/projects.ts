import "server-only";
import { db } from "./db";

// 시공 진행에 따라 Cluster·수요 상태를 맞춘다
export async function syncClusterProgress(tenderId: string) {
  const tender = await db.tender.findUnique({
    where: { id: tenderId },
    include: { contracts: { where: { status: { not: "CANCELLED" } }, include: { project: true } }, cluster: { include: { members: true } } },
  });
  if (!tender) return;
  const projects = tender.contracts.map((c) => c.project);
  const allDone = tender.contracts.length > 0 && projects.every((p) => p && ["COMPLETED", "AS"].includes(p.status));
  const anyStarted = projects.some((p) => p && ["IN_PROGRESS", "COMPLETED", "AS"].includes(p.status));
  const status = allDone ? "COMPLETED" : anyStarted ? "IN_PROGRESS" : "AWARDED";
  if (tender.cluster.status !== status) await db.cluster.update({ where: { id: tender.clusterId }, data: { status } });
  if (allDone) {
    const done = tender.contracts.map((c) => c.buildingId);
    const demandIds = tender.cluster.members.filter((m) => done.includes(m.buildingId) && m.demandId).map((m) => m.demandId!);
    await db.retrofitDemand.updateMany({ where: { id: { in: demandIds } }, data: { status: "DONE" } });
  }
}
