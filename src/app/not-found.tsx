import { ButtonLink, Logo } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center px-6 text-center">
      <Logo />
      <p className="mt-8 text-5xl" aria-hidden="true">🔎</p>
      <h1 className="mt-4 text-xl font-extrabold">찾는 화면이 없어요</h1>
      <p className="mt-2 text-muted">주소가 바뀌었거나, 볼 수 있는 권한이 없는 정보예요.</p>
      <ButtonLink href="/" className="mt-6 w-full">처음으로</ButtonLink>
    </main>
  );
}
