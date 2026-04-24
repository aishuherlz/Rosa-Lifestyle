// Unified streaming chat client with three providers, in priority order:
//   1. GEMINI_API_KEY → Google Gemini 1.5 Flash (FREE: 1500 req/day, no card needed)
//      Get one at https://aistudio.google.com/apikey
//   2. OPENAI_API_KEY → OpenAI gpt-4o-mini (paid, ~$0.15 per 1M tokens)
//   3. AI_INTEGRATIONS_OPENAI_* → Replit AI Integrations OpenAI proxy (limited monthly quota)
//
// All calls are lazy: importing this module never throws, so missing creds
// only surface when an actual chat call is made (not at server boot).
import { GoogleGenerativeAI } from "@google/generative-ai";
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
    logger.info("Chat provider: Google Gemini 1.5 Flash (free tier)");
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

// Async iterator of text deltas for the chosen provider.
// Mirrors the OpenAI streaming shape on the consumer side: just a string per chunk.
export async function* streamChat(
  messages: ChatMessage[],
  opts: { signal?: AbortSignal; maxTokens?: number; temperature?: number } = {}
): AsyncGenerator<string, void, void> {
  const provider = getActiveProvider();

  if (provider === "gemini") {
    const gen = getGemini();
    // Gemini handles "system" via a separate field. Split it out.
    const systemText = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const convo = messages.filter((m) => m.role !== "system");
    const model = gen.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: systemText || undefined,
      generationConfig: {
        maxOutputTokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0.85,
      },
    });
    // Gemini uses "model" for assistant; map roles.
    const contents = convo.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const result = await model.generateContentStream({ contents }, { signal: opts.signal });
    let emitted = false;
    for await (const chunk of result.stream) {
      if (opts.signal?.aborted) {
        // Throw so the route's catch path runs (instead of silently ending the stream)
        throw new Error("Chat request aborted");
      }
      const text = chunk.text();
      if (text) { emitted = true; yield text; }
    }
    if (!emitted && opts.signal?.aborted) throw new Error("Chat request aborted");
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
    const systemText = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const convo = messages.filter((m) => m.role !== "system");
    const model = gen.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: systemText || undefined,
      generationConfig: { maxOutputTokens: opts.maxTokens ?? 1024 },
    });
    const result = await model.generateContent({
      contents: convo.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    }, { signal: opts.signal });
    return result.response.text() || "";
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
