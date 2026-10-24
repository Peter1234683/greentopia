"use client";

import { useState, useTransition } from "react";
import { lookupBuilding } from "@/app/actions/building";
import type { RegistryRecord } from "@/lib/adapters/buildingRegistry";
import { BuildingForm, type BuildingInitial } from "@/components/customer/BuildingForm";
import { Button, Field, Input } from "@/components/ui";

type Step = { kind: "address" } | { kind: "form"; initial: BuildingInitial };

const EXAMPLES = ["대구 남구 대명동 1520-3", "대구 서구 비산동 402-11", "대구 수성구 황금동 77"];

function toInitial(r: RegistryRecord): BuildingInitial {
  return { ...r, source: r.source };
}

export function RegisterFlow({ defaultAddress, windowRatio }: { defaultAddress: string; windowRatio: number }) {
  const [step, setStep] = useState<Step>({ kind: "address" });
  const [address, setAddress] = useState(defaultAddress);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function search(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await lookupBuilding(address);
      if (res.ok) setStep({ kind: "form", initial: toInitial(res.record) });
      else setError(res.message);
    });
  }

  if (step.kind === "form")
    return (
      <BuildingForm
        initial={step.initial}
        windowRatio={windowRatio}
        submitLabel="이 정보로 등록하기"
        onBack={() => setStep({ kind: "address" })}
      />
    );

  return (
    <div className="space-y-5">
      <form onSubmit={search} className="space-y-3">
        <Field label="건물 주소" hint="지번 주소로 입력해주세요. 예: 대구 남구 대명동 123-4" error={error ?? undefined}>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="대구 ○○구 ○○동 번지"
            autoFocus
            aria-invalid={!!error}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={pending || address.trim().length < 4}>
          {pending ? "건축물대장 조회 중…" : "건축물대장에서 불러오기"}
        </Button>
      </form>

      <div>
        <p className="mb-2 text-xs text-muted">데모용 예시 주소</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setAddress(ex)}
              className="rounded-full bg-white px-3 py-1.5 text-sm ring-1 ring-line hover:bg-mint-50"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 text-sm ring-1 ring-line/60">
        <p className="font-semibold">주소로 찾기가 안 되나요?</p>
        <p className="mt-1 text-muted">건물 정보를 직접 입력할 수도 있어요.</p>
        <Button
          type="button"
          variant="outline"
          className="mt-3 w-full py-2.5"
          onClick={() => setStep({ kind: "form", initial: { address, source: "MANUAL" } })}
        >
          직접 입력하기
        </Button>
      </div>
    </div>
  );
}
