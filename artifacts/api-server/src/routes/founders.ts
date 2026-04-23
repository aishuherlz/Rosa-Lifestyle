import { Router } from "express";
import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { verifyEmailToken } from "./auth";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

const RAFFLE_MIN_USERS = 500;
const RAFFLE_MIN_SUBSCRIBERS = 50;

async function getActiveSubscriberCount(): Promise<number> {
  try {
    const r: any = await db.execute(sql`SELECT COUNT(*)::int AS n FROM rosa_users WHERE subscription_status = 'active'`);
    return Number((r.rows && r.rows[0] && (r.rows[0] as any).n) || 0);
  } catch { return 0; }
}
router.use(express.json({ limit: "10kb" }));

const FILE = path.join(process.cwd(), ".rosa-founders.json");
const ADMIN_TOKEN = process.env.FOUNDERS_ADMIN_TOKEN || "";
const BETA_WINDOW_END = process.env.BETA_WINDOW_END
  ? new Date(process.env.BETA_WINDOW_END).getTime()
  : Date.now() + 90 * 24 * 60 * 60 * 1000; // default 90 days from boot

type Tier = "first_100" | "first_500" | "regular" | "lifetime";
type Claim = {
  number: number;
  tier: Tier;
  beta: boolean;          // signed up during the 3-month beta window
  claimedAt: number;
  raffleWinner?: boolean; // chosen as one of the lucky 10
};
type State = { claims: Record<string, Claim>; total: number; raffleDone?: boolean; raffleAt?: number };

function load(): State {
  try {
    if (fs.existsSync(FILE)) {
      const raw = fs.readFileSync(FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.claims && typeof parsed.total === "number") return parsed;
    }
  } catch (e) {
    throw new Error(`Founders state file corrupted at ${FILE}: ${(e as Error).message}. Refusing to silently reset.`);
  }
  return { claims: {}, total: 0 };
}
function saveAtomic(s: State) {
  const tmp = `${FILE}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(s));
  fs.renameSync(tmp, FILE);
}
let state = load();

function tierFor(n: number): "first_100" | "first_500" | "regular" {
  if (n <= 100) return "first_100";
  if (n <= 500) return "first_500";
  return "regular";
}
// Single in-process mutex — serializes all read-modify-write on state.
// (Single Node process per artifact, so this is sufficient until we move to DB.)
let mutex: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T> | T): Promise<T> {
  const next = mutex.then(() => fn());
  mutex = next.catch(() => {}); // never let a rejection break the chain
  return next as Promise<T>;
}

function bearer(req: any): string | null {
  const h = req.headers["authorization"];
  if (typeof h === "string" && h.startsWith("Bearer ")) return h.slice(7).trim();
  return null;
}
function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a); const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
function freeMonthsFor(c: Claim): number {
  if (c.tier === "lifetime") return 9999;
  if (c.tier === "first_100") return 6;
  if (c.tier === "first_500") return 3;
  return c.beta ? 1 : 0; // beta members beyond 500 still get 1 free month
}

// PUBLIC: aggregate scarcity info — no per-user data, no enumeration vector.
router.get("/founders/status", async (_req, res) => {
  const now = Date.now();
  const betaActive = now < BETA_WINDOW_END;
  const activeSubscribers = await getActiveSubscriberCount();
  const raffleEligible = state.total >= RAFFLE_MIN_USERS && activeSubscribers >= RAFFLE_MIN_SUBSCRIBERS;
  res.json({
    ok: true,
    total: state.total,
    spotsLeftFirst100: Math.max(0, 100 - state.total),
    spotsLeftFirst500: Math.max(0, 500 - state.total),
    nextTier: tierFor(state.total + 1),
    betaActive,
    betaWindowEnd: new Date(BETA_WINDOW_END).toISOString(),
    betaDaysLeft: Math.max(0, Math.ceil((BETA_WINDOW_END - now) / (24 * 60 * 60 * 1000))),
    raffleDone: !!state.raffleDone,
    raffleEligible,
    raffleProgress: {
      members: state.total,
      membersNeeded: RAFFLE_MIN_USERS,
      subscribers: activeSubscribers,
      subscribersNeeded: RAFFLE_MIN_SUBSCRIBERS,
    },
  });
});

// AUTHENTICATED claim — requires the HMAC token issued by /auth/verify-code.
router.post("/founders/claim", async (req, res) => {
  const token = bearer(req) || (req.body && req.body.token);
  const verifiedEmail = verifyEmailToken(String(token || ""));
  if (!verifiedEmail) return res.status(401).json({ ok: false, error: "Verified email token required. Sign in first." });
  const id = verifiedEmail;

  const result = await withLock(() => {
    const now = Date.now();
    if (state.claims[id]) {
      const c = state.claims[id];
      return { ok: true as const, number: c.number, tier: c.tier, beta: c.beta, raffleWinner: !!c.raffleWinner, freeMonths: freeMonthsFor(c), total: state.total };
    }
    const next = state.total + 1;
    const tier = tierFor(next);
    const beta = now < BETA_WINDOW_END;
    const claim: Claim = { number: next, tier, beta, claimedAt: now };
    const newState: State = { ...state, total: next, claims: { ...state.claims, [id]: claim } };
    try { saveAtomic(newState); } catch (e: any) { return { error: "Could not record claim. Please retry." }; }
    state = newState;
    return { ok: true as const, number: next, tier, beta, raffleWinner: false, freeMonths: freeMonthsFor(claim), total: state.total };
  });
  if ("error" in result) return res.status(500).json({ ok: false, error: result.error });
  res.json(result);
});

// AUTHENTICATED — only the verified owner can read their own claim.
router.get("/founders/me", (req, res) => {
  const verifiedEmail = verifyEmailToken(String(bearer(req) || ""));
  if (!verifiedEmail) return res.status(401).json({ ok: false, error: "Verified email token required." });
  const c = state.claims[verifiedEmail];
  if (!c) return res.json({ ok: true, claimed: false });
  res.json({ ok: true, claimed: true, ...c, freeMonths: freeMonthsFor(c) });
});

// ADMIN — pick 10 lucky beta members at random. Crypto-secure, idempotent (refuses if already done).
router.post("/founders/raffle/pick", async (req, res) => {
  const provided = bearer(req) || (req.body && req.body.adminToken) || "";
  if (!ADMIN_TOKEN || !constantTimeEqual(String(provided), ADMIN_TOKEN)) {
    return res.status(401).json({ ok: false, error: "Admin token required." });
  }
  // Eligibility gate: 500+ founders signed up AND 50+ active paying subscribers.
  const activeSubscribers = await getActiveSubscriberCount();
  if (state.total < RAFFLE_MIN_USERS || activeSubscribers < RAFFLE_MIN_SUBSCRIBERS) {
    return res.status(412).json({
      ok: false,
      error: `Raffle locked until ${RAFFLE_MIN_USERS}+ founders AND ${RAFFLE_MIN_SUBSCRIBERS}+ active subscribers.`,
      progress: { members: state.total, membersNeeded: RAFFLE_MIN_USERS, subscribers: activeSubscribers, subscribersNeeded: RAFFLE_MIN_SUBSCRIBERS },
    });
  }
  const result = await withLock(() => {
    if (state.raffleDone) return { conflict: true as const, at: state.raffleAt };
    const pool = Object.entries(state.claims).filter(([, c]) => c.beta && !c.raffleWinner);
    if (pool.length === 0) return { bad: true as const };
    const idx = pool.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    const winners = idx.slice(0, Math.min(10, pool.length)).map(i => pool[i][0]);
    const newClaims = { ...state.claims };
    for (const email of winners) newClaims[email] = { ...newClaims[email], raffleWinner: true };
    const newState: State = { ...state, claims: newClaims, raffleDone: true, raffleAt: Date.now() };
    try { saveAtomic(newState); } catch { return { error: "Could not persist raffle." as const }; }
    state = newState;
    return { ok: true as const, winners: winners.map(e => ({ email: e, number: newClaims[e].number })), drawnAt: state.raffleAt };
  });
  if ("conflict" in result) return res.status(409).json({ ok: false, error: "Raffle already drawn.", at: result.at });
  if ("bad" in result) return res.status(400).json({ ok: false, error: "No eligible beta members." });
  if ("error" in result) return res.status(500).json({ ok: false, error: result.error });
  res.json(result);
});

// PUBLIC — anyone can see if/when the raffle was drawn (no winner identities)
router.get("/founders/raffle/status", (_req, res) => {
  const winners = Object.values(state.claims).filter(c => c.raffleWinner).length;
  res.json({ ok: true, raffleDone: !!state.raffleDone, drawnAt: state.raffleAt || null, winnersCount: winners });
});

export default router;
