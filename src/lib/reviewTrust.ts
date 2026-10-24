// 리뷰 신뢰 장치 (F11, 순수 함수): 같은 묶음 이웃 세대 평점과 크게 다른 리뷰, 짧은 기간 몰린 리뷰 감지
export type TrustReview = { id: string; createdAt: Date; avg: number };

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function reviewFlags(
  mine: TrustReview,
  clusterPeers: TrustReview[], // 같은 묶음 · 같은 업체의 다른 세대 시공 후기
  contractorRecent: TrustReview[], // 같은 업체의 다른 시공 후기 (기간 무관)
  cfg: { crossCheck: { outlierGap: number; minPeers: number }; anomaly: { windowDays: number; minReviews: number } },
) {
  const flags: { reason: "CLUSTER_OUTLIER" | "BURST"; detail: string }[] = [];
  if (clusterPeers.length >= cfg.crossCheck.minPeers) {
    const m = median(clusterPeers.map((r) => r.avg));
    if (Math.abs(mine.avg - m) >= cfg.crossCheck.outlierGap)
      flags.push({ reason: "CLUSTER_OUTLIER", detail: `같은 묶음 이웃 세대 평균 ${m.toFixed(1)}점과 ${mine.avg.toFixed(1)}점으로 차이가 커요` });
  }
  const windowMs = cfg.anomaly.windowDays * 864e5;
  const inWindow = contractorRecent.filter((r) => Math.abs(r.createdAt.getTime() - mine.createdAt.getTime()) <= windowMs).length + 1;
  if (inWindow >= cfg.anomaly.minReviews)
    flags.push({ reason: "BURST", detail: `${cfg.anomaly.windowDays}일 안에 같은 업체 후기가 ${inWindow}건 몰렸어요` });
  return flags;
}

export type TagReview = { projectId: string; kind: string; tags: string[]; replied: boolean; defectOccurred: boolean | null; defectResolved: boolean | null };

// 불만 태그별 비율과 사후 해결률.
// 해결 = 업체가 답글로 대응했고, 같은 공사의 후속 점검에서 "하자 없음" 또는 "처리 완료"로 응답한 경우
export function tagStats(reviews: TagReview[]) {
  const initial = reviews.filter((r) => r.kind === "INITIAL");
  const followOk = (projectId: string) => {
    const f = reviews.filter((r) => r.projectId === projectId && r.kind !== "INITIAL");
    return f.length > 0 && f.every((x) => !x.defectOccurred || x.defectResolved);
  };
  const tags = [...new Set(initial.flatMap((r) => r.tags))];
  return tags
    .map((tag) => {
      const hit = initial.filter((r) => r.tags.includes(tag));
      const resolved = hit.filter((r) => r.replied && followOk(r.projectId)).length;
      return { tag, count: hit.length, ratio: initial.length ? hit.length / initial.length : 0, resolved, resolvedRate: hit.length ? resolved / hit.length : 0 };
    })
    .sort((a, b) => b.count - a.count);
}
