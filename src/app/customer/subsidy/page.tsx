import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { matchAllForBuilding } from "@/lib/subsidy/service";
import { saveBeneficiaries } from "@/app/actions/subsidy";
import { ProgramCard } from "@/components/subsidy/ProgramCard";
import { Button, ButtonLink, Card } from "@/components/ui";
import { BENEFICIARY_TYPES, parseJson } from "@/lib/constants";
import { Calculator } from "./Calculator";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "숨은 지원금 찾기" };

export default async function SubsidyPage(props: PageProps<"/customer/subsidy">) {
  const user = await requireRole("CUSTOMER");
  const { b } = await props.searchParams;
  const m = await matchAllForBuilding(user.id, typeof b === "string" ? b : undefined);
  if (!m)
    return (
      <div className="space-y-4 pt-2">
        <h1 className="text-2xl font-extrabold">숨은 지원금 찾기</h1>
        <Card className="text-center">
          <p className="font-bold">먼저 우리 집을 등록해주세요</p>
          <p className="mt-1 text-sm text-muted">건물 정보와 필요한 공사를 알면 받을 수 있는 지원금을 찾아드려요.</p>
          <ButtonLink href="/customer/buildings/new" className="mt-4 w-full">내 건물 등록하기</ButtonLink>
        </Card>
      </div>
    );
  const settings = await getSettings();
  const profile = await db.customerProfile.findUnique({ where: { userId: user.id } });
  const myTypes = parseJson<string[]>(profile?.beneficiaryTypesJson, []);
  const contract = await db.contract.findFirst({ where: { buildingId: m.building.id, status: { not: "CANCELLED" } }, orderBy: { createdAt: "desc" } });
  const dm = m.building.demands[0];
  const cost = contract?.amount ?? (dm?.budgetMax ?? dm?.budgetMin ?? 20_000_000);
  const top = m.results.find((r) => r.match.rate != null && r.match.status !== "INELIGIBLE") ?? m.results.find((r) => r.match.rate != null);
  const eligible = m.results.filter((r) => r.match.status !== "INELIGIBLE").length;

  return (
    <div className="space-y-5 pt-2">
      <div>
        <h1 className="text-2xl font-extrabold">숨은 지원금 찾기</h1>
        <p className="mt-1 text-sm text-muted">출처가 확인된 지원사업만 보여드려요.</p>
      </div>

      {m.buildings.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {m.buildings.map((x) => (
            <Link key={x.id} href={`/customer/subsidy?b=${x.id}`} className={`shrink-0 rounded-full px-3 py-1.5 text-sm ring-1 ${x.id === m.building.id ? "bg-forest-800 text-white ring-forest-800" : "bg-white ring-line"}`}>{x.nickname ?? x.dong}</Link>
          ))}
        </div>
      )}

      <Card className="bg-forest-900 text-white ring-0">
        <p className="text-sm text-mint-300">{m.building.nickname ?? m.building.address}</p>
        <p className="mt-1 text-2xl font-extrabold">검토해 볼 지원사업 {eligible}건</p>
        {!m.hasDiagnosis && (
          <p className="mt-2 text-sm text-white/80">
            에너지 진단을 받으면 성능개선률 요건까지 판단할 수 있어요.{" "}
            <Link href="/customer/diagnosis" className="font-semibold text-mint-300 underline">진단 받기</Link>
          </p>
        )}
      </Card>

      <Card>
        <p className="font-bold">우대 대상에 해당하시나요? <span className="text-sm font-normal text-muted">(선택)</span></p>
        <form action={saveBeneficiaries} className="mt-3">
          <div className="flex flex-wrap gap-2">
            {BENEFICIARY_TYPES.map((t) => (
              <label key={t.code} className="cursor-pointer">
                <input type="checkbox" name="types" value={t.code} defaultChecked={myTypes.includes(t.code)} className="peer sr-only" />
                <span className="inline-block rounded-full px-3 py-1.5 text-sm ring-1 ring-line peer-checked:bg-forest-800 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-mint-400">{t.label}</span>
              </label>
            ))}
          </div>
          <Button variant="outline" className="mt-3 w-full py-2.5 text-sm">다시 확인하기</Button>
        </form>
      </Card>

      {m.results.length === 0 ? (
        <Card className="text-sm text-muted">아직 공개된 지원사업이 없어요. 운영자가 출처를 확인한 사업을 등록하면 보여드릴게요.</Card>
      ) : (
        m.results.map((r) => <ProgramCard key={r.program.id} program={r.program} match={r.match} usage={m.building.usage} />)
      )}

      <Calculator
        // 우대 여부·한도가 바뀌면 계산기를 새 값으로 다시 시작
        key={`${top?.program.id}-${top?.match.rate}-${top?.match.loanLimit}-${cost}`}
        cost={cost}
        costBasis={contract ? "우리 집 계약 금액" : dm?.budgetMax ? "입력하신 예산 상단" : "예시 금액"}
        loanRatePct={settings.support.calculator.loanRatePct}
        supportRatePct={top?.match.rate ?? null}
        years={top?.match.maxRepayYears ?? settings.support.calculator.termYears}
        loanLimit={top?.match.loanLimit ?? null}
        programName={top?.program.name ?? null}
      />

      <Link href={`/customer/subsidy/advisor?b=${m.building.id}`} className="block">
        <Card className="flex items-center gap-4 bg-mint-50 ring-mint-300">
          <span className="text-3xl" aria-hidden="true">💬</span>
          <div className="flex-1">
            <p className="font-bold">지원금 상담하기</p>
            <p className="text-sm text-muted">&ldquo;우리 집이 이자지원 대상인가요?&rdquo; 처럼 물어보세요.</p>
          </div>
          <span className="text-xl text-muted" aria-hidden="true">›</span>
        </Card>
      </Link>
      <p className="text-xs text-muted">※ 실제 적용 여부는 공고문과 관할 기관 확인이 필요합니다.</p>
    </div>
  );
}
