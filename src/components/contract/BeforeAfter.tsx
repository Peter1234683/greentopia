"use client";

import { useState } from "react";

// 전/후 비교: 슬라이더로 가르기 + 나란히 보기
export function BeforeAfter({ before, after }: { before: string[]; after: string[] }) {
  const [mode, setMode] = useState<"slide" | "side">("slide");
  const [pos, setPos] = useState(50);
  const [i, setI] = useState(0);
  const b = before[Math.min(i, before.length - 1)];
  const a = after[Math.min(i, after.length - 1)];
  const pairs = Math.max(before.length, after.length);
  if (!a) return <p className="text-sm text-muted">완료 사진이 없어요.</p>;
  return (
    <div className="space-y-2">
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 text-sm" role="tablist">
        {(["slide", "side"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`flex-1 rounded-lg py-1.5 font-semibold ${mode === m ? "bg-white shadow-sm" : "text-muted"}`}>
            {m === "slide" ? "슬라이더 비교" : "나란히 보기"}
          </button>
        ))}
      </div>
      {!b ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/files/${a}`} alt="시공 후" className="aspect-[4/3] w-full rounded-2xl object-cover" />
          <p className="text-xs text-muted">시공 전 사진(진단 때 올린 사진)이 없어 시공 후 사진만 보여드려요.</p>
        </>
      ) : mode === "slide" ? (
        <div className="relative aspect-[4/3] w-full select-none overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/files/${a}`} alt="시공 후" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/files/${b}`} alt="시공 전" className="h-full max-w-none object-cover" style={{ width: `${10000 / Math.max(pos, 1)}%` }} />
          </div>
          <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${pos}%` }} />
          <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-bold text-white">시공 전</span>
          <span className="absolute right-2 top-2 rounded-full bg-mint-400 px-2 py-0.5 text-xs font-bold text-forest-950">시공 후</span>
          <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label="전후 비교 위치" className="absolute inset-x-0 bottom-2 mx-auto w-4/5 accent-white" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {[["시공 전", b], ["시공 후", a]].map(([l, id]) => (
            <figure key={l}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/files/${id}`} alt={l} className="aspect-square w-full rounded-xl object-cover" />
              <figcaption className="mt-0.5 text-center text-xs text-muted">{l}</figcaption>
            </figure>
          ))}
        </div>
      )}
      {pairs > 1 && (
        <div className="flex justify-center gap-1">
          {Array.from({ length: pairs }, (_, k) => (
            <button key={k} type="button" onClick={() => setI(k)} aria-label={`${k + 1}번째 사진`} className={`h-2 w-2 rounded-full ${k === i ? "bg-forest-700" : "bg-line"}`} />
          ))}
        </div>
      )}
    </div>
  );
}
