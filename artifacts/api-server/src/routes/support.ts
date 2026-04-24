import { Router } from "express";
import express from "express";

const router = Router();
router.use(express.json({ limit: "50kb" }));

const SUPPORT_INBOX = process.env.SUPPORT_EMAIL || "rosainclusivelifestyle@gmail.com";
const RATE = new Map<string, number[]>();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const arr = (RATE.get(ip) || []).filter((t) => now - t < 60_000);
  if (arr.length >= 3) return false;
  arr.push(now);
  RATE.set(ip, arr);
  return true;
}

function escape(s: string): string {
  return String(s || "").replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
  );
}

function buildSupportHtml(args: {
  type: string; name: string; email: string; message: string;
}): string {
  const { type, name, email, message } = args;
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#fdf6f4;font-family:Georgia,serif;color:#3d1a24;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdf6f4;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(139,34,82,0.10);">
        <tr><td style="background:linear-gradient(135deg,#8b2252 0%,#c14b7c 100%);padding:28px 32px;text-align:center;">
          <h1 style="margin:0;font-size:24px;color:#fff;letter-spacing:3px;">ROSA — ${escape(type)}</h1>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 4px;font-size:13px;color:#a85a78;text-transform:uppercase;letter-spacing:1px;">From</p>
          <p style="margin:0 0 18px;font-size:16px;"><strong>${escape(name)}</strong> &lt;${escape(email)}&gt;</p>
          <p style="margin:0 0 4px;font-size:13px;color:#a85a78;text-transform:uppercase;letter-spacing:1px;">Message</p>
          <div style="background:#fdf6f4;border-radius:12px;padding:18px;font-size:15px;line-height:1.6;white-space:pre-wrap;">${escape(message)}</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function sendViaSendGrid(args: {
  to: string; replyTo: string; subject: string; html: string; text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM_EMAIL;
  if (!key || !from) {
    console.error("[Support] Skipped: SENDGRID_API_KEY or SENDGRID_FROM_EMAIL not set.");
    return { ok: false, error: "missing_config" };
  }
  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: args.to }] }],
        from: { email: from, name: "ROSA Support 🌹" },
        reply_to: { email: args.replyTo },
        subject: args.subject,
        content: [
          { type: "text/plain", value: args.text },
          { type: "text/html", value: args.html },
        ],
      }),
    });
    if (res.ok) {
      console.log(`[Support] Forwarded message from ${args.replyTo} to ${args.to} (status ${res.status})`);
      return { ok: true };
    }
    const errText = await res.text();
    console.error(`[Support] SendGrid FAILED ${res.status} from ${from} to ${args.to}: ${errText.slice(0, 500)}`);
    if (res.status === 401 || res.status === 403) {
      console.error(`[Support] HINT: SENDGRID_FROM_EMAIL "${from}" is likely not a verified Single Sender in SendGrid.`);
    }
    return { ok: false, error: `sendgrid_${res.status}` };
  } catch (e: any) {
    console.error("[Support] Network error:", e?.message || e);
    return { ok: false, error: e?.message || "fetch_failed" };
  }
}

router.post("/support/send", async (req, res) => {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
  if (!rateLimit(ip)) {
    return res.status(429).json({ ok: false, error: "Too many messages. Please wait a minute and try again." });
  }

  const { type, name, email, message } = (req.body || {}) as Record<string, string>;

  // Validation
  if (!name || !email || !message) {
    return res.status(400).json({ ok: false, error: "Please fill in your name, email, and message." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: "Please enter a valid email address." });
  }
  if (message.length > 5000) {
    return res.status(400).json({ ok: false, error: "Message is too long (max 5000 characters)." });
  }

  const cleanType = ["support", "feedback", "bug", "feature"].includes(type) ? type : "support";
  const typeLabel =
    cleanType === "feedback" ? "Feedback 💌" :
    cleanType === "bug" ? "Bug Report 🐞" :
    cleanType === "feature" ? "Feature Request ✨" :
    "Support";

  const subject = `[ROSA ${typeLabel}] from ${name}`;
  const text = `Type: ${typeLabel}\nFrom: ${name} <${email}>\n\nMessage:\n${message}`;
  const html = buildSupportHtml({ type: typeLabel, name, email, message });

  const result = await sendViaSendGrid({
    to: SUPPORT_INBOX,
    replyTo: email,
    subject,
    html,
    text,
  });

  if (!result.ok) {
    return res.status(500).json({
      ok: false,
      error: "Couldn't send right now. Please try emailing rosainclusivelifestyle@gmail.com directly 🌹",
    });
  }

  res.json({ ok: true, message: "Sent with love, sister 🌹" });
});

export default router;
