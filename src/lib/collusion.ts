// 담합 감시 (규칙 기반, MVP)
//  ROTATION     : 같은 업체 조합이 여러 공고에 함께 입찰하면서 낙찰자가 돌아가며 바뀌는 패턴
//  CLOSE_PRICES : 한 공고에서 서로 다른 업체 입찰가가 비정상적으로 근접한 패턴
export type CTender = { id: string; label: string; bids: { contractorId: string; totalPrice: number; won: boolean }[] };
export type Flag = { kind: "ROTATION" | "CLOSE_PRICES"; contractorIds: string[]; tenderIds: string[]; detail: string };

export function detectCollusion(tenders: CTender[], names: Record<string, string>, opts: { minSharedTenders: number; closePriceGap: number }): Flag[] {
  const flags: Flag[] = [];
  const pairs = new Map<string, string[]>();
  for (const t of tenders) {
    const ids = [...new Set(t.bids.map((b) => b.contractorId))].sort();
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const k = `${ids[i]}|${ids[j]}`;
      pairs.set(k, [...(pairs.get(k) ?? []), t.id]);
    }
    // 근접 입찰가
    const sorted = [...t.bids].sort((a, b) => a.totalPrice - b.totalPrice);
    for (let i = 0; i + 1 < sorted.length; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      const gap = (b.totalPrice - a.totalPrice) / a.totalPrice;
      if (a.contractorId !== b.contractorId && gap <= opts.closePriceGap)
        flags.push({
          kind: "CLOSE_PRICES",
          contractorIds: [a.contractorId, b.contractorId].sort(),
          tenderIds: [t.id],
          detail: `${t.label}: ${names[a.contractorId]}·${names[b.contractorId]} 입찰가 차이 ${(gap * 100).toFixed(2)}%`,
        });
    }
  }
  for (const [k, tenderIds] of pairs) {
    if (tenderIds.length < opts.minSharedTenders) continue;
    const [x, y] = k.split("|");
    const wins = tenderIds.map((id) => tenders.find((t) => t.id === id)!.bids.find((b) => b.won)?.contractorId);
    const xWins = wins.filter((w) => w === x).length;
    const yWins = wins.filter((w) => w === y).length;
    // 둘이 함께 들어간 공고를 둘이 번갈아 가져가는 경우
    if (xWins > 0 && yWins > 0 && xWins + yWins === tenderIds.length)
      flags.push({
        kind: "ROTATION",
        contractorIds: [x, y],
        tenderIds,
        detail: `${names[x]}·${names[y]}가 함께 입찰한 ${tenderIds.length}건을 번갈아 낙찰 (${xWins}:${yWins})`,
      });
  }
  return flags;
}
