import type { Metadata } from "next";
import { SignupShell } from "../SignupShell";
import { ContractorSignupForm } from "./ContractorSignupForm";
import { DAEGU_SIGUNGU, SIDO } from "@/config/regions";

export const metadata: Metadata = { title: "시공업체 회원가입" };

export default function Page() {
  return (
    <SignupShell icon="🛠️" title="시공업체 회원가입" subtitle="가입 후 서류 심사(PQ 1차)를 통과하면 입찰에 참여할 수 있어요.">
      <ContractorSignupForm sido={SIDO} sigungu={DAEGU_SIGUNGU} />
    </SignupShell>
  );
}
