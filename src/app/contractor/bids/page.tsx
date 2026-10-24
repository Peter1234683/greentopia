import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui";

export const metadata: Metadata = { title: "내 입찰" };

export default function Page() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-extrabold">내 입찰</h1>
      <ComingSoon milestone={5} title="내 입찰 화면을 준비하고 있어요" items={["물량 구간별 단가 입찰서 작성", "제출·평가 중·낙찰·탈락 상태와 항목별 점수"]} />
    </div>
  );
}
