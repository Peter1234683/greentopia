import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { generateGuide, importChecklist } from "@/app/actions/photo";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, Card, cx } from "@/components/ui";
import { GUIDE_STRATEGIES } from "@/config/photoDiagnosis";
import { guideSchema, IMPORTANCE_LABEL, PHASE_LABEL } from "@/lib/photo/guide";
import { parseJson } from "@/lib/constants";

export const metadata: Metadata = { title: "리모델링 성공 가이드" };

export default async function GuidePage(props: PageProps<"/customer/buildings/[id]/guide">) {
  const user = await requireRole("CUSTOMER");
  const { id } = await props.params;
  const { g } = await props.searchParams;
  const b = await db.building.findFirst({ where: { id, ownerId: user.id } });
  if (!b) notFound();
  const row = await db.successGuide.findFirst({
    where: { buildingId: b.id, ...(typeof g === "string" ? { id: g } : {}) },
    orderBy: { createdAt: "desc" },
  });
  const parsed = row ? guideSchema.safeParse(parseJson(row.contentJson, null)) : null;
  const guide = parsed?.success ? parsed.data : null;
  const strategy = GUIDE_STRATEGIES.find((s) => s.code === row?.strategy);
  const imported = row ? await db.checklistItem.count({ where: { guideId: row.id } }) : 0;

  return (
    <div className="space-y-5 pt-2">
      <Link href="/customer/diagnosis" className="text-sm text-muted">‹ 진단</Link>
      <div>
        <h1 className="text-2xl font-extrabold">📘 리모델링 성공 가이드</h1>
        <p className="mt-1 text-sm text-muted">{b.nickname ?? b.dong} 맞춤 가이드예요. 어떤 방향으로 진행할지 골라주세요.</p>
      </div>

      <form action={generateGuide} className="space-y-2">
        <input type="hidden" name="buildingId" value={b.id} />
        {GUIDE_STRATEGIES.map((s) => (
          <label key={s.code} className="flex cursor-pointer gap-3 rounded-2xl bg-white p-4 ring-1 ring-line has-[:checked]:bg-mint-50 has-[:checked]:ring-2 has-[:checked]:ring-mint-400">
            <input type="radio" name="strategy" value={s.code} defaultChecked={(row?.strategy ?? "COST") === s.code} className="mt-1 accent-forest-700" />
            <span>
              <span className="block font-bold">{s.label}</span>
              <span className="block text-sm text-muted">{s.desc}</span>
            </span>
          </label>
        ))}
        <SubmitButton pendingLabel="가이드를 만드는 중…" className="w-full">{guide ? "이 전략으로 다시 만들기" : "가이드 만들기"}</SubmitButton>
      </form>

      {guide && row && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="forest">{strategy?.label}</Badge>
            <Badge tone={row.source === "ai" ? "mint" : "gray"}>{row.source === "ai" ? "AI 참고 의견" : "규칙 기반 가이드"}</Badge>
            <span className="text-xs text-muted">{row.createdAt.toLocaleDateString("ko-KR")}</span>
          </div>

          <Card>
            <h2 className="font-bold">🏠 우리 집 구조 특성과 약한 곳</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{guide.structure.traits.map((t) => <li key={t}>{t}</li>)}</ul>
            <p className="mt-3 text-sm font-semibold text-warn">약한 곳</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{guide.structure.weakPoints.map((t) => <li key={t}>{t}</li>)}</ul>
          </Card>

          <Card>
            <h2 className="font-bold">🔎 뜯어보면 자주 나오는 숨은 리스크</h2>
            <ul className="mt-2 space-y-3 text-sm">
              {guide.hiddenRisks.map((h) => (
                <li key={h.risk}>
                  <p className="font-semibold">⚠️ {h.risk}</p>
                  <p className="text-muted">→ {h.response}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="bg-forest-900 text-white ring-0">
            <h2 className="font-bold text-mint-300">성공 핵심 4가지</h2>
            <ol className="mt-2 space-y-2 text-sm">
              {guide.keys.map((k, i) => (
                <li key={k} className="flex gap-2"><span className="font-extrabold text-mint-300">{i + 1}</span>{k}</li>
              ))}
            </ol>
          </Card>

          <section className="space-y-3">
            <h2 className="text-lg font-bold">✅ 단계별 체크리스트</h2>
            {(["BEFORE", "DURING", "AFTER"] as const).map((ph) => (
              <Card key={ph} className="p-4">
                <p className="font-bold">{PHASE_LABEL[ph]}</p>
                <ul className="mt-2 space-y-2 text-sm">
                  {guide.checklist.filter((c) => c.phase === ph).map((c) => (
                    <li key={c.title} className="flex flex-wrap items-center gap-1.5">
                      <span className={cx("h-2 w-2 shrink-0 rounded-full", c.importance === "HIGH" ? "bg-danger" : c.importance === "MEDIUM" ? "bg-warn" : "bg-gray-300")} aria-hidden="true" />
                      <span className="flex-1">{c.title}</span>
                      <Badge tone={c.importance === "HIGH" ? "danger" : c.importance === "MEDIUM" ? "warn" : "gray"}>{IMPORTANCE_LABEL[c.importance]}</Badge>
                      {c.expertCheck && <Badge tone="forest">전문가 확인 필요</Badge>}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
            <p className="text-xs text-muted">※ 전기·가스·비계·고소작업·석면 의심 자재처럼 안전과 관련된 항목은 직접 하지 말고 자격 있는 전문가에게 확인을 맡기세요.</p>
            <form action={importChecklist}>
              <input type="hidden" name="guideId" value={row.id} />
              <SubmitButton pendingLabel="가져오는 중…" variant="mint" className="w-full">
                {imported ? "내 공사 할 일로 다시 가져오기" : "내 공사 할 일로 가져가기"}
              </SubmitButton>
            </form>
          </section>

          <Card>
            <h2 className="font-bold">💬 최종 제언</h2>
            <p className="mt-2 text-sm leading-relaxed">{guide.finalAdvice}</p>
          </Card>
        </>
      )}
    </div>
  );
}
