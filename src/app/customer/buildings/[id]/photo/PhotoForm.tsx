"use client";

import { useActionState, useState } from "react";
import { runPhotoDiagnosis } from "@/app/actions/photo";
import { Button, inputClass } from "@/components/ui";
import { PHOTO_PARTS } from "@/lib/constants";
import { MAX_PHOTOS, PHOTO_MAX_EDGE } from "@/config/photoDiagnosis";

// 업로드 전에 브라우저에서 긴 변을 줄여 JPEG 로 바꾼다 (전송량·AI 비용 절감). 실패하면 원본 그대로.
async function shrink(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.type === "image/jpeg") return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

const DEFAULT_PARTS = ["WINDOW", "WALL", "CEILING", "BOILER"];

export function PhotoForm({ buildingId }: { buildingId: string }) {
  const [state, action, pending] = useActionState(runPhotoDiagnosis, undefined);
  const [previews, setPreviews] = useState<(string | null)[]>(Array(MAX_PHOTOS).fill(null));

  async function onPick(i: number, input: HTMLInputElement) {
    const f = input.files?.[0];
    if (!f) return setPreviews((p) => p.map((x, j) => (j === i ? null : x)));
    const small = await shrink(f);
    const dt = new DataTransfer();
    dt.items.add(small);
    input.files = dt.files;
    const url = URL.createObjectURL(small);
    setPreviews((p) => p.map((x, j) => (j === i ? url : x)));
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="buildingId" value={buildingId} />
      {Array.from({ length: MAX_PHOTOS }, (_, i) => (
        <fieldset key={i} className="rounded-3xl bg-white p-4 ring-1 ring-line/60">
          <legend className="sr-only">사진 {i + 1}</legend>
          <div className="flex gap-3">
            <label className="flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-mint-50 text-center text-xs text-forest-700 ring-1 ring-mint-100">
              {previews[i] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previews[i]!} alt={`사진 ${i + 1} 미리보기`} className="h-full w-full object-cover" />
              ) : (
                <span>📷<br />사진 {i + 1}</span>
              )}
              <input type="file" name={`photo${i}`} accept="image/*" capture="environment" className="sr-only" onChange={(e) => onPick(i, e.currentTarget)} aria-label={`사진 ${i + 1} 선택`} />
            </label>
            <div className="min-w-0 flex-1 space-y-2">
              <select name={`part${i}`} defaultValue={DEFAULT_PARTS[i]} aria-label={`사진 ${i + 1} 부위`} className={`${inputClass} py-2 text-sm`}>
                {PHOTO_PARTS.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
              </select>
              <input name={`note${i}`} maxLength={200} placeholder="예: 겨울마다 모서리에 곰팡이" aria-label={`사진 ${i + 1} 메모`} className={`${inputClass} py-2 text-sm`} />
            </div>
          </div>
        </fieldset>
      ))}
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">집 전체에 대한 메모 (선택)</span>
        <textarea name="memo" rows={3} maxLength={300} placeholder="예: 북쪽 방이 유난히 춥고, 창문에 물방울이 맺혀요" className={inputClass} />
      </label>
      {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <Button disabled={pending} className="w-full">{pending ? "사진을 살펴보는 중… (최대 1분)" : "사진으로 진단받기"}</Button>
    </form>
  );
}
