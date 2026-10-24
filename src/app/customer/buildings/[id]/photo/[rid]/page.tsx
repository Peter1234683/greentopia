import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { Badge, Basis, ButtonLink, Card } from "@/components/ui";
import { PHOTO_PARTS, TRADE_LABEL, parseJson } from "@/lib/constants";
import { standardsCompare, type PhotoResult } from "@/lib/photo/diagnose";
import { INSULATION_STANDARDS } from "@/config/photoDiagnosis";
import { GRAI_URL } from "@/config/diagnosis";
import { won } from "@/lib/format";

export const metadata: Metadata = { title: "사진 진단 결과" };

const SEV = { HIGH: { label: "빨리 점검", tone: "danger" }, MEDIUM: { label: "1~2년 안 개선", tone: "warn" }, LOW: { label: "지켜보기", tone: "gray" } } as const;
const partLabel = (c: string) => PHOTO_PARTS.find((p) => p.code === c)?.label ?? c;

export default async function PhotoResultPage(props: PageProps<"/customer/buildings/[id]/photo/[rid]">) {
  const user = await requireRole("CUSTOMER");
  const { id, rid } = await props.params;
  const row = await db.photoDiagnosisResult.findFirst({ where: { id: rid, buildingId: id, building: { ownerId: user.id } }, include: { building: true } });
  if (!row) notFound();
  const r = parseJson<PhotoResult | null>(row.resultJson, null);
  if (!r) notFound();
  const b = row.building;
  const photos = await db.diagnosisPhoto.findMany({ where: { id: { in: parseJson<string[]>(row.photoIdsJson, []) } }, orderBy: { createdAt: "asc" } });
  const std = standardsCompare(b);
  const ai = row.source === "ai";
  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };

  return (
    <div className="space-y-5 pt-2">
      <Link href={`/customer/buildings/${b.id}/photo`} className="text-sm text-muted">‹ 사진 진단</Link>
      <div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={ai ? "forest" : "gray"}>{ai ? "AI 참고 의견" : "규칙 기반 추정"}</Badge>
          <Badge tone="warn">사진 기반</Badge>
        </div>
        <h1 className="mt-2 text-2xl font-extrabold">{b.nickname ?? b.dong} 사진 진단 결과</h1>
        <p className="mt-1 rounded-2xl bg-warn-bg px-4 py-3 text-sm text-warn">
          사진 기반 {ai ? "AI " : ""}참고 의견이며 정밀 진단을 대체하지 않습니다. 열화상·측정값이 아닌 눈으로 보이는 상태와 건물 정보로 판단했어요.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {photos.map((p) => (
          <figure key={p.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/files/${p.documentId}`} alt={`${partLabel(p.part)} 사진`} className="aspect-square w-full rounded-xl object-cover" />
            <figcaption className="mt-0.5 text-center text-xs text-muted">{partLabel(p.part)}</figcaption>
          </figure>
        ))}
      </div>

      <Card className="bg-forest-900 text-white ring-0">
        <p className="text-sm text-mint-300">노후도 점수</p>
        <p className="mt-1 text-4xl font-extrabold tabular-nums">{r.agingScore}<span className="text-lg text-white/60"> / 100</span></p>
        <div className="mt-3 h-2 rounded-full bg-white/15" aria-hidden="true">
          <div className="h-2 rounded-full bg-mint-400" style={{ width: `${r.agingScore}%` }} />
        </div>
        <p className="mt-3 text-sm leading-relaxed text-white/90">{r.summary}</p>
      </Card>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">부위별 상태</h2>
        {[...r.defects].sort((x, y) => order[x.severity] - order[y.severity]).map((d, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold">{partLabel(d.part)}</p>
              <Badge tone={SEV[d.severity].tone}>{SEV[d.severity].label}</Badge>
            </div>
            <p className="mt-1 text-sm">{d.observation}</p>
            <p className="mt-2 text-sm text-forest-700">🔧 {d.method}</p>
          </Card>
        ))}
      </section>

      {r.recommendations.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">추천 공사</h2>
          {r.recommendations.map((x) => (
            <Card key={x.trade} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold"><span className="mr-1.5 text-forest-700">{x.priority}순위</span>{TRADE_LABEL[x.trade]}</p>
                <p className="text-sm font-semibold tabular-nums">{won(x.cost.low)} ~ {won(x.cost.high)}</p>
              </div>
              <p className="mt-1 text-sm text-muted">{x.why}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {x.subsidyPossible && (
                  <Link href={`/customer/subsidy?b=${b.id}`}><Badge>💰 지원사업 대상 가능성 · 조건 확인</Badge></Link>
                )}
                {x.joint && <Badge tone="gray">🤝 {x.joint}</Badge>}
              </div>
            </Card>
          ))}
          <Basis>예상비용은 개별 발주 기준 가정 단가 × 건물 물량 추정치예요. 실제 가격은 입찰로 정해져요. 지원사업 대상 여부는 공고문·관할 기관 확인이 필요해요.</Basis>
        </section>
      )}

      {std && (
        <Card>
          <p className="font-bold">📏 지을 때 단열 기준 vs 지금 기준</p>
          <p className="mt-1 text-sm text-muted">{std.year}년 사용승인 → {std.era.label} 기준 적용 시기</p>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-muted"><th className="py-1 text-left font-normal">부위</th><th className="font-normal">지을 때</th><th className="font-normal">현행</th></tr>
            </thead>
            <tbody>
              {([["외벽", std.era.wall, std.current.wall], ["창호", std.era.window, std.current.window]] as const).map(([k, then, now]) => (
                <tr key={k} className="border-t border-line">
                  <td className="py-2 font-semibold">{k}</td>
                  <td className="text-center">{then ?? "기준 없음"}</td>
                  <td className="text-center">{now}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-sm text-forest-700">
            {std.wallTimes ? `외벽 기준이 지금보다 약 ${std.wallTimes}배 느슨했어요 (같은 조건이면 열이 그만큼 더 샐 수 있어요).` : std.era.note ?? "당시에는 외벽 단열 기준이 거의 없었어요."}
          </p>
          <Basis>{INSULATION_STANDARDS.unit} · {INSULATION_STANDARDS.region} · 가정 기반: {INSULATION_STANDARDS.sourceNote}</Basis>
        </Card>
      )}

      <Card className="space-y-3">
        <p className="font-bold">정밀 진단이 필요하다면</p>
        <p className="text-sm text-muted">사진만으로는 벽 속 상태·실제 에너지 사용량을 알 수 없어요. GR-AI 시뮬레이션이나 그린리모델링 지원사업의 진단·컨설팅을 확인해보세요.</p>
        <div className="grid grid-cols-2 gap-2">
          <a href={GRAI_URL} target="_blank" rel="noreferrer" className="rounded-2xl bg-white px-3 py-3 text-center text-sm font-semibold ring-1 ring-line">GR-AI 열기 ↗</a>
          <Link href={`/customer/subsidy?b=${b.id}`} className="rounded-2xl bg-white px-3 py-3 text-center text-sm font-semibold ring-1 ring-line">지원사업 확인</Link>
        </div>
      </Card>

      <div className="grid gap-2">
        <ButtonLink href={`/customer/buildings/${b.id}/guide`} className="w-full">📘 전문가 가이드 보기</ButtonLink>
        <ButtonLink href={`/customer/buildings/${b.id}/demand`} variant="outline" className="w-full">추천 공사로 수요 등록·수정</ButtonLink>
      </div>
    </div>
  );
}
