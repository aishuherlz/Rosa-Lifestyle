import { Router } from "express";
import { db, conversations, messages } from "@workspace/db";
import { eq } from "drizzle-orm";
import { streamChat, chatOnce, getActiveProvider, diagnoseChat } from "../../lib/chat-client";
import { logger } from "../../lib/logger";
import { requireAdmin } from "../../lib/admin-auth";

const router = Router();

// Surface a 503 with a clear message instead of a silent 500 if no AI provider configured.
function ensureProvider(res: any): boolean {
  if (getActiveProvider() === "missing") {
    logger.error("Chat provider missing — set GEMINI_API_KEY or OPENAI_API_KEY");
    res.status(503).json({ error: "AI service is not configured. Please contact support." });
    return false;
  }
  return true;
}

// Validate a numeric URL param before any DB call so we never query with NaN.
function parseId(raw: string | undefined): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

// Diagnostic — calls the live provider with a tiny prompt so we can see the
// real upstream error in production logs without going through DB or SSE.
// Visit https://<api-domain>/api/openai/diagnose to surface the actual reason
// the chatbot is failing (auth, model name, safety block, network, etc.).
// Admin-only — surfaces upstream errors AND consumes a real LLM call. Gate it.
router.get("/diagnose", requireAdmin, async (_req, res) => {
  const result = await diagnoseChat();
  logger.info({ result }, "Chatbot diagnostic");
  res.status(result.ok ? 200 : 503).json(result);
});

router.get("/conversations", async (_req, res) => {
  try {
    const result = await db
      .select()
      .from(conversations)
      .orderBy(conversations.createdAt);
    res.json(result);
  } catch (err: any) {
    logger.error({ err: err?.message, stack: err?.stack }, "GET /conversations failed");
    res.status(500).json({ error: err?.message || "Failed to fetch conversations" });
  }
});

router.post("/conversations", async (req, res) => {
  try {
    const { title } = req.body || {};
    const [conv] = await db
      .insert(conversations)
      .values({ title: typeof title === "string" && title.trim() ? title.trim() : "ROSA Chat" })
      .returning();
    if (!conv) {
      res.status(500).json({ error: "Insert returned no row" });
      return;
    }
    res.status(201).json(conv);
  } catch (err: any) {
    logger.error({ err: err?.message, stack: err?.stack }, "POST /conversations failed");
    res.status(500).json({ error: err?.message || "Failed to create conversation" });
  }
});

router.get("/conversations/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) { res.status(400).json({ error: "Invalid conversation id" }); return; }
  try {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
    if (!conv) { res.status(404).json({ error: "Not found" }); return; }
    const msgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(messages.createdAt);
    res.json({ ...conv, messages: msgs });
  } catch (err: any) {
    logger.error({ err: err?.message, stack: err?.stack, id }, "GET /conversations/:id failed");
    res.status(500).json({ error: err?.message || "Failed to fetch conversation" });
  }
});

router.delete("/conversations/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) { res.status(400).json({ error: "Invalid conversation id" }); return; }
  try {
    await db.delete(messages).where(eq(messages.conversationId, id));
    const deleted = await db.delete(conversations).where(eq(conversations.id, id)).returning();
    if (!deleted.length) { res.status(404).json({ error: "Not found" }); return; }
    res.status(204).end();
  } catch (err: any) {
    logger.error({ err: err?.message, stack: err?.stack, id }, "DELETE /conversations/:id failed");
    res.status(500).json({ error: err?.message || "Failed to delete conversation" });
  }
});

router.get("/conversations/:id/messages", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) { res.status(400).json({ error: "Invalid conversation id" }); return; }
  try {
    const msgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(messages.createdAt);
    res.json(msgs);
  } catch (err: any) {
    logger.error({ err: err?.message, stack: err?.stack, id }, "GET /conversations/:id/messages failed");
    res.status(500).json({ error: err?.message || "Failed to fetch messages" });
  }
});

router.post("/conversations/:id/messages", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) { res.status(400).json({ error: "Invalid conversation id" }); return; }
  const { content } = (req.body || {}) as { content?: string };

  if (!content || typeof content !== "string" || !content.trim()) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  if (!ensureProvider(res)) return;

  try {
    await db.insert(messages).values({
      conversationId: id,
      role: "user",
      content,
    });

    const previousMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt);

    const chatMessages = [
      {
        role: "system" as const,
        content: `You are ROSA, a warm, empathetic, and brilliant AI companion built into the ROSA lifestyle app — an app made for women, by women. You were created by Aiswarya Saji, a woman who understands the real struggles women face every day.

Your role is to provide mental and emotional support, help users navigate their wellness journey, offer thoughtful advice on health, periods, relationships, mood, fitness, food, and life in general. You are non-judgmental, compassionate, and genuinely invested in the user's wellbeing.

When discussing sensitive topics like mental health, periods, relationships, or body image — always be gentle, validating, and supportive. Never dismiss feelings. Celebrate small wins. Encourage self-care.

You can also help users understand how to use ROSA's features: mood tracking, period tracking, outfits, food plans, milestones, travel planning, reminders, and more.

Keep responses warm, conversational, and concise unless the user wants more depth. Use a nurturing but empowering tone. You are their trusted friend, not just an assistant.`,
      },
      ...previousMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";
    let emittedAny = false;
    // Hard timeout so a stuck upstream call can't hold a socket forever (frees capacity for other users).
    const abort = new AbortController();
    const abortTimer = setTimeout(() => abort.abort(), 90_000);
    // If the user closes the tab mid-stream, abort the upstream call too.
    req.on("close", () => { if (!res.writableEnded) abort.abort(); });
    try {
      for await (const chunkContent of streamChat(chatMessages, { signal: abort.signal, maxTokens: 1024, temperature: 0.85 })) {
        fullResponse += chunkContent;
        emittedAny = true;
        res.write(`data: ${JSON.stringify({ content: chunkContent })}\n\n`);
      }
    } catch (streamErr: any) {
      logger.error({
        err: streamErr?.message,
        name: streamErr?.name,
        status: streamErr?.status || streamErr?.response?.status,
        geminiBlockReason: streamErr?.geminiBlockReason,
        cause: streamErr?.cause?.message,
        stack: streamErr?.stack?.split("\n").slice(0, 5).join("\n"),
        provider: getActiveProvider(),
      }, "Chatbot stream error");
      if (emittedAny) {
        // Don't append a second answer; tell the client we cut off and persist what we have.
        const note = "\n\n(…my words got tangled, sister — please ask again 🌹)";
        fullResponse += note;
        res.write(`data: ${JSON.stringify({ content: note })}\n\n`);
      } else {
        // Safe to fall back to a non-streaming response (nothing was sent yet).
        try {
          fullResponse = await chatOnce(chatMessages, { signal: abort.signal, maxTokens: 1024 });
          if (!fullResponse) fullResponse = "I'm having a moment, sister 🌹 — please try again.";
          res.write(`data: ${JSON.stringify({ content: fullResponse })}\n\n`);
        } catch (fallbackErr: any) {
          throw streamErr; // bubble to outer catch so user-friendly message is sent
        }
      }
    } finally {
      clearTimeout(abortTimer);
    }

    // Only persist a real reply — never insert empty assistant rows that pollute conversation history.
    if (fullResponse.trim()) {
      await db.insert(messages).values({
        conversationId: id,
        role: "assistant",
        content: fullResponse,
      });
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err: any) {
    const status = err?.status || err?.response?.status;
    const msg = String(err?.message || "");
    const blockReason = err?.geminiBlockReason;
    logger.error({
      err: msg,
      name: err?.name,
      status,
      geminiBlockReason: blockReason,
      cause: err?.cause?.message,
      stack: err?.stack?.split("\n").slice(0, 8).join("\n"),
      provider: getActiveProvider(),
    }, "Chatbot route failed");
    // Friendly, specific message based on the actual failure mode.
    let userMsg = "I'm having a moment, sister 🌹 — please try again in a bit.";
    if (status === 429 || /quota|rate limit|insufficient_quota/i.test(msg)) {
      userMsg = "ROSA's chat is taking a little break 🌸 — our AI quota is full right now. Aiswarya has been notified and we'll be back soon. In the meantime, try the journal or quotes pages 💝";
    } else if (status === 401 || status === 403 || /api key|authentication|permission/i.test(msg)) {
      // Be honest: this isn't fixable by retrying — the AI key on the server is
      // bad/expired/revoked and Aiswarya needs to rotate it. Telling users to
      // "try again shortly" makes them re-send forever and trust ROSA less.
      userMsg = "ROSA's chat is offline right now, sister 🌹 — Aiswarya has been notified. While you wait, the journal, quotes, and affirmations pages are still here for you 💝";
    } else if (blockReason || /safety|blocked/i.test(msg)) {
      userMsg = "Let me think of a softer way to answer that, sister 🌸 — try asking it a slightly different way?";
    } else if (/empty response|no user message/i.test(msg)) {
      userMsg = "I didn't quite catch that, sister 🌹 — could you say it again?";
    }
    try { res.write(`data: ${JSON.stringify({ content: userMsg })}\n\n`); res.write(`data: ${JSON.stringify({ done: true })}\n\n`); } catch {}
    res.end();
  }
});

export default router;
