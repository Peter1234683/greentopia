import "server-only";
import type { AiProvider } from "./types";

// Gemini (GEMINI_API_KEY) — REST generateContent. JSON 모드로 받은 뒤 호출부에서 zod 검증한다.
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const URL = (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

async function call(body: Record<string, unknown>) {
  const res = await fetch(URL(MODEL), {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
}

export class GeminiProvider implements AiProvider {
  readonly name = "gemini" as const;

  async generateJson({ system, prompt, images = [] }: Parameters<AiProvider["generateJson"]>[0]) {
    try {
      const parts: Part[] = [...images.map((i) => ({ inline_data: { mime_type: i.mimeType, data: i.base64 } })), { text: prompt }];
      const text = await call({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json" },
      });
      return text ? JSON.parse(text) : null;
    } catch (error) {
      console.warn("[ai:gemini] generateJson failed", error);
      return null;
    }
  }

  async chat({ system, context, messages }: Parameters<AiProvider["chat"]>[0]) {
    try {
      const text = await call({
        systemInstruction: { parts: [{ text: `${system}\n\n<근거자료>\n${context}\n</근거자료>` }] },
        contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      });
      return text.trim() || null;
    } catch (error) {
      console.warn("[ai:gemini] chat failed", error);
      return null;
    }
  }
}
