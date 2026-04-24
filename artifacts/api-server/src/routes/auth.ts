import { Router } from "express";
import express from "express";
import crypto from "crypto";
import { requireAdmin } from "../lib/admin-auth";

const router = Router();

const AUTH_SECRET = (() => {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production (min 16 chars).");
  }
  return "rosa-dev-secret-change-me";
})();
export function signEmailToken(email: string): string {
  const e = email.trim().toLowerCase();
  const sig = crypto.createHmac("sha256", AUTH_SECRET).update(`v1:${e}`).digest("base64url");
  return `v1.${Buffer.from(e).toString("base64url")}.${sig}`;
}
export function verifyEmailToken(token: string): string | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  try {
    const email = Buffer.from(parts[1], "base64url").toString("utf-8");
    const expected = crypto.createHmac("sha256", AUTH_SECRET).update(`v1:${email}`).digest("base64url");
    if (parts[2].length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(parts[2]), Buffer.from(expected))) return null;
    return email;
  } catch { return null; }
}
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
  // Gmail-to-Gmail via 3rd-party senders is the worst-case for deliverability.
  // Adding List-Unsubscribe + Reply-To + a stable Message-ID and tagging the
  // category lifts spam-folder placement noticeably.
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
            // Gmail/Outlook prioritise messages with a working unsubscribe.
            "List-Unsubscribe": `<mailto:${from}?subject=unsubscribe>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }],
        from: { email: from, name: fromName },
        reply_to: { email: from, name: fromName },
        subject: `Your ROSA verification code 🌹 — ${code}`,
        // Custom_args show up in the Activity Feed so we can correlate failures.
        custom_args: { kind: "verification", to_domain: to.split("@")[1] || "" },
        categories: ["rosa-verification"],
        // mail_settings.sandbox_mode would silently swallow mail — make absolutely sure it's off.
        mail_settings: { sandbox_mode: { enable: false } },
        // tracking_settings: keep open/click tracking off so the email stays clean and snappy.
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
    // The #1 cause of "email never arrives" is an unverified sender — log it loudly.
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

// Diagnostic endpoint: queries SendGrid's Activity Feed to see what actually
// happened to recent emails (delivered? bounced? blocked? marked as spam?).
// Usage: GET /api/auth/sendgrid-activity?email=foo@gmail.com
// Note: Requires the SendGrid API key to have the "Email Activity Read" scope,
// AND your SendGrid plan must include Activity Feed access (free plan: 3 days).
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

// Diagnostic endpoint: tells you whether SendGrid env vars are set on the server.
// Safe to expose — it never reveals the key itself, only whether it's configured.
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
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
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
    // Fallback for misconfigured email — return code so dev can keep moving
    return res.json({ ok: true, channel, sent: false, devCode: process.env.NODE_ENV !== "production" ? code : undefined,
      message: process.env.NODE_ENV !== "production" ? `Email service not configured (${sent.error}). Use the code shown.` : "Could not send email. Please try again later." });
  }

  // Phone — Twilio not yet wired
  return res.json({ ok: true, channel, sent: false, devCode: process.env.NODE_ENV !== "production" ? code : undefined,
    message: "SMS coming soon — for now, please use email." });
});

router.post("/auth/verify-code", (req, res) => {
  const { destination, code } = req.body || {};
  if (!destination || !code) return res.status(400).json({ ok: false, error: "Missing fields" });
  const dest = normalize(destination);
  const entry = codes.get(dest);
  if (!entry) return res.status(400).json({ ok: false, error: "No code found. Please request a new one." });
  if (Date.now() > entry.expiresAt) { codes.delete(dest); return res.status(400).json({ ok: false, error: "Code expired. Please request a new one." }); }
  if (entry.attempts >= 5) { codes.delete(dest); return res.status(429).json({ ok: false, error: "Too many attempts. Please request a new code." }); }
  entry.attempts++;
  if (String(code).trim() !== entry.code) return res.status(400).json({ ok: false, error: "Incorrect code. Please try again." });
  codes.delete(dest);
  const token = entry.channel === "email" ? signEmailToken(dest) : null;
  res.json({ ok: true, verified: true, channel: entry.channel, token });
});

export default router;
