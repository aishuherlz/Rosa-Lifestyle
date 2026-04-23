import { Router } from "express";
import { db, conversations, messages } from "@workspace/db";
import { eq } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.get("/conversations", async (req, res) => {
  try {
    const result = await db
      .select()
      .from(conversations)
      .orderBy(conversations.createdAt);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

router.post("/conversations", async (req, res) => {
  try {
    const { title } = req.body;
    const [conv] = await db
      .insert(conversations)
      .values({ title: title || "ROSA Chat" })
      .returning();
    res.status(201).json(conv);
  } catch (err) {
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

router.get("/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));
    if (!conv) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt);
    res.json({ ...conv, messages: msgs });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});

router.delete("/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.delete(messages).where(eq(messages.conversationId, id));
    const deleted = await db
      .delete(conversations)
      .where(eq(conversations.id, id))
      .returning();
    if (!deleted.length) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

router.get("/conversations/:id/messages", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt);
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.post("/conversations/:id/messages", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { content } = req.body as { content: string };

  if (!content) {
    res.status(400).json({ error: "content is required" });
    return;
  }

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
      const stream = await openai.chat.completions.create({
        model: "gpt-5-mini",
        max_completion_tokens: 2048,
        messages: chatMessages,
        stream: true,
      }, { signal: abort.signal });
      for await (const chunk of stream) {
        const chunkContent = chunk.choices[0]?.delta?.content;
        if (chunkContent) {
          fullResponse += chunkContent;
          emittedAny = true;
          res.write(`data: ${JSON.stringify({ content: chunkContent })}\n\n`);
        }
      }
    } catch (streamErr: any) {
      console.error("Chatbot stream error:", streamErr?.message || streamErr);
      if (emittedAny) {
        // Don't append a second answer; tell the client we cut off and persist what we have.
        const note = "\n\n(…my words got tangled, sister — please ask again 🌹)";
        fullResponse += note;
        res.write(`data: ${JSON.stringify({ content: note })}\n\n`);
      } else {
        // Safe to fall back to a fresh non-streaming response (nothing was sent yet).
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: 1024,
          messages: chatMessages,
        }, { signal: abort.signal });
        fullResponse = completion.choices[0]?.message?.content || "I'm having a moment, sister 🌹 — please try again.";
        res.write(`data: ${JSON.stringify({ content: fullResponse })}\n\n`);
      }
    } finally {
      clearTimeout(abortTimer);
    }

    await db.insert(messages).values({
      conversationId: id,
      role: "assistant",
      content: fullResponse,
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err: any) {
    console.error("Chatbot error:", err?.message || err, err?.stack);
    try { res.write(`data: ${JSON.stringify({ content: "I'm having a moment, sister 🌹 — please try again in a bit." })}\n\n`); res.write(`data: ${JSON.stringify({ done: true })}\n\n`); } catch {}
    res.end();
  }
});

export default router;
