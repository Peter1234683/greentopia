"use client";

import { useActionState } from "react";
import { approveInspection } from "@/app/actions/payment";
import { Button, inputClass } from "@/components/ui";

export function ApproveInspection({ contractId, hasIssues }: { contractId: string; hasIssues: boolean }) {
  const [state, action, pending] = useActionState(approveInspection, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="contractId" value={contractId} />
      <textarea name="note" rows={2} maxLength={500} placeholder="남길 메모 (선택)" className={inputClass} />
      {hasIssues && (
        <label className="flex gap-2 text-sm">
          <input type="checkbox" name="acceptIssues" className="mt-0.5 h-5 w-5 accent-forest-700" />
          미흡 항목을 확인했고 그대로 승인할게요 (A/S 로 보완 요청 가능)
        </label>
      )}
      {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <Button disabled={pending} className="w-full">{pending ? "승인 중…" : "준공 검측 승인하기"}</Button>
    </form>
  );
}
