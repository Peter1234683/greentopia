import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card } from "@/components/ui";
import { GRAI_URL } from "@/config/diagnosis";
import { STRUCTURE_LABEL, USAGE_LABEL, parseJson } from "@/lib/constants";
import { GraiResultForm } from "./GraiResultForm";

export const metadata: Metadata = { title: "GR-AI 시뮬레이션 결과 입력" };

export default async function GraiPage(props: PageProps<"/customer/buildings/[id]/diagnosis/grai">) {
  const user = await requireRole("CUSTOMER");
  const { id } = await props.params;
  const b = await db.building.findFirst({
    where: { id, ownerId: user.id },
    include: { demands: { where: { status: { in: ["ACTIVE", "MATCHED"] } }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!b) notFound();
  const facts: [string, string][] = [
    ["주소", b.address],
    ["사용승인연도", b.approvalDate ? `${b.approvalDate.getFullYear()}년` : "모름"],
    ["용도", USAGE_LABEL[b.usage]],
    ["구조", STRUCTURE_LABEL[b.structure]],
    ["연면적", `${b.grossArea}㎡`],
    ["층수 / 세대수", `${b.floors}층 / ${b.households}세대`],
  ];

  return (
    <div className="space-y-5 pt-2">
      <Link href="/customer/diagnosis" className="text-sm text-muted">‹ 내 집 진단</Link>
      <div>
        <h1 className="text-2xl font-extrabold">GR-AI로 정밀 시뮬레이션</h1>
        <p className="mt-1 text-sm text-muted">
          GR-AI는 외벽·지붕·창호 단열 성능, 보일러 효율 등을 바꿔가며 건물 에너지 소요량을 비교해 주는 서비스예요.
          결과를 이곳에 옮겨 적으면 그린토피아 진단에 반영돼요.
        </p>
      </div>

      <Card>
        <p className="font-bold">① GR-AI 열기</p>
        <p className="mt-1 text-sm text-muted">새 창에서 열려요. 아래 우리 집 정보를 참고해 입력하세요.</p>
        <dl className="mt-3 divide-y divide-line rounded-2xl bg-surface px-3 text-sm">
          {facts.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 py-2">
              <dt className="text-muted">{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <a
          href={GRAI_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex items-center justify-center rounded-2xl bg-forest-800 px-5 py-3.5 font-semibold text-white hover:bg-forest-700"
        >
          GR-AI에서 시뮬레이션하기 ↗
        </a>
      </Card>

      <Card>
        <p className="mb-4 font-bold">② 결과 옮겨 적기</p>
        <GraiResultForm buildingId={b.id} highlight={b.demands[0] ? parseJson<string[]>(b.demands[0].tradesJson, []) : []} />
      </Card>
      <p className="text-xs text-muted">※ 그린토피아는 GR-AI와 자동 연동되어 있지 않아요. 입력하신 값만 저장해요.</p>
    </div>
  );
}
