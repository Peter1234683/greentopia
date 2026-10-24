"use client";

import { useEffect, useRef, useState } from "react";
import type { LearnCard } from "@/lib/content";

export function LearnDeck({ cards, start = 0 }: { cards: LearnCard[]; start?: number }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(start);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    if (start) el.scrollTo({ left: start * el.clientWidth });
    const onScroll = () => setIndex(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [start]);

  function go(i: number) {
    const el = track.current;
    if (!el) return;
    const next = Math.max(0, Math.min(cards.length - 1, i));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div>
      <div
        ref={track}
        className="-mx-5 flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none]"
        aria-roledescription="카드 넘기기"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(index + 1);
          if (e.key === "ArrowLeft") go(index - 1);
        }}
        tabIndex={0}
      >
        {cards.map((c, i) => (
          <article
            key={c.slug}
            id={c.slug}
            aria-roledescription="카드"
            aria-label={`${i + 1} / ${cards.length}: ${c.title}`}
            className="w-full shrink-0 snap-center px-5"
          >
            <div className="min-h-[60dvh] rounded-3xl bg-white p-6 shadow-sm ring-1 ring-line/60">
              <div className="flex items-center justify-between">
                <span className="text-5xl" aria-hidden="true">{c.emoji}</span>
                <span className="text-xs text-muted tabular-nums">{i + 1} / {cards.length}</span>
              </div>
              <h2 className="mt-4 text-2xl font-extrabold">{c.title}</h2>
              {c.summary && <p className="mt-1 text-forest-700">{c.summary}</p>}
              <div className="prose-gt mt-3 text-[0.95rem] text-ink" dangerouslySetInnerHTML={{ __html: c.html }} />
              {(c.sources.length > 0 || c.needsReview) && (
                <div className="mt-5 border-t border-line pt-3 text-[0.7rem] text-muted">
                  {c.needsReview && <span className="mr-1 rounded bg-warn-bg px-1.5 py-0.5 font-semibold text-warn">출처 확인 중</span>}
                  {c.sources.map((s) => <p key={s} className="mt-1">출처: {s}</p>)}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button type="button" onClick={() => go(index - 1)} disabled={index === 0} className="rounded-full px-4 py-2 text-sm font-semibold text-forest-700 disabled:opacity-30">
          ‹ 이전
        </button>
        <div className="flex gap-1.5" role="tablist" aria-label="카드 목록">
          {cards.map((c, i) => (
            <button
              key={c.slug}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={c.title}
              onClick={() => go(i)}
              className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-forest-700" : "w-2 bg-line"}`}
            />
          ))}
        </div>
        <button type="button" onClick={() => go(index + 1)} disabled={index === cards.length - 1} className="rounded-full px-4 py-2 text-sm font-semibold text-forest-700 disabled:opacity-30">
          다음 ›
        </button>
      </div>
    </div>
  );
}
