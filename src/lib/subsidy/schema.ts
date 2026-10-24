// 지원금 DB(SubsidyProgram)의 JSON 필드 구조. 관리자 입력과 매칭 엔진이 같은 스키마를 쓴다.
import { z } from "zod";

export const conditionsSchema = z
  .object({
    minImprovementPct: z.number().min(0).max(100).optional(), // 에너지 성능개선률 최소
    preferentialImprovementPct: z.number().min(0).max(100).optional(), // 이 이상이면 우대
    preferentialBeneficiaries: z.array(z.string()).optional(), // 우대 대상자 유형
    requiresEnergyWork: z.boolean().optional(), // 창호·단열·보일러 등 에너지 성능 공사 필요
    approvalBefore: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // 사용승인일 요건 (공고에 있을 때만)
    minAgeYears: z.number().int().min(0).optional(),
    detachedSimpleEvaluation: z.boolean().optional(), // 단독주택 간이평가표 안내
  })
  .strict();

export const benefitSchema = z
  .object({
    interestSupportPct: z.object({ general: z.number().min(0).max(20), preferential: z.number().min(0).max(20).optional() }).optional(),
    loanLimit: z.record(z.string(), z.number().int().min(0)).optional(), // 집 유형별 대출 한도 (원)
    maxRepayYears: z.number().int().min(1).max(30).optional(),
    grantAmount: z.number().int().min(0).optional(), // 정액 보조금
    grantRatioPct: z.number().min(0).max(100).optional(), // 공사비 대비 보조 비율
    grantCap: z.number().int().min(0).optional(),
    services: z.array(z.string()).optional(), // 비금전 지원 (컨설팅 등)
  })
  .strict();

export type Conditions = z.infer<typeof conditionsSchema>;
export type Benefit = z.infer<typeof benefitSchema>;

export function parseConditions(json: string): Conditions {
  try {
    return conditionsSchema.parse(JSON.parse(json || "{}"));
  } catch {
    return {};
  }
}
export function parseBenefit(json: string): Benefit {
  try {
    return benefitSchema.parse(JSON.parse(json || "{}"));
  } catch {
    return {};
  }
}
