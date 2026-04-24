// Unified streaming chat client with three providers, in priority order:
//   1. GEMINI_API_KEY → Google Gemini (FREE: 1500 req/day, no card needed)
//      Get one at https://aistudio.google.com/apikey
//   2. OPENAI_API_KEY → OpenAI gpt-4o-mini (paid, ~$0.15 per 1M tokens)
//   3. AI_INTEGRATIONS_OPENAI_* → Replit AI Integrations OpenAI proxy (limited monthly quota)
//
// All calls are lazy: importing this module never throws, so missing creds
// only surface when an actual chat call is made (not at server boot).
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import OpenAI from "openai";
import { logger } from "./logger";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatProvider = "gemini" | "openai-direct" | "openai-replit-proxy" | "missing";

let providerCache: ChatProvider | null = null;
let geminiCache: GoogleGenerativeAI | null = null;
let openaiCache: OpenAI | null = null;

// ROSA covers wellness, periods, mental health, body image — Gemini's default
// safety filters block plenty of legitimate content in those domains.
// We relax to BLOCK_ONLY_HIGH so genuinely harmful content still blocks but
// normal women's-health conversation flows through.
const RELAXED_SAFETY = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

// Single pinned Gemini model. We previously had a fallback chain
// (gemini-2.0-flash → gemini-2.0-flash-lite → gemini-1.0-pro) but on a paid
// Tier-1 plan that just burnt extra quota every time the upstream had a
// transient blip. Owner is on Tier 1, gemini-2.0-flash is stable, so we now
// send exactly one request per chat and let real errors surface immediately.
//
// GEMINI_MODEL env var still wins so the model can be swapped (e.g. to a
// future "gemini-2.5-flash") without redeploying.
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";

function detectProvider(): ChatProvider {
  if (process.env.GEMINI_API_KEY?.trim()) return "gemini";
  if (process.env.OPENAI_API_KEY?.trim()) return "openai-direct";
  if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY?.trim() &&
      process.env.AI_INTEGRATIONS_OPENAI_BASE_URL?.trim()) return "openai-replit-proxy";
  return "missing";
}

export function getActiveProvider(): ChatProvider {
  if (!providerCache) providerCache = detectProvider();
  return providerCache;
}

export function logChatProviderConfig(): void {
  const p = detectProvider();
  if (p === "gemini") {
    const key = process.env.GEMINI_API_KEY!.trim();
    const looksValid = /^AIza[\w-]{30,}$/.test(key);
    logger.info(
      { model: GEMINI_MODEL, keyPrefix: key.slice(0, 6) + "…", keyLength: key.length, looksValid },
      "Chat provider: Google Gemini"
    );
    if (!looksValid) {
      logger.warn(
        "GEMINI_API_KEY does not match the expected format (should start with 'AIza' and be ~39 chars). " +
        "Get a fresh one from https://aistudio.google.com/apikey"
      );
    }
  } else if (p === "openai-direct") {
    logger.info("Chat provider: OpenAI direct (your API key)");
  } else if (p === "openai-replit-proxy") {
    logger.info("Chat provider: Replit AI Integrations OpenAI proxy (quota-limited)");
  } else {
    logger.error(
      "Chat provider: NONE — chatbot will return 503. " +
      "Set GEMINI_API_KEY (free, recommended) from https://aistudio.google.com/apikey, " +
      "or OPENAI_API_KEY for paid OpenAI."
    );
  }
}

function getGemini(): GoogleGenerativeAI {
  if (!geminiCache) {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) throw new Error("GEMINI_API_KEY missing");
    geminiCache = new GoogleGenerativeAI(key);
  }
  return geminiCache;
}

function getOpenAIClient(): OpenAI {
  if (!openaiCache) {
    const directKey = process.env.OPENAI_API_KEY?.trim();
    const proxyKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY?.trim();
    const proxyBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL?.trim();
    if (directKey) {
      openaiCache = new OpenAI({ apiKey: directKey });
    } else if (proxyKey && proxyBase) {
      openaiCache = new OpenAI({ apiKey: proxyKey, baseURL: proxyBase });
    } else {
      throw new Error("No OpenAI credentials configured");
    }
  }
  return openaiCache;
}

// Map the conversation onto Gemini's expected shape.
//   - "system" messages become a single `systemInstruction`
//   - "assistant" → "model" role
//   - First message MUST be role "user" (Gemini errors otherwise) so we drop
//     any leading non-user turns.
function buildGeminiPayload(messages: ChatMessage[]) {
  const systemText = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const convo = messages.filter((m) => m.role !== "system");
  while (convo.length && convo[0].role !== "user") convo.shift();
  const contents = convo.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  return { systemText, contents };
}

// Best-effort, throw-safe text extraction from a Gemini stream chunk.
// chunk.text() throws when a safety filter blocks the response — we want to
// detect that explicitly rather than crash the whole stream.
function safeChunkText(chunk: any): { text: string; blocked: boolean; reason?: string } {
  try {
    const t = chunk.text?.() ?? "";
    return { text: t, blocked: false };
  } catch (e: any) {
    const reason = chunk?.candidates?.[0]?.finishReason || chunk?.promptFeedback?.blockReason;
    return { text: "", blocked: true, reason: reason || e?.message || "unknown" };
  }
}

// Async iterator of text deltas for the chosen provider.
// Mirrors the OpenAI streaming shape on the consumer side: just a string per chunk.
export async function* streamChat(
  messages: ChatMessage[],
  opts: { signal?: AbortSignal; maxTokens?: number; temperature?: number } = {}
): AsyncGenerator<string, void, void> {
  const provider = getActiveProvider();

  if (provider === "gemini") {
    const gen = getGemini();
    const { systemText, contents } = buildGeminiPayload(messages);
    if (!contents.length) throw new Error("No user message to send to Gemini");
    const model = gen.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: systemText || undefined,
      safetySettings: RELAXED_SAFETY,
      generationConfig: {
        maxOutputTokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0.85,
      },
    });
    // The SDK's SingleRequestOptions accepts an AbortSignal — pass it so a
    // client disconnect or our 90s timeout actually cancels the upstream call.
    const result = await model.generateContentStream(
      { contents },
      opts.signal ? { signal: opts.signal } : undefined,
    );
    let emitted = false;
    let blockReason: string | undefined;
    for await (const chunk of result.stream) {
      if (opts.signal?.aborted) throw new Error("Chat request aborted");
      const { text, blocked, reason } = safeChunkText(chunk);
      if (blocked) { blockReason = reason; continue; }
      if (text) { emitted = true; yield text; }
    }
    if (!emitted) {
      // Surface the real reason so the route can show a useful message.
      const reason = blockReason || "empty response";
      logger.warn({ provider, model: GEMINI_MODEL, reason }, "Gemini returned no text");
      const err: any = new Error(`Gemini empty response (${reason})`);
      err.geminiBlockReason = blockReason || null;
      throw err;
    }
    return;
  }

  if (provider === "openai-direct" || provider === "openai-replit-proxy") {
    const openai = getOpenAIClient();
    const stream = await openai.chat.completions.create({
      model: provider === "openai-direct" ? "gpt-4o-mini" : "gpt-4o",
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.85,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    }, { signal: opts.signal });
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) yield text;
    }
    return;
  }

  throw new Error("No chat provider configured. Set GEMINI_API_KEY (free) or OPENAI_API_KEY.");
}

// Non-streaming fallback used when the streaming call fails after emitting nothing.
export async function chatOnce(
  messages: ChatMessage[],
  opts: { signal?: AbortSignal; maxTokens?: number } = {}
): Promise<string> {
  const provider = getActiveProvider();

  if (provider === "gemini") {
    const gen = getGemini();
    const { systemText, contents } = buildGeminiPayload(messages);
    if (!contents.length) throw new Error("No user message to send to Gemini");
    const model = gen.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: systemText || undefined,
      safetySettings: RELAXED_SAFETY,
      generationConfig: { maxOutputTokens: opts.maxTokens ?? 1024 },
    });
    const result = await model.generateContent(
      { contents },
      opts.signal ? { signal: opts.signal } : undefined,
    );
    try {
      return result.response.text() || "";
    } catch (e: any) {
      const reason = result.response?.promptFeedback?.blockReason || e?.message;
      const err: any = new Error(`Gemini empty response (${reason})`);
      err.geminiBlockReason = reason;
      throw err;
    }
  }

  if (provider === "openai-direct" || provider === "openai-replit-proxy") {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: opts.maxTokens ?? 1024,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }, { signal: opts.signal });
    return completion.choices[0]?.message?.content || "";
  }

  throw new Error("No chat provider configured.");
}

// Minimal, fast probe used by the diagnostic endpoint to surface real
// upstream errors (auth, model, network) without going through DB or SSE.
export async function diagnoseChat(): Promise<{ ok: boolean; provider: ChatProvider; model?: string; sample?: string; error?: string; details?: any }> {
  const provider = getActiveProvider();
  if (provider === "missing") return { ok: false, provider, error: "No chat provider configured" };
  try {
    const sample = await chatOnce(
      [
        { role: "system", content: "You are a friendly assistant. Reply in one short sentence." },
        { role: "user", content: "Say hi to ROSA in one short friendly sentence." },
      ],
      { maxTokens: 64 }
    );
    return {
      ok: true,
      provider,
      model: provider === "gemini" ? GEMINI_MODEL : undefined,
      sample: sample.slice(0, 200),
    };
  } catch (e: any) {
    return {
      ok: false,
      provider,
      model: provider === "gemini" ? GEMINI_MODEL : undefined,
      error: e?.message || "unknown",
      details: {
        name: e?.name,
        status: e?.status,
        geminiBlockReason: e?.geminiBlockReason,
        cause: e?.cause?.message,
      },
    };
  }
}
