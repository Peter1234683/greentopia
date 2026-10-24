"use client";

import { useActionState } from "react";
import { confirmParticipation, declineParticipation, signContract } from "@/app/actions/contract";
import { Button } from "@/components/ui";

export function ConfirmForm({ contractId, negotiated }: { contractId: string; negotiated: boolean }) {
  const [state, action, pending] = useActionState(confirmParticipation, undefined);
  return (
    <div className="space-y-2">
      <form action={action} className="space-y-3">
        <input type="hidden" name="contractId" value={contractId} />
        {negotiated && (
          <label className="flex items-start gap-2 rounded-xl bg-warn-bg p-3 text-sm text-warn">
            <input type="checkbox" name="consent" className="mt-1" />
            수의계약 전환 사유와 금액(직전 공고 상한 이하)을 확인했고, 이 업체와 진행하는 데 동의해요.
          </label>
        )}
        <Button className="w-full" disabled={pending}>{pending ? "처리 중…" : "참여 확정하고 현장확인 받기"}</Button>
        {state?.message && <p role="status" className="text-sm text-forest-700">{state.message}</p>}
      </form>
      <form action={declineParticipation}>
        <input type="hidden" name="contractId" value={contractId} />
        <Button variant="ghost" className="w-full text-sm text-muted">이번에는 참여하지 않을래요</Button>
      </form>
    </div>
  );
}

export function SignForm({ contractId }: { contractId: string }) {
  const [state, action, pending] = useActionState(signContract, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="contractId" value={contractId} />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="agree" className="mt-1" />
        공사 금액·기간·하자보증 조건을 확인했어요. 계약은 우리 건물과 시공업체 간 개별 계약이에요.
      </label>
      <Button className="w-full" disabled={pending}>{pending ? "처리 중…" : "계약서 서명하기"}</Button>
      {state?.message && <p role="status" className="text-sm text-forest-700">{state.message}</p>}
    </form>
  );
}
