import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";
import { Slides } from "./Slides";

export const metadata: Metadata = { title: "그린토피아 둘러보기" };

export default async function Welcome(props: PageProps<"/customer/welcome">) {
  await requireRole("CUSTOMER");
  const { replay } = await props.searchParams;
  return <Slides replay={replay === "1"} />;
}
