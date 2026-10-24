"use client";

import { useState } from "react";
import Link from "next/link";
import { markOnboarded } from "@/app/actions/demo";
import { Button } from "@/components/ui";

const SLIDES = [
  { icon: "🔍", title: "우리 집 상태부터", body: "주소와 사진 몇 장이면 어디가 약한지, 어떤 공사가 필요한지 알려드려요." },
  { icon: "💰", title: "숨은 지원금 찾기", body: "출처가 확인된 지원사업만 골라 우리 집 조건과 대조해요. 실제 적용은 공고문으로 확인해요." },
  { icon: "🤝", title: "이웃과 함께 고치기", body: "같은 공사가 필요한 이웃을 AI가 묶어요. 모일수록 자재·장비·인력을 함께 써 비용을 줄일 수 있어요." },
  { icon: "🛡️", title: "업체 선정부터 준공까지 안심", body: "가격만이 아닌 종합평가로 업체를 정하고, 계약은 건물별로 따로, 단계마다 건물주가 승인해요." },
];

export function Slides({ replay }: { replay: boolean }) {
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;
  return (
    <div className="flex min-h-[70dvh] flex-col">
      <div className="flex flex-1 flex-col items-center justify-center text-center" aria-live="polite">
        <div className="text-7xl" aria-hidden="true">{s.icon}</div>
        <h1 className="mt-6 text-2xl font-extrabold">{s.title}</h1>
        <p className="mt-3 max-w-xs text-muted">{s.body}</p>
      </div>
      <div className="flex justify-center gap-2 py-6" aria-label={`${i + 1} / ${SLIDES.length}`}>
        {SLIDES.map((_, k) => <span key={k} className={`h-2 rounded-full transition-all ${k === i ? "w-6 bg-forest-700" : "w-2 bg-line"}`} />)}
      </div>
      {last ? (
        replay ? (
          <Link href="/customer/my" className="block rounded-2xl bg-forest-800 py-3.5 text-center font-semibold text-white">마이로 돌아가기</Link>
        ) : (
          <form action={markOnboarded}><Button className="w-full">시작하기</Button></form>
        )
      ) : (
        <div className="flex gap-2">
          {i > 0 && <Button variant="outline" onClick={() => setI(i - 1)} className="flex-1">이전</Button>}
          <Button onClick={() => setI(i + 1)} className="flex-1">다음</Button>
        </div>
      )}
    </div>
  );
}
