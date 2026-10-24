import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { ROLE_HOME, type Role } from "@/lib/constants";
import { ButtonLink, Logo } from "@/components/ui";

export default async function Splash() {
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME[user.role as Role]);

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-forest-900 text-white">
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-mint-400/20 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-forest-600/40 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-10 pt-14">
        <Logo light />
        <div className="mt-auto">
          <p className="mb-4 inline-block rounded-full bg-white/10 px-3 py-1 text-sm text-mint-300">
            이웃과 함께하는 그린리모델링
          </p>
          <h1 className="text-[2.1rem] font-extrabold leading-tight">
            혼자 고치면 비싸고,
            <br />
            <span className="text-mint-400">모아 고치면 싸다.</span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/75">
            AI가 우리 동네에서 같은 공사가 필요한 이웃 건물을 찾아 묶어 드려요.
            가격은 여러 시공업체의 공개 입찰로 정해집니다.
          </p>

          <div className="mt-8 grid grid-cols-3 gap-2 text-center text-xs text-white/80">
            {[
              ["🏠", "우리 집 진단"],
              ["🤝", "이웃과 묶기"],
              ["🏗️", "입찰로 업체 선택"],
            ].map(([icon, label]) => (
              <div key={label} className="rounded-2xl bg-white/5 px-2 py-3 ring-1 ring-white/10">
                <div className="text-2xl" aria-hidden="true">{icon}</div>
                <div className="mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 space-y-3">
          <ButtonLink href="/onboarding" variant="mint" className="w-full text-lg">
            시작하기
          </ButtonLink>
          <ButtonLink href="/login" variant="ghost" className="w-full text-white hover:bg-white/10">
            이미 회원이에요 · 로그인
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
