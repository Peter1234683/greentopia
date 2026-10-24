import type { FormValues } from "@/app/actions/auth";

// 서버 액션이 돌려준 입력값으로 폼 기본값을 채우는 도우미
export function formValues(values: FormValues | undefined) {
  const v = values ?? {};
  return {
    str: (k: string) => (typeof v[k] === "string" ? (v[k] as string) : undefined),
    has: (k: string, x: string) => [v[k]].flat().includes(x),
  };
}
