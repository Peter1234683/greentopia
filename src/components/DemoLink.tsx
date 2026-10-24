import Link from "next/link";

// 헤더 숨김 데모 메뉴 (운영자 또는 ?demo=1 로 들어온 경우, 데모 도구가 켜진 서버에서만)
export function DemoLink({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/demo" aria-label="데모 모드" className={`inline-flex h-9 items-center rounded-full px-2 text-xs font-bold ${dark ? "text-mint-300 hover:bg-white/10" : "text-warn hover:bg-white"}`}>
      🧪 데모
    </Link>
  );
}
