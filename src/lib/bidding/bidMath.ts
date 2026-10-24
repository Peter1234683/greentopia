// 입찰 금액 계산 (순수 함수, 서버·클라이언트 공용)
// - 유형·규격별 단가표(㎡ 또는 대 단가) × 건물별 유형 물량
// - 물량 구간: 현재 참여 동수 기준 상위 구간은 기본 단가, 이탈로 동수가 줄면 하위 구간 가산율 자동 적용

export type Tier = { min: number; max: number; adjustPct: number };
export type UnitTable = Record<string, number>; // 유형 코드 → 단가
export type MemberQty = { memberId: string; label: string; amount: number; mix: Record<string, number>; unit: string };

export function tierRanges(n: number, minSize: number, upperShare: number, extra: number) {
  const upperMin = Math.max(minSize, Math.ceil(n * upperShare));
  const tiers = [{ min: upperMin, max: n + extra }];
  if (upperMin > minSize) tiers.push({ min: minSize, max: upperMin - 1 });
  return tiers;
}

export function tierFor(n: number, tiers: Tier[]) {
  return tiers.find((t) => n >= t.min && n <= t.max) ?? null;
}

export function memberAmount(q: MemberQty, table: UnitTable, adjustPct: number) {
  const base = Object.entries(q.mix).reduce((s, [code, amt]) => s + amt * (table[code] ?? 0), 0);
  return Math.round((base * (1 + adjustPct / 100)) / 1000) * 1000;
}

export function bidTotal(members: MemberQty[], table: UnitTable, tiers: Tier[]) {
  const tier = tierFor(members.length, tiers);
  const adjust = tier?.adjustPct ?? 0;
  const rows = members.map((m) => ({ ...m, price: memberAmount(m, table, adjust) }));
  return { tier, adjust, rows, total: rows.reduce((s, r) => s + r.price, 0), outOfTier: !tier };
}
