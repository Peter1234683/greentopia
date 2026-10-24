import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui";

export const metadata: Metadata = { title: "내 집 진단" };

export default function Page() {
  return (
    <div className="pt-2">
      <h1 className="mb-4 text-2xl font-extrabold">내 집 진단</h1>
      <ComingSoon milestone={2} title="내 집 진단 화면을 준비하고 있어요" items={["건축물대장으로 건물 정보 불러오기", "생활 언어 질문으로 필요한 공사 찾기", "간이 에너지 진단 · GR-AI 정밀 시뮬레이션 연결"]} />
    </div>
  );
}
