import test from "node:test";
import assert from "node:assert/strict";

import { buildAssistantPromptPayload, parseAssistantProviderResponse, requestCompatibleChat, resolveDailyLimit, resolveMaxContextMessages } from "../lib/nutrition-ai-core.ts";

test("buildAssistantPromptPayload uses the conversation summary and recent messages", () => {
  const payload = buildAssistantPromptPayload({
    context: {
      student: { firstName: "Sofía", objective: "perder grasa" },
      profile: { allergies: ["huevo"], preferredFoods: ["arroz"], dislikedFoods: [] },
    },
    currentQuestion: "¿Qué puedo comer antes de entrenar?",
    conversationSummary: "La alumna busca opciones rápidas antes del entrenamiento.",
    recentMessages: [
      { role: "USER", content: "¿Qué puedo comer antes de entrenar?" },
      { role: "ASSISTANT", content: "Podés elegir algo simple y con proteína." },
    ],
    maxContextMessages: 6,
  });

  assert.equal(payload.request.question, "¿Qué puedo comer antes de entrenar?");
  assert.equal(payload.conversation.summary, "La alumna busca opciones rápidas antes del entrenamiento.");
  assert.equal(payload.conversation.recentMessages.length, 2);
  assert.equal(payload.conversation.recentMessages[1].role, "ASSISTANT");
});

test("resolveDailyLimit prefers the new environment variable", () => {
  process.env.NUTRITION_AI_DAILY_MESSAGE_LIMIT = "2";
  delete process.env.NUTRITION_AI_DAILY_LIMIT;
  assert.equal(resolveDailyLimit(), 2);

  process.env.NUTRITION_AI_DAILY_LIMIT = "4";
  assert.equal(resolveDailyLimit(), 2);

  delete process.env.NUTRITION_AI_DAILY_MESSAGE_LIMIT;
  assert.equal(resolveDailyLimit(), 4);
  delete process.env.NUTRITION_AI_DAILY_LIMIT;
});

test("keeps between 6 and 10 recent messages", () => {
  process.env.NUTRITION_AI_MAX_CONTEXT_MESSAGES = "50";
  assert.equal(resolveMaxContextMessages(), 10);
  process.env.NUTRITION_AI_MAX_CONTEXT_MESSAGES = "2";
  assert.equal(resolveMaxContextMessages(), 6);
  delete process.env.NUTRITION_AI_MAX_CONTEXT_MESSAGES;
});

test("accepts valid JSON and plain-text provider answers", () => {
  assert.deepEqual(parseAssistantProviderResponse('{"answer":"Usá las tostadas.","actions":["Ver ideas"]}'), { answer: "Usá las tostadas.", actions: ["Ver ideas"] });
  assert.deepEqual(parseAssistantProviderResponse("Podés cambiar el huevo por queso si lo tolerás."), { answer: "Podés cambiar el huevo por queso si lo tolerás.", actions: [] });
  assert.equal(parseAssistantProviderResponse("   ").answer, "");
});

test("uses a mocked compatible provider and never needs a real external call", async () => {
  let receivedAuthorization = "";
  const fetchImpl: typeof fetch = async (_input, init) => {
    receivedAuthorization = new Headers(init?.headers).get("Authorization") ?? "";
    return new Response(JSON.stringify({ choices: [{ message: { content: "Respuesta nueva" } }], usage: { total_tokens: 12 } }), { status: 200 });
  };
  const result = await requestCompatibleChat({ endpoint: "https://provider.invalid/chat", apiKey: "test-key", body: { messages: [] }, timeoutMs: 100, fetchImpl });
  assert.equal(result.content, "Respuesta nueva");
  assert.equal(receivedAuthorization, "Bearer test-key");
});

test("provider errors and timeouts reject without producing a response", async () => {
  const failedFetch: typeof fetch = async () => new Response(JSON.stringify({ error: "down" }), { status: 503 });
  await assert.rejects(() => requestCompatibleChat({ endpoint: "https://provider.invalid/chat", apiKey: "test", body: {}, timeoutMs: 100, fetchImpl: failedFetch }), /AI_HTTP_503/);
  const timeoutFetch: typeof fetch = async (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Timed out", "AbortError")));
  });
  await assert.rejects(() => requestCompatibleChat({ endpoint: "https://provider.invalid/chat", apiKey: "test", body: {}, timeoutMs: 5, fetchImpl: timeoutFetch }), /Timed out/);
});
