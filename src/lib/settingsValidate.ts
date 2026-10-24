// 관리자가 고친 설정 JSON 이 코드 기본값과 같은 모양·타입인지 확인 (순수 함수)
const kindOf = (v: unknown) => (Array.isArray(v) ? "array" : v === null ? "null" : typeof v);

export function validateShape(base: unknown, value: unknown, path = ""): string[] {
  const bk = kindOf(base);
  const vk = kindOf(value);
  if (bk !== vk) return [`${path || "(전체)"}: ${bk} 이어야 해요 (입력: ${vk})`];
  if (bk === "array") {
    const arr = value as unknown[];
    const sample = (base as unknown[])[0];
    return sample === undefined ? [] : arr.flatMap((v, i) => validateShape(sample, v, `${path}[${i}]`));
  }
  if (bk === "object") {
    const b = base as Record<string, unknown>;
    const v = value as Record<string, unknown>;
    const errs: string[] = [];
    // 기본값에 없는 키는 레코드형(예: 공종별 단가) 아래에서만 허용
    const isRecord = Object.keys(b).length > 0 && Object.values(b).every((x) => kindOf(x) === kindOf(Object.values(b)[0])) && path !== "";
    for (const k of Object.keys(v)) {
      if (k in b) errs.push(...validateShape(b[k], v[k], path ? `${path}.${k}` : k));
      else if (isRecord) errs.push(...validateShape(Object.values(b)[0], v[k], path ? `${path}.${k}` : k));
      else errs.push(`${path ? `${path}.` : ""}${k}: 알 수 없는 항목이에요`);
    }
    return errs;
  }
  if (bk === "number" && !Number.isFinite(value as number)) return [`${path}: 숫자가 아니에요`];
  return [];
}
