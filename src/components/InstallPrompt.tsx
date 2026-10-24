"use client";

import { useEffect, useState } from "react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);

// 홈 화면에 추가 안내: Android/Chrome 은 설치 버튼, iOS Safari 는 공유 → 홈 화면에 추가 안내 시트, 설치돼 있으면 숨김
export function InstallPrompt({ compact = false }: { compact?: boolean }) {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone()) return;
    let dismissed = false;
    try {
      dismissed = !compact && localStorage.getItem("gt_install_dismissed") === "1";
    } catch {}
    if (dismissed) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const onInstalled = () => setHidden(true);
    window.addEventListener("appinstalled", onInstalled);
    // iOS 는 설치 이벤트가 없으므로 안내 시트용 버튼을 보여준다 (렌더 후 반영)
    const t = isIOS()
      ? setTimeout(() => {
          setIos(true);
          setHidden(false);
        }, 0)
      : undefined;
    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [compact]);

  if (hidden) return null;

  async function install() {
    if (evt) {
      await evt.prompt();
      const r = await evt.userChoice;
      if (r.outcome === "accepted") setHidden(true);
      setEvt(null);
    } else if (ios) setSheet(true);
  }
  function dismiss() {
    try {
      localStorage.setItem("gt_install_dismissed", "1");
    } catch {}
    setHidden(true);
  }

  return (
    <>
      <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-line/60" data-testid="install-prompt">
        <span className="text-2xl" aria-hidden="true">📲</span>
        <p className="flex-1 text-sm"><b>홈 화면에 추가</b><span className="block text-xs text-muted">앱처럼 바로 열고 알림을 받아요</span></p>
        <button type="button" onClick={install} className="rounded-xl bg-forest-800 px-3 py-2 text-sm font-semibold text-white">{ios ? "방법 보기" : "설치"}</button>
        {!compact && <button type="button" onClick={dismiss} aria-label="닫기" className="text-muted">✕</button>}
      </div>
      {sheet && (
        <div role="dialog" aria-modal="true" aria-label="홈 화면에 추가 방법" className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setSheet(false)}>
          <div className="w-full rounded-t-3xl bg-white p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-bold">아이폰에서 홈 화면에 추가하기</p>
            <ol className="mt-3 space-y-2 text-sm">
              <li>1. Safari 아래쪽의 <b>공유 버튼</b>(□↑)을 눌러요</li>
              <li>2. 목록에서 <b>홈 화면에 추가</b>를 골라요</li>
              <li>3. 오른쪽 위 <b>추가</b>를 누르면 끝!</li>
            </ol>
            <button type="button" onClick={() => setSheet(false)} className="mt-5 w-full rounded-2xl bg-forest-800 py-3 font-semibold text-white">알겠어요</button>
          </div>
        </div>
      )}
    </>
  );
}
