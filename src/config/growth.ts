// 이웃 초대 (F6) 설정값. 보상은 리뷰 포인트와 같은 포인트 체계를 쓴다 (가정치, 현금성 혜택 아님).
export const GROWTH_DEFAULTS = {
  invite: {
    rewardPoints: 3000, // 초대받은 이웃이 공사 수요를 등록하면 초대한 사람에게
    maxRewardsPerInviter: 10,
  },
};
export type GrowthSettings = typeof GROWTH_DEFAULTS;
