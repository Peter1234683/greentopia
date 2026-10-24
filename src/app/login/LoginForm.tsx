"use client";

import { useActionState, useRef } from "react";
import { login } from "@/app/actions/auth";
import { Button, Field, Input } from "@/components/ui";

const DEMO = [
  { label: "건물주", email: "customer@demo.kr" },
  { label: "시공업체", email: "contractor@demo.kr" },
  { label: "심사 대기 업체", email: "pending@demo.kr" },
  { label: "관리자", email: "admin@demo.kr" },
];

export function LoginForm({ showDemo }: { showDemo: boolean }) {
  const [state, action, pending] = useActionState(login, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  function fillDemo(email: string) {
    const f = formRef.current;
    if (!f) return;
    (f.elements.namedItem("email") as HTMLInputElement).value = email;
    (f.elements.namedItem("password") as HTMLInputElement).value = "demo1234";
  }

  return (
    <>
      <form ref={formRef} action={action} className="mt-8 space-y-4">
        <Field label="이메일" error={state?.errors?.email}>
          <Input name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email as string | undefined} />
        </Field>
        <Field label="비밀번호" error={state?.errors?.password}>
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>
        {state?.message && <p role="alert" className="text-sm text-danger">{state.message}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "확인 중…" : "로그인"}
        </Button>
      </form>

      {showDemo && (
        <div className="mt-6 rounded-2xl bg-mint-50 p-4 ring-1 ring-mint-100">
          <p className="text-sm font-semibold text-forest-800">데모 계정 (비밀번호 demo1234)</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DEMO.map((d) => (
              <button
                key={d.email}
                type="button"
                onClick={() => fillDemo(d.email)}
                className="rounded-full bg-white px-3 py-1.5 text-sm text-forest-800 ring-1 ring-mint-300 hover:bg-mint-100"
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
