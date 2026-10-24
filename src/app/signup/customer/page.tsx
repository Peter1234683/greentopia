import type { Metadata } from "next";
import { SignupShell } from "../SignupShell";
import { CustomerSignupForm } from "./CustomerSignupForm";

export const metadata: Metadata = { title: "건물주 회원가입" };

export default function Page() {
  return (
    <SignupShell icon="🏠" title="건물주 회원가입" subtitle="1분이면 끝나요. 건물 주소는 나중에 입력해도 돼요.">
      <CustomerSignupForm />
    </SignupShell>
  );
}
