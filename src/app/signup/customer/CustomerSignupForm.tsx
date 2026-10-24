"use client";

import { useActionState } from "react";
import { signupCustomer } from "@/app/actions/auth";
import { Button, Field, Input } from "@/components/ui";
import { formValues } from "@/lib/formValues";

export function CustomerSignupForm() {
  const [state, action, pending] = useActionState(signupCustomer, undefined);
  const e = state?.errors ?? {};
  const { str } = formValues(state?.values);
  return (
    <form action={action} className="mt-8 space-y-4" noValidate>
      <Field label="이름" required error={e.name}>
        <Input name="name" defaultValue={str("name")} autoComplete="name" />
      </Field>
      <Field label="연락처" required error={e.phone}>
        <Input name="phone" defaultValue={str("phone")} type="tel" inputMode="tel" placeholder="010-1234-5678" autoComplete="tel" />
      </Field>
      <Field label="이메일" required error={e.email}>
        <Input name="email" defaultValue={str("email")} type="email" autoComplete="email" />
      </Field>
      <Field label="비밀번호" required hint="8자 이상" error={e.password}>
        <Input name="password" type="password" autoComplete="new-password" />
      </Field>
      <Field label="건물 주소 (선택)" hint="지금 넣지 않아도 '내 집 진단'에서 언제든 등록할 수 있어요." error={e.address}>
        <Input name="address" defaultValue={str("address")} placeholder="예: 대구 남구 대명동 123-4" />
      </Field>
      {state?.message && <p role="alert" className="text-sm text-danger">{state.message}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "가입 중…" : "가입하고 시작하기"}
      </Button>
    </form>
  );
}
