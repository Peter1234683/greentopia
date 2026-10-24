import "server-only";
import { db } from "./db";
import { getSettings } from "./settings";
import { notify } from "./notify";
import { parseJson } from "./constants";
import { computeReputation, gradeFor, RATING_KEYS } from "./reputation";
import { notifyAdmins } from "./notify";
import { reviewFlags } from "./reviewTrust";

// 교차 검증이 끝나지 않았거나 제외 결정된 리뷰는 평판 계산에서 뺀다
export const TRUSTED_REVIEW = { flags: { none: { OR: [{ resolved: false }, { resolution: "EXCLUDE" }] } } };

const avgOf = (r: Record<string, unknown>) => RATING_KEYS.reduce((a, [, f]) => a + Number(r[f]), 0) / RATING_KEYS.length;

// 새 시공 후기: 같은 묶음 이웃 세대·짧은 기간 몰림을 확인해 플래그를 남긴다
export async function flagNewReview(reviewId: string) {
  const r = await db.review.findUnique({ where: { id: reviewId }, include: { project: { include: { contract: { include: { tender: true } } } }, contractor: true } });
  if (!r || r.kind !== "INITIAL") return [];
  const s = (await getSettings()).reputation;
  const clusterId = r.project.contract.tender?.clusterId;
  const others = await db.review.findMany({
    where: { contractorId: r.contractorId, kind: "INITIAL", id: { not: r.id }, status: { not: "HIDDEN" } },
    include: { project: { include: { contract: { include: { tender: true } } } } },
  });
  const t = (x: typeof r | (typeof others)[number]) => ({ id: x.id, createdAt: x.createdAt, avg: avgOf(x) });
  const flags = reviewFlags(t(r), others.filter((o) => clusterId && o.project.contract.tender?.clusterId === clusterId).map(t), others.map(t), s);
  for (const f of flags) await db.reviewFlag.create({ data: { reviewId: r.id, reason: f.reason, detail: f.detail } });
  if (flags.length) await notifyAdmins("리뷰 교차 검증 필요", `${r.contractor.companyName} 후기: ${flags.map((f) => f.detail).join(" / ")}`, "/admin/reviews");
  return flags;
}

export async function recomputeContractor(contractorId: string, opts: { silent?: boolean } = {}) {
  const s = (await getSettings()).reputation;
  const [reviews, contracts, before] = await Promise.all([
    db.review.findMany({ where: { contractorId, status: { not: "HIDDEN" }, ...TRUSTED_REVIEW } }),
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
