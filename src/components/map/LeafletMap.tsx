"use client";

import "leaflet/dist/leaflet.css";
import { Circle, CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import { useEffect } from "react";
import type { MapProps } from "./types";

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    // 애니메이션 중 화면을 떠나면 Leaflet 이 _leaflet_pos 오류를 내므로 애니메이션 없이 맞춘다
    if (points.length > 1) map.fitBounds(points, { padding: [24, 24], maxZoom: 16, animate: false });
  }, [map, points]);
  return null;
}

const TONE = {
  me: { color: "#ffffff", fillColor: "#072419", radius: 9 },
  member: { color: "#ffffff", fillColor: "#1a6347", radius: 7 },
  other: { color: "#ffffff", fillColor: "#8fb8a6", radius: 5 },
  highlight: { color: "#ffffff", fillColor: "#24c99a", radius: 7 },
};

export default function LeafletMap({ center, zoom = 14, markers, circles = [], bubbles = [], path, height = 240, fit = true }: MapProps) {
  const points = [...markers, ...bubbles].map((m) => [m.lat, m.lng] as [number, number]);
  return (
    <div style={{ height }} className="overflow-hidden rounded-2xl ring-1 ring-line">
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={false}
        zoomAnimation={false}
        fadeAnimation={false}
        markerZoomAnimation={false}
        style={{ height: "100%", width: "100%" }}
        attributionControl
      >
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {circles.map((c, i) => (
          <Circle key={i} center={[c.lat, c.lng]} radius={c.radiusM} pathOptions={{ color: "#1a6347", weight: 2, dashArray: "6 6", fillColor: "#24c99a", fillOpacity: 0.08 }} />
        ))}
        {bubbles.map((b, i) => (
          <Circle key={`b${i}`} center={[b.lat, b.lng]} radius={b.radiusM} pathOptions={{ stroke: false, fillColor: "#1a6347", fillOpacity: 0.15 + 0.55 * b.intensity }}>
            {b.label && <Tooltip direction="top">{b.label}</Tooltip>}
          </Circle>
        ))}
        {path && path.length > 1 && <Polyline positions={path} pathOptions={{ color: "#072419", weight: 3, dashArray: "2 6" }} />}
        {markers.map((m) => {
          const t = TONE[m.tone ?? "member"];
          return (
            <CircleMarker key={m.id} center={[m.lat, m.lng]} radius={t.radius} pathOptions={{ color: t.color, weight: 2, fillColor: t.fillColor, fillOpacity: 1 }}>
              {m.label && (
                <Tooltip direction="top" offset={[0, -6]} permanent={m.permanent}>
                  {m.label}
                </Tooltip>
              )}
            </CircleMarker>
          );
        })}
        {fit && <FitBounds points={points} />}
      </MapContainer>
    </div>
  );
}
