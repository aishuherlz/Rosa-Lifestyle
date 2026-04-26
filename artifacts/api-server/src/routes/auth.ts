import { Router } from "express";
import express from "express";
import crypto from "crypto";
import { eq, and, desc, isNull } from "drizzle-orm";
import { db, rosaUsers, trustedDevices } from "@workspace/db";
import { generateUniqueAnonymousName } from "../lib/anonymous-name";
import { requireAdmin } from "../lib/admin-auth";
// ─── ROSA ID generation ────────────────────────────────────────────────────
async function generateUniqueRosaId(): Promise<string> {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  for (let attempt = 0; attempt < 10; attempt++) {
    let id = "ROSA-";
    for (let i = 0; i < 5; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    const existing = await db.select({ rosaId: rosaUsers.rosaId })
      .from(rosaUsers)
      .where(eq(rosaUsers.rosaId, id))
      .limit(1);
    if (!existing[0]) return id;
  }
  // fallback with timestamp to guarantee uniqueness
  return "ROSA-" + Date.now().toString(36).toUpperCase().slice(-5);
}

async function backfillRosaIdIfNull(email: string): Promise<void> {
  const rosaId = await generateUniqueRosaId();
  await db.update(rosaUsers)
    .set({ rosaId })
    .where(and(eq(rosaUsers.emailOrPhone, email), isNull(rosaUsers.rosaId)));
}

const router = Router();

const AUTH_SECRET = (() => {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production (min 16 chars).");
  }
  return "rosa-dev-secret-change-me";
})();

// ─── Token format ──────────────────────────────────────────────────────────
// v2.<base64(json payload)>.<sig>
// payload = { e: email, exp: epochSec, v: tokenVersion, d: deviceId, r: 0|1 }
// - exp: hard expiry (30d for remember-me, 1d otherwise)
// - v: tokenVersion from rosa_users; bumping invalidates ALL old tokens for the user
// - d: trusted_device.id this token is bound to (so device-revoke works)
// We keep verifying v1 tokens (no expiry, no version) for backward compat with
// already-signed-in users until they re-verify.
type TokenPayload = { e: string; exp: number; v: number; d: string; r: 0 | 1 };

export function signSessionToken(payload: TokenPayload): string {
  const json = JSON.stringify(payload);
  const body = Buffer.from(json, "utf-8").toString("base64url");
  const sig = crypto.createHmac("sha256", AUTH_SECRET).update(`v2:${body}`).digest("base64url");
  return `v2.${body}.${sig}`;
}

export function verifySessionToken(token: string): TokenPayload | { e: string; legacy: true } | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  // v1 (legacy) — no expiry, no version. Still accept so existing logins keep working.
  if (parts[0] === "v1") {
    try {
      const email = Buffer.from(parts[1], "base64url").toString("utf-8");
      const expected = crypto.createHmac("sha256", AUTH_SECRET).update(`v1:${email}`).digest("base64url");
      if (parts[2].length !== expected.length) return null;
      if (!crypto.timingSafeEqual(Buffer.from(parts[2]), Buffer.from(expected))) return null;
      return { e: email, legacy: true };
    } catch { return null; }
  }
  if (parts[0] !== "v2") return null;
  try {
    const expected = crypto.createHmac("sha256", AUTH_SECRET).update(`v2:${parts[1]}`).digest("base64url");
    if (parts[2].length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(parts[2]), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8")) as TokenPayload;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch { return null; }
}

// Back-compat shim — older code imported these names.
export const signEmailToken = (email: string): string =>
  signSessionToken({
    e: email.trim().toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    v: 1,
    d: "legacy",
    r: 0,
  });
export const verifyEmailToken = (token: string): string | null => {
  const r = verifySessionToken(token);
  return r ? r.e : null;
};

router.use(express.json({ limit: "50kb" }));

type CodeEntry = { code: string; expiresAt: number; attempts: number; sent: number; channel: "email" | "phone" };
const codes = new Map<string, CodeEntry>();
const RATE = new Map<string, number[]>();

function genCode(): string { return Math.floor(100000 + Math.random() * 900000).toString(); }
function isEmail(s: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
function isPhone(s: string): boolean { return /^\+\d{6,15}$/.test(s.replace(/[\s-]/g, "")); }
function normalize(s: string): string { return s.trim().toLowerCase(); }

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const arr = (RATE.get(ip) || []).filter(t => now - t < 60_000);
  if (arr.length >= 5) return false;
  arr.push(now);
  RATE.set(ip, arr);
  return true;
}

function hashIp(ip: string): string {
  // Salted with the auth secret so the stored value is not reversible to the raw IP.
  return crypto.createHmac("sha256", AUTH_SECRET).update(`ip:${ip}`).digest("base64url").slice(0, 22);
}

function getClientIp(req: any): string {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
}

// Best-effort device label from the User-Agent string (no UA parsing dep).
function describeDevice(ua: string | undefined): string {
  if (!ua) return "Unknown device";
  const u = ua.toLowerCase();
  const os =
    u.includes("iphone") ? "iPhone" :
    u.includes("ipad") ? "iPad" :
    u.includes("android") ? "Android" :
    u.includes("mac os x") || u.includes("macintosh") ? "Mac" :
    u.includes("windows") ? "Windows" :
    u.includes("linux") ? "Linux" : "Device";
  const browser =
    u.includes("edg/") ? "Edge" :
    u.includes("chrome") && !u.includes("chromium") ? "Chrome" :
    u.includes("firefox") ? "Firefox" :
    u.includes("safari") && !u.includes("chrome") ? "Safari" :
    "Browser";
  return `${browser} on ${os}`;
}

function buildHtml(code: string, name: string): string {
  const safeName = (name || "beautiful").replace(/[<>&]/g, "");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Your ROSA verification code</title></head>
<body style="margin:0;padding:0;background:#fdf6f4;font-family:Georgia,'Times New Roman',serif;color:#3d1a24;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdf6f4;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 8px 32px rgba(139,34,82,0.10);">
        <tr><td style="background:linear-gradient(135deg,#8b2252 0%,#c14b7c 50%,#e8a4a4 100%);padding:48px 40px;text-align:center;">
          <h1 style="margin:0;font-size:64px;font-weight:500;letter-spacing:8px;color:#fff;font-family:Georgia,serif;">ROSA</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-style:italic;font-size:14px;letter-spacing:2px;">An app made for women, by women 🌹</p>
        </td></tr>
        <tr><td style="padding:48px 40px 16px;">
          <p style="margin:0 0 16px;font-size:18px;color:#3d1a24;">Hello ${safeName},</p>
          <p style="margin:0 0 32px;font-size:15px;line-height:1.6;color:#6b3a48;">
            Welcome to your sanctuary. Use the code below to verify your email and step into ROSA.
          </p>
          <div style="text-align:center;margin:32px 0;">
            <div style="display:inline-block;background:linear-gradient(135deg,#fdf6f4 0%,#fbe8eb 100%);border:1px solid #f1c4cd;border-radius:20px;padding:24px 36px;">
              <p style="margin:0 0 8px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#a85a78;">Your code</p>
              <p style="margin:0;font-size:42px;letter-spacing:10px;font-weight:600;color:#8b2252;font-family:'Courier New',monospace;">${code}</p>
            </div>
          </div>
          <p style="margin:16px 0 0;font-size:13px;color:#a08591;text-align:center;">
            This code expires in 10 minutes 🌸
          </p>
        </td></tr>
        <tr><td style="padding:24px 40px 48px;border-top:1px solid #fbe8eb;margin-top:32px;">
          <p style="margin:24px 0 8px;font-size:13px;color:#6b3a48;line-height:1.6;font-style:italic;text-align:center;">
            "Every woman deserves a soft place to land."
          </p>
          <p style="margin:16px 0 0;font-size:11px;color:#c8a4ae;text-align:center;letter-spacing:1px;">
            If you didn't request this, you can safely ignore it.<br>
            Built with love by Aiswarya Saji 💝
          </p>
        </td></tr>
      </table>
      <p style="margin:24px 0 0;font-size:11px;color:#c8a4ae;">© ROSA · Your sanctuary, always</p>
    </td></tr>
  </table>
</body></html>`;
}

async function sendEmailViaSendGrid(to: string, code: string, name: string): Promise<{ ok: boolean; error?: string; messageId?: string }> {
  const key = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM_EMAIL;
  if (!key || !from) {
    console.error("[SendGrid] Skipped: SENDGRID_API_KEY or SENDGRID_FROM_EMAIL not set on server.");
    return { ok: false, error: "missing_config" };
  }
  const fromGmail = /@gmail\.com$/i.test(from);
  const toGmail = /@gmail\.com$/i.test(to);
  const fromName = "ROSA — Aiswarya";
  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: to, name: name || undefined }],
          headers: {
            "List-Unsubscribe": `<mailto:${from}?subject=unsubscribe>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }],
        from: { email: from, name: fromName },
        reply_to: { email: from, name: fromName },
        subject: `Your ROSA verification code 🌹 — ${code}`,
        custom_args: { kind: "verification", to_domain: to.split("@")[1] || "" },
        categories: ["rosa-verification"],
        mail_settings: { sandbox_mode: { enable: false } },
        tracking_settings: {
          click_tracking: { enable: false, enable_text: false },
          open_tracking: { enable: false },
          subscription_tracking: { enable: false },
        },
        content: [
          { type: "text/plain", value:
`Hi ${name || "beautiful"},

Welcome to ROSA. Your verification code is:

  ${code}

It expires in 10 minutes. If you didn't request this, you can safely ignore this email.

With love,
Aiswarya
ROSA — an app made for women, by women 🌹

To unsubscribe, reply with "unsubscribe".` },
          { type: "text/html", value: buildHtml(code, name) },
        ],
      }),
    });
    if (res.ok) {
      const messageId = res.headers.get("x-message-id") || undefined;
      console.log(`[SendGrid] Verification code accepted for ${to} (status ${res.status}, from ${from}, x-message-id ${messageId || "n/a"})`);
      if (fromGmail && toGmail) {
        console.warn(`[SendGrid] WARNING: gmail.com→gmail.com via SendGrid often lands in spam due to DKIM/DMARC. Consider verifying a custom domain (e.g. noreply@rosainclusive.lifestyle) for production.`);
      }
      return { ok: true, messageId };
    }
    const errText = await res.text();
    console.error(`[SendGrid] FAILED ${res.status} sending to ${to} from ${from}: ${errText.slice(0, 500)}`);
    if (res.status === 401 || res.status === 403) {
      console.error(`[SendGrid] HINT: Your SENDGRID_FROM_EMAIL "${from}" is probably not verified as a Single Sender in SendGrid. Go to SendGrid → Sender Authentication → Single Sender Verification.`);
    }
    return { ok: false, error: `sendgrid_${res.status}: ${errText.slice(0, 200)}` };
  } catch (e: any) {
    console.error(`[SendGrid] Network error sending to ${to}:`, e?.message || e);
    return { ok: false, error: e?.message || "fetch_failed" };
  }
}

router.get("/auth/sendgrid-activity", requireAdmin, async (req, res) => {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) return res.status(503).json({ ok: false, error: "SENDGRID_API_KEY not set" });
  const email = String(req.query.email || "").trim().toLowerCase();
  if (!email || !isEmail(email)) return res.status(400).json({ ok: false, error: "Pass ?email=foo@bar.com" });
  try {
    const query = encodeURIComponent(`to_email="${email}"`);
    const url = `https://api.sendgrid.com/v3/messages?limit=20&query=${query}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) {
      const txt = await r.text();
      return res.status(r.status).json({
        ok: false,
        status: r.status,
        error: txt.slice(0, 500),
        hint: r.status === 401 ? "API key lacks 'Email Activity Read' scope. Create a new SendGrid API key with Full Access OR enable that scope." :
              r.status === 403 ? "Your SendGrid plan may not include Activity Feed. Free plan keeps activity for 3 days only." :
              undefined,
      });
    }
    const body = await r.json() as { messages?: any[] };
    const events = (body.messages || []).map((m: any) => ({
      to_email: m.to_email,
      from_email: m.from_email,
      subject: m.subject,
      status: m.status,
      opens_count: m.opens_count,
      clicks_count: m.clicks_count,
      last_event_time: m.last_event_time,
      msg_id: m.msg_id,
    }));
    res.json({ ok: true, count: events.length, events });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "fetch_failed" });
  }
});

router.get("/auth/sendgrid-status", (_req, res) => {
  const key = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM_EMAIL;
  res.json({
    configured: !!(key && from),
    hasApiKey: !!key,
    apiKeyPrefix: key ? `${key.slice(0, 7)}…` : null,
    fromEmail: from || null,
    note: !key || !from
      ? "Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL in your hosting environment."
      : "Configured. If emails don't arrive, verify the FROM address as a Single Sender in your SendGrid dashboard.",
  });
});

router.post("/auth/send-code", async (req, res) => {
  const ip = getClientIp(req);
  if (!rateLimit(ip)) return res.status(429).json({ ok: false, error: "Too many requests. Please wait a minute." });

  const { destination, name } = req.body || {};
  if (!destination || typeof destination !== "string") return res.status(400).json({ ok: false, error: "Missing destination" });
  const dest = normalize(destination);

  let channel: "email" | "phone";
  if (isEmail(dest)) channel = "email";
  else if (isPhone(dest)) channel = "phone";
  else return res.status(400).json({ ok: false, error: "Enter a valid email or phone number with country code (e.g. +14155551234)" });

  const code = genCode();
  codes.set(dest, { code, expiresAt: Date.now() + 10 * 60_000, attempts: 0, sent: Date.now(), channel });

  if (channel === "email") {
    const sent = await sendEmailViaSendGrid(dest, code, name || "");
    if (sent.ok) return res.json({ ok: true, channel, sent: true, message: "Code sent to your email" });
    return res.json({ ok: true, channel, sent: false, devCode: process.env.NODE_ENV !== "production" ? code : undefined,
      message: process.env.NODE_ENV !== "production" ? `Email service not configured (${sent.error}). Use the code shown.` : "Could not send email. Please try again later." });
  }

  return res.json({ ok: true, channel, sent: false, devCode: process.env.NODE_ENV !== "production" ? code : undefined,
    message: "SMS coming soon — for now, please use email." });
});

// Look up (or upsert) the rosa_users row for an email so we have a stable
// tokenVersion. We don't require name here — sign-up may flow through gender/
// pronouns step before saving full profile elsewhere.
// Sanitises any incoming marketingOptIn value to one of three safe states.
// Anything unrecognised falls back to "later" so we never write garbage to DB.
function cleanMarketingPref(v: unknown): "yes" | "later" | "never" {
  return v === "yes" || v === "never" ? v : "later";
}

// Best-effort backfill of `anonymous_name` for an existing user that doesn't
// have one yet. Defends against three concurrency hazards at once:
//
//  1. Same-row race — two simultaneous sign-ins for the same email both see
//     anonymousName=NULL, both generate candidates, and both UPDATE. The
//     second write would overwrite the first, breaking the *permanence*
//     guarantee. We avoid that by adding `WHERE anonymous_name IS NULL` to
//     every UPDATE so the loser is a no-op.
//  2. Cross-row collision — generated candidate is already used by a
//     different user. Postgres raises 23505; we catch and retry with a fresh
//     candidate (up to a few attempts).
//  3. Generator exhaustion — generateUniqueAnonymousName returns null when
//     it can't find a free slot in 20 tries. We bail without writing
//     anything; the next sign-in will try again. Never a hard failure.
//
// Returns true if the row now (definitely) has an anonymous_name, false if
// we couldn't get one this time around.
async function backfillAnonymousNameIfNull(email: string): Promise<boolean> {
  for (let i = 0; i < 5; i++) {
    const candidate = await generateUniqueAnonymousName();
    if (!candidate) return false;
    try {
      const updated = await db
        .update(rosaUsers)
        .set({ anonymousName: candidate })
        .where(and(eq(rosaUsers.emailOrPhone, email), isNull(rosaUsers.anonymousName)))
        .returning({ id: rosaUsers.id });
      // updated.length === 0 means a sibling sign-in already won the
      // backfill race for this row. That's fine — the row already has a
      // permanent name; we just stop trying.
      return true;
    } catch (err: any) {
      // 23505 on anonymous_name_unique → cross-row collision; pick a new
      // name and retry. Any other error escapes to the caller.
      if (err?.code !== "23505") throw err;
    }
  }
  return false;
}

async function ensureUserRow(
  email: string,
  marketingOptIn?: "yes" | "later" | "never",
  name?: string,
): Promise<{ tokenVersion: number }> {
  const cleanName = (name || "").trim().slice(0, 80);
  const existing = await db.select().from(rosaUsers).where(eq(rosaUsers.emailOrPhone, email)).limit(1);
  if (existing[0]) {
    // Build a partial update so we only touch the fields the client actually sent.
    // - marketingOptIn: only overwrite if explicitly provided (so re-verify never resets pref).
    // - name: only overwrite if a real name was provided AND the existing name is the
    //   email-prefix placeholder we wrote on first insert. This way a user's
    //   intentionally chosen display name is never silently clobbered on re-login.
    const patch: Partial<{ marketingOptIn: "yes" | "later" | "never"; name: string }> = {};
    if (marketingOptIn) patch.marketingOptIn = marketingOptIn;
    const placeholder = email.split("@")[0] || "Friend";
    if (cleanName && (existing[0].name === placeholder || !existing[0].name)) {
      patch.name = cleanName;
    }
    if (Object.keys(patch).length > 0) {
      await db.update(rosaUsers).set(patch).where(eq(rosaUsers.emailOrPhone, email));
    }
    // Backfill anonymous_name in a separate, race-safe statement so the
    // permanence guarantee is preserved even under concurrent sign-ins (see
    // `backfillAnonymousNameIfNull` for the exact protections).
    if (!existing[0].anonymousName) {
      await backfillAnonymousNameIfNull(email);
    }
    if (!existing[0].rosaId) {
      await backfillRosaIdIfNull(email);
    }
    return { tokenVersion: existing[0].tokenVersion ?? 1 };
  }

  // New user: try to insert with a freshly minted anonymous name. If the
  // unique constraint on `anonymous_name` collides (vanishingly rare), regenerate
  // and retry; we don't want signup to fail just because the dice were unlucky.
  for (let attempt = 0; attempt < 5; attempt++) {
    const anonymousName = await generateUniqueAnonymousName();
    const rosaId = await generateUniqueRosaId();
    try {
      const [row] = await db
        .insert(rosaUsers)
        .values({
          emailOrPhone: email,
          name: cleanName || (email.split("@")[0] || "Friend"),
          marketingOptIn: marketingOptIn ?? "later",
          anonymousName,
          rosaId,
        })
        .onConflictDoNothing({ target: rosaUsers.emailOrPhone })
        .returning();
      if (row) return { tokenVersion: row.tokenVersion ?? 1 };
      // emailOrPhone race: another request created it; re-read and try a
      // best-effort backfill in case that other writer ran out of attempts.
      const again = await db.select().from(rosaUsers).where(eq(rosaUsers.emailOrPhone, email)).limit(1);
      if (again[0] && !again[0].anonymousName) {
        await backfillAnonymousNameIfNull(email);
      }
      return { tokenVersion: again[0]?.tokenVersion ?? 1 };
    } catch (err: any) {
      // 23505 on anonymous_name unique → regenerate + retry. Anything else bubbles.
      if (err?.code !== "23505") throw err;
      // If it's the email unique that fired (shouldn't, since we used onConflictDoNothing),
      // re-read and exit gracefully.
      const detail = String(err?.constraint || err?.detail || "");
      if (detail.includes("email")) {
        const again = await db.select().from(rosaUsers).where(eq(rosaUsers.emailOrPhone, email)).limit(1);
        return { tokenVersion: again[0]?.tokenVersion ?? 1 };
      }
      // Else: anonymous_name collision — loop and try a different one.
    }
  }
  // Last-ditch: insert without an anonymousName so signup never hard-fails.
  // We then immediately attempt one more backfill so the user doesn't have
  // to wait for the *next* sign-in just because the namespace had a brief
  // hot streak. Both the new row and any sibling email-race winner get the
  // opportunistic backfill treatment.
  const [row] = await db
    .insert(rosaUsers)
    .values({
      emailOrPhone: email,
      name: cleanName || (email.split("@")[0] || "Friend"),
      marketingOptIn: marketingOptIn ?? "later",
    })
    .onConflictDoNothing({ target: rosaUsers.emailOrPhone })
    .returning();
  if (row) {
    if (!row.anonymousName) await backfillAnonymousNameIfNull(email);
    return { tokenVersion: row.tokenVersion ?? 1 };
  }
  const again = await db.select().from(rosaUsers).where(eq(rosaUsers.emailOrPhone, email)).limit(1);
  if (again[0] && !again[0].anonymousName) {
    await backfillAnonymousNameIfNull(email);
  }
  return { tokenVersion: again[0]?.tokenVersion ?? 1 };
}

router.post("/auth/verify-code", async (req, res) => {
  const { destination, code, rememberMe, deviceName, marketingOptIn, name } = req.body || {};
  if (!destination || !code) return res.status(400).json({ ok: false, error: "Missing fields" });
  const dest = normalize(destination);
  const entry = codes.get(dest);
  if (!entry) return res.status(400).json({ ok: false, error: "No code found. Please request a new one." });
  if (Date.now() > entry.expiresAt) { codes.delete(dest); return res.status(400).json({ ok: false, error: "Code expired. Please request a new one." }); }
  if (entry.attempts >= 5) { codes.delete(dest); return res.status(429).json({ ok: false, error: "Too many attempts. Please request a new code." }); }
  entry.attempts++;
  if (String(code).trim() !== entry.code) return res.status(400).json({ ok: false, error: "Incorrect code. Please try again." });
  codes.delete(dest);

  if (entry.channel !== "email") {
    return res.json({ ok: true, verified: true, channel: entry.channel, token: null });
  }

  const remember = rememberMe === true;
  const ttlSec = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24; // 30d vs 1d
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const deviceId = crypto.randomBytes(18).toString("base64url");
  const ua = (req.headers["user-agent"] as string | undefined) || "";
  const label = (typeof deviceName === "string" && deviceName.trim()) ? deviceName.trim().slice(0, 80) : describeDevice(ua);
  const ip = getClientIp(req);

  try {
    const { tokenVersion } = await ensureUserRow(
      dest,
      marketingOptIn !== undefined ? cleanMarketingPref(marketingOptIn) : undefined,
      typeof name === "string" ? name : undefined,
    );
    await db.insert(trustedDevices).values({
      email: dest,
      deviceId,
      deviceName: label,
      userAgent: ua.slice(0, 500),
      ipHash: hashIp(ip),
      rememberMe: remember,
      expiresAt: new Date(exp * 1000),
    });
    const token = signSessionToken({ e: dest, exp, v: tokenVersion, d: deviceId, r: remember ? 1 : 0 });
    // Read back the now-guaranteed anonymous_name so the client can stash it
    // alongside the rest of the profile during sign-in (no extra round trip).
    const [profile] = await db
      .select({ anonymousName: rosaUsers.anonymousName })
      .from(rosaUsers)
      .where(eq(rosaUsers.emailOrPhone, dest))
      .limit(1);
    res.json({
      ok: true,
      verified: true,
      channel: entry.channel,
      token,
      deviceId,
      deviceName: label,
      expiresAt: new Date(exp * 1000).toISOString(),
      rememberMe: remember,
      anonymousName: profile?.anonymousName ?? null,
    });
  } catch (e: any) {
    console.error("[Auth] verify-code failed to register device:", e?.message || e);
    res.status(500).json({ ok: false, error: "Verification succeeded but session could not be created. Please try again." });
  }
});

// Bearer-token middleware. Attaches { email, deviceId, legacy } to req on success.
// Exported so other route files (rose-wall, etc.) can mount auth-protected
// endpoints without duplicating the token-verification + tokenVersion +
// trusted-device check logic.
export async function requireSession(req: any, res: any, next: any): Promise<void> {
  const auth = (req.headers.authorization || "").trim();
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return res.status(401).json({ ok: false, error: "Not signed in" });
  const payload = verifySessionToken(token);
  if (!payload) return res.status(401).json({ ok: false, error: "Session expired or invalid" });
  // Legacy v1 tokens have no expiry and ignore tokenVersion — they would
  // survive a "Log out of all devices". For any session-protected endpoint
  // we reject them so the user is forced to re-verify and get a v2 token.
  // (verifySessionToken still accepts v1 at the function level for any
  // non-protected back-compat uses.)
  if ("legacy" in payload) {
    return res.status(401).json({ ok: false, error: "Session format is outdated. Please sign in again." });
  }
  // Validate the user's tokenVersion matches (cheap query, indexed by unique email).
  const [user] = await db.select().from(rosaUsers).where(eq(rosaUsers.emailOrPhone, payload.e)).limit(1);
  if (!user || (user.tokenVersion ?? 1) !== payload.v) {
    return res.status(401).json({ ok: false, error: "Session was revoked. Please sign in again." });
  }
  // Confirm the device row still exists (revocation works without bumping version).
  const [device] = await db.select().from(trustedDevices).where(eq(trustedDevices.deviceId, payload.d)).limit(1);
  if (!device || device.email !== payload.e) {
    return res.status(401).json({ ok: false, error: "This device was removed. Please sign in again." });
  }
  // Fire-and-forget last-seen update so the Trusted Devices list stays fresh.
  db.update(trustedDevices)
    .set({ lastSeenAt: new Date() })
    .where(eq(trustedDevices.deviceId, payload.d))
    .catch(() => {});
  req.session = { email: payload.e, deviceId: payload.d, legacy: false };
  next();
}

// Surface marketingOptIn to the client so the Settings page can show the
// current preference selected. Returned alongside other public profile fields.
router.get("/auth/me", requireSession, async (req: any, res) => {
  const { email } = req.session;
  const [user] = await db.select().from(rosaUsers).where(eq(rosaUsers.emailOrPhone, email)).limit(1);
  res.json({
    ok: true,
    email,
    deviceId: req.session.deviceId,
    legacy: req.session.legacy,
    user: user ? {
      name: user.name,
      isFoundingMember: user.isFoundingMember,
      foundingMemberType: user.foundingMemberType,
      isLifetimeFree: user.isLifetimeFree,
      subscriptionStatus: user.subscriptionStatus,
      trialEndsAt: user.trialEndsAt,
      marketingOptIn: user.marketingOptIn ?? "later",
      // Permanent pen name shown on Rose Wall when the user posts anonymously.
      // Surfaced here (and only to the authenticated owner) so Settings can show
      // "your anonymous name is …". Never linkable back to the real account by
      // anyone but the user themselves.
      anonymousName: user.anonymousName ?? null,
      rosaId: user.rosaId ?? null,
      nickname: user.nickname ?? null,
      nicknameChanges: user.nicknameChanges ?? 0,
      bio: user.bio ?? null,
      profilePhotoUrl: user.profilePhotoUrl ?? null,
      gender: user.gender ?? null,
      pronouns: user.pronouns ?? null,
    } : null,
  });
});

router.get("/auth/devices", requireSession, async (req: any, res) => {
  const { email, deviceId } = req.session;
  const rows = await db
    .select()
    .from(trustedDevices)
    .where(eq(trustedDevices.email, email))
    .orderBy(desc(trustedDevices.lastSeenAt));
  res.json({
    ok: true,
    currentDeviceId: deviceId,
    devices: rows.map((r) => ({
      deviceId: r.deviceId,
      deviceName: r.deviceName,
      rememberMe: r.rememberMe,
      lastSeenAt: r.lastSeenAt,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      isCurrent: r.deviceId === deviceId,
    })),
  });
});

router.delete("/auth/devices/:deviceId", requireSession, async (req: any, res) => {
  const { email } = req.session;
  const target = String(req.params.deviceId || "").trim();
  if (!target) return res.status(400).json({ ok: false, error: "Missing deviceId" });
  const result = await db
    .delete(trustedDevices)
    .where(and(eq(trustedDevices.email, email), eq(trustedDevices.deviceId, target)))
    .returning();
  if (!result.length) return res.status(404).json({ ok: false, error: "Device not found" });
  res.json({ ok: true, removed: target });
});

// Update marketing consent for the signed-in user. Mounted under requireSession
// so only the logged-in person can change their own preference.
router.put("/auth/marketing-pref", requireSession, async (req: any, res) => {
  const { email } = req.session;
  const pref = cleanMarketingPref(req.body?.marketingOptIn);
  await db
    .update(rosaUsers)
    .set({ marketingOptIn: pref, updatedAt: new Date() })
    .where(eq(rosaUsers.emailOrPhone, email));
  res.json({ ok: true, marketingOptIn: pref });
});

router.post("/auth/logout-all", requireSession, async (req: any, res) => {
  const { email } = req.session;
  const [user] = await db.select().from(rosaUsers).where(eq(rosaUsers.emailOrPhone, email)).limit(1);
  if (!user) return res.status(404).json({ ok: false, error: "User not found" });
  await db
    .update(rosaUsers)
    .set({ tokenVersion: (user.tokenVersion ?? 1) + 1, updatedAt: new Date() })
    .where(eq(rosaUsers.id, user.id));
  await db.delete(trustedDevices).where(eq(trustedDevices.email, email));
  res.json({ ok: true, message: "All sessions ended. You'll need to sign in again." });
});

router.post("/auth/logout", requireSession, async (req: any, res) => {
  const { email, deviceId } = req.session;
  if (deviceId) {
    await db.delete(trustedDevices).where(and(eq(trustedDevices.email, email), eq(trustedDevices.deviceId, deviceId)));
  }
  res.json({ ok: true });
});

export default router;


















// ROSA ID routes
router.get("/check-nickname", async (req, res) => {
  try {
    const { nickname } = req.query as { nickname: string };
    if (!nickname) return res.status(400).json({ error: "Nickname required" });
    const existing = await db.select({ id: rosaUsers.id }).from(rosaUsers).where(eq(rosaUsers.nickname, (nickname as string).toLowerCase())).limit(1);
    return res.json({ available: existing.length === 0 });
  } catch { return res.status(500).json({ error: "Server error" }); }
});

router.post("/set-nickname", requireSession, async (req: any, res) => {
  try {
    const user = req.rosaUser; const email = user.emailOrPhone; const { nickname } = req.body;
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!nickname || nickname.length < 3 || nickname.length > 20) return res.status(400).json({ error: "Invalid nickname" });
    const existing = await db.select({ id: rosaUsers.id }).from(rosaUsers).where(eq(rosaUsers.nickname, nickname.toLowerCase())).limit(1);
    if (existing.length > 0 && existing[0].id !== user.id) return res.status(409).json({ error: "Nickname already taken" });
    const isFirstTime = !user.nickname;
    await db.update(rosaUsers).set({ nickname: nickname.toLowerCase(), nicknameChanges: isFirstTime ? 0 : (user.nicknameChanges || 0) + 1, updatedAt: new Date() }).where(eq(rosaUsers.emailOrPhone, email));
    return res.json({ success: true, nickname: nickname.toLowerCase() });
  } catch { return res.status(500).json({ error: "Server error" }); }
});

router.put("/profile", requireSession, async (req: any, res) => {
  try {
    const user = req.rosaUser; const email = user.emailOrPhone;
    const { bio, name } = req.body;
    if (bio && bio.length > 150) return res.status(400).json({ error: "Bio max 150 chars" });
    await db.update(rosaUsers).set({ ...(bio !== undefined && { bio }), ...(name !== undefined && { name }), updatedAt: new Date() }).where(eq(rosaUsers.emailOrPhone, email));
    return res.json({ success: true });
  } catch { return res.status(500).json({ error: "Server error" }); }
});

router.get("/find/:rosaId", async (req, res) => {
  try {
    const user = await db.select({ rosaId: rosaUsers.rosaId, name: rosaUsers.name, nickname: rosaUsers.nickname, bio: rosaUsers.bio, profilePhotoUrl: rosaUsers.profilePhotoUrl, createdAt: rosaUsers.createdAt }).from(rosaUsers).where(eq(rosaUsers.rosaId, req.params.rosaId.toUpperCase())).limit(1);
    if (user.length === 0) return res.status(404).json({ error: "User not found" });
    return res.json(user[0]);
  } catch { return res.status(500).json({ error: "Server error" }); }
});
