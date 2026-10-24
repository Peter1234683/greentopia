"use client";

import { useActionState, useRef } from "react";
import { askAdvisor } from "@/app/actions/subsidy";
import { Button, inputClass } from "@/components/ui";

export function AdvisorForm({ buildingId, suggestions }: { buildingId: string; suggestions: string[] }) {
  const [state, action, pending] = useActionState(askAdvisor, undefined);
  const ref = useRef<HTMLFormElement>(null);
  const ask = (q: string) => {
    const f = ref.current;
    if (!f || pending) return;
    (f.elements.namedItem("question") as HTMLTextAreaElement).value = q;
    f.requestSubmit();
  };
  return (
    <div className="sticky bottom-20 space-y-2 bg-surface/95 py-2">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {suggestions.map((s) => (
          <button key={s} type="button" onClick={() => ask(s)} disabled={pending} className="shrink-0 rounded-full bg-white px-3 py-1.5 text-sm ring-1 ring-mint-300 hover:bg-mint-50 disabled:opacity-50">
            {s}
          </button>
        ))}
      </div>
      <form ref={ref} action={action} className="flex gap-2">
        <input type="hidden" name="buildingId" value={buildingId} />
        <textarea name="question" rows={1} className={`${inputClass} resize-none py-2.5`} placeholder="지원금에 대해 물어보세요" aria-label="질문" />
        <Button className="shrink-0 px-4 py-2.5" disabled={pending}>{pending ? "…" : "보내기"}</Button>
      </form>
      {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      {pending && <p role="status" className="text-sm text-muted">등록된 지원사업을 찾아보고 있어요…</p>}
    </div>
  );
}
