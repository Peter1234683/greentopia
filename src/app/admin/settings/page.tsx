import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getSettings, SETTINGS_SECTIONS } from "@/lib/settings";
import { SettingsEditor } from "./SettingsEditor";

export const metadata: Metadata = { title: "설정" };

const META: Record<string, [string, string]> = {
  matching: ["AI 매칭", "Hard Filter 반경·시기, 적합도 가중치(합 100), Cluster 최소·최대 동수, 공고 생성 기준"],
  pricing: ["가격 가정치", "공종별 개별 발주 단가, 유형·규격 보정, 공동발주 할인 가정치, 실제 낙찰가 전환 표본 수"],
  bidding: ["입찰 제도", "공고 기간, 유찰 기준, 입찰 방식 추천 규칙, 종합평가 배점, 덤핑 기준, 수의계약 경고선, 담합 감시 기준"],
  reputation: ["평판 · 등급", "별점 가중치, 최근 가중, 불만 태그 감점, 새싹 트랙, 등급 기준, PQ 후보 기준, 리뷰 포인트"],
  support: ["지원사업", "이자지원·무료 컨설팅 요건과 예시 계산 가정치"],
};

export default async function SettingsPage() {
  const [settings, rows, benefits] = await Promise.all([getSettings(), db.config.findMany(), db.benefit.findMany({ orderBy: { grade: "asc" } })]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">설정</h1>
        <p className="mt-1 text-sm text-muted">
          확정되지 않은 수치는 모두 이곳의 가정치로 관리해요. 저장하면 바로 반영되고, 코드 기본값(src/config)은 그대로 남아요.
          에너지 간이 진단 계수는 src/config/diagnosis.ts 에서 관리해요.
        </p>
      </div>
      {SETTINGS_SECTIONS.map((s) => (
        <SettingsEditor
          key={s}
          section={s}
          title={META[s][0]}
          desc={META[s][1]}
          json={JSON.stringify(settings[s], null, 2)}
          overridden={rows.some((r) => r.key === s)}
        />
      ))}
      <section className="rounded-2xl bg-white p-4 ring-1 ring-line/60">
        <p className="font-bold">등급별 혜택</p>
        <ul className="mt-2 space-y-1 text-sm">
          {benefits.map((b) => <li key={b.id}><span className="inline-block w-24 text-muted">{b.grade}</span>{b.description}</li>)}
        </ul>
      </section>
    </div>
  );
}
