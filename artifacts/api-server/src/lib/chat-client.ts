// OpenAI-only streaming chat client.
//
// Reads OPENAI_API_KEY from the environment and uses model gpt-4o-mini for
// every chat. No fallback chains, no provider switching — owner explicitly
// requested a single, predictable provider.
//
// Gemini and the Replit AI proxy were removed. The Gemini package
// (@google/generative-ai) is still in package.json so it's easy to bring
// back later if needed; nothing in this file imports it.
//
// All calls are lazy: importing this module never throws, so missing creds
// only surface when an actual chat call is made (not at server boot).
import OpenAI from "openai";
import { logger } from "./logger";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

// Kept as a discriminated union (rather than a single literal) so call sites
// like routes can still test `provider === "missing"` without rewrites.
export type ChatProvider = "openai" | "missing";

const OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

let providerCache: ChatProvider | null = null;
let openaiCache: OpenAI | null = null;

function detectProvider(): ChatProvider {
  return process.env.OPENAI_API_KEY?.trim() ? "openai" : "missing";
}

export function getActiveProvider(): ChatProvider {
  if (!providerCache) providerCache = detectProvider();
  return providerCache;
}

export function logChatProviderConfig(): void {
  const p = detectProvider();
  if (p === "openai") {
    const key = process.env.OPENAI_API_KEY!.trim();
    // OpenAI keys start with "sk-" and are typically 50+ chars. We only log a
    // prefix + length so a misconfigured key is debuggable without leaking it.
    const looksValid = /^sk-[\w-]{20,}$/.test(key);
    logger.info(
      { model: OPENAI_MODEL, keyLength: key.length, looksValid },
      "Chat provider: OpenAI",
    );
    if (!looksValid) {
      logger.warn(
        "OPENAI_API_KEY does not match the expected format (should start with 'sk-'). " +
        "Get one at https://platform.openai.com/api-keys",
      );
    }
  } else {
    logger.error(
      "Chat provider: NONE — chatbot will return 503. Set OPENAI_API_KEY in the environment.",
    );
  }
}

function getOpenAIClient(): OpenAI {
  if (!openaiCache) {
    const key = process.env.OPENAI_API_KEY?.trim();
    if (!key) throw new Error("OPENAI_API_KEY missing");
    openaiCache = new OpenAI({ apiKey: key });
  }
  return openaiCache;
}

// Async iterator of text deltas. Each yielded string is one streaming chunk
// of assistant text; consumers join them into the final response.
export async function* streamChat(
  messages: ChatMessage[],
  opts: { signal?: AbortSignal; maxTokens?: number; temperature?: number } = {},
): AsyncGenerator<string, void, void> {
  const provider = getActiveProvider();
  if (provider === "missing") {
    throw new Error("No chat provider configured. Set OPENAI_API_KEY.");
  }

  const openai = getOpenAIClient();
  const stream = await openai.chat.completions.create(
    {
      model: OPENAI_MODEL,
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.85,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    },
    { signal: opts.signal },
  );

  // Track terminal state so we can surface content_filter / empty-output as
  // explicit errors instead of silently ending the SSE with no assistant text.
  let emitted = false;
  let finishReason: string | null = null;
  for await (const chunk of stream) {
    if (opts.signal?.aborted) throw new Error("Chat request aborted");
    const choice = chunk.choices[0];
    const text = choice?.delta?.content;
    if (text) {
      emitted = true;
      yield text;
    }
    if (choice?.finish_reason) finishReason = choice.finish_reason;
  }

  if (finishReason === "content_filter") {
    throw new Error("Response blocked by safety filter (content_filter)");
  }
  if (!emitted) {
    throw new Error(`Empty response from model (finish_reason=${finishReason || "unknown"})`);
  }
}

// Non-streaming companion to streamChat — used as a fallback by the route
// when the streaming path errors before emitting anything.
export async function chatOnce(
  messages: ChatMessage[],
  opts: { signal?: AbortSignal; maxTokens?: number } = {},
): Promise<string> {
  const provider = getActiveProvider();
  if (provider === "missing") {
    throw new Error("No chat provider configured. Set OPENAI_API_KEY.");
  }

  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create(
    {
      model: OPENAI_MODEL,
      max_tokens: opts.maxTokens ?? 1024,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    },
    { signal: opts.signal },
  );
  const choice = completion.choices[0];
  if (choice?.finish_reason === "content_filter") {
    throw new Error("Response blocked by safety filter (content_filter)");
  }
  const text = choice?.message?.content || "";
  if (!text) {
    throw new Error(`Empty response from model (finish_reason=${choice?.finish_reason || "unknown"})`);
  }
  return text;
}

// Minimal probe used by /api/openai/diagnose to surface real upstream errors
// (auth, model, network) without going through DB or SSE.
export async function diagnoseChat(): Promise<{
  ok: boolean;
  provider: ChatProvider;
  model?: string;
  sample?: string;
  error?: string;
  details?: any;
}> {
  const provider = getActiveProvider();
  if (provider === "missing") return { ok: false, provider, error: "No chat provider configured" };
  try {
    const sample = await chatOnce(
      [
        { role: "system", content: "You are a friendly assistant. Reply in one short sentence." },
        { role: "user", content: "Say hi to ROSA in one short friendly sentence." },
      ],
      { maxTokens: 64 },
    );
    return { ok: true, provider, model: OPENAI_MODEL, sample: sample.slice(0, 200) };
  } catch (e: any) {
    return {
      ok: false,
      provider,
      model: OPENAI_MODEL,
      error: e?.message || "unknown",
      details: {
        name: e?.name,
        status: e?.status,
        cause: e?.cause?.message,
      },
    };
  }
}
