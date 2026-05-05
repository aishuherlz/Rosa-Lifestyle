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

// Auto-apply DB schema updates for sync/share columns
db.execute(sql`
  CREATE TABLE IF NOT EXISTS partner_links (
    id SERIAL PRIMARY KEY,
    user_email TEXT NOT NULL,
    partner_email TEXT NOT NULL,
    share_cycle BOOLEAN DEFAULT false,
    share_mood BOOLEAN DEFAULT false,
    share_wishlist BOOLEAN DEFAULT false,
    share_milestones BOOLEAN DEFAULT false,
    share_fitness BOOLEAN DEFAULT false,
    share_sleep BOOLEAN DEFAULT false,
    share_skin BOOLEAN DEFAULT false,
    share_travel BOOLEAN DEFAULT false,
    share_food BOOLEAN DEFAULT false,
    share_journal BOOLEAN DEFAULT false,
    share_goals BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_email, partner_email)
  );
`).catch(console.error);

db.execute(sql`
  CREATE TABLE IF NOT EXISTS partner_notifications (
    id SERIAL PRIMARY KEY,
    from_email TEXT NOT NULL,
    to_email TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
  );
`).catch(console.error);

db.execute(sql`
  ALTER TABLE partner_links 
  ADD COLUMN IF NOT EXISTS share_sleep BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_skin BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_travel BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_food BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_journal BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_goals BOOLEAN DEFAULT false;
`).catch(() => {});

// Ensure the unique constraint exists (Postgres 9.1+ syntax)
db.execute(sql`
  DO $$ 
  BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'partner_links_user_partner_unique') THEN
      ALTER TABLE partner_links ADD CONSTRAINT partner_links_user_partner_unique UNIQUE (user_email, partner_email);
    END IF;
  END $$;
`).catch(err => console.error("Constraint repair failed:", err.message));

db.execute(sql`
  ALTER TABLE rosa_users
  ADD COLUMN IF NOT EXISTS wishlist_data TEXT,
  ADD COLUMN IF NOT EXISTS milestones_data TEXT,
  ADD COLUMN IF NOT EXISTS goals_data TEXT,
  ADD COLUMN IF NOT EXISTS sleep_data TEXT,
  ADD COLUMN IF NOT EXISTS skin_data TEXT,
  ADD COLUMN IF NOT EXISTS travel_data TEXT,
  ADD COLUMN IF NOT EXISTS food_data TEXT,
  ADD COLUMN IF NOT EXISTS journal_data TEXT,
  ADD COLUMN IF NOT EXISTS mood_data TEXT,
  ADD COLUMN IF NOT EXISTS cycle_data TEXT,
  ADD COLUMN IF NOT EXISTS fitness_data TEXT;
`).catch(console.error);

// Send notification to partner
router.post("/partner/notify", requireSession, async (req: any, res) => {
  const email = req.rosaUser?.emailOrPhone;
  const { toEmail, type, title, message, data } = req.body;
  try {
    const from = String(email || "").toLowerCase().trim();
    const to = String(toEmail || "").toLowerCase().trim();
    await db.execute(sql`
      INSERT INTO partner_notifications (from_email, to_email, type, title, message, data)
      VALUES (${from}, ${to}, ${type}, ${title}, ${message}, ${JSON.stringify(data || {})})
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
      SELECT pn.*, ru.name as from_name
      FROM partner_notifications pn
      LEFT JOIN rosa_users ru ON ru.email_or_phone = pn.from_email
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

// Link partner by Invite Code (Bidirectional)
router.post("/partner/link", requireSession, async (req: any, res) => {
  const email = req.rosaUser?.emailOrPhone;
  const { partnerInviteCode } = req.body;
  
  console.log(`[PARTNER LINK] Request from ${email} with code: ${partnerInviteCode}`);
  
  try {
    const code = String(partnerInviteCode || "").trim().toUpperCase();
    if (!code) {
      console.log(`[PARTNER LINK] Rejected: empty code`);
      return res.status(400).json({ error: "Invite code required" });
    }

    const target = await db.execute(sql`
      SELECT email_or_phone, name FROM rosa_users WHERE UPPER(TRIM(partner_invite_code)) = ${code}
    `);
    
    if (!target.rows.length) {
      console.log(`[PARTNER LINK] Rejected: code ${code} not found in DB`);
      return res.status(404).json({ error: "Partner not found with that invite code. Please check the code and try again." });
    }
    
    const partnerEmail = (target.rows[0] as any).email_or_phone;
    const partnerName = (target.rows[0] as any).name;
    
    if (partnerEmail.toLowerCase() === email.toLowerCase()) {
      console.log(`[PARTNER LINK] Rejected: user ${email} tried to link to self`);
      return res.status(400).json({ error: "Cannot link to yourself" });
    }
    
    console.log(`[PARTNER LINK] Linking ${email} <-> ${partnerEmail}`);
    
    // Use a transaction for the bidirectional link
    await db.transaction(async (tx) => {
      const u1 = email.toLowerCase().trim();
      const u2 = partnerEmail.toLowerCase().trim();

      console.log(`[PARTNER LINK] Executing inserts for: ${u1} and ${u2}`);

      // 1. Create the bidirectional links (Manual check to avoid ON CONFLICT syntax issues)
      const existing1 = await tx.execute(sql`SELECT id FROM partner_links WHERE user_email = ${u1} AND partner_email = ${u2}`);
      if (!existing1.rows.length) {
        await tx.execute(sql`INSERT INTO partner_links (user_email, partner_email) VALUES (${u1}, ${u2})`);
      }
      
      const existing2 = await tx.execute(sql`SELECT id FROM partner_links WHERE user_email = ${u2} AND partner_email = ${u1}`);
      if (!existing2.rows.length) {
        await tx.execute(sql`INSERT INTO partner_links (user_email, partner_email) VALUES (${u2}, ${u1})`);
      }
      
      // 2. Mark users as linked in rosa_users table (for easier querying elsewhere)
      await tx.execute(sql`
        UPDATE rosa_users SET partner_linked = true 
        WHERE email_or_phone IN (${email.toLowerCase()}, ${partnerEmail.toLowerCase()})
      `);
      
      // 3. Send notification to the partner
      try {
        const from = email.trim();
        const to = partnerEmail.trim();
        const senderName = req.rosaUser.name || 'Your partner';
        await tx.execute(sql`
          INSERT INTO partner_notifications (from_email, to_email, type, title, message)
          VALUES (${from}, ${to}, 'partner_request', 'Partner Linked 🌹',
            ${senderName + ' has successfully linked with you on ROSA'})
        `);
      } catch (notifyErr) {
        console.error(`[PARTNER LINK] Notification failed (non-fatal):`, notifyErr);
      }
    });

    console.log(`[PARTNER LINK] Successfully linked ${email} with ${partnerEmail}`);
    res.json({ ok: true, partnerName });
  } catch (err: any) {
    console.error(`[PARTNER LINK] CRITICAL ERROR for ${email}:`, err);
    res.status(500).json({ error: `Linking failed: ${err.message}` });
  }
});

// Get partner shared data
router.get("/partner/shared-data", requireSession, async (req: any, res) => {
  const email = req.rosaUser?.emailOrPhone;
  try {
    // Check if my partner has shared things with me
    const link = await db.execute(sql`
      SELECT * FROM partner_links WHERE partner_email = ${email}
      ORDER BY created_at DESC LIMIT 1
    `);
    if (!link.rows.length) return res.json({ linked: false });
    const partnerLink = link.rows[0] as any;
    
    // Get their actual user data
    const partner = await db.execute(sql`
      SELECT name, nickname, profile_photo_url,
             wishlist_data, milestones_data, goals_data, sleep_data, skin_data, 
             travel_data, food_data, journal_data, mood_data, cycle_data, fitness_data
      FROM rosa_users
      WHERE email_or_phone = ${partnerLink.user_email}
    `);
    
    if (!partner.rows.length) return res.json({ linked: false });
    const pData = partner.rows[0] as any;
    
    const safeParse = (str: string | null) => { try { return str ? JSON.parse(str) : null; } catch { return null; } };

    res.json({
      linked: true,
      partner: {
        name: pData.name,
        nickname: pData.nickname,
        profilePhotoUrl: pData.profile_photo_url
      },
      sharePrefs: {
        cycle: partnerLink.share_cycle,
        mood: partnerLink.share_mood,
        wishlist: partnerLink.share_wishlist,
        milestones: partnerLink.share_milestones,
        fitness: partnerLink.share_fitness,
        sleep: partnerLink.share_sleep,
        skin: partnerLink.share_skin,
        travel: partnerLink.share_travel,
        food: partnerLink.share_food,
        journal: partnerLink.share_journal,
        goals: partnerLink.share_goals,
      },
      partnerData: {
        cycle: partnerLink.share_cycle ? safeParse(pData.cycle_data) : null,
        mood: partnerLink.share_mood ? safeParse(pData.mood_data) : null,
        wishlist: partnerLink.share_wishlist ? safeParse(pData.wishlist_data) : null,
        milestones: partnerLink.share_milestones ? safeParse(pData.milestones_data) : null,
        fitness: partnerLink.share_fitness ? safeParse(pData.fitness_data) : null,
        sleep: partnerLink.share_sleep ? safeParse(pData.sleep_data) : null,
        skin: partnerLink.share_skin ? safeParse(pData.skin_data) : null,
        travel: partnerLink.share_travel ? safeParse(pData.travel_data) : null,
        food: partnerLink.share_food ? safeParse(pData.food_data) : null,
        journal: partnerLink.share_journal ? safeParse(pData.journal_data) : null,
        goals: partnerLink.share_goals ? safeParse(pData.goals_data) : null,
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update partner share preferences
router.put("/partner/share-prefs", requireSession, async (req: any, res) => {
  const email = req.rosaUser?.emailOrPhone;
  const { 
    partnerEmail, shareCycle, shareMood, shareWishlist, shareMilestones, shareFitness,
    shareSleep, shareSkin, shareTravel, shareFood, shareJournal, shareGoals
  } = req.body;
  try {
    let targetEmail = partnerEmail;
    if (!targetEmail) {
      // If client didn't provide partnerEmail, look it up from existing links
      const link = await db.execute(sql`
        SELECT partner_email FROM partner_links WHERE user_email = ${email} LIMIT 1
      `);
      if (link.rows.length > 0) {
        targetEmail = (link.rows[0] as any).partner_email;
      }
    }

    if (!targetEmail) return res.status(400).json({ error: "No partner link found to update" });

    await db.execute(sql`
      UPDATE partner_links SET
        share_cycle = ${!!shareCycle},
        share_mood = ${!!shareMood},
        share_wishlist = ${!!shareWishlist},
        share_milestones = ${!!shareMilestones},
        share_fitness = ${!!shareFitness},
        share_sleep = ${!!shareSleep},
        share_skin = ${!!shareSkin},
        share_travel = ${!!shareTravel},
        share_food = ${!!shareFood},
        share_journal = ${!!shareJournal},
        share_goals = ${!!shareGoals}
      WHERE user_email = ${email} AND partner_email = ${targetEmail}
    `);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Sync data (push from local storage to backend)
router.post("/sync/push", requireSession, async (req: any, res) => {
  const email = req.rosaUser?.emailOrPhone;
  const { type, data } = req.body;
  const validTypes = ["wishlist", "milestones", "goals", "sleep", "skin", "travel", "food", "journal", "mood", "cycle", "fitness"];
  
  if (!validTypes.includes(type)) return res.status(400).json({ error: "Invalid sync type" });
  
  try {
    // We construct the column name safely since type is strictly validated against a whitelist
    const colName = type + "_data";
    const jsonData = JSON.stringify(data);
    await db.execute(sql.raw(`UPDATE rosa_users SET ${colName} = '${jsonData.replace(/'/g, "''")}' WHERE email_or_phone = '${email.replace(/'/g, "''")}'`));
    res.json({ ok: true });
  } catch(err: any) {
    res.status(500).json({ error: err.message });
  }
});
