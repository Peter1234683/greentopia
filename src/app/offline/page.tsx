import { Logo } from "@/components/ui";

export const metadata = { title: "오프라인" };

export default function Offline() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <Logo />
      <p className="mt-8 text-5xl" aria-hidden="true">📶</p>
      <h1 className="mt-4 text-xl font-extrabold">인터넷 연결이 끊겼어요</h1>
      <p className="mt-2 text-muted">연결되면 다시 시도해주세요. 입력하던 내용은 연결 후 다시 저장해야 해요.</p>
    </main>
  );
}
