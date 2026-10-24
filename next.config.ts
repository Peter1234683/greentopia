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
  experimental: {
    // 사업자 가입 시 증빙 파일(최대 5MB × 2) 업로드
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
