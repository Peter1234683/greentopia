// 입찰 방식 추천 (순수 함수). 최종 확정은 관리자.
import type { BiddingSettings } from "@/config/bidding";
import { TRADE_LABEL, type Trade } from "@/lib/constants";
import { won } from "@/lib/format";

export type RecommendInput = {
  trade: string;
  estimatedAmount: number;
  qualifiedCount: number; // 기본 PQ 통과 + 공종 업체 (전체)
  regionQualifiedCount: number; // 그중 Cluster 권역 업체
  failedRounds: number; // 이 Cluster 의 유찰 횟수
  buildingAges: number[]; // 참여 건물 연식
  nominationPool: { id: string; name: string; score: number }[]; // 상위 등급 + 자격 업체 (점수 내림차순)
};

export type Recommendation = {
  method: "OPEN" | "RESTRICTED" | "NOMINATED" | "NEGOTIATED";
  reasons: string[];
  qualification: Record<string, unknown> | null;
  nominatedIds: string[];
};

export function recommendMethod(i: RecommendInput, s: BiddingSettings): Recommendation {
  const reasons: string[] = [];
  if (i.failedRounds >= s.maxRoundsBeforeNegotiation) {
    reasons.push(`재공고까지 ${i.failedRounds}회 유찰되어 수의계약 전환을 검토할 수 있어요.`);
    reasons.push("수의계약은 직전 공고 상한을 넘을 수 없고, 전환 사유 공개와 건물주 승인이 필요해요.");
    return { method: "NEGOTIATED", reasons, qualification: null, nominatedIds: [] };
  }

  const oldCount = i.buildingAges.filter((a) => a >= s.riskyBuildingAge).length;
  const risky = i.buildingAges.length > 0 && oldCount / i.buildingAges.length >= s.riskyBuildingShare;
  if (i.regionQualifiedCount <= s.nominatedMaxQualified || risky) {
    const picks = i.nominationPool.slice(0, s.nominatedCount);
    if (picks.length >= s.minBidders) {
      if (i.regionQualifiedCount <= s.nominatedMaxQualified)
        reasons.push(`권역 내 자격 업체가 ${i.regionQualifiedCount}곳뿐이라 공개경쟁 시 유찰 위험이 높아요.`);
      if (risky) reasons.push(`${i.buildingAges.length}동 중 ${oldCount}동이 지은 지 ${s.riskyBuildingAge}년 이상이라 하자 위험이 커요.`);
      reasons.push(`평판 상위 등급 업체 ${picks.length}곳(${picks.map((p) => p.name).join(", ")})을 지명하는 지명경쟁을 추천해요.`);
      return { method: "NOMINATED", reasons, qualification: null, nominatedIds: picks.map((p) => p.id) };
    }
    reasons.push("지명할 상위 등급 업체가 부족해 공개경쟁으로 시작해요.");
  }

  const hard = s.hardTrades.includes(i.trade);
  const large = i.estimatedAmount >= s.largeClusterAmount;
  if ((hard || large) && i.regionQualifiedCount >= s.restrictedMinQualified) {
    if (hard) reasons.push(`${TRADE_LABEL[i.trade as Trade]}은 고난도 공종이에요.`);
    if (large) reasons.push(`예상 공사비가 ${won(i.estimatedAmount)}로 대형 Cluster예요.`);
    reasons.push(`권역 내 자격 업체가 ${i.regionQualifiedCount}곳으로 충분해 실적·권역·기술인력 조건을 둔 제한경쟁을 추천해요.`);
    return { method: "RESTRICTED", reasons, qualification: { ...s.restrictedConditions, minProjects: s.restrictedConditions.minPlatformOrExternalProjects }, nominatedIds: [] };
  }

  reasons.push(`일반 난이도 공종이고 자격 업체가 ${i.qualifiedCount}곳(권역 ${i.regionQualifiedCount}곳)이라 공개경쟁이 적합해요.`);
  return { method: "OPEN", reasons, qualification: null, nominatedIds: [] };
}
