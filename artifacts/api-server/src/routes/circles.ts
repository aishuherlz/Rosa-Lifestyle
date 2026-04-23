import { Router } from "express";
import express from "express";
import fs from "fs";
import path from "path";

const router = Router();
router.use(express.json({ limit: "200kb" }));

const FILE = path.join(process.cwd(), ".rosa-circles.json");

type Msg = { id: string; author: string; text: string; ts: number; roses: number; anonymous: boolean };
type PublicCircle = { id: string; name: string; topic: string; emoji: string; createdBy: string; members: string[]; messages: Msg[]; createdAt: number; gameOfTheDay?: string; gameDate?: string };
type State = { publicCircles: PublicCircle[]; roses: Record<string, number> };

const SEED: Omit<PublicCircle, "id" | "createdAt">[] = [
  { name: "Cycle Talk 🩷", topic: "Periods, hormones, real talk — judgment free", emoji: "🩷", createdBy: "ROSA", members: [], messages: [] },
  { name: "Self Love Lounge", topic: "Affirmations, glow ups, soft girl era", emoji: "💖", createdBy: "ROSA", members: [], messages: [] },
  { name: "Career Queens", topic: "Promotions, salary tea, slay your work week", emoji: "👑", createdBy: "ROSA", members: [], messages: [] },
  { name: "Heartbreak Hotel", topic: "Sisters who get it. Healing together.", emoji: "🥀", createdBy: "ROSA", members: [], messages: [] },
  { name: "Mama Circle", topic: "Motherhood — the chaos & the magic", emoji: "🤱", createdBy: "ROSA", members: [], messages: [] },
  { name: "LGBTQ+ Sanctuary", topic: "All sisters, all loves welcome 🌈", emoji: "🌈", createdBy: "ROSA", members: [], messages: [] },
  { name: "Wellness & Wanderlust", topic: "Travel diaries, fitness, soulful living", emoji: "✈️", createdBy: "ROSA", members: [], messages: [] },
  { name: "Late Night Vents", topic: "When you can't sleep and need a sister", emoji: "🌙", createdBy: "ROSA", members: [], messages: [] },
];

const PROMPTS = [
  "What's one tiny win you had today? 🌸",
  "Drop a song that's healing you right now 🎶",
  "If your week were a flower, which one and why? 🌷",
  "One thing you're proud of yourself for this month? 💪",
  "What does self love look like for you today? 💗",
  "Share an affirmation every sister here needs ✨",
  "What boundary did you protect this week? 🛡️",
  "If you could text your past self one line, what is it? 💌",
];

function load(): State {
  try {
    if (fs.existsSync(FILE)) return JSON.parse(fs.readFileSync(FILE, "utf-8"));
  } catch {}
  const seeded: State = { publicCircles: SEED.map((s, i) => ({ ...s, id: `seed-${i}`, createdAt: Date.now() - (i * 86400000) })), roses: {} };
  save(seeded);
  return seeded;
}
function save(s: State) { try { fs.writeFileSync(FILE, JSON.stringify(s)); } catch {} }
let state = load();

function todayKey() { return new Date().toISOString().split("T")[0]; }
function ensureGameOfTheDay(c: PublicCircle) {
  const today = todayKey();
  if (c.gameDate !== today) {
    c.gameDate = today;
    const seed = (c.id + today).split("").reduce((a, ch) => a + ch.charCodeAt(0), 0);
    c.gameOfTheDay = PROMPTS[seed % PROMPTS.length];
  }
}

router.get("/circles/public", (_req, res) => {
  state.publicCircles.forEach(ensureGameOfTheDay);
  save(state);
  const summaries = state.publicCircles.map(c => ({
    id: c.id, name: c.name, topic: c.topic, emoji: c.emoji,
    memberCount: c.members.length, messageCount: c.messages.length,
    lastActivity: c.messages.length ? c.messages[c.messages.length - 1].ts : c.createdAt,
    gameOfTheDay: c.gameOfTheDay,
  }));
  res.json({ ok: true, circles: summaries });
});

router.get("/circles/public/:id", (req, res) => {
  const c = state.publicCircles.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ ok: false, error: "Circle not found" });
  ensureGameOfTheDay(c); save(state);
  res.json({ ok: true, circle: c });
});

router.post("/circles/public", (req, res) => {
  const { name, topic, emoji, createdBy } = req.body || {};
  if (!name || !topic) return res.status(400).json({ ok: false, error: "Name and topic are required" });
  if (state.publicCircles.length >= 200) return res.status(429).json({ ok: false, error: "Lounge limit reached" });
  const c: PublicCircle = {
    id: `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: String(name).slice(0, 50), topic: String(topic).slice(0, 200), emoji: String(emoji || "🌹").slice(0, 4),
    createdBy: String(createdBy || "Anonymous").slice(0, 40), members: [], messages: [], createdAt: Date.now(),
  };
  ensureGameOfTheDay(c);
  state.publicCircles.unshift(c); save(state);
  res.json({ ok: true, circle: c });
});

router.post("/circles/public/:id/join", (req, res) => {
  const c = state.publicCircles.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ ok: false, error: "Not found" });
  const { name } = req.body || {};
  const who = String(name || "").slice(0, 40).trim();
  if (who && !c.members.includes(who)) { c.members.push(who); save(state); }
  res.json({ ok: true, memberCount: c.members.length });
});

router.post("/circles/public/:id/messages", (req, res) => {
  const c = state.publicCircles.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ ok: false, error: "Not found" });
  const { author, text, anonymous } = req.body || {};
  const t = String(text || "").trim().slice(0, 1000);
  if (!t) return res.status(400).json({ ok: false, error: "Message empty" });
  const msg: Msg = {
    id: `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    author: anonymous ? "A Sister 🌹" : (String(author || "Anonymous").slice(0, 40)),
    text: t, ts: Date.now(), roses: 0, anonymous: !!anonymous,
  };
  c.messages.push(msg);
  if (c.messages.length > 500) c.messages = c.messages.slice(-500);
  save(state);
  res.json({ ok: true, message: msg });
});

router.post("/circles/public/:id/messages/:msgId/rose", (req, res) => {
  const c = state.publicCircles.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ ok: false, error: "Not found" });
  const m = c.messages.find(x => x.id === req.params.msgId);
  if (!m) return res.status(404).json({ ok: false, error: "Message not found" });
  m.roses++;
  if (!m.anonymous) state.roses[m.author] = (state.roses[m.author] || 0) + 1;
  save(state);
  res.json({ ok: true, roses: m.roses, authorTotalRoses: m.anonymous ? null : state.roses[m.author] });
});

router.get("/circles/roses/:author", (req, res) => {
  res.json({ ok: true, author: req.params.author, roses: state.roses[req.params.author] || 0 });
});

export default router;
