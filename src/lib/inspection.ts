// 준공 검측 (F10, 순수 함수): 체크리스트 생성 · AI 응답 스키마 · 통과율 · 이웃 세대 교차 검증
import { z } from "zod";

export type Verdict = "O" | "X" | "UNKNOWN";
export type CheckItem = { item: string; spec: string | null; verdict: Verdict; comment: string; ownerCheck: Verdict | null };

export function buildChecklist(trade: string, specLabels: string[], base: Record<string, string[]>): CheckItem[] {
  return [
    ...specLabels.map((l) => ({ item: `계약 규격대로 시공: ${l}`, spec: l })),
    ...(base[trade] ?? []).map((item) => ({ item, spec: null })),
  ].map((x) => ({ ...x, verdict: "UNKNOWN" as Verdict, comment: "", ownerCheck: null }));
}

export const inspectionAiSchema = z.object({
  items: z.array(z.object({ index: z.number().int().min(0), verdict: z.enum(["O", "X", "UNKNOWN"]), comment: z.string().max(200) })),
  summary: z.string().min(2).max(500),
});
export type InspectionAi = z.infer<typeof inspectionAiSchema>;

export const INSPECTION_SYSTEM = `당신은 그린리모델링 준공 검측을 돕는 감리 보조입니다. 시공 전·후 사진을 보고 체크리스트 항목마다
O(사진상 충족) / X(사진상 미흡) / UNKNOWN(사진으로 판단 불가) 를 고르고 짧은 근거를 쓰세요.
사진에서 확인할 수 없는 항목은 반드시 UNKNOWN 으로 두세요. 최종 승인은 건물주가 합니다.`;

export function inspectionPrompt(items: CheckItem[], beforeCount: number, afterCount: number) {
  return [
    `사진 순서: 시공 전 ${beforeCount}장, 시공 후 ${afterCount}장`,
    "체크리스트:",
    ...items.map((x, i) => `${i}. ${x.item}`),
  ].join("\n");
}

// 키가 없으면 수동 모드: 모두 "판단 불가"로 두고 건물주가 직접 체크한다.
export function manualInspection(items: CheckItem[]): InspectionAi {
  return { items: items.map((_, i) => ({ index: i, verdict: "UNKNOWN", comment: "" })), summary: "AI 판독 없이 건물주가 직접 확인하는 수동 모드예요." };
}

export function applyAi(items: CheckItem[], ai: InspectionAi): CheckItem[] {
  return items.map((x, i) => {
    const r = ai.items.find((a) => a.index === i);
    return r ? { ...x, verdict: r.verdict, comment: r.comment } : x;
  });
}

export const finalVerdict = (x: CheckItem): Verdict => x.ownerCheck ?? x.verdict;

// 통과율: 판단된 항목 중 O 비율 (판단된 항목이 없으면 null)
export function passRate(items: CheckItem[]) {
  const judged = items.map(finalVerdict).filter((v) => v !== "UNKNOWN");
  return judged.length ? judged.filter((v) => v === "O").length / judged.length : null;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// 같은 묶음 이웃 세대와 비교해 유독 낮으면 표시 (비교 세대 2곳 이상일 때만)
export function crossCheck(mine: number | null, others: number[], gap: number) {
  if (mine == null || others.length < 2) return { flagged: false, median: others.length ? median(others) : null };
  const m = median(others);
  return { flagged: mine < m - gap, median: m };
}
