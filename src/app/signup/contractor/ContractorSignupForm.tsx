"use client";

import { useActionState, useState } from "react";
import { signupContractor } from "@/app/actions/auth";
import { Button, Field, Input, inputClass } from "@/components/ui";
import { TRADES, TRADE_LABEL } from "@/lib/constants";
import { formValues } from "@/lib/formValues";

function Chip({ name, value, label, defaultChecked }: { name: string; value: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="cursor-pointer">
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="inline-block rounded-full border border-line bg-white px-3.5 py-2 text-sm peer-checked:border-forest-700 peer-checked:bg-forest-800 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-mint-400">
        {label}
      </span>
    </label>
  );
}

function YesNo({ name, value, onChange }: { name: string; value?: string; onChange?: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[["yes", "예"], ["no", "아니요"]].map(([v, l]) => (
        <label key={v} className="cursor-pointer">
          <input type="radio" name={name} value={v} defaultChecked={value === v} className="peer sr-only" onChange={() => onChange?.(v)} />
          <span className="block rounded-xl border border-line bg-white py-3 text-center peer-checked:border-forest-700 peer-checked:bg-mint-50 peer-checked:font-semibold peer-focus-visible:ring-2 peer-focus-visible:ring-mint-400">
            {l}
          </span>
        </label>
      ))}
    </div>
  );
}

function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-3xl bg-white p-5 ring-1 ring-line/60">
      <legend className="sr-only">{title}</legend>
      <p className="flex items-center gap-2 text-base font-bold">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-forest-800 text-xs text-white">{step}</span>
        {title}
      </p>
      {children}
    </fieldset>
  );
}

export function ContractorSignupForm({ sido, sigungu }: { sido: string; sigungu: string[] }) {
  const [state, action, pending] = useActionState(signupContractor, undefined);
  const [gr, setGr] = useState<string>("");
  const e = state?.errors ?? {};
  const { str, has } = formValues(state?.values);

  return (
    <form action={action} className="mt-8 space-y-5" noValidate encType="multipart/form-data">
      <Section step={1} title="업체 기본 정보">
        <Field label="상호" required error={e.companyName}><Input name="companyName" defaultValue={str("companyName")} /></Field>
        <Field label="대표자" required error={e.ceoName}><Input name="ceoName" defaultValue={str("ceoName")} /></Field>
        <Field label="사업자등록번호" required error={e.bizRegNo}>
          <Input name="bizRegNo" defaultValue={str("bizRegNo")} inputMode="numeric" placeholder="123-45-67890" />
        </Field>
        <Field label="연락처" required error={e.phone}>
          <Input name="phone" defaultValue={str("phone")} type="tel" inputMode="tel" placeholder="053-123-4567" />
        </Field>
        <Field label="이메일 (로그인 ID)" required error={e.email}><Input name="email" defaultValue={str("email")} type="email" autoComplete="email" /></Field>
        <Field label="비밀번호" required hint="8자 이상" error={e.password}>
          <Input name="password" type="password" autoComplete="new-password" />
        </Field>
      </Section>

      <Section step={2} title="시공 분야 · 활동 권역">
        <div>
          <p className="mb-2 text-sm font-semibold">시공 가능 공종 <span className="text-mint-500">*</span></p>
          <div className="flex flex-wrap gap-2">
            {TRADES.map((t) => <Chip key={t} name="trades" value={t} label={TRADE_LABEL[t]} defaultChecked={has("trades", t)} />)}
          </div>
          {e.trades && <p className="mt-1 text-sm text-danger">{e.trades}</p>}
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">활동 권역 ({sido}) <span className="text-mint-500">*</span></p>
          <div className="flex flex-wrap gap-2">
            <Chip name="regions" value="전체" label="대구 전역" defaultChecked={has("regions", "전체")} />
            {sigungu.map((s) => <Chip key={s} name="regions" value={s} label={s} defaultChecked={has("regions", s)} />)}
          </div>
          {e.regions && <p className="mt-1 text-sm text-danger">{e.regions}</p>}
        </div>
      </Section>

      <Section step={3} title="자격 · 면허 (입찰 참가 자격 확인용)">
        <Field label="GR(그린리모델링) 사업자로 등록되어 있나요?" required error={e.grRegistered}>
          <YesNo name="grRegistered" value={str("grRegistered")} onChange={setGr} />
        </Field>
        {gr === "yes" && (
          <>
            <Field label="GR 사업자 등록번호" required error={e.grRegNo}><Input name="grRegNo" defaultValue={str("grRegNo")} /></Field>
            <Field label="GR 사업자 등록 증빙" required hint="PDF·이미지, 5MB 이하" error={e.grCert}>
              <input name="grCert" type="file" accept="application/pdf,image/*" className={inputClass} />
            </Field>
          </>
        )}
        {gr === "no" && (
          <p className="rounded-xl bg-warn-bg p-3 text-sm text-warn">
            가입은 가능하지만, 대부분의 입찰 공고는 GR 사업자 등록이 참가 자격이에요. 등록 후 내 업체 화면에서 증빙을 추가할 수 있어요.
          </p>
        )}
        <Field label="건설업 등록·면허 종류" required hint="예: 실내건축공사업, 창호공사업, 기계설비공사업" error={e.constructionLicense}>
          <Input name="constructionLicense" defaultValue={str("constructionLicense")} />
        </Field>
        <Field label="등록·면허 번호" error={e.licenseNo}><Input name="licenseNo" defaultValue={str("licenseNo")} /></Field>
        <Field label="면허 증빙 (선택)" hint="PDF·이미지, 5MB 이하" error={e.licenseDoc}>
          <input name="licenseDoc" type="file" accept="application/pdf,image/*" className={inputClass} />
        </Field>
        <Field label="하자보증(보증보험) 발급이 가능한가요?" required error={e.warrantyAvailable}>
          <YesNo name="warrantyAvailable" value={str("warrantyAvailable")} />
        </Field>
      </Section>

      <Section step={4} title="시공 실적">
        <div className="grid grid-cols-2 gap-3">
          <Field label="기술인력 수" error={e.techStaffCount}><Input name="techStaffCount" type="number" min={0} defaultValue={str("techStaffCount") ?? 0} /></Field>
          <Field label="최근 3년 GR 시공 건수" error={e.externalProjectCount}>
            <Input name="externalProjectCount" type="number" min={0} defaultValue={str("externalProjectCount") ?? 0} />
          </Field>
        </div>
        <Field label="대표 시공 실적" hint="새싹 트랙 초기 점수에 반영돼요. 예: 2025 수성구 다세대 12세대 창호 교체" error={e.portfolio}>
          <textarea name="portfolio" rows={4} className={inputClass} defaultValue={str("portfolio")} />
        </Field>
      </Section>

      {state?.message && <p role="alert" className="text-sm text-danger">{state.message}</p>}
      {Object.keys(e).length > 0 && (
        <p role="alert" className="text-sm text-danger">입력 내용을 다시 확인해주세요. 파일은 다시 선택해야 해요.</p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "제출 중…" : "가입 신청하기"}
      </Button>
      <p className="text-center text-xs text-muted">가입 신청 후 운영자가 서류를 확인하면 입찰에 참여할 수 있어요.</p>
    </form>
  );
}
