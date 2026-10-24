import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { aiStatus } from "@/lib/ai";
import { Badge, Card } from "@/components/ui";
import { PhotoForm } from "./PhotoForm";

export const metadata: Metadata = { title: "사진 진단" };

export default async function PhotoDiagnosisPage(props: PageProps<"/customer/buildings/[id]/photo">) {
  const user = await requireRole("CUSTOMER");
  const { id } = await props.params;
  const b = await db.building.findFirst({ where: { id, ownerId: user.id }, include: { photoResults: { orderBy: { createdAt: "desc" }, take: 5 } } });
  if (!b) notFound();
  const ai = aiStatus();
  return (
    <div className="space-y-4 pt-2">
      <Link href="/customer/diagnosis" className="text-sm text-muted">‹ 진단</Link>
      <div>
        <h1 className="text-2xl font-extrabold">📷 사진으로 진단받기</h1>
        <p className="mt-1 text-sm text-muted">창호·벽 모서리·천장의 결로나 곰팡이처럼 신경 쓰이는 곳을 찍어주세요. 휴대폰 카메라로 바로 찍을 수 있어요.</p>
      </div>
      <Card className="bg-mint-50 p-4 text-sm ring-mint-100">
        <div className="flex items-center gap-2"><Badge tone={ai.provider === "rule" ? "gray" : "forest"}>{ai.label}</Badge></div>
        <p className="mt-2">
          {ai.provider === "rule"
            ? "지금은 AI가 연결되지 않아 사진을 판독하지 않고, 연식·구조·메모로 규칙 기반 추정을 해요."
            : "AI가 사진과 건물 정보를 함께 보고 부위별 상태를 설명해요."}{" "}
          결과는 참고 의견이며 정밀 진단을 대체하지 않아요.
        </p>
      </Card>
      <PhotoForm buildingId={b.id} />
      {b.photoResults.length > 0 && (
        <section>
          <h2 className="mb-2 font-bold">지난 사진 진단</h2>
          <ul className="space-y-1 text-sm">
            {b.photoResults.map((r) => (
              <li key={r.id}>
                <Link href={`/customer/buildings/${b.id}/photo/${r.id}`} className="text-forest-700 underline">
                  {r.createdAt.toLocaleDateString("ko-KR")} · {r.source === "ai" ? "AI 참고 의견" : "규칙 기반 추정"}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
