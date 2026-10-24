import { Badge } from "@/components/ui";
import { TENDER_METHOD_LABEL } from "@/lib/constants";

export function MethodBadge({ method }: { method: string }) {
  const tone = method === "OPEN" ? "mint" : method === "RESTRICTED" ? "warn" : method === "NOMINATED" ? "forest" : "danger";
  return <Badge tone={tone}>{TENDER_METHOD_LABEL[method] ?? method}</Badge>;
}

export function dDay(deadline: Date) {
  const days = Math.ceil((deadline.getTime() - Date.now()) / 864e5);
  if (days < 0) return "마감";
  if (days === 0) return "오늘 마감";
  return `D-${days}`;
}

export function qtyText(amount: number, unit: string) {
  return `${Math.round(amount).toLocaleString("ko-KR")}${unit}`;
}
