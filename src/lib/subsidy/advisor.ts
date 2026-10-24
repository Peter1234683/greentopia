// 지원금 AI 상담: 근거 자료(RAG) 구성과 규칙 기반 템플릿 답변 — 순수 함수
import { BENEFICIARY_TYPES, USAGE_LABEL } from "@/lib/constants";
import { won } from "@/lib/format";
import type { MatchInput, matchProgram } from "./match";
import type { ProgramView } from "./service";

type Item = { program: ProgramView; match: ReturnType<typeof matchProgram> };

export const DISCLAIMER = "※ 실제 적용 여부는 공고문과 관할 기관 확인이 필요합니다.";

export const ADVISOR_SYSTEM = `당신은 그린토피아의 그린리모델링 지원금 상담 도우미입니다.
규칙:
- 아래 <근거자료>에 있는 지원사업과 매칭 결과만 근거로 답합니다. 근거자료에 없는 제도·조례·금리·한도·비율은 절대 지어내지 않습니다. 모르면 "등록된 정보에 없어요"라고 말하고 공고문·기관 확인을 권합니다.
- 혜택을 약속하지 않습니다. "해당 가능", "조건 확인 필요"처럼 매칭 결과의 표현을 씁니다.
- 건축 비전문가도 이해하는 쉬운 한국어로, 5문장 이내로 핵심만 답합니다.
- 근거로 쓴 지원사업 이름을 답변에 밝힙니다.
- 공고문 확인일이 없는 항목은 "공고문 확인이 필요한 정보"라고 함께 알립니다.`;

const ST = { ELIGIBLE: "해당 가능", CHECK: "조건 확인 필요", INELIGIBLE: "해당 없음" } as const;

export function buildContext(items: Item[], input: MatchInput) {
  const me = [
    `우리 집: ${input.sido} ${input.sigungu}, ${USAGE_LABEL[input.usage] ?? input.usage}, 사용승인 ${input.approvalDate ? input.approvalDate.getFullYear() + "년" : "모름"}`,
    `계획 공사: ${input.trades.join(", ") || "미입력"}`,
    `예상 성능개선률: ${input.improvementPct ? `${Math.round(input.improvementPct.low)}~${Math.round(input.improvementPct.high)}% (간이 진단)` : "진단 전"}`,
    `대상자 유형: ${input.beneficiaryTypes.map((b) => BENEFICIARY_TYPES.find((x) => x.code === b)?.label ?? b).join(", ") || "선택 안 함"}`,
  ].join("\n");
  const programs = items
    .map(({ program: p, match: m }) =>
      JSON.stringify({
        이름: p.name,
        기관: p.provider,
        지역: p.region,
        요약: p.summary,
        요건: p.conditions,
        혜택: p.benefit,
        신청절차: p.applySteps,
        신청기간: p.applyPeriod,
        출처: p.sourceUrl,
        출처설명: p.sourceNote,
        공고문확인일: p.verifiedAt ? p.verifiedAt.toISOString().slice(0, 10) : "미확인",
        우리집_매칭결과: ST[m.status],
        판단근거: m.reasons.map((r) => `${r.state === "ok" ? "충족" : r.state === "no" ? "미충족" : "확인 필요"}: ${r.label}`),
        우대여부: m.preferential ? `우대 (${m.prefReasons.join(", ")})` : "일반",
        적용_이자지원율: m.rate,
        우리집_대출한도: m.loanLimit,
      }),
    )
    .join("\n");
  return `${me}\n\n등록된 지원사업:\n${programs || "(없음)"}`;
}

export function sourcesFooter(items: Item[]) {
  const lines = items
    .filter((i) => i.program.sourceUrl || i.program.applyUrl)
    .map((i) => `- ${i.program.name}: ${i.program.sourceUrl ?? i.program.applyUrl}${i.program.verifiedAt ? "" : " (공고문 확인 필요)"}`);
  return `\n\n${DISCLAIMER}${lines.length ? `\n근거:\n${lines.join("\n")}` : ""}`;
}

// 키가 없을 때: 매칭 결과를 템플릿 문장으로 요약
export function ruleAnswer(question: string, items: Item[], input: MatchInput) {
  if (items.length === 0) return "아직 등록된 지원사업이 없어요. 운영자가 출처를 확인한 지원사업을 추가하면 알려드릴게요.";
  const q = question.replace(/\s/g, "");
  const main = items[0];
  if (/한도|얼마까지|대출/.test(q)) {
    const lines = items
      .filter((i) => i.program.benefit.loanLimit)
      .map((i) => `${i.program.name}: ${USAGE_LABEL[input.usage]} 대출 한도 ${i.match.loanLimit ? won(i.match.loanLimit) : "등록된 정보 없음"}${i.match.maxRepayYears ? `, 상환 최대 ${i.match.maxRepayYears}년` : ""}`);
    return lines.length ? `등록된 정보 기준으로 알려드려요.\n${lines.join("\n")}` : "등록된 지원사업에 대출 한도 정보가 없어요.";
  }
  if (/중복|같이받|함께받/.test(q)) {
    const ok = items.filter((i) => i.match.status !== "INELIGIBLE").map((i) => i.program.name);
    return `우리 집이 검토해 볼 수 있는 지원사업은 ${ok.join(", ") || "현재 없음"}이에요. 여러 사업을 함께 받을 수 있는지는 각 공고문에 정해져 있어서, 등록된 정보만으로는 판단할 수 없어요. 신청 전 관할 기관에 꼭 확인해 주세요.`;
  }
  if (/순서|절차|신청|어떻게/.test(q)) {
    const target = items.find((i) => i.match.status !== "INELIGIBLE") ?? main;
    return `${target.program.name} 신청 순서예요.\n${target.program.applySteps.map((s, i) => `${i + 1}. ${s}`).join("\n")}${target.program.applyPeriod ? `\n신청 기간: ${target.program.applyPeriod}` : ""}`;
  }
  // 기본: 대상 여부 요약
  return items
    .map(({ program: p, match: m }) => {
      const miss = m.reasons.filter((r) => r.state !== "ok").map((r) => r.label);
      const rate = m.rate != null ? ` 이자 지원 연 ${m.rate}%${m.preferential ? "(우대)" : "(일반)"} 기준이에요.` : "";
      return `${p.name}: ${ST[m.status]}.${rate}${miss.length ? ` 확인할 점: ${miss.join(" / ")}` : ""}`;
    })
    .join("\n");
}

export const SUGGESTED_QUESTIONS = ["우리 집이 이자지원 대상인가요?", "단독주택 대출 한도는?", "중복으로 받을 수 있는 지원은?", "신청 순서가 어떻게 되나요?"];
