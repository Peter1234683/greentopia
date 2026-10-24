import "server-only";
import { db } from "./db";
import { MATCHING_DEFAULTS } from "@/config/matching";
import { PRICING_DEFAULTS } from "@/config/pricing";
import { BIDDING_DEFAULTS } from "@/config/bidding";
import { REPUTATION_DEFAULTS } from "@/config/reputation";
import { SUBSIDY_DEFAULTS } from "@/config/support";

// 코드 기본값(src/config) 위에 관리자가 저장한 Config 행(섹션별 JSON)을 덮어쓴다.
export const SETTINGS_DEFAULTS = {
  matching: MATCHING_DEFAULTS,
  pricing: PRICING_DEFAULTS,
  bidding: BIDDING_DEFAULTS,
  reputation: REPUTATION_DEFAULTS,
  support: SUBSIDY_DEFAULTS,
};
export type Settings = typeof SETTINGS_DEFAULTS;
export type SettingsSection = keyof Settings;
export const SETTINGS_SECTIONS = Object.keys(SETTINGS_DEFAULTS) as SettingsSection[];

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function deepMerge<T>(base: T, override: unknown): T {
  if (!isObj(base) || !isObj(override)) return (override === undefined ? base : override) as T;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) out[k] = k in out ? deepMerge(out[k], v) : v;
  return out as T;
}

export async function getSettings(): Promise<Settings> {
  const rows = await db.config.findMany({ where: { key: { in: SETTINGS_SECTIONS } } });
  const out = { ...SETTINGS_DEFAULTS } as Settings;
  for (const row of rows) {
    try {
      const k = row.key as SettingsSection;
      (out as Record<string, unknown>)[k] = deepMerge(SETTINGS_DEFAULTS[k], JSON.parse(row.valueJson));
    } catch {
      // 잘못 저장된 값은 무시하고 기본값 사용
    }
  }
  return out;
}
