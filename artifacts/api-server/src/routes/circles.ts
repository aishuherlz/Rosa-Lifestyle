import { Router } from "express";
import express from "express";
import { moderateText } from "../lib/moderation";
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

router.post("/circles/public/:id/messages", async (req, res) => {
  const c = state.publicCircles.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ ok: false, error: "Not found" });
  const { author, text, anonymous } = req.body || {};
  const t = String(text || "").trim().slice(0, 1000);
  if (!t) return res.status(400).json({ ok: false, error: "Message empty" });
  try {
    const verdict = await moderateText(t);
    if (verdict.allow === false) {
      return res.status(422).json({ ok: false, error: verdict.reason || "This message goes against our community guidelines 🌹" });
    }
  } catch {}
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

// ─── Private Circles (DB-backed) ─────────────────────────────────────────
import { requireSession } from "./auth";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

// Create private circle
router.post("/circles/private", requireSession, async (req: any, res) => {
  const email = req.rosaUser?.emailOrPhone;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name required" });
  try {
    const result = await db.execute(sql`
      INSERT INTO private_circles (name, created_by_email)
      VALUES (${name}, ${email})
      RETURNING id, name, created_at
    `);
    const circle = result.rows[0] as any;
    await db.execute(sql`
      INSERT INTO private_circle_members (circle_id, user_email)
      VALUES (${circle.id}, ${email})
    `);
    res.json({ ok: true, circle });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get my private circles
router.get("/circles/private", requireSession, async (req: any, res) => {
  const email = req.rosaUser?.emailOrPhone;
  try {
    const result = await db.execute(sql`
      SELECT pc.id, pc.name, pc.created_at, pc.created_by_email,
        COUNT(pcm.id) as member_count
      FROM private_circles pc
      JOIN private_circle_members pcm ON pc.id = pcm.circle_id
      WHERE pc.id IN (
        SELECT circle_id FROM private_circle_members WHERE user_email = ${email}
      )
      GROUP BY pc.id
      ORDER BY pc.created_at DESC
    `);
    res.json({ circles: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Invite member by ROSA ID
router.post("/circles/private/:id/invite", requireSession, async (req: any, res) => {
  const email = req.rosaUser?.emailOrPhone;
  const { rosaId } = req.body;
  const circleId = req.params.id;
  try {
    const member = await db.execute(sql`
      SELECT user_email FROM private_circle_members
      WHERE circle_id = ${circleId} AND user_email = ${email}
    `);
    if (!member.rows.length) return res.status(403).json({ error: "Not a member" });
    const target = await db.execute(sql`
      SELECT email_or_phone FROM rosa_users WHERE rosa_id = ${rosaId}
    `);
    if (!target.rows.length) return res.status(404).json({ error: "User not found" });
    const targetEmail = (target.rows[0] as any).email_or_phone;
    await db.execute(sql`
      INSERT INTO private_circle_members (circle_id, user_email)
      VALUES (${circleId}, ${targetEmail})
      ON CONFLICT DO NOTHING
    `);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get messages in private circle
router.get("/circles/private/:id/messages", requireSession, async (req: any, res) => {
  const email = req.rosaUser?.emailOrPhone;
  const circleId = req.params.id;
  try {
    const member = await db.execute(sql`
      SELECT id FROM private_circle_members
      WHERE circle_id = ${circleId} AND user_email = ${email}
    `);
    if (!member.rows.length) return res.status(403).json({ error: "Not a member" });
    const messages = await db.execute(sql`
      SELECT pcm.id, pcm.content, pcm.is_anonymous, pcm.created_at,
        CASE WHEN pcm.is_anonymous THEN ru.anonymous_name
             ELSE ru.name END as author,
        ru.nickname
      FROM private_circle_messages pcm
      JOIN rosa_users ru ON ru.email_or_phone = pcm.user_email
      WHERE pcm.circle_id = ${circleId}
      ORDER BY pcm.created_at ASC
      LIMIT 100
    `);
    res.json({ messages: messages.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Send message in private circle
router.post("/circles/private/:id/messages", requireSession, async (req: any, res) => {
  const email = req.rosaUser?.emailOrPhone;
  const circleId = req.params.id;
  const { content, isAnonymous } = req.body;
  if (!content) return res.status(400).json({ error: "Message required" });
  try {
    const member = await db.execute(sql`
      SELECT id FROM private_circle_members
      WHERE circle_id = ${circleId} AND user_email = ${email}
    `);
    if (!member.rows.length) return res.status(403).json({ error: "Not a member" });
    const result = await db.execute(sql`
      INSERT INTO private_circle_messages (circle_id, user_email, content, is_anonymous)
      VALUES (${circleId}, ${email}, ${content}, ${!!isAnonymous})
      RETURNING id, content, is_anonymous, created_at
    `);
    res.json({ ok: true, message: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Partner System (DB-backed) ──────────────────────────────────────────

// Send notification to partner
router.post("/partner/notify", requireSession, async (req: any, res) => {
  const email = req.rosaUser?.emailOrPhone;
  const { toEmail, type, title, message, data } = req.body;
  try {
    await db.execute(sql`
      INSERT INTO partner_notifications (from_email, to_email, type, title, message, data)
      VALUES (${email}, ${toEmail}, ${type}, ${title}, ${message}, ${JSON.stringify(data || {})})
    `);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get my partner notifications
router.get("/partner/notifications", requireSession, async (req: any, res) => {
  const email = req.rosaUser?.emailOrPhone;
  try {
    const result = await db.execute(sql`
      SELECT pn.*, ru.name as from_name, ru.nickname as from_nickname
      FROM partner_notifications pn
      JOIN rosa_users ru ON ru.email_or_phone = pn.from_email
      WHERE pn.to_email = ${email}
      ORDER BY pn.created_at DESC
      LIMIT 50
    `);
    res.json({ notifications: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Mark notification as read
router.put("/partner/notifications/:id/read", requireSession, async (req: any, res) => {
  const email = req.rosaUser?.emailOrPhone;
  try {
    await db.execute(sql`
      UPDATE partner_notifications SET is_read = true
      WHERE id = ${req.params.id} AND to_email = ${email}
    `);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Link partner by ROSA ID
router.post("/partner/link", requireSession, async (req: any, res) => {
  const email = req.rosaUser?.emailOrPhone;
  const { partnerRosaId } = req.body;
  try {
    const target = await db.execute(sql`
      SELECT email_or_phone, name FROM rosa_users WHERE rosa_id = ${partnerRosaId}
    `);
    if (!target.rows.length) return res.status(404).json({ error: "Partner not found with that ROSA ID" });
    const partnerEmail = (target.rows[0] as any).email_or_phone;
    if (partnerEmail === email) return res.status(400).json({ error: "Cannot link to yourself" });
    await db.execute(sql`
      INSERT INTO partner_links (user_email, partner_email)
      VALUES (${email}, ${partnerEmail})
      ON CONFLICT (user_email, partner_email) DO NOTHING
    `);
    await db.execute(sql`
      INSERT INTO partner_notifications (from_email, to_email, type, title, message)
      VALUES (${email}, ${partnerEmail}, 'partner_request', 'Partner Request 🌹',
        ${req.rosaUser.name + ' wants to link with you on ROSA'})
    `);
    res.json({ ok: true, partnerName: (target.rows[0] as any).name });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get partner shared data
router.get("/partner/shared-data", requireSession, async (req: any, res) => {
  const email = req.rosaUser?.emailOrPhone;
  try {
    const link = await db.execute(sql`
      SELECT * FROM partner_links WHERE partner_email = ${email}
    `);
    if (!link.rows.length) return res.json({ linked: false });
    const partnerLink = link.rows[0] as any;
    const partner = await db.execute(sql`
      SELECT name, nickname, rosa_id, profile_photo_url FROM rosa_users
      WHERE email_or_phone = ${partnerLink.user_email}
    `);
    res.json({
      linked: true,
      partner: partner.rows[0],
      sharePrefs: {
        cycle: partnerLink.share_cycle,
        mood: partnerLink.share_mood,
        wishlist: partnerLink.share_wishlist,
        milestones: partnerLink.share_milestones,
        fitness: partnerLink.share_fitness,
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update partner share preferences
router.put("/partner/share-prefs", requireSession, async (req: any, res) => {
  const email = req.rosaUser?.emailOrPhone;
  const { partnerEmail, shareCycle, shareMood, shareWishlist, shareMilestones, shareFitness } = req.body;
  try {
    await db.execute(sql`
      UPDATE partner_links SET
        share_cycle = ${!!shareCycle},
        share_mood = ${!!shareMood},
        share_wishlist = ${!!shareWishlist},
        share_milestones = ${!!shareMilestones},
        share_fitness = ${!!shareFitness}
      WHERE user_email = ${email} AND partner_email = ${partnerEmail}
    `);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
