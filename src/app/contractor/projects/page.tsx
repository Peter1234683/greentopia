import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui";

export const metadata: Metadata = { title: "시공 관리" };

export default function Page() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-extrabold">시공 관리</h1>
      <ComingSoon milestone={7} title="시공 관리 화면을 준비하고 있어요" items={["건물별 계약 현황", "시공 일정 캘린더와 동선 지도", "완료 보고"]} />
    </div>
  );
}
