import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { AiProvider } from "./types";

// Claude (ANTHROPIC_API_KEY). 기본 모델 claude-opus-5-5, 거절(refusal) 시 서버 측 기본 폴백 사용.
const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
const EFFORT = (process.env.AI_EFFORT || "medium") as "low" | "medium" | "high";
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

export class ClaudeProvider implements AiProvider {
  readonly name = "claude" as const;
  private client = new Anthropic();

  async generateJson<T>({ schema, system, prompt, images = [] }: Parameters<AiProvider["generateJson"]>[0] & { schema: import("zod").ZodType<T> }) {
    try {
      const response = await this.client.beta.messages.parse({
        model: MODEL,
        max_tokens: 16000,
        ...FALLBACK,
        output_config: { effort: EFFORT, format: betaZodOutputFormat(schema) },
        system,
        messages: [
          {
            role: "user",
            content: [
              ...images.map((img) => ({
                type: "image" as const,
                source: { type: "base64" as const, media_type: img.mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: img.base64 },
              })),
              { type: "text" as const, text: prompt },
            ],
          },
        ],
      });
      if (response.stop_reason === "refusal") return null;
      return response.parsed_output ?? null;
    } catch (error) {
      logError("generateJson", error);
      return null;
    }
  }

  async chat({ system, context, messages }: Parameters<AiProvider["chat"]>[0]) {
    try {
      const response = await this.client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        ...FALLBACK,
        output_config: { effort: EFFORT },
        // 고정 지침을 먼저, 근거 자료를 뒤에 두어 지침 부분이 캐시되게 한다
        system: [
          { type: "text", text: system, cache_control: { type: "ephemeral" } },
          { type: "text", text: `<근거자료>\n${context}\n</근거자료>` },
        ],
        messages,
      });
      if (response.stop_reason === "refusal") return null;
      const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
      return text || null;
    } catch (error) {
      logError("chat", error);
      return null;
    }
  }
}

function logError(op: string, error: unknown) {
  if (error instanceof Anthropic.RateLimitError) console.warn(`[ai:claude] ${op} rate limited`);
  else if (error instanceof Anthropic.AuthenticationError) console.warn(`[ai:claude] ${op} invalid API key`);
  else if (error instanceof Anthropic.APIError) console.warn(`[ai:claude] ${op} API error ${error.status}`);
  else console.warn(`[ai:claude] ${op} failed`, error);
}
