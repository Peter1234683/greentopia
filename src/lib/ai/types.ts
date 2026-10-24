import type { z } from "zod";

// AI 어댑터 공통 인터페이스. 구현체가 실패하거나 키가 없으면 null 을 돌려주고,
// 호출하는 쪽(aiJson / aiChat)이 규칙 기반 결과로 대체한다.
export type AiImage = { mimeType: string; base64: string };
export type ChatTurn = { role: "user" | "assistant"; content: string };
export type ProviderName = "claude" | "gemini" | "rule";

export interface AiProvider {
  readonly name: ProviderName;
  /** 스키마에 맞는 JSON 생성. 응답은 호출부에서 다시 zod 로 검증한다. */
  generateJson<T>(req: { schema: z.ZodType<T>; system: string; prompt: string; images?: AiImage[] }): Promise<unknown | null>;
  /** 대화. context 는 근거 자료(RAG)로 시스템 프롬프트 뒤에 붙는다. */
  chat(req: { system: string; context: string; messages: ChatTurn[] }): Promise<string | null>;
}
