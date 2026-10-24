// 지도 컴포넌트 공통 인터페이스. 카카오맵 등으로 바꿀 때 이 props 만 맞추면 된다.
export type MapMarker = { id: string; lat: number; lng: number; label?: string; tone?: "me" | "member" | "other" | "highlight" };
export type MapCircle = { lat: number; lng: number; radiusM: number };
export type MapProps = {
  center: [number, number];
  zoom?: number;
  markers: MapMarker[];
  circles?: MapCircle[];
  height?: number;
  fit?: boolean;
};
