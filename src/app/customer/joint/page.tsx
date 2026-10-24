import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui";

export const metadata: Metadata = { title: "공동공사" };

export default function Page() {
  return (
    <div className="pt-2">
      <h1 className="mb-4 text-2xl font-extrabold">공동공사</h1>
      <ComingSoon milestone={4} title="공동공사 화면을 준비하고 있어요" items={["혼자 할 때 vs 같이 할 때 비용 비교", "AI가 묶어 준 우리 동네 공동공사 Cluster", "공동견적 참여하기"]} />
    </div>
  );
}
