import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { parseJson } from "@/lib/constants";
import { dateValue } from "@/lib/format";
import { ProgramForm, type ProgramInitial } from "../ProgramForm";

export const metadata: Metadata = { title: "지원사업 편집" };

const pretty = (j: string) => JSON.stringify(parseJson(j, {}), null, 2);

export default async function EditProgram(props: PageProps<"/admin/subsidies/[id]">) {
  const { id } = await props.params;
  let initial: ProgramInitial;
  if (id === "new") {
    initial = {
      name: "", provider: "", region: "대구광역시", summary: "", applyPeriod: "", applyUrl: "", sourceUrl: "", sourceNote: "",
      status: "UNVERIFIED", verifiedAt: "", targets: ["DETACHED", "MULTI_HOUSEHOLD", "MULTIPLEX"], steps: "",
      conditionsJson: "{\n  \"requiresEnergyWork\": true\n}", benefitJson: "{}",
    };
  } else {
    const p = await db.subsidyProgram.findUnique({ where: { id } });
    if (!p) notFound();
    initial = {
      id: p.id, name: p.name, provider: p.provider, region: p.region, summary: p.summary, applyPeriod: p.applyPeriod ?? "",
      applyUrl: p.applyUrl ?? "", sourceUrl: p.sourceUrl ?? "", sourceNote: p.sourceNote ?? "", status: p.status,
      verifiedAt: dateValue(p.verifiedAt), targets: parseJson<string[]>(p.targetBuildingTypesJson, []),
      steps: parseJson<string[]>(p.applyStepsJson, []).join("\n"), conditionsJson: pretty(p.conditionsJson), benefitJson: pretty(p.benefitJson),
    };
  }
  return (
    <div className="space-y-4">
      <Link href="/admin/subsidies" className="text-sm text-muted">‹ 지원금 DB</Link>
      <h1 className="text-xl font-extrabold">{id === "new" ? "지원사업 추가" : "지원사업 편집"}</h1>
      <ProgramForm initial={initial} />
    </div>
  );
}
