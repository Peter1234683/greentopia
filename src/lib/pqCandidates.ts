import "server-only";
import { db } from "./db";
import { getSettings } from "./settings";
import { COMPLAINT_TAGS, parseJson } from "./constants";

// 리뷰에서 자주 나온 불만 → PQ 규칙 후보
export async function pqCandidates() {
  const s = (await getSettings()).reputation;
  const [reviews, rules] = await Promise.all([
    db.review.findMany({ where: { status: { not: "HIDDEN" } }, include: { contractor: true } }),
    db.pQRule.findMany({ where: { kind: "COMPLAINT_TAG_RATIO" } }),
  ]);
  const covered = new Set(rules.map((r) => String(parseJson<{ tag?: string }>(r.paramsJson, {}).tag)));
  const by = new Map<string, { name: string; initial: number; tags: Record<string, number> }>();
  for (const r of reviews) {
    const e = by.get(r.contractorId) ?? { name: r.contractor.companyName, initial: 0, tags: {} };
    if (r.kind === "INITIAL") e.initial++;
    for (const t of parseJson<string[]>(r.complaintTagsJson, [])) e.tags[t] = (e.tags[t] ?? 0) + 1;
    by.set(r.contractorId, e);
  }
  return COMPLAINT_TAGS.filter((t) => !covered.has(t.code))
    .map((t) => {
      const hits = [...by.values()]
        .filter((c) => c.initial >= s.pqCandidate.minReviews && (c.tags[t.code] ?? 0) / c.initial >= s.pqCandidate.tagRatio)
        .map((c) => ({ name: c.name, ratio: (c.tags[t.code] ?? 0) / c.initial, reviews: c.initial }));
      const total = [...by.values()].reduce((sum, c) => sum + (c.tags[t.code] ?? 0), 0);
      return { tag: t.code, label: t.label, total, hits };
    })
    .filter((c) => c.hits.length > 0)
    .sort((a, b) => b.total - a.total);
}

// 짧은 기간에 한 업체로 몰린 리뷰 (조작 의심)
export async function reviewAnomalies() {
  const s = (await getSettings()).reputation.anomaly;
  const reviews = await db.review.findMany({ where: { kind: "INITIAL" }, include: { contractor: true }, orderBy: { createdAt: "asc" } });
  const by = new Map<string, typeof reviews>();
  for (const r of reviews) by.set(r.contractorId, [...(by.get(r.contractorId) ?? []), r]);
  const out: { name: string; count: number; from: Date; to: Date }[] = [];
  for (const list of by.values()) {
    for (let i = 0; i < list.length; i++) {
      const end = list.findLastIndex((x) => x.createdAt.getTime() - list[i].createdAt.getTime() <= s.windowDays * 864e5);
      const count = end - i + 1;
      if (count >= s.minReviews) {
        out.push({ name: list[i].contractor.companyName, count, from: list[i].createdAt, to: list[end].createdAt });
        break;
      }
    }
  }
  return out;
}
