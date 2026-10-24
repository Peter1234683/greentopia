// 다른 건물주 위치는 약 100m 단위로 흐리게 보여준다 (개인정보 보호)
export const blur = (v: number) => Math.round(v * 1000) / 1000;
