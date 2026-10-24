import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents 는 끈다: 거의 모든 화면이 로그인 사용자별 동적 화면이라 MVP에서는 이득보다 복잡도가 크다.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
  experimental: {
    // 사업자 증빙(5MB × 2) · 진단 사진(5MB × 4) 업로드
    serverActions: { bodySizeLimit: "24mb" },
  },
};

export default nextConfig;
