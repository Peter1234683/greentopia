import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { BUDGET_OPTIONS, DESIRED_START_MONTHS } from "@/config/building";
import { parseJson, type Trade } from "@/lib/constants";
import { monthLabel, monthValue } from "@/lib/format";
import { DemandWizard, type DemandInitial } from "./DemandWizard";

export const metadata: Metadata = { title: "공사 수요 입력" };

function budgetCode(min: number | null, max: number | null) {
  return BUDGET_OPTIONS.find((b) => b.min === min && b.max === max)?.code ?? "";
}

export default async function DemandPage(props: PageProps<"/customer/buildings/[id]/demand">) {
  const user = await requireRole("CUSTOMER");
  const { id } = await props.params;
  const b = await db.building.findFirst({
    where: { id, ownerId: user.id },
    include: { demands: { where: { status: { in: ["ACTIVE", "MATCHED"] } }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!b) notFound();

  const now = new Date();
  const months = Array.from({ length: DESIRED_START_MONTHS }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + 1 + i, 1);
    return { value: monthValue(d), label: monthLabel(d) };
  });
  const dm = b.demands[0];
  const initial: DemandInitial = dm
    ? {
        symptoms: parseJson<string[]>(dm.symptomsJson, []),
        trades: parseJson<Trade[]>(dm.tradesJson, []),
        desiredStart: months.some((m) => m.value === monthValue(dm.desiredStart)) ? monthValue(dm.desiredStart) : "",
        budget: budgetCode(dm.budgetMin, dm.budgetMax),
        jointIntent: dm.jointIntent,
        billElectric: dm.billElectric?.toString() ?? "",
        billGas: dm.billGas?.toString() ?? "",
      }
    : { symptoms: [], trades: [], desiredStart: "", budget: "", jointIntent: "", billElectric: "", billGas: "" };

  return (
    <div className="pt-2">
      <Link href="/customer/diagnosis" className="text-sm text-muted">‹ 내 집 진단</Link>
      <p className="mt-4 text-sm font-semibold text-forest-700">2단계 · 공사 수요</p>
      <p className="mb-5 text-sm text-muted">{b.nickname ?? b.address}</p>
      <DemandWizard
        buildingId={b.id}
        initial={initial}
        months={months}
        budgets={BUDGET_OPTIONS.map((o) => ({ value: o.code, label: o.label }))}
      />
    </div>
  );
}
