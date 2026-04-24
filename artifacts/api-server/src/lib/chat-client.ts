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

// Gemini model fallback chain. Google has been aggressively renaming/retiring
// models on the v1beta endpoint (gemini-1.5-flash-latest → gone, plain
// gemini-1.5-flash → also returning 404 in some regions), so instead of pinning
// to one name we try a list in order until one works, then lock that in for
// the lifetime of the process.
//
// GEMINI_MODEL env var (if set) is tried FIRST so the owner can pin a specific
// model from Railway without needing a code change. The default list below
// covers the current free-tier line as of 2026-04 — when Google ships a new
// flagship, just prepend it.
const DEFAULT_GEMINI_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.0-pro",
];

function buildGeminiModelChain(): string[] {
  const env = process.env.GEMINI_MODEL?.trim();
  if (env) return [env, ...DEFAULT_GEMINI_MODELS.filter((m) => m !== env)];
  return DEFAULT_GEMINI_MODELS;
}

const GEMINI_MODEL_CHAIN = buildGeminiModelChain();
// First model that returned a successful response — once locked in we skip
// the fallback loop on subsequent calls (saves 2 round-trips per chat).
let workingGeminiModel: string | null = null;

// Returns true ONLY for the specific "model name not recognised" failure
// — we deliberately do NOT fall back on auth (401/403), quota (429), or
// network errors, because trying a different model name won't fix those
// and would just waste time + mask the real problem.
function isGeminiModelNotFound(e: any): boolean {
  const status = e?.status ?? e?.statusCode;
  if (status === 404) return true;
  const msg = String(e?.message || "").toLowerCase();
  return msg.includes("is not found") || msg.includes("not found for api version");
}

// Run `attempt` against each candidate model in turn. If a model 404s we try
// the next. Any other error (auth, quota, network) propagates immediately.
//
// Cache behavior: once a model succeeds we cache it, but if Google later
// retires that cached model (mid-process 404) we MUST clear the cache and
// re-walk the full chain — otherwise the process would be stuck on a dead
// model until restart.
async function tryGeminiModels<T>(
  attempt: (modelName: string) => Promise<T>,
): Promise<T> {
  // Pass 1: try the cached model alone (fast path).
  if (workingGeminiModel) {
    const cached = workingGeminiModel;
    try {
      return await attempt(cached);
    } catch (e: any) {
      if (!isGeminiModelNotFound(e)) throw e;
      // Cached model was retired by Google. Drop the cache and fall through
      // to walk the full chain again.
      logger.warn(
        { model: cached, err: String(e?.message || "").slice(0, 200) },
        "Cached Gemini model now 404s — clearing cache and re-walking fallback chain",
      );
      workingGeminiModel = null;
    }
  }
  // Pass 2: full chain walk. We deliberately re-include the cached model
  // (already removed from cache) — it's already failed once so the loop
  // below will skip past it on 404 and try the rest.
  let lastErr: any;
  for (const modelName of GEMINI_MODEL_CHAIN) {
    try {
      const result = await attempt(modelName);
      if (workingGeminiModel !== modelName) {
        logger.info({ model: modelName }, "Gemini model locked in");
        workingGeminiModel = modelName;
      }
      return result;
    } catch (e: any) {
      if (isGeminiModelNotFound(e)) {
        logger.warn(
          { model: modelName, err: String(e?.message || "").slice(0, 200) },
          "Gemini model not found, trying next in fallback chain",
        );
        lastErr = e;
        continue;
      }
      throw e;
    }
  }
  // Exhausted the whole chain — re-throw the last 404 with a clearer message.
  const tried = GEMINI_MODEL_CHAIN.join(", ");
  const err: any = new Error(`All Gemini models returned 404 (tried: ${tried}). Update GEMINI_MODEL env var to a current model name.`);
  err.cause = lastErr;
  throw err;
}

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
      { modelChain: GEMINI_MODEL_CHAIN, keyPrefix: key.slice(0, 6) + "…", keyLength: key.length, looksValid },
      "Chat provider: Google Gemini (free tier)"
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
    // Open the stream inside the fallback helper. The SDK awaits the upstream
    // HTTP headers before returning, so a 404 from a retired model name surfaces
    // here (BEFORE we start yielding) and the helper falls through to the next
    // candidate. Once we get past this await, streaming is committed.
    const { result, modelUsed } = await tryGeminiModels(async (modelName) => {
      const model = gen.getGenerativeModel({
        model: modelName,
        systemInstruction: systemText || undefined,
        safetySettings: RELAXED_SAFETY,
        generationConfig: {
          maxOutputTokens: opts.maxTokens ?? 1024,
          temperature: opts.temperature ?? 0.85,
        },
      });
      // The SDK's SingleRequestOptions accepts an AbortSignal — pass it so a
      // client disconnect or our 90s timeout actually cancels the upstream call.
      const r = await model.generateContentStream(
        { contents },
        opts.signal ? { signal: opts.signal } : undefined,
      );
      return { result: r, modelUsed: modelName };
    });
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
      logger.warn({ provider, model: modelUsed, reason }, "Gemini returned no text");
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
    const result = await tryGeminiModels(async (modelName) => {
      const model = gen.getGenerativeModel({
        model: modelName,
        systemInstruction: systemText || undefined,
        safetySettings: RELAXED_SAFETY,
        generationConfig: { maxOutputTokens: opts.maxTokens ?? 1024 },
      });
      return await model.generateContent(
        { contents },
        opts.signal ? { signal: opts.signal } : undefined,
      );
    });
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
      model: provider === "gemini" ? (workingGeminiModel || GEMINI_MODEL_CHAIN[0]) : undefined,
      sample: sample.slice(0, 200),
    };
  } catch (e: any) {
    return {
      ok: false,
      provider,
      model: provider === "gemini" ? (workingGeminiModel || GEMINI_MODEL_CHAIN[0]) : undefined,
      error: e?.message || "unknown",
      details: {
        name: e?.name,
        status: e?.status,
        geminiBlockReason: e?.geminiBlockReason,
        geminiModelChain: provider === "gemini" ? GEMINI_MODEL_CHAIN : undefined,
        cause: e?.cause?.message,
      },
    };
  }
}
