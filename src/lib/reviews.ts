import "server-only";
import { db } from "./db";
import { getSettings } from "./settings";
import { notify } from "./notify";
import { parseJson } from "./constants";
import { computeReputation, gradeFor } from "./reputation";

export async function recomputeContractor(contractorId: string, opts: { silent?: boolean } = {}) {
  const s = (await getSettings()).reputation;
  const [reviews, contracts, before] = await Promise.all([
    db.review.findMany({ where: { contractorId, status: { not: "HIDDEN" } } }),
    db.contract.findMany({ where: { contractorId, status: "SIGNED" }, include: { project: true } }),
    db.contractorProfile.findUniqueOrThrow({ where: { id: contractorId } }),
  ]);
  const rep = computeReputation(
    reviews.map((r) => ({ ...r, complaintTags: parseJson<string[]>(r.complaintTagsJson, []) })),
    contracts.map((c) => ({ completedAt: c.project?.completedAt ?? null, plannedEnd: c.project?.plannedEnd ?? null })),
    s,
  );
  const grade = gradeFor(rep?.score ?? null, rep?.reviewCount ?? 0, s);
  await db.contractorProfile.update({ where: { id: contractorId }, data: { reputationScore: rep?.score ?? null, grade } });
  if (before.grade !== grade && !opts.silent) await notify([before.userId], "평판 등급이 바뀌었어요", `새 등급을 내 업체 화면에서 확인하세요.`, "/contractor/company");
  return rep;
}

// 후속 리뷰(6개월·12개월 하자 확인) 알림 — 이미 보낸 알림은 다시 보내지 않는다
export async function ensureFollowupReminders(userId?: string) {
  const s = (await getSettings()).reputation;
  const contracts = await db.contract.findMany({
    where: { status: "SIGNED", project: { status: { in: ["COMPLETED", "AS"] } }, ...(userId ? { building: { ownerId: userId } } : {}) },
    include: { project: { include: { reviews: true } }, building: true, contractor: true, tender: true },
  });
  let sent = 0;
  for (const c of contracts) {
    const p = c.project!;
    if (!p.completedAt || !p.reviews.some((r) => r.kind === "INITIAL")) continue;
    for (const months of s.followupMonths) {
      const kind = `FOLLOWUP_${months}M`;
      const due = new Date(p.completedAt);
      due.setMonth(due.getMonth() + months);
      if (due > new Date() || p.reviews.some((r) => r.kind === kind)) continue;
      const link = `/customer/reviews/new?contract=${c.id}&kind=${kind}`;
      const exists = await db.notification.count({ where: { userId: c.building.ownerId, link } });
      if (exists) continue;
      await notify([c.building.ownerId], `공사 ${months}개월 후 점검`, `${c.contractor.companyName} 시공 부분에 하자가 생기지 않았는지 알려주세요.`, link);
      sent++;
    }
  }
  return sent;
}

export function followupDue(completedAt: Date | null, months: number) {
  if (!completedAt) return false;
  const due = new Date(completedAt);
  due.setMonth(due.getMonth() + months);
  return due <= new Date();
}
