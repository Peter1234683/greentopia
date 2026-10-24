// 사진 진단 (F4): AI 응답 스키마 · 규칙 기반 결과 · 비용/지원금/공동시공 보강 (순수 함수)
import { z } from "zod";
import { INSULATION_STANDARDS, JOINT_FRIENDLY, NOTE_KEYWORDS, PART_TRADES } from "@/config/photoDiagnosis";
import type { PricingSettings } from "@/config/pricing";
import { soloEstimate, type QuantityBuilding } from "@/lib/pricing";
import { PHOTO_PARTS, TRADES, TRADE_LABEL, STRUCTURE_LABEL, USAGE_LABEL, type Trade } from "@/lib/constants";

const PART_CODES = PHOTO_PARTS.map((p) => p.code) as [string, ...string[]];

// AI 가 채우는 부분. 비용·지원금·공동시공 여부는 AI 가 아니라 설정값으로 계산해 덧붙인다.
export const photoAiSchema = z.object({
  defects: z
    .array(
      z.object({
        part: z.enum(PART_CODES),
        observation: z.string().min(2).max(300),
        severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
        method: z.string().min(2).max(200),
      }),
    )
    .max(10),
  agingScore: z.number().int().min(0).max(100),
  recommendations: z
    .array(z.object({ trade: z.enum(TRADES), priority: z.number().int().min(1).max(5), why: z.string().min(2).max(200) }))
    .max(5),
  summary: z.string().min(5).max(800),
});
export type PhotoAi = z.infer<typeof photoAiSchema>;

export type PhotoInput = { part: string; note: string | null };
export type PhotoBuilding = QuantityBuilding & { usage: string; structure: string; approvalDate: Date | null };

export const ageOf = (b: { approvalDate: Date | null }, now = new Date()) =>
  b.approvalDate ? now.getFullYear() - b.approvalDate.getFullYear() : null;

export const PHOTO_SYSTEM = `당신은 한국 노후 소형 주거건물(단독·다가구·다세대) 그린리모델링 현장을 많이 본 점검 전문가입니다.
사진과 건물 정보를 보고 부위별 결함을 생활 언어로 설명하세요.
- 사진에서 실제로 보이는 것만 말하고, 보이지 않으면 "사진으로는 확인이 어려워요"라고 쓰세요.
- 열화상·측정값을 지어내지 마세요. 금액·지원금 액수는 쓰지 마세요.
- severity: LOW(지켜보기) / MEDIUM(1~2년 안 개선) / HIGH(빨리 점검)
- agingScore: 0(새 건물)~100(매우 노후)
- recommendations.trade 는 WINDOW, EXT_INSULATION, INT_INSULATION, BOILER, ROOF 중에서만 고르세요.`;

export function photoPrompt(b: PhotoBuilding, photos: PhotoInput[], memo: string) {
  const age = ageOf(b);
  return [
    `건물: ${USAGE_LABEL[b.usage] ?? b.usage}, ${STRUCTURE_LABEL[b.structure] ?? b.structure}, ${age != null ? `지은 지 ${age}년` : "연식 모름"}, ${b.floors}층 ${b.households}세대, 연면적 ${Math.round(b.grossArea)}㎡`,
    `사진 ${photos.length}장 (순서대로): ${photos.map((p, i) => `${i + 1}) ${PHOTO_PARTS.find((x) => x.code === p.part)?.label ?? p.part}${p.note ? ` - 메모: ${p.note}` : ""}`).join(" / ")}`,
    memo ? `집주인 메모: ${memo}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// 키가 없거나 AI 실패 시: 연식·구조·메모 키워드 기반 추정. 사진을 판독했다고 말하지 않는다.
export function rulePhotoDiagnosis(b: PhotoBuilding, photos: PhotoInput[], memo: string): PhotoAi {
  const age = ageOf(b) ?? 30;
  const ageBase = age >= 35 ? 2 : age >= 25 ? 1 : 0;
  const defects = photos.map((p) => {
    const text = `${p.note ?? ""} ${memo}`;
    const hits = NOTE_KEYWORDS.filter((k) => k.re.test(p.note ?? ""));
    const memoHits = NOTE_KEYWORDS.filter((k) => k.re.test(memo) && !hits.includes(k));
    const score = ageBase + hits.reduce((s, k) => s + k.weight, 0) + (memoHits.length ? 1 : 0) + (b.structure === "BRICK" || b.structure === "MASONRY" ? 0.5 : 0);
    const severity = score >= 4 ? "HIGH" : score >= 2 ? "MEDIUM" : "LOW";
    const label = PHOTO_PARTS.find((x) => x.code === p.part)?.label ?? "기타";
    const found = [...hits, ...memoHits].map((k) => k.label);
    const observation = found.length
      ? `메모에 적어주신 ${found.join("·")} 증상과 ${age}년 된 건물 연식을 함께 보면 ${label} 쪽 점검이 필요해 보여요.`
      : `${age}년 된 건물의 ${label}는 이 시기 단열 기준을 고려하면 성능이 떨어졌을 가능성이 있어요.`;
    const method =
      p.part === "WINDOW" ? "기밀·단열 성능이 좋은 이중창으로 교체, 창틀 주변 틈 실링"
      : p.part === "WALL" ? (/곰팡이|결로/.test(text) ? "결로 원인 확인 후 외단열(가능하면) 또는 내단열 + 환기 개선" : "외단열 또는 내단열 보강")
      : p.part === "CEILING" ? "천장·지붕층 단열 보강, 누수 흔적이 있으면 방수 먼저"
      : p.part === "ROOF" ? "옥상 방수·단열 보강"
      : p.part === "BOILER" ? "고효율(콘덴싱) 보일러 교체 검토, 배기·가스 연결은 전문가 점검"
      : "현장 확인 후 판단";
    return { part: p.part, observation, severity: severity as "LOW" | "MEDIUM" | "HIGH", method };
  });
  const weight = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  const tradeScore = new Map<string, number>();
  for (const d of defects) for (const t of PART_TRADES[d.part] ?? []) tradeScore.set(t, Math.max(tradeScore.get(t) ?? 0, weight[d.severity]));
  const recommendations = [...tradeScore.entries()]
    .sort((a, b2) => b2[1] - a[1])
    .slice(0, 4)
    .map(([trade, s], i) => ({ trade: trade as Trade, priority: Math.min(5, i + 1), why: s >= 3 ? "증상이 뚜렷해 먼저 손보면 좋아요" : s === 2 ? "1~2년 안에 개선을 권해요" : "다른 공사와 함께 검토해요" }));
  const agingScore = Math.max(0, Math.min(100, Math.round(age * 1.8 + defects.filter((d) => d.severity === "HIGH").length * 6)));
  return {
    defects,
    agingScore,
    recommendations,
    summary: `연식(${age}년)·구조와 적어주신 메모를 기준으로 한 규칙 기반 추정이에요. 사진 판독은 AI 연결 시 제공돼요. ${recommendations[0] ? `우선 ${TRADE_LABEL[recommendations[0].trade]}부터 점검해보세요.` : ""}`.trim(),
  };
}

export type PhotoRecommendation = PhotoAi["recommendations"][number] & {
  cost: { low: number; high: number };
  subsidyPossible: boolean;
  joint: string | null;
};
export type PhotoResult = Omit<PhotoAi, "recommendations"> & { recommendations: PhotoRecommendation[] };

// 비용 범위(가정 단가) · 지원사업 대상 가능성(에너지 성능 공사인지) · 공동시공 규격 안내를 덧붙인다.
export function enrichPhotoResult(ai: PhotoAi, b: PhotoBuilding, pricing: PricingSettings, energyTrades: readonly string[] = TRADES): PhotoResult {
  const seen = new Set<string>();
  const recs = ai.recommendations
    .filter((r) => !seen.has(r.trade) && seen.add(r.trade))
    .sort((x, y) => x.priority - y.priority)
    .map((r) => ({
      ...r,
      cost: soloEstimate(b, r.trade, pricing),
      subsidyPossible: energyTrades.includes(r.trade),
      joint: JOINT_FRIENDLY[r.trade] ?? null,
    }));
  return { ...ai, recommendations: recs };
}

// 준공 당시 단열 기준 vs 현행 기준 (연식 기반, 가정치)
export function standardsCompare(b: { approvalDate: Date | null }) {
  const year = b.approvalDate?.getFullYear() ?? null;
  if (year == null) return null;
  const era = INSULATION_STANDARDS.eras.find((e) => year <= e.until)!;
  const cur = INSULATION_STANDARDS.current;
  const times = (v: number | null, c: number) => (v == null ? null : Math.round((v / c) * 10) / 10);
  return { year, era, current: cur, wallTimes: times(era.wall, cur.wall), windowTimes: times(era.window, cur.window) };
}
