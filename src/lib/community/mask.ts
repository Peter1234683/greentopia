// 이름 마스킹: 김그린 → 김*린, 이수 → 이*, 남궁민수 → 남**수
export function maskName(name: string) {
  const s = [...name.trim()];
  if (s.length <= 1) return s.join("") || "이웃";
  if (s.length === 2) return `${s[0]}*`;
  return `${s[0]}${"*".repeat(s.length - 2)}${s[s.length - 1]}`;
}

export function timeAgo(d: Date, now = new Date()) {
  const m = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}일 전`;
  return d.toLocaleDateString("ko-KR");
}

// 정확한 주소(지번·도로명 번호·동호수)로 보이는 표현. 게시판에는 동 단위까지만 쓰도록 막는다.
const EXACT_ADDRESS = [
  /\d+(-\d+)?\s*번지/,
  /[가-힣\d]+(로|길)\s?\d{1,4}(-\d{1,4})?(?![\d만천원%개년층평㎡분시일주월회번차명cmkm])/,
  /\d+\s*동\s*\d+\s*호/,
];
export function hasExactAddress(text: string) {
  return EXACT_ADDRESS.some((re) => re.test(text));
}
