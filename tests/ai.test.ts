// AI 어댑터: 키가 없거나 응답이 스키마에 맞지 않으면 규칙 기반 결과로 대체되는지
import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { aiChat, aiJson, getAiProvider, type AiProvider } from "../src/lib/ai";

const schema = z.object({ score: z.number().min(0).max(100), note: z.string() });
const req = { schema, system: "s", prompt: "p" };
const fake = (json: unknown, text: string | null = null): AiProvider => ({
  name: "claude",
  generateJson: async () => json,
  chat: async () => text,
});

test("키가 없으면 규칙 기반 제공자", () => {
  assert.equal(getAiProvider().name, "rule");
});

test("유효한 AI 응답은 그대로, 스키마 위반·실패는 규칙 결과로", async () => {
  const fb = () => ({ score: 50, note: "rule" });
  assert.deepEqual(await aiJson(req, fb, fake({ score: 80, note: "ai" })), { data: { score: 80, note: "ai" }, source: "ai", provider: "claude" });
  assert.equal((await aiJson(req, fb, fake({ score: 999, note: "bad" }))).source, "rule");
  assert.equal((await aiJson(req, fb, fake(null))).data.note, "rule");
  assert.equal((await aiChat({ system: "", context: "", messages: [] }, () => "템플릿", fake(null, null))).data, "템플릿");
});
