import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";
import { AccountActions } from "@/components/AccountActions";
import Link from "next/link";
import { Card } from "@/components/ui";
import { InstallPrompt } from "@/components/InstallPrompt";

export const metadata: Metadata = { title: "마이" };

export default async function MyPage() {
  const user = await requireRole("CUSTOMER");
  return (
    <div className="space-y-4 pt-2">
      <h1 className="text-2xl font-extrabold">마이</h1>
      <Card>
        <p className="text-lg font-bold">{user.name}</p>
        <p className="text-sm text-muted">{user.email}</p>
        <p className="text-sm text-muted">{user.phone}</p>
        <p className="mt-3 text-sm">
          보유 포인트 <span className="font-bold text-forest-700">{(user.customerProfile?.points ?? 0).toLocaleString()}P</span>
        </p>
      </Card>
      <a href="/customer/subsidy" className="block">
        <Card className="flex items-center justify-between">
          <span className="font-semibold">💰 숨은 지원금 · 우대 대상 설정</span>
          <span aria-hidden="true" className="text-muted">›</span>
        </Card>
      </a>
      <InstallPrompt compact />
      <Link href="/customer/welcome?replay=1" className="block">
        <Card className="flex items-center justify-between">
          <span className="font-semibold">👋 온보딩 다시 보기</span>
          <span aria-hidden="true" className="text-muted">›</span>
        </Card>
      </Link>
      <AccountActions />
    </div>
  );
}
