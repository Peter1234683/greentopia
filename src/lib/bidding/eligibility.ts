// 입찰 참가 자격(PQ) 확인 — 통과/탈락 게이트 (점수 아님). 순수 함수.
import { COMPLAINT_TAGS, TRADE_LABEL, type Trade } from "@/lib/constants";

export type EligContractor = {
  id: string;
  reviewStatus: string;
  grRegistered: boolean;
  constructionLicense: string | null;
  warrantyAvailable: boolean;
  recentSanction: boolean;
  techStaffCount: number;
  externalProjectCount: number;
  trades: string[];
  regions: string[]; // 시군구 또는 "전체"
  platformProjects: number; // 플랫폼 완료 공사 수
  reviewCount: number;
  tagCounts: Record<string, number>; // 리뷰 불만 태그 빈도
};

export type EligTender = {
  method: string;
  trade: string;
  sigungu: string;
  qualification: { minProjects?: number; regionOnly?: boolean; minTechStaff?: number; contractorId?: string; expandedRegion?: boolean } | null;
  nominatedIds: string[];
};

export type PQRuleLite = { id: string; name: string; kind: string; params: Record<string, unknown>; action: string; active: boolean };

export type Eligibility = { eligible: boolean; failures: string[]; warnings: string[] };

const tagLabel = (code: string) => COMPLAINT_TAGS.find((t) => t.code === code)?.label ?? code;

export function checkEligibility(c: EligContractor, t: EligTender, rules: PQRuleLite[]): Eligibility {
  const failures: string[] = [];
  const warnings: string[] = [];
  if (c.reviewStatus !== "APPROVED") failures.push("가입 심사 승인 후 참여할 수 있어요");
  if (!c.trades.includes(t.trade)) failures.push(`${TRADE_LABEL[t.trade as Trade]} 공종 등록이 필요해요`);

  for (const r of rules.filter((r) => r.active)) {
    let hit = false;
    let msg = "";
    switch (r.kind) {
      case "REQUIRE_GR":
        hit = !c.grRegistered;
        msg = "GR 사업자 등록 필요";
        break;
      case "REQUIRE_LICENSE":
        hit = !c.constructionLicense;
        msg = "공종 면허·등록 필요";
        break;
      case "REQUIRE_WARRANTY":
        hit = !c.warrantyAvailable;
        msg = "하자보증 가능 업체만 참여할 수 있어요";
        break;
      case "NO_SANCTION":
        hit = c.recentSanction;
        msg = "최근 행정처분·부실시공 이력";
        break;
      case "COMPLAINT_TAG_RATIO": {
        const tag = String(r.params.tag);
        const ratio = Number(r.params.ratio ?? 0.3);
        const minReviews = Number(r.params.minReviews ?? 3);
        const share = c.reviewCount ? (c.tagCounts[tag] ?? 0) / c.reviewCount : 0;
        hit = c.reviewCount >= minReviews && share >= ratio;
        msg = `리뷰 불만 '${tagLabel(tag)}' 비율 ${Math.round(share * 100)}% (기준 ${Math.round(ratio * 100)}%)`;
        break;
      }
    }
    if (hit) (r.action === "WARN" ? warnings : failures).push(r.action === "WARN" ? `주의: ${msg}` : `참가 자격 미충족: ${msg}`);
  }

  const inRegion = c.regions.includes("전체") || c.regions.includes(t.sigungu);
  const q = t.qualification ?? {};
  switch (t.method) {
    case "RESTRICTED":
      if ((q.minProjects ?? 0) > c.platformProjects + c.externalProjectCount)
        failures.push(`제한경쟁 조건: 시공 실적 ${q.minProjects}건 이상`);
      if (q.regionOnly && !inRegion) failures.push(`제한경쟁 조건: ${t.sigungu} 권역 업체`);
      if ((q.minTechStaff ?? 0) > c.techStaffCount) failures.push(`제한경쟁 조건: 기술인력 ${q.minTechStaff}명 이상`);
      break;
    case "NOMINATED":
      if (!t.nominatedIds.includes(c.id)) failures.push("지명경쟁: 지명된 업체만 참여할 수 있어요");
      break;
    case "NEGOTIATED":
      if (q.contractorId !== c.id) failures.push("수의계약: 지정된 업체만 참여할 수 있어요");
      break;
    default:
      if (!inRegion && !q.expandedRegion) warnings.push("내 활동 권역 밖의 공고예요");
  }
  return { eligible: failures.length === 0, failures, warnings };
}
