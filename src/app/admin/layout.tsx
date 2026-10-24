import { requireRole } from "@/lib/dal";
import { AppHeader } from "@/components/AppHeader";
import { logout } from "@/app/actions/auth";
import { AdminNav } from "@/components/admin/AdminNav";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireRole("ADMIN");
  return (
    <>
      <AppHeader
        home="/admin"
        dark
        wide
        right={
          <form action={logout} className="flex items-center gap-3 text-sm text-white/80">
            <span>운영자</span>
            <button className="underline underline-offset-4">로그아웃</button>
          </form>
        }
      />
      <AdminNav />
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-6">{children}</main>
    </>
  );
}
