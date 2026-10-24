import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui";

export const metadata: Metadata = { title: "내 공사" };

export default function Page() {
  return (
    <div className="pt-2">
      <h1 className="mb-4 text-2xl font-extrabold">내 공사</h1>
      <ComingSoon milestone={7} title="내 공사 화면을 준비하고 있어요" items={["공동견적 비교와 업체 선택", "공사 진행 타임라인", "지원사업 안내"]} />
    </div>
  );
}
