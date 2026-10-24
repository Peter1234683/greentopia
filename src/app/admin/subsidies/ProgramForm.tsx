"use client";

import { useActionState } from "react";
import { saveSubsidyProgram } from "@/app/actions/subsidy";
import { Button, Field, Input, inputClass } from "@/components/ui";
import { USAGE_LABEL } from "@/lib/constants";

export type ProgramInitial = {
  id?: string;
  name: string;
  provider: string;
  region: string;
  summary: string;
  applyPeriod: string;
  applyUrl: string;
  sourceUrl: string;
  sourceNote: string;
  status: string;
  verifiedAt: string;
  targets: string[];
  steps: string;
  conditionsJson: string;
  benefitJson: string;
};

export function ProgramForm({ initial: base }: { initial: ProgramInitial }) {
  const [state, action, pending] = useActionState(saveSubsidyProgram, undefined);
  // 서버가 돌려준 입력값이 있으면 그것을 기본값으로 (오류 후 폼 초기화로 입력이 사라지지 않게)
  const v = state?.values;
  const initial: ProgramInitial = v
    ? { ...base, ...(Object.fromEntries(Object.entries(v).filter(([k]) => k !== "targets")) as Partial<ProgramInitial>), targets: (v.targets as string[]) ?? base.targets }
    : base;
  return (
    <form action={action} className="space-y-4">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="사업명" required><Input name="name" defaultValue={initial.name} /></Field>
        <Field label="주관 기관" required><Input name="provider" defaultValue={initial.provider} /></Field>
        <Field label="지역" required hint="전국 / 대구광역시 / 대구광역시 수성구"><Input name="region" defaultValue={initial.region} /></Field>
        <Field label="상태" required>
          <select name="status" defaultValue={initial.status} className={inputClass}>
            <option value="UNVERIFIED">검증 필요 (고객에게 숨김)</option>
            <option value="ACTIVE">진행 중 (고객에게 공개)</option>
            <option value="CLOSED">마감</option>
          </select>
        </Field>
      </div>
      <Field label="한 줄 요약" required><Input name="summary" defaultValue={initial.summary} /></Field>
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">대상 건물</legend>
        <div className="flex flex-wrap gap-3 text-sm">
          {Object.entries(USAGE_LABEL).map(([k, l]) => (
            <label key={k} className="flex items-center gap-1.5"><input type="checkbox" name="targets" value={k} defaultChecked={initial.targets.includes(k)} />{l}</label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="출처 링크" hint="보도자료·공고문 등. 없으면 공개할 수 없어요."><Input name="sourceUrl" defaultValue={initial.sourceUrl} /></Field>
        <Field label="공식 신청 링크"><Input name="applyUrl" defaultValue={initial.applyUrl} /></Field>
        <Field label="출처 설명"><Input name="sourceNote" defaultValue={initial.sourceNote} /></Field>
        <Field label="공고문 확인일" hint="공고문 원문을 확인한 날. 비우면 '공고문 확인 필요' 배지"><Input name="verifiedAt" type="date" defaultValue={initial.verifiedAt} /></Field>
        <Field label="신청 기간"><Input name="applyPeriod" defaultValue={initial.applyPeriod} /></Field>
      </div>
      <Field label="신청 절차 (한 줄에 한 단계)"><textarea name="steps" rows={5} defaultValue={initial.steps} className={inputClass} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="요건 (JSON)" hint="minImprovementPct, preferentialImprovementPct, preferentialBeneficiaries, requiresEnergyWork, approvalBefore, minAgeYears, detachedSimpleEvaluation">
          <textarea name="conditionsJson" rows={8} defaultValue={initial.conditionsJson} spellCheck={false} className={`${inputClass} font-mono text-xs`} />
        </Field>
        <Field label="혜택 (JSON)" hint="interestSupportPct{general,preferential}, loanLimit{DETACHED,…}, maxRepayYears, grantAmount, grantRatioPct, grantCap, services[]">
          <textarea name="benefitJson" rows={8} defaultValue={initial.benefitJson} spellCheck={false} className={`${inputClass} font-mono text-xs`} />
        </Field>
      </div>
      {state?.errors && <ul role="alert" className="space-y-0.5 text-sm text-danger">{state.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      {state?.ok && <p role="status" className="text-sm text-forest-700">저장했어요.</p>}
      <Button disabled={pending} className="w-full">{pending ? "저장 중…" : "저장"}</Button>
    </form>
  );
}
