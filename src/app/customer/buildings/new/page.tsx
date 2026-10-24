import type { Metadata } from "next";
import Link from "next/link";
import { WINDOW_AREA_RATIO } from "@/config/building";
import { RegisterFlow } from "./RegisterFlow";

export const metadata: Metadata = { title: "내 건물 등록" };

export default async function NewBuildingPage(props: PageProps<"/customer/buildings/new">) {
  const { address } = await props.searchParams;
  return (
    <div className="pt-2">
      <Link href="/customer/diagnosis" className="text-sm text-muted">‹ 내 집 진단</Link>
      <p className="mt-4 text-sm font-semibold text-forest-700">1단계 · 건물 정보</p>
      <h1 className="mt-1 text-2xl font-extrabold">어느 건물을 고치고 싶으세요?</h1>
      <p className="mt-1 mb-6 text-muted">주소만 넣으면 건축물대장 정보를 불러와요.</p>
      <RegisterFlow defaultAddress={typeof address === "string" ? address : ""} windowRatio={WINDOW_AREA_RATIO} />
    </div>
  );
}
