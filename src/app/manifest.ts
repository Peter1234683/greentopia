import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "그린토피아 — 이웃과 함께하는 그린리모델링",
    short_name: "그린토피아",
    description: "혼자 고치면 비싸고, 모아 고치면 싸다. 이웃 건물과 함께하는 그린리모델링 공동공사 플랫폼",
    start_url: "/",
    display: "standalone",
    background_color: "#0c3526",
    theme_color: "#0c3526",
    lang: "ko",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
