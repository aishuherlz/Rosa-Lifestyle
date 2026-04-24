// Smart OpenAI client.
//
// Works in two environments:
//   • Replit: uses the AI Integrations proxy (AI_INTEGRATIONS_OPENAI_BASE_URL +
//     AI_INTEGRATIONS_OPENAI_API_KEY) so usage is billed via Replit.
//   • Railway / standalone production: uses your own OPENAI_API_KEY against
//     the public OpenAI API.
//
// The selection happens lazily — importing this module never throws, so a
// missing key only surfaces when an actual call is made (not at server boot).
import OpenAI from "openai";
import { logger } from "./logger";

let cached: OpenAI | null = null;
let lastMode: "replit-proxy" | "openai-direct" | "missing" = "missing";

function buildClient(): OpenAI {
  const proxyBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL?.trim();
  const proxyKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY?.trim();
  const directKey = process.env.OPENAI_API_KEY?.trim();

  if (proxyBase && proxyKey) {
    lastMode = "replit-proxy";
    return new OpenAI({ apiKey: proxyKey, baseURL: proxyBase });
  }
  if (directKey) {
    lastMode = "openai-direct";
    return new OpenAI({ apiKey: directKey });
  }
  lastMode = "missing";
  throw new Error(
    "OpenAI key MISSING — set OPENAI_API_KEY (or AI_INTEGRATIONS_OPENAI_API_KEY + AI_INTEGRATIONS_OPENAI_BASE_URL on Replit)."
  );
}

export function getOpenAI(): OpenAI {
  if (!cached) cached = buildClient();
  return cached;
}

// Run once at boot to surface configuration problems in the logs immediately.
export function logOpenAIConfig() {
  const proxyBase = !!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL?.trim();
  const proxyKey = !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY?.trim();
  const directKey = !!process.env.OPENAI_API_KEY?.trim();
  if (proxyBase && proxyKey) {
    logger.info("OpenAI key loaded (Replit AI Integrations proxy)");
  } else if (directKey) {
    logger.info("OpenAI key loaded (direct OPENAI_API_KEY)");
  } else {
    logger.error(
      "OpenAI key MISSING — chatbot, food vision, and outfit vision will return 503. " +
      "Set OPENAI_API_KEY in your hosting dashboard."
    );
  }
  return { mode: lastMode };
}
