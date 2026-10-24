import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";
import { AccountActions } from "@/components/AccountActions";
import { Card } from "@/components/ui";

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
      <AccountActions />
    </div>
  );
}
