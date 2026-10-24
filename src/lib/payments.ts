// 단계별 지급 상태 머신 (F9, 순수 함수). 실제 송금은 없고 상태와 승인 기록만 다룬다.
// LOCKED → READY(조건 충족, 건물주 승인 대기) → RELEASED(건물주 승인 = 지급 처리 기록)
export const STAGE_ORDER = ["DEPOSIT", "INTERIM", "COMPLETION", "RETENTION"] as const;
export type Stage = (typeof STAGE_ORDER)[number];
export type StageStatus = "LOCKED" | "READY" | "RELEASED";

export type PayContext = {
  signed: boolean;
  materialsDelivered: boolean;
  inspectionApproved: boolean;
  openAS: boolean;
  releaseAt: Date | null; // 유보금 해제 예정일
  now: Date;
};

export function conditionMet(stage: Stage, c: PayContext) {
  switch (stage) {
    case "DEPOSIT":
      return c.signed;
    case "INTERIM":
      return c.materialsDelivered;
    case "COMPLETION":
      return c.inspectionApproved;
    case "RETENTION":
      return c.inspectionApproved && !!c.releaseAt && c.now >= c.releaseAt && !c.openAS;
  }
}

// 앞 단계가 지급 처리돼야 다음 단계가 열린다. 이미 지급 처리된 단계는 그대로 둔다.
export function computeStatuses(current: Record<Stage, StageStatus>, c: PayContext): Record<Stage, StageStatus> {
  const out = { ...current };
  let prevReleased = true;
  for (const s of STAGE_ORDER) {
    if (out[s] !== "RELEASED") out[s] = prevReleased && conditionMet(s, c) ? "READY" : "LOCKED";
    prevReleased = out[s] === "RELEASED";
  }
  return out;
}

export function splitAmounts(amount: number, stages: { code: string; ratio: number }[]) {
  const parts = stages.map((s) => Math.floor((amount * s.ratio) / 1000) * 1000);
  parts[parts.length - 1] += amount - parts.reduce((a, b) => a + b, 0); // 끝 단계에 나머지
  return parts;
}

export function delayPenalty(amount: number, days: number, cfg: { ratePerDayPermil: number; maxRatio: number }) {
  const raw = (amount * cfg.ratePerDayPermil * Math.max(0, days)) / 1000;
  const cap = amount * cfg.maxRatio;
  return { amount: Math.round(Math.min(raw, cap)), capped: raw > cap, cap: Math.round(cap) };
}
