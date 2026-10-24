// AI 공동공사 매칭 설정 (가중치는 이후 실제 데이터로 학습·조정할 수 있도록 설정값으로 둔다)
export const MATCHING_DEFAULTS = {
  // STEP 1 Hard Filter
  radiusKm: 3,
  timingMonths: 2, // 희망 시기 ±N개월
  excludedIntents: ["NO"], // "혼자 진행할래요" 는 매칭에서 제외
  // 유사 공종 호환도 (같은 공종 = 1). 이 값 이상이면 같은 Cluster 후보로 본다
  tradeCompat: {
    "EXT_INSULATION|ROOF": 0.6,
    "INT_INSULATION|WINDOW": 0.5,
  } as Record<string, number>,
  similarTradeMin: 0.6,
  // STEP 2 적합도 점수 (합계 100)
  weights: { trade: 30, distance: 20, timing: 20, scale: 10, volume: 10, condition: 10 },
  // STEP 3 Cluster 구성
  edgeThreshold: 65, // 이 점수 이상인 쌍만 연결
  minClusterSize: 4,
  maxClusterSize: 12,
  minJoinedForTender: 4, // 참여 확정 건물이 이 수 이상이면 입찰 공고 초안 생성

  // STEP 1 Hard Filter 추가: 건물 구조 호환 (공종별로 같은 그룹끼리만 묶는다, 가정치)
  structureGroups: {
    WINDOW: [["BRICK", "MASONRY"], ["RC", "STEEL", "WOOD", "OTHER"]],
    EXT_INSULATION: [["BRICK", "MASONRY", "RC", "OTHER"], ["WOOD", "STEEL"]],
  } as Record<string, string[][]>,
  structureReason: {
    WINDOW: "조적조(벽돌)는 창틀 고정 방식이 달라 별도 그룹으로 묶어요",
    EXT_INSULATION: "목조·철골은 단열재 고정 방식이 달라 별도 그룹으로 묶어요",
  } as Record<string, string>,
  // STEP 1 Hard Filter 추가: 자재 규격 호환 (규격 등급 차이가 maxGap 을 넘으면 같은 묶음 불가, 가정치)
  specClasses: {
    BOILER: { by: "areaPerHousehold", bounds: [85, 135], maxGap: 1, label: "세대 면적에 맞는 보일러 용량" },
    EXT_INSULATION: { by: "floors", bounds: [4], maxGap: 0, label: "5층 이상은 비계·외단열 자재 규격" },
  } as Record<string, { by: "areaPerHousehold" | "floors"; bounds: number[]; maxGap: number; label: string }>,
  // 대기 풀: 거리·시기가 이만큼만 벗어나면 "조건이 바뀌면 합류 가능" 후보로 보여준다
  waitlistSlack: { km: 1.5, months: 2 },
  algorithmNote:
    "적합도 점수가 기준 이상인 이웃끼리만 연결하고, 모든 구성원이 서로 조건을 만족하도록(완전 연결) 한 명씩 붙여요. 동네 단위의 작은 데이터에서도 결과를 설명하기 쉬워 이 방식을 써요.",

  // 비용 구성 분해 (매칭 설명 화면, 가정치). 개별 발주 총액을 4개 요소로 나누고 공동시공 효과를 요소별로 적용한다.
  costModel: {
    shares: { material: 0.5, labor: 0.3, logistics: 0.08, fixed: 0.12 },
    laborSavingPerBuilding: 0.03, // 연속 시공으로 1동 늘 때마다 인건비 절감 (상한까지)
    laborSavingMax: 0.12,
    logisticsExponent: 0.5, // 이동·물류비: n동이 나누면 1/n^0.5 배
    fixedOverheadGrowth: 0.15, // 고정비(사다리차·비계)는 1동 늘 때마다 15%씩 늘고 n동이 나눈다
  },

  // 수요 지도 (개인정보: 정확한 위치 대신 격자 단위, 너무 적은 칸은 숨김)
  demandMap: { gridDeg: 0.004, minCellCount: 2 },
};
export type MatchingSettings = typeof MATCHING_DEFAULTS;
