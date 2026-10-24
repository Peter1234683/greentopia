import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { simulateMatching } from "@/lib/matching/simulate";
import { Tuner } from "./Tuner";

export const metadata: Metadata = { title: "매칭 파라미터" };

export default async function MatchingTuner() {
  const s = (await getSettings()).matching;
  const initial = { radiusKm: s.radiusKm, timingMonths: s.timingMonths, minClusterSize: s.minClusterSize, edgeThreshold: s.edgeThreshold, weights: s.weights };
  const first = await simulateMatching(initial);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">매칭 파라미터 시뮬레이션</h1>
        <p className="mt-1 text-sm text-muted">반경·최소 동수·가중치를 바꿔 묶음 결과가 어떻게 달라지는지 바로 확인해요 (데모·운영 검토용). <Link href="/admin/settings" className="underline">설정으로 적용 ›</Link></p>
        <p className="mt-1 text-sm text-muted">왜 이 알고리즘? {s.algorithmNote}</p>
      </div>
      <Tuner initial={initial} first={first} />
    </div>
  );
}
