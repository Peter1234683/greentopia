// 화면 표시용 포맷 도우미 (서버·클라이언트 공용)

export function won(n: number | null | undefined) {
  if (n == null) return "-";
  if (n >= 1e8) return `${(n / 1e8).toFixed(n % 1e8 === 0 ? 0 : 1)}억 원`;
  if (n >= 1e4) return `${Math.round(n / 1e4).toLocaleString("ko-KR")}만 원`;
  return `${n.toLocaleString("ko-KR")}원`;
}

export function monthLabel(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

export function monthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function buildingAge(approvalDate: Date | string | null | undefined) {
  if (!approvalDate) return null;
  const d = typeof approvalDate === "string" ? new Date(approvalDate) : approvalDate;
  return new Date().getFullYear() - d.getFullYear();
}

export function dateValue(date: Date | null | undefined) {
  if (!date) return "";
  // KST 기준 YYYY-MM-DD
  return new Date(date.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
}
