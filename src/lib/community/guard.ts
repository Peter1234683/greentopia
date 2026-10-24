// 사업자 라운지 담합 방지: 진행 중 입찰 번호·가격 합의로 보이는 표현 감지 (키워드 규칙, 순수 함수)
// 감지되면 게시를 보류하고 운영자가 검토한다. 일반적인 자재·기술 이야기는 막지 않는다.
const RULES: { re: RegExp; why: string }[] = [
  { re: /(cluster|클러스터)\s*#?\s*\d+/i, why: "입찰 묶음 번호" },
  { re: /(공고|입찰)\s*(번호)?\s*#\s*\d+/, why: "입찰 공고 번호" },
  { re: /#\s*\d+\s*(번)?\s*(건|공고|입찰)/, why: "입찰 공고 번호" },
  { re: /\d[\d,.]*\s*(만|천)?\s*원?\s*(대)?\s*(에|으로|로)\s*(넣|쓰|맞추|투찰|들어가|가자|하자)/, why: "입찰 금액 맞추기" },
  { re: /(㎡|m2|㎥|평|ea|대)\s*당\s*\d[\d,.]*\s*(만|천)?\s*원?\s*(대)?\s*(에|으로|로)?\s*(넣|쓰|맞추|투찰|가자|하자)/i, why: "단가 맞추기" },
  { re: /(입찰가|투찰가|투찰|낙찰가)\s*(를|은|는|좀|다들|얼마)/, why: "입찰가 논의" },
  { re: /(얼마|몇)\s*(에|으로)?\s*(넣|쓰|투찰)/, why: "입찰가 논의" },
  { re: /(들러리|나눠\s*먹|순번\s*(정|돌)|담합|짜고\s*(하|들어))/, why: "담합 의심 표현" },
  { re: /(이번|이)\s*(건|공고|입찰)\s*(은|는)?\s*(빠져|양보|안\s*들어)/, why: "입찰 참여 조율" },
];

export function detectBidTalk(text: string) {
  const hits: { why: string; match: string }[] = [];
  for (const r of RULES) {
    const m = r.re.exec(text);
    if (m) hits.push({ why: r.why, match: m[0].trim() });
  }
  return { hit: hits.length > 0, hits };
}

export function holdReasonOf(hits: { why: string; match: string }[]) {
  return `진행 중 입찰 정보로 보이는 표현이 감지됐어요 (${hits.map((h) => `${h.why}: "${h.match}"`).join(", ")})`;
}
