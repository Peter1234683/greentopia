// 리모델링 성공 가이드 (F5): AI 응답 스키마 · 규칙 기반 가이드 · 전문가 확인 표시 강제 (순수 함수)
import { z } from "zod";
import { EXPERT_CHECK_RE, GUIDE_STRATEGIES, type GuideStrategy } from "@/config/photoDiagnosis";
import { STRUCTURE_LABEL, TRADE_LABEL, USAGE_LABEL, type Trade } from "@/lib/constants";

export const guideSchema = z.object({
  structure: z.object({ traits: z.array(z.string().min(2).max(200)).min(1).max(5), weakPoints: z.array(z.string().min(2).max(200)).min(1).max(5) }),
  hiddenRisks: z.array(z.object({ risk: z.string().min(2).max(200), response: z.string().min(2).max(300) })).min(1).max(6),
  keys: z.array(z.string().min(2).max(200)).length(4),
  checklist: z
    .array(
      z.object({
        phase: z.enum(["BEFORE", "DURING", "AFTER"]),
        title: z.string().min(2).max(120),
        importance: z.enum(["HIGH", "MEDIUM", "LOW"]),
        expertCheck: z.boolean(),
      }),
    )
    .min(3)
    .max(18),
  finalAdvice: z.string().min(5).max(800),
});
export type Guide = z.infer<typeof guideSchema>;

export const PHASE_LABEL = { BEFORE: "착공 전", DURING: "시공 중", AFTER: "준공 후" } as const;
export const IMPORTANCE_LABEL = { HIGH: "중요", MEDIUM: "보통", LOW: "참고" } as const;

export type GuideBuilding = { usage: string; structure: string; age: number | null; floors: number; households: number };

export const GUIDE_SYSTEM = `당신은 한국 노후 소형 주거건물 그린리모델링 감리 경험이 많은 전문가입니다. 집주인에게 생활 언어로 맞춤 가이드를 써주세요.
- 금액·지원금 액수·할인율·법 조항 번호를 지어내지 마세요.
- 전기·가스·비계·고소작업·석면 의심 자재·구조 관련 항목은 expertCheck=true 로 표시하세요.
- keys 는 정확히 4개, checklist 는 착공 전(BEFORE)·시공 중(DURING)·준공 후(AFTER)를 모두 포함하세요.`;

export function guidePrompt(b: GuideBuilding, strategy: GuideStrategy, trades: string[], findings: string[]) {
  const s = GUIDE_STRATEGIES.find((x) => x.code === strategy)!;
  return [
    `전략: ${s.label} — ${s.desc}`,
    `건물: ${USAGE_LABEL[b.usage] ?? b.usage}, ${STRUCTURE_LABEL[b.structure] ?? b.structure}, ${b.age != null ? `${b.age}년 차` : "연식 모름"}, ${b.floors}층 ${b.households}세대`,
    `희망·추천 공사: ${trades.map((t) => TRADE_LABEL[t as Trade] ?? t).join(", ") || "미정"}`,
    findings.length ? `진단에서 나온 내용: ${findings.join(" / ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// AI 가 빠뜨려도 위험 항목은 "전문가 확인 필요"로 표시한다.
export function enforceExpertCheck(g: Guide): Guide {
  return { ...g, checklist: g.checklist.map((c) => ({ ...c, expertCheck: c.expertCheck || EXPERT_CHECK_RE.test(c.title) })) };
}

const OLD_MASONRY = (b: GuideBuilding) => b.structure === "BRICK" || b.structure === "MASONRY";

export function ruleGuide(b: GuideBuilding, strategy: GuideStrategy, trades: string[]): Guide {
  const age = b.age ?? 30;
  const has = (t: string) => trades.includes(t);
  const traits = [
    `${USAGE_LABEL[b.usage] ?? "주택"}은 ${b.usage === "DETACHED" ? "지붕·바닥으로 빠지는 열 비중이 커요" : "세대마다 쓰는 방식이 달라 일정·소음 조율이 중요해요"}.`,
    OLD_MASONRY(b) ? "벽돌(조적) 구조는 벽 자체가 무게를 받쳐서, 창 크기를 키우거나 벽을 뚫는 공사에 제약이 있어요." : "철근콘크리트 구조는 외단열·창호 고정이 비교적 수월해요.",
    `${age}년 차 건물은 지어질 당시 단열 기준이 지금보다 훨씬 느슨했어요.`,
  ];
  const weakPoints = [
    "창틀 주변·벽과 천장 모서리에 결로와 곰팡이가 생기기 쉬워요.",
    age >= 30 ? "오래된 배관·전기 배선이 함께 노후했을 수 있어요." : "창호 기밀(틈새)이 약해져 외풍이 생겼을 수 있어요.",
    ...(b.floors >= 3 ? ["3층 이상은 외부 작업에 비계나 고소작업차가 필요해요."] : []),
  ];
  const hiddenRisks = [
    { risk: "기존 마감을 뜯었더니 벽 속 곰팡이·누수 흔적 발견", response: "공사 전 '숨은 하자 발견 시 처리 방법과 추가비 기준'을 계약서에 미리 적어두세요." },
    ...(age >= 30 ? [{ risk: "석면이 들어있을 수 있는 옛 자재(슬레이트·천장재)", response: "철거 전 석면 조사 여부를 업체에 확인하고, 의심되면 전문 업체 처리를 요청하세요." }] : []),
    ...(has("WINDOW") ? [{ risk: "창틀 철거 후 벽돌·몰탈이 약해 새 창 고정이 어려움", response: "실측 때 벽 상태 사진을 남기고, 보강 방법을 견적에 포함해 달라고 하세요." }] : []),
    ...(has("BOILER") ? [{ risk: "보일러 교체 시 배기 연통·가스 배관 규격이 맞지 않음", response: "가스 시공 자격이 있는 기사가 연결·기밀 점검을 하는지 확인하세요." }] : []),
    ...(has("EXT_INSULATION") ? [{ risk: "외단열 후 창 주변·배관 관통부 틈으로 빗물 유입", response: "관통부 마감(실링·후레싱) 방법을 시방에 적어두세요." }] : []),
  ];
  const keys =
    strategy === "COST"
      ? ["지원사업 신청 순서(공사 전 신청)를 먼저 확인하기", "이웃과 같은 규격으로 묶어 공동 발주하기", "효과 큰 공사(창호·단열) 먼저, 마감 공사는 나중에", "견적은 같은 규격으로 비교하기"]
      : strategy === "PERFORMANCE"
        ? ["창호·단열·환기를 한 번에 계획해 결로를 막기", "열교(창틀·모서리) 처리 방법을 시방에 명시", "보일러는 단열 후 줄어든 난방량에 맞춰 용량 선택", "준공 후 겨울 실내 온·습도를 기록해 효과 확인"]
        : ["외피(단열·창호) → 설비(보일러) 순서로 나누기", "다음 단계 공사와 겹치는 부분(창 주변 마감 등)을 미리 정리", "단계마다 사진·자재 기록 남기기", "단계 사이에 지원사업 공고 시기를 확인하기"];
  const checklist: Guide["checklist"] = [
    { phase: "BEFORE", title: "지원사업 신청 가능 여부·순서 확인 (공사 전 신청 필요 여부)", importance: "HIGH", expertCheck: false },
    { phase: "BEFORE", title: "같은 규격·물량 기준으로 견적 비교", importance: "HIGH", expertCheck: false },
    { phase: "BEFORE", title: "계약서에 공사 범위·자재 규격·하자보수 기간 적기", importance: "HIGH", expertCheck: false },
    { phase: "BEFORE", title: "세입자·이웃에게 공사 일정과 소음 안내", importance: "MEDIUM", expertCheck: false },
    ...(age >= 30 ? [{ phase: "BEFORE" as const, title: "석면 의심 자재 확인", importance: "HIGH" as const, expertCheck: true }] : []),
    ...(b.floors >= 3 || has("EXT_INSULATION") ? [{ phase: "DURING" as const, title: "비계·고소작업 안전시설(난간·안전망) 확인", importance: "HIGH" as const, expertCheck: true }] : []),
    { phase: "DURING", title: "반입 자재가 계약 규격과 같은지 라벨 사진 남기기", importance: "HIGH", expertCheck: false },
    { phase: "DURING", title: "철거 후 숨은 하자 발견 시 사진 기록 후 협의", importance: "MEDIUM", expertCheck: false },
    ...(has("BOILER") ? [{ phase: "DURING" as const, title: "보일러 가스 배관·배기 연통 연결 점검", importance: "HIGH" as const, expertCheck: true }] : []),
    ...(age >= 30 ? [{ phase: "DURING" as const, title: "노후 전기 배선·분전반 상태 확인", importance: "MEDIUM" as const, expertCheck: true }] : []),
    { phase: "AFTER", title: "창 주변·모서리 마감, 실링 상태 확인", importance: "HIGH", expertCheck: false },
    { phase: "AFTER", title: "하자보수 보증서·자재 인증서 받기", importance: "HIGH", expertCheck: false },
    { phase: "AFTER", title: "첫 겨울 결로·외풍 여부 기록 (A/S 근거)", importance: "MEDIUM", expertCheck: false },
    ...(strategy === "PHASED" ? [{ phase: "AFTER" as const, title: "다음 단계 공사 시기·예산 메모", importance: "LOW" as const, expertCheck: false }] : []),
  ];
  const finalAdvice =
    strategy === "COST"
      ? "꼭 필요한 공사부터 하되, 지원사업은 보통 공사 전에 신청해야 하니 공고문을 먼저 확인하세요. 이웃과 묶으면 고정비를 나눌 수 있어요."
      : strategy === "PERFORMANCE"
        ? "한 번에 여러 공사를 할수록 공정 간 연결부(창틀·관통부)가 성패를 가릅니다. 시방에 연결부 처리 방법을 꼭 적어두세요."
        : "나눠서 하더라도 전체 계획을 먼저 세우면 다시 뜯는 일을 줄일 수 있어요. 외피 → 설비 순서를 권해요.";
  return enforceExpertCheck({ structure: { traits, weakPoints }, hiddenRisks: hiddenRisks.slice(0, 6), keys, checklist, finalAdvice });
}
