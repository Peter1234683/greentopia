import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { ServiceWorker } from "@/components/ServiceWorker";

export const metadata: Metadata = {
  title: { default: "그린토피아", template: "%s · 그린토피아" },
  description: "혼자 고치면 비싸고, 모아 고치면 싸다. 이웃과 함께하는 그린리모델링 공동공사 플랫폼",
  applicationName: "그린토피아",
  appleWebApp: { capable: true, title: "그린토피아", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0c3526",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const large = (await cookies()).get("gt_large")?.value === "1";
  return (
    <html lang="ko" className={`h-full antialiased ${large ? "text-large" : ""}`}>
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
