"use client";

import { useActionState } from "react";
import { saveGraiResult } from "@/app/actions/diagnosis";
import { Button, Field, Input, inputClass } from "@/components/ui";
import { TRADES, TRADE_LABEL } from "@/lib/constants";
import { formValues } from "@/lib/formValues";

export function GraiResultForm({ buildingId, highlight }: { buildingId: string; highlight: string[] }) {
  const [state, action, pending] = useActionState(saveGraiResult, undefined);
  const e = state?.errors ?? {};
  const { str } = formValues(state?.values);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="buildingId" value={buildingId} />
      <Field label="현재 상태 연간 에너지 소요량 (kWh)" required hint="GR-AI 결과에서 '현재(기준) 건물' 값을 옮겨 적어주세요." error={e.baselineKwh}>
        <Input name="baselineKwh" type="number" inputMode="decimal" defaultValue={str("baselineKwh")} />
      </Field>
      <div>
        <p className="mb-2 text-sm font-semibold">개선 시나리오별 소요량 (kWh)</p>
        <p className="mb-3 text-xs text-muted">시뮬레이션해 본 항목만 적으면 돼요.</p>
        <div className="grid grid-cols-2 gap-3">
          {TRADES.map((t) => (
            <Field key={t} label={`${TRADE_LABEL[t]} 개선 후${highlight.includes(t) ? " ·필요" : ""}`} error={e[t]}>
              <Input name={t} type="number" inputMode="decimal" defaultValue={str(t)} />
            </Field>
          ))}
          <Field label="통합 개선 후" error={e.COMBINED}>
            <Input name="COMBINED" type="number" inputMode="decimal" defaultValue={str("COMBINED")} />
          </Field>
        </div>
      </div>
      <Field label="결과 화면 캡처 또는 PDF (선택)" hint="5MB 이하" error={e.resultFile}>
        <input name="resultFile" type="file" accept="image/*,application/pdf" className={inputClass} />
      </Field>
      {e.form && <p role="alert" className="text-sm text-danger">{e.form}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "저장 중…" : "결과 저장하기"}
      </Button>
    </form>
  );
}
