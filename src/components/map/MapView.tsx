"use client";

import dynamic from "next/dynamic";
import type { MapProps } from "./types";

// Leaflet 은 window 가 필요하므로 클라이언트에서만 불러온다.
const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => <div className="h-full animate-pulse rounded-2xl bg-line/50" />,
});

export function MapView(props: MapProps) {
  return (
    // isolate: Leaflet 레이어(z-index 400)가 고정 헤더·하단 탭 위로 올라오지 않게 새 쌓임 맥락을 만든다
    <div style={{ height: props.height ?? 240 }} role="region" aria-label="지도" className="relative isolate z-0">
      <LeafletMap {...props} />
    </div>
  );
}
