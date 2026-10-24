import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui";

export const metadata: Metadata = { title: "입찰 공고" };

export default function Page() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-extrabold">입찰 공고</h1>
      <ComingSoon milestone={5} title="입찰 공고 화면을 준비하고 있어요" items={["지도·리스트로 내 권역 공고 보기", "공종·규모·마감일·입찰방식 필터", "참가 자격 자동 확인"]} />
    </div>
  );
}
