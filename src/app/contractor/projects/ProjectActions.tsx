"use client";

import { useActionState } from "react";
import { completeProject } from "@/app/actions/contract";
import { saveLot } from "@/app/actions/payment";
import { Button, inputClass } from "@/components/ui";

export function CompleteForm({ contractId, isAS }: { contractId: string; isAS: boolean }) {
  const [state, action, pending] = useActionState(completeProject, undefined);
  return (
    <form action={action} className="mt-2 space-y-2 rounded-xl bg-surface p-3">
      <input type="hidden" name="contractId" value={contractId} />
      <p className="text-sm font-semibold">{isAS ? "A/S 처리 완료 보고" : "완료 보고"}</p>
      <input name="photos" type="file" accept="image/*" multiple className={`${inputClass} py-2 text-sm`} aria-label="완료 사진" />
      <textarea name="note" rows={2} className={`${inputClass} text-sm`} placeholder={isAS ? "처리 내용" : "시공 내용·특이사항"} />
      <Button className="w-full py-2.5 text-sm" disabled={pending}>{pending ? "올리는 중…" : isAS ? "A/S 완료" : "완료 보고 올리기"}</Button>
      {state?.message && <p role="status" className="text-sm text-forest-700">{state.message}</p>}
    </form>
  );
}

export function LotForm({ contractId, lotNumber }: { contractId: string; lotNumber: string | null }) {
  const [state, action, pending] = useActionState(saveLot, undefined);
  return (
    <form action={action} className="mt-2 space-y-2 rounded-xl bg-surface p-3">
      <input type="hidden" name="contractId" value={contractId} />
      <p className="text-sm font-semibold">준공 검측 · 자재 LOT 입력</p>
      <input name="lotNumber" defaultValue={lotNumber ?? ""} placeholder="자재 LOT 번호 (예: PVC-2026-0412-A)" className={`${inputClass} py-2 text-sm`} aria-label="LOT 번호" />
      <input name="lotPhotos" type="file" accept="image/*" multiple className={`${inputClass} py-2 text-sm`} aria-label="인증 라벨 사진" />
      <Button className="w-full py-2.5 text-sm" variant="outline" disabled={pending}>{pending ? "저장 중…" : "LOT · 라벨 저장"}</Button>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-forest-700">저장했어요.</p>}
    </form>
  );
}
