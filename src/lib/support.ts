// 지원사업 요건 대조 (규칙 기반). RAG 기반 안내는 추후 이 자리를 대체한다.
import type { SupportSettings } from "@/config/support";
import { USAGE_LABEL } from "./constants";

export type SupportCheck = { name: string; eligible: boolean; checks: { label: string; ok: boolean }[]; infoUrl: string };

const ENVELOPE_TRADES = ["WINDOW", "EXT_INSULATION", "INT_INSULATION", "ROOF"];

export function checkSupports(b: { approvalDate: Date | null; usage: string }, trades: string[], s: SupportSettings): SupportCheck[] {
  const is = s.interestSupport;
  const before = new Date(`${is.approvalBefore}T00:00:00+09:00`);
  const interestChecks = [
    // 사용승인일 요건이 설정된 경우에만 확인 (2026 공고 기준 미확인 → 기본값은 제한 없음)
    ...(before.getFullYear() < 2100
      ? [{ label: `사용승인일 ${is.approvalBefore.replace(/-/g, ".")} 이전`, ok: !!b.approvalDate && b.approvalDate < before }]
      : []),
    { label: `대상 용도 (${is.eligibleUsages.map((u) => USAGE_LABEL[u]).join("·")})`, ok: is.eligibleUsages.includes(b.usage) },
    ...(is.requiresEnergyImprovement
      ? [{ label: "에너지 성능 개선 공사(창호·단열·지붕) 포함", ok: trades.some((t) => ENVELOPE_TRADES.includes(t)) }]
      : []),
  ];
  const age = b.approvalDate ? new Date().getFullYear() - b.approvalDate.getFullYear() : 0;
  const consultChecks = [{ label: `지은 지 ${s.consulting.minAgeYears}년 이상`, ok: age >= s.consulting.minAgeYears }];
  return [
    { name: is.name, eligible: interestChecks.every((c) => c.ok), checks: interestChecks, infoUrl: is.infoUrl },
    { name: s.consulting.name, eligible: consultChecks.every((c) => c.ok), checks: consultChecks, infoUrl: s.consulting.infoUrl },
  ];
}
