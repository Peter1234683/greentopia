import { cookies } from "next/headers";
import { logout } from "@/app/actions/auth";
import { toggleLargeText } from "@/app/actions/preferences";
import { Button, Card } from "./ui";

export async function AccountActions() {
  const large = (await cookies()).get("gt_large")?.value === "1";
  return (
    <>
      <Card>
        <form action={toggleLargeText} className="flex items-center justify-between gap-4">
          <div>
            <p className="font-bold">큰 글씨</p>
            <p className="text-sm text-muted">글자와 버튼을 크게 보여드려요.</p>
          </div>
          <button
            type="submit"
            role="switch"
            aria-checked={large}
            aria-label="큰 글씨"
            className={`relative h-8 w-14 shrink-0 rounded-full transition ${large ? "bg-forest-700" : "bg-gray-300"}`}
          >
            <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${large ? "left-7" : "left-1"}`} />
          </button>
        </form>
      </Card>
      <form action={logout}>
        <Button variant="outline" className="w-full">로그아웃</Button>
      </form>
    </>
  );
}
