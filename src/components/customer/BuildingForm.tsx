"use client";

import { useActionState, useState } from "react";
import { saveBuilding } from "@/app/actions/building";
import { Badge, Button, Field, Input, inputClass } from "@/components/ui";
import { STRUCTURE_LABEL, USAGE_LABEL } from "@/lib/constants";
import { formValues } from "@/lib/formValues";
import { buildingAge } from "@/lib/format";

export type BuildingInitial = {
  id?: string;
  nickname?: string | null;
  address: string;
  approvalDate?: string | null; // YYYY-MM-DD
  usage?: string;
  structure?: string;
  grossArea?: number;
  floors?: number;
  households?: number;
  windowArea?: number | null;
  lat?: number;
  lng?: number;
  source: "MOCK" | "API" | "MANUAL";
};

export function BuildingForm({
  initial,
  windowRatio,
  submitLabel,
  onBack,
}: {
  initial: BuildingInitial;
  windowRatio: number;
  submitLabel: string;
  onBack?: () => void;
}) {
  const [state, action, pending] = useActionState(saveBuilding, undefined);
  const e = state?.errors ?? {};
  const { str } = formValues(state?.values);
  const v = (k: keyof BuildingInitial) => str(k) ?? (initial[k] == null ? undefined : String(initial[k]));

  // 연면적을 바꾸면 창호 면적 추정치도 따라 바뀌게 (사용자가 직접 고치기 전까지)
  const [area, setArea] = useState(v("grossArea") ?? "");
  const [windowTouched, setWindowTouched] = useState(initial.windowArea != null || !!str("windowArea"));
  const [windowArea, setWindowArea] = useState(v("windowArea") ?? (area ? String(Math.round(Number(area) * windowRatio)) : ""));
  const age = buildingAge(initial.approvalDate);
  const fromRegistry = initial.source !== "MANUAL";

  return (
    <form action={action} className="space-y-4" noValidate>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="source" value={initial.source} />
      {initial.lat != null && <input type="hidden" name="lat" value={initial.lat} />}
      {initial.lng != null && <input type="hidden" name="lng" value={initial.lng} />}

      {fromRegistry && (
        <div className="rounded-2xl bg-mint-50 p-4 ring-1 ring-mint-100">
          <div className="flex items-center gap-2">
            <Badge tone="forest">건축물대장</Badge>
            {initial.source === "MOCK" && <Badge tone="warn">데모용 가상 정보</Badge>}
          </div>
          <p className="mt-2 text-sm text-forest-900">
            건축물대장에서 불러온 정보예요. 실제와 다르면 바로 고쳐주세요.
            {age != null && <> 지은 지 <b>{age}년</b> 된 집이네요.</>}
          </p>
        </div>
      )}

      <Field label="주소" required error={e.address}>
        <Input name="address" defaultValue={v("address")} readOnly={fromRegistry} className={fromRegistry ? "bg-surface" : ""} />
      </Field>
      <Field label="건물 별명 (선택)" hint="예: 대명동 우리집" error={e.nickname}>
        <Input name="nickname" defaultValue={v("nickname")} maxLength={30} />
      </Field>
      <Field label="사용승인일" hint="집이 다 지어져 사용 허가를 받은 날이에요. 모르면 비워두세요." error={e.approvalDate}>
        <Input name="approvalDate" type="date" defaultValue={v("approvalDate")} max={new Date().toISOString().slice(0, 10)} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="집 유형" required error={e.usage}>
          <select name="usage" defaultValue={v("usage") ?? ""} className={inputClass}>
            <option value="" disabled>선택</option>
            {Object.entries(USAGE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="구조" required error={e.structure}>
          <select name="structure" defaultValue={v("structure") ?? ""} className={inputClass}>
            <option value="" disabled>선택</option>
            {Object.entries(STRUCTURE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
      </div>
      <p className="-mt-2 text-xs text-muted">단독: 한 가구 / 다가구: 집주인 1명이 여러 세대 소유 / 다세대: 세대별로 소유자가 따로 있음</p>

      <div className="grid grid-cols-3 gap-3">
        <Field label="연면적(㎡)" required error={e.grossArea}>
          <Input
            name="grossArea"
            type="number"
            inputMode="decimal"
            value={area}
            onChange={(ev) => {
              setArea(ev.target.value);
              if (!windowTouched) setWindowArea(ev.target.value ? String(Math.round(Number(ev.target.value) * windowRatio)) : "");
            }}
          />
        </Field>
        <Field label="층수" required error={e.floors}>
          <Input name="floors" type="number" inputMode="numeric" defaultValue={v("floors")} />
        </Field>
        <Field label="세대수" required error={e.households}>
          <Input name="households" type="number" inputMode="numeric" defaultValue={v("households")} />
        </Field>
      </div>
      <p className="-mt-2 text-xs text-muted">연면적은 모든 층 바닥 면적을 더한 값이에요. (1평 ≈ 3.3㎡)</p>

      <Field
        label="창호 면적(㎡, 추정)"
        hint={`연면적의 약 ${Math.round(windowRatio * 100)}%로 추정한 값이에요(가정치). 현장 실측 때 정확히 확인해요.`}
        error={e.windowArea}
      >
        <Input
          name="windowArea"
          type="number"
          inputMode="decimal"
          value={windowArea}
          onChange={(ev) => {
            setWindowTouched(true);
            setWindowArea(ev.target.value);
          }}
        />
      </Field>

      {state?.message && <p role="alert" className="text-sm text-danger">{state.message}</p>}
      <div className="flex gap-2 pt-2">
        {onBack && (
          <Button type="button" variant="outline" onClick={onBack}>
            주소 다시 찾기
          </Button>
        )}
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? "저장 중…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
