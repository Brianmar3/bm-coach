import type { NutritionContextSnapshot } from "../types/nutrition-intelligence.ts";

export type ConversationMessage = { role: string; content: string };

export type AssistantPromptPayload = {
  system: string;
  request: { question: string; contextSummary: string | null; recentMessages: ConversationMessage[]; instructions: string[] };
  conversation: { summary: string | null; recentMessages: ConversationMessage[] };
  context: {
    student: NutritionContextSnapshot["student"];
    evaluation: NutritionContextSnapshot["evaluation"];
    profile: NutritionContextSnapshot["profile"];
    training: NutritionContextSnapshot["training"];
    activePlan: NutritionContextSnapshot["activePlan"];
    localHour: number;
    habits: NutritionContextSnapshot["habits"];
  };
};

export function resolveDailyLimit() {
  const configuredValue = Number(process.env.NUTRITION_AI_DAILY_MESSAGE_LIMIT ?? process.env.NUTRITION_AI_DAILY_LIMIT);
  return Math.max(1, Math.min(Number.isFinite(configuredValue) ? configuredValue : 5, 100));
}

export function resolveMaxContextMessages() {
  const configuredValue = Number(process.env.NUTRITION_AI_MAX_CONTEXT_MESSAGES);
  return Math.max(6, Math.min(Number.isFinite(configuredValue) ? configuredValue : 8, 10));
}

export function resolveMaxOutputTokens() {
  const configuredValue = Number(process.env.NUTRITION_AI_MAX_OUTPUT_TOKENS);
  return Math.max(120, Math.min(Number.isFinite(configuredValue) ? configuredValue : 280, 800));
}

export function buildAssistantPromptPayload({ context, currentQuestion, conversationSummary, recentMessages, maxContextMessages = resolveMaxContextMessages() }: {
  context: NutritionContextSnapshot;
  currentQuestion: string;
  conversationSummary?: string;
  recentMessages?: ConversationMessage[];
  maxContextMessages?: number;
}): AssistantPromptPayload {
  const relevantMessages = (recentMessages ?? []).filter((message) => typeof message?.content === "string" && message.content.trim()).slice(-Math.max(1, maxContextMessages));
  return {
    system: [
      "Sos el asistente de nutrición de BM Training.",
      "Respondé en español rioplatense, breve primero, claro y práctico.",
      "Usá únicamente el contexto autorizado del alumno y no inventes datos clínicos.",
      "No diagnosticás ni prescribís tratamientos; derivá a evaluación profesional si hay riesgo clínico.",
      "Priorizá alimentos argentinos habituales, accesibles y realistas.",
      "Mantené continuidad con la conversación anterior y respondé al mensaje concreto.",
      "Si faltan datos, hacé una sola pregunta breve y útil.",
    ].join(" "),
    request: {
      question: currentQuestion,
      contextSummary: conversationSummary?.trim() || null,
      recentMessages: relevantMessages,
      instructions: ["Respondé como ayuda práctica y educativa.", "Mantené el tono argentino, natural y cercano.", "Respetá alergias, intolerancias, restricciones y presupuesto."],
    },
    conversation: { summary: conversationSummary?.trim() || null, recentMessages: relevantMessages },
    context: { student: context.student, evaluation: context.evaluation, profile: context.profile, training: context.training, activePlan: context.activePlan, localHour: context.localHour, habits: context.habits },
  };
}

export function parseAssistantProviderResponse(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return { answer: "", actions: [] as string[] };
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const answer = typeof parsed.answer === "string" ? parsed.answer.trim().slice(0, 1200) : "";
    if (answer) return { answer, actions: Array.isArray(parsed.actions) ? parsed.actions.filter((value): value is string => typeof value === "string").slice(0, 5) : [] };
  } catch {
    // The compatible provider may return plain text for chat completions.
  }
  return { answer: trimmed.slice(0, 1200), actions: [] as string[] };
}

export async function requestCompatibleChat({ endpoint, apiKey, body, timeoutMs, fetchImpl = fetch }: {
  endpoint: string;
  apiKey: string;
  body: unknown;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null) as { choices?: Array<{ message?: { content?: string } }>; usage?: Record<string, unknown> } | null;
    if (!response.ok) throw new Error(`AI_HTTP_${response.status}`);
    const content = payload?.choices?.[0]?.message?.content;
    if (!content?.trim()) throw new Error("AI_EMPTY");
    return { content, usage: payload?.usage };
  } finally {
    clearTimeout(timer);
  }
}
