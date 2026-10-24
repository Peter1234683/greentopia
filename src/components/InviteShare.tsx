"use client";

import { useState } from "react";

// 초대 링크 공유: Web Share(카카오톡 등 공유 시트) → 안 되면 복사
export function InviteShare({ url, text }: { url: string; text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "그린토피아 공동공사 초대", text, url });
        return;
      } catch {
        return; // 사용자가 취소
      }
    }
    await copy();
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input readOnly value={url} aria-label="초대 링크" className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm" onFocus={(e) => e.currentTarget.select()} />
        <button type="button" onClick={copy} className="shrink-0 rounded-xl px-3 text-sm font-semibold ring-1 ring-line">{copied ? "복사됨 ✓" : "복사"}</button>
      </div>
      <button type="button" onClick={share} className="w-full rounded-2xl bg-[#FEE500] px-5 py-3.5 font-semibold text-[#191919]">
        카카오톡 등으로 공유하기
      </button>
    </div>
  );
}
