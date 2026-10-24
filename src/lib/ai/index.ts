import "server-only";
import type { z } from "zod";
import { ClaudeProvider } from "./claude";
import { GeminiProvider } from "./gemini";
import type { AiImage, AiProvider, ChatTurn, ProviderName } from "./types";

export type { AiImage, AiProvider, ChatTurn, ProviderName } from "./types";

// 키가 없으면 아무것도 호출하지 않는 규칙 기반 제공자 (호출부가 규칙 결과를 쓴다)
class RuleBasedProvider implements AiProvider {
  readonly name = "rule" as const;
  async generateJson() {
    return null;
  }
  async chat() {
    return null;
  }
}

let cached: AiProvider | null = null;

// AI_PROVIDER=auto(기본)|claude|gemini|rule. auto 는 Claude → Gemini → 규칙 기반 순서.
export function getAiProvider(): AiProvider {
  if (cached) return cached;
  const pref = (process.env.AI_PROVIDER || "auto").toLowerCase();
  const hasClaude = !!process.env.ANTHROPIC_API_KEY;
  const hasGemini = !!process.env.GEMINI_API_KEY;
  if ((pref === "claude" || pref === "auto") && hasClaude) cached = new ClaudeProvider();
  else if ((pref === "gemini" || pref === "auto") && hasGemini) cached = new GeminiProvider();
  else cached = new RuleBasedProvider();
  return cached;
}

export type AiResult<T> = { data: T; source: "ai" | "rule"; provider: ProviderName };

/** AI 로 JSON 을 만들고 스키마 검증. 키가 없거나 실패·검증 오류면 규칙 기반 결과로 대체. */
export async function aiJson<T>(
  req: { schema: z.ZodType<T>; system: string; prompt: string; images?: AiImage[] },
  fallback: () => T,
  provider: AiProvider = getAiProvider(),
): Promise<AiResult<T>> {
  if (provider.name !== "rule") {
    const raw = await provider.generateJson(req);
    const parsed = raw == null ? null : req.schema.safeParse(raw);
    if (parsed?.success) return { data: parsed.data, source: "ai", provider: provider.name };
    if (parsed) console.warn(`[ai:${provider.name}] schema validation failed`, parsed.error.issues.slice(0, 3));
  }
  return { data: fallback(), source: "rule", provider: "rule" };
}

/** AI 대화. 실패하면 규칙 기반 템플릿 답변으로 대체. */
export async function aiChat(
  req: { system: string; context: string; messages: ChatTurn[] },
  fallback: () => string,
  provider: AiProvider = getAiProvider(),
): Promise<AiResult<string>> {
  if (provider.name !== "rule") {
    const text = await provider.chat(req);
    if (text) return { data: text, source: "ai", provider: provider.name };
  }
  return { data: fallback(), source: "rule", provider: "rule" };
}

export function aiStatus() {
  const p = getAiProvider();
  return { provider: p.name, label: p.name === "claude" ? "Claude" : p.name === "gemini" ? "Gemini" : "규칙 기반 (AI 키 없음)" };
}
