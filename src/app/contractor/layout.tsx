import { requireRole } from "@/lib/dal";
import { AppHeader } from "@/components/AppHeader";
import { BottomTabs, type Tab } from "@/components/BottomTabs";
import { Badge } from "@/components/ui";
import { CONTRACTOR_REVIEW_STATUS_LABEL } from "@/lib/constants";

const TABS: Tab[] = [
  { href: "/contractor", label: "홈", icon: "📊" },
  { href: "/contractor/tenders", label: "입찰 공고", icon: "📢" },
  { href: "/contractor/bids", label: "내 입찰", icon: "📝" },
  { href: "/contractor/projects", label: "시공 관리", icon: "🏗️" },
  { href: "/contractor/company", label: "내 업체", icon: "🏢" },
];

export default async function ContractorLayout({ children }: LayoutProps<"/contractor">) {
  const user = await requireRole("CONTRACTOR");
  const p = user.contractorProfile!;
  return (
    <>
      <AppHeader
        home="/contractor"
        dark
        right={
          <span className="flex items-center gap-2 text-sm text-white/80">
            <span className="max-w-[9rem] truncate">{p.companyName}</span>
            {p.reviewStatus !== "APPROVED" && <Badge tone="warn">{CONTRACTOR_REVIEW_STATUS_LABEL[p.reviewStatus]}</Badge>}
          </span>
        }
      />
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-28 pt-4">{children}</main>
      <BottomTabs tabs={TABS} root="/contractor" />
    </>
  );
}
