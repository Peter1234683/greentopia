import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { demoToolsEnabled } from "@/lib/demo";
import { scenarioSteps } from "@/lib/demoMode";
import { getCurrentUser } from "@/lib/dal";
import { demoReset, demoSwitch } from "@/app/actions/demo";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, Card, Logo } from "@/components/ui";

export const metadata: Metadata = { title: "데모 모드" };

const ROLES = [
  { role: "CUSTOMER", label: "🏠 건물주", sub: "customer@demo.kr" },
  { role: "CONTRACTOR", label: "🛠️ 시공업체", sub: "contractor@demo.kr" },
  { role: "ADMIN", label: "🧭 운영자", sub: "admin@demo.kr" },
];

// 본선 시연용: 역할 빠른 전환 · 시드 초기화 · 시나리오 바로가기 (DEMO_TOOLS=1 또는 개발 모드에서만)
export default async function DemoPage() {
  if (!demoToolsEnabled()) notFound();
  const [user, steps] = await Promise.all([getCurrentUser(), scenarioSteps()]);
  return (
    <main className="mx-auto w-full max-w-md space-y-5 px-5 py-8">
      <div className="flex items-center justify-between">
        <Link href="/"><Logo /></Link>
        <Badge tone="warn">🧪 데모 모드</Badge>
      </div>
      <div>
        <h1 className="text-2xl font-extrabold">시연 도구</h1>
        <p className="mt-1 text-sm text-muted">지금 로그인: {user ? `${user.name} (${user.email})` : "없음"} · 데모 계정 비밀번호는 모두 demo1234</p>
      </div>

      <Card>
        <p className="font-bold">역할 빠른 전환</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {ROLES.map((r) => (
            <form key={r.role} action={demoSwitch}>
              <input type="hidden" name="role" value={r.role} />
              <button className="w-full rounded-2xl bg-white px-2 py-3 text-sm font-semibold ring-1 ring-line hover:ring-mint-400">
                {r.label}
                <span className="block text-[0.6rem] font-normal text-muted">{r.sub}</span>
              </button>
            </form>
          ))}
        </div>
      </Card>

      <Card>
        <p className="font-bold">시연 시나리오 바로가기</p>
        <ol className="mt-3 space-y-2">
          {steps.map((s) => (
            <li key={s.n}>
              <form action={demoSwitch}>
                <input type="hidden" name="role" value={s.role === "OWNER" ? "CUSTOMER" : s.role} />
                {s.email && <input type="hidden" name="email" value={s.email} />}
                <input type="hidden" name="to" value={s.to} />
                <button className="flex w-full items-center gap-3 rounded-2xl bg-surface px-3 py-2.5 text-left hover:bg-mint-50">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest-800 text-sm font-bold text-white">{s.n}</span>
                  <span className="flex-1">
                    <span className="block text-sm font-bold">{s.title}</span>
                    <span className="block text-xs text-muted">{s.desc} · {s.role === "OWNER" ? "완료 공사 건물주" : ROLES.find((r) => r.role === s.role)?.label}</span>
                  </span>
                  <span aria-hidden="true" className="text-muted">›</span>
                </button>
              </form>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-muted">6~8단계는 시드의 완료된 공동공사(실제 송금 없음, 기록만)를 보여줘요.</p>
      </Card>

      <Card>
        <p className="font-bold">시드 데이터 초기화</p>
        <p className="mt-1 text-sm text-muted">모든 데이터를 처음 상태(대구 100동 · 업체 15곳)로 되돌리고 고른 역할로 다시 로그인해요. 10~30초 걸려요.</p>
        <form action={demoReset} className="mt-3 flex gap-2">
          <select name="role" aria-label="초기화 후 역할" className="rounded-xl border border-line bg-white px-3 text-sm">
            {ROLES.map((r) => <option key={r.role} value={r.role}>{r.label}</option>)}
          </select>
          <SubmitButton pendingLabel="초기화 중…" variant="outline" className="flex-1 py-3 text-sm">초기화</SubmitButton>
        </form>
      </Card>

      <Card className="text-sm">
        <p className="font-bold">그 밖에</p>
        <ul className="mt-2 space-y-1">
          <li><Link href="/customer/welcome?replay=1" className="text-forest-700 underline">건물주 온보딩 다시 보기</Link></li>
          <li><Link href="/?demo=0" className="text-forest-700 underline">헤더 데모 메뉴 숨기기</Link></li>
        </ul>
      </Card>
    </main>
  );
}
