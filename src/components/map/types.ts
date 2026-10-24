// 지도 컴포넌트 공통 인터페이스. 카카오맵 등으로 바꿀 때 이 props 만 맞추면 된다.
export type MapMarker = { id: string; lat: number; lng: number; label?: string; tone?: "me" | "member" | "other" | "highlight"; permanent?: boolean };
export type MapCircle = { lat: number; lng: number; radiusM: number };
// 수요 밀도 표시용 원 (격자 칸). intensity 0~1 로 진하기를 정한다.
export type MapBubble = { lat: number; lng: number; radiusM: number; intensity: number; label?: string };
export type MapProps = {
  center: [number, number];
  zoom?: number;
  markers: MapMarker[];
  circles?: MapCircle[];
  bubbles?: MapBubble[];
  path?: [number, number][]; // 동선 (순서대로 잇는 선)
  height?: number;
  fit?: boolean;
};
