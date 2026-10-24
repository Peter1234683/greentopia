import { z } from "zod";

export type FormValues = Record<string, string | string[]>;
export type FormState =
  | {
      errors?: Record<string, string>;
      message?: string;
      values?: FormValues; // 오류 시 입력값 복원용 (비밀번호·파일 제외)
    }
  | undefined;

const MULTI = new Set(["trades", "regions", "symptoms"]);

// React 19는 액션 제출 후 폼을 초기화하므로, 오류가 나면 입력값을 돌려줘 다시 채운다.
export function echo(formData: FormData): FormValues {
  const out: FormValues = {};
  for (const k of new Set(formData.keys())) {
    if (k === "password" || k.startsWith("$")) continue;
    const all = formData.getAll(k).filter((v): v is string => typeof v === "string");
    if (all.length) out[k] = all.length > 1 || MULTI.has(k) ? all : all[0];
  }
  return out;
}

export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const k = String(issue.path[0] ?? "form");
    out[k] ??= issue.message;
  }
  return out;
}

// 빈 입력("")을 0이 아닌 "값 없음"으로 다루는 선택 숫자 필드
export const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().pipe(schema).optional());

// 필수 숫자 필드: 빈 입력이면 0으로 바뀌지 않고 "입력해주세요" 오류가 난다
export const requiredNumber = (schema: z.ZodNumber, message: string) =>
  z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number({ message }).pipe(schema));
