import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { WINDOW_AREA_RATIO } from "@/config/building";
import { BuildingForm } from "@/components/customer/BuildingForm";
import { dateValue } from "@/lib/format";

export const metadata: Metadata = { title: "건물 정보 수정" };

export default async function EditBuildingPage(props: PageProps<"/customer/buildings/[id]/edit">) {
  const user = await requireRole("CUSTOMER");
  const { id } = await props.params;
  const b = await db.building.findFirst({ where: { id, ownerId: user.id } });
  if (!b) notFound();
  return (
    <div className="pt-2">
      <Link href="/customer/diagnosis" className="text-sm text-muted">‹ 내 집 진단</Link>
      <h1 className="mt-4 mb-6 text-2xl font-extrabold">건물 정보 수정</h1>
      <BuildingForm
        windowRatio={WINDOW_AREA_RATIO}
        submitLabel="저장하기"
        initial={{
          id: b.id,
          nickname: b.nickname,
          address: b.address,
          approvalDate: dateValue(b.approvalDate),
          usage: b.usage,
          structure: b.structure,
          grossArea: b.grossArea,
          floors: b.floors,
          households: b.households,
          windowArea: b.windowArea,
          lat: b.lat,
          lng: b.lng,
          source: b.registrySource as "MOCK" | "API" | "MANUAL",
        }}
      />
    </div>
  );
}
