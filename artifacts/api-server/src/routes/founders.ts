import { Router } from "express";
import express from "express";
import fs from "fs";
import path from "path";
import { verifyEmailToken } from "./auth";

const router = Router();
router.use(express.json({ limit: "10kb" }));

const FILE = path.join(process.cwd(), ".rosa-founders.json");

type State = { claims: Record<string, { number: number; tier: "first_100" | "first_500" | "regular" | "lifetime"; claimedAt: number }>; total: number };

function load(): State {
  try {
    if (fs.existsSync(FILE)) {
      const raw = fs.readFileSync(FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.claims && typeof parsed.total === "number") return parsed;
    }
  } catch (e) {
    // CRITICAL: refuse to silently reset state on parse failure — that would erase founders.
    throw new Error(`Founders state file is corrupted at ${FILE}: ${(e as Error).message}. Refusing to start with empty state.`);
  }
  return { claims: {}, total: 0 };
}
function saveAtomic(s: State) {
  // Atomic write: temp + rename. If anything fails the original file is untouched.
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

function bearer(req: any): string | null {
  const h = req.headers["authorization"];
  if (typeof h === "string" && h.startsWith("Bearer ")) return h.slice(7).trim();
  return null;
}

// PUBLIC: aggregate counts only — no per-user data, no enumeration vector.
router.get("/founders/status", (_req, res) => {
  res.json({
    ok: true,
    total: state.total,
    spotsLeftFirst100: Math.max(0, 100 - state.total),
    spotsLeftFirst500: Math.max(0, 500 - state.total),
    nextTier: tierFor(state.total + 1),
  });
});

// AUTHENTICATED: claim requires a valid HMAC token issued by /auth/verify-code.
// The client cannot forge this — it can only obtain it by completing email verification.
router.post("/founders/claim", (req, res) => {
  const token = bearer(req) || (req.body && req.body.token);
  const verifiedEmail = verifyEmailToken(String(token || ""));
  if (!verifiedEmail) {
    return res.status(401).json({ ok: false, error: "Verified email token required. Sign in first." });
  }
  const id = verifiedEmail;

  if (state.claims[id]) {
    const c = state.claims[id];
    const months = c.tier === "first_100" ? 6 : c.tier === "first_500" ? 3 : c.tier === "lifetime" ? 9999 : 0;
    return res.json({ ok: true, number: c.number, tier: c.tier, freeMonths: months, total: state.total });
  }

  const next = state.total + 1;
  const tier = tierFor(next);
  const months = tier === "first_100" ? 6 : tier === "first_500" ? 3 : 0;
  const newState: State = { ...state, total: next, claims: { ...state.claims, [id]: { number: next, tier, claimedAt: Date.now() } } };

  try {
    saveAtomic(newState);
  } catch (e: any) {
    // Hard fail — caller must know the claim wasn't persisted. Do NOT update in-memory state.
    return res.status(500).json({ ok: false, error: "Could not record claim. Please retry." });
  }
  state = newState;
  res.json({ ok: true, number: next, tier, freeMonths: months, total: state.total });
});

// AUTHENTICATED: only the verified owner of an email can read their own claim.
// Removed the path param / enumeration endpoint.
router.get("/founders/me", (req, res) => {
  const token = bearer(req);
  const verifiedEmail = verifyEmailToken(String(token || ""));
  if (!verifiedEmail) return res.status(401).json({ ok: false, error: "Verified email token required." });
  const c = state.claims[verifiedEmail];
  if (!c) return res.json({ ok: true, claimed: false });
  const freeMonths = c.tier === "first_100" ? 6 : c.tier === "first_500" ? 3 : c.tier === "lifetime" ? 9999 : 0;
  res.json({ ok: true, claimed: true, ...c, freeMonths });
});

export default router;
