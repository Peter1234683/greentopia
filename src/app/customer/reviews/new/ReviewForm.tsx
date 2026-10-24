"use client";

import { useActionState, useState } from "react";
import { createReview } from "@/app/actions/review";
import { Button, inputClass } from "@/components/ui";
import { COMPLAINT_TAGS } from "@/lib/constants";

const ITEMS = [
  ["ratingQuality", "시공 품질"],
  ["ratingSchedule", "공사기간 준수"],
  ["ratingCleanliness", "청결·안전"],
  ["ratingComm", "소통"],
  ["ratingAS", "A/S 대응"],
  ["ratingValue", "가격 대비 만족"],
] as const;

function Stars({ name, label }: { name: string; label: string }) {
  const [v, setV] = useState(0);
  return (
    <fieldset className="flex items-center justify-between">
      <legend className="sr-only">{label}</legend>
      <span className="text-sm font-semibold" aria-hidden="true">{label}</span>
      <div className="flex" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer px-0.5">
            <input type="radio" name={name} value={n} className="peer sr-only" onChange={() => setV(n)} aria-label={`${label} ${n}점`} />
            <span className={`text-3xl leading-none peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-mint-500 ${n <= v ? "text-amber-500" : "text-gray-300"}`} aria-hidden="true">★</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ReviewForm({ contractId, kind }: { contractId: string; kind: "INITIAL" | "FOLLOWUP_6M" | "FOLLOWUP_12M" }) {
  const [state, action, pending] = useActionState(createReview, undefined);
  const [defect, setDefect] = useState<string>("");
  const followup = kind !== "INITIAL";
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="contractId" value={contractId} />
      <input type="hidden" name="kind" value={kind} />
      {followup ? (
        <>
          <fieldset className="space-y-2">
            <legend className="mb-2 font-bold">공사한 부분에 하자가 생겼나요?</legend>
            <div className="grid grid-cols-2 gap-2">
              {[["no", "아니요, 괜찮아요"], ["yes", "네, 생겼어요"]].map(([v, l]) => (
                <label key={v} className="cursor-pointer">
                  <input type="radio" name="defectOccurred" value={v} className="peer sr-only" onChange={() => setDefect(v)} />
                  <span className="block rounded-xl py-3 text-center ring-1 ring-line peer-checked:bg-mint-50 peer-checked:font-semibold peer-checked:ring-2 peer-checked:ring-forest-700">{l}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {defect === "yes" && (
            <fieldset className="space-y-2">
              <legend className="mb-2 font-bold">업체가 하자를 처리해줬나요?</legend>
              <div className="grid grid-cols-2 gap-2">
                {[["yes", "처리됐어요"], ["no", "아직이에요"]].map(([v, l]) => (
                  <label key={v} className="cursor-pointer">
                    <input type="radio" name="defectResolved" value={v} className="peer sr-only" />
                    <span className="block rounded-xl py-3 text-center ring-1 ring-line peer-checked:bg-mint-50 peer-checked:font-semibold peer-checked:ring-2 peer-checked:ring-forest-700">{l}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <Stars name="ratingAS" label="A/S 대응" />
        </>
      ) : (
        <div className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-line/60">
          {ITEMS.map(([name, label]) => <Stars key={name} name={name} label={label} />)}
        </div>
      )}
      <fieldset>
        <legend className="mb-2 font-bold">아쉬웠던 점이 있었나요? <span className="text-sm font-normal text-muted">(여러 개 선택)</span></legend>
        <div className="flex flex-wrap gap-2">
          {COMPLAINT_TAGS.map((t) => (
            <label key={t.code} className="cursor-pointer">
              <input type="checkbox" name="tags" value={t.code} className="peer sr-only" />
              <span className="inline-block rounded-full px-3 py-1.5 text-sm ring-1 ring-line peer-checked:bg-red-50 peer-checked:text-danger peer-checked:ring-red-300 peer-focus-visible:ring-2 peer-focus-visible:ring-mint-400">{t.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="mb-2 block font-bold">후기</span>
        <textarea name="text" rows={4} className={inputClass} placeholder="공사 과정과 결과를 이웃에게 알려주세요." />
      </label>
      <label className="block">
        <span className="mb-2 block font-bold">사진 (최대 5장)</span>
        <input name="photos" type="file" accept="image/*" multiple className={inputClass} />
      </label>
      {state?.message && <p role="alert" className="text-sm text-danger">{state.message}</p>}
      <Button className="w-full" disabled={pending}>{pending ? "등록 중…" : "리뷰 등록"}</Button>
      <p className="text-center text-xs text-muted">허위·비방 리뷰는 신고되어 숨겨질 수 있어요.</p>
    </form>
  );
}
