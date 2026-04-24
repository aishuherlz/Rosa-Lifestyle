import { Router } from "express";
import express from "express";

const router = Router();
router.use(express.json({ limit: "50kb" }));

const SUPPORT_INBOX = process.env.SUPPORT_EMAIL || "rosainclusivelifestyle@gmail.com";

// Per-IP rate limit. User asked for max 3 per hour to deter spam without
// punishing real people who hit Send twice by accident.
const RATE = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 3;

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const arr = (RATE.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= MAX_PER_WINDOW) return false;
  arr.push(now);
  RATE.set(ip, arr);
  return true;
}

function escape(s: string): string {
  return String(s || "").replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
  );
}

// Strip every CR / LF / NUL plus other control chars, then trim and cap.
// Anything that gets baked into a mail header (Subject, From-name, etc.)
// MUST go through this — a stray "\r\nBcc: attacker@x" in a name field
// would otherwise let a user inject an extra header (RFC 5322 §2.2).
function safeForHeader(s: string, maxLen = 120): string {
  return String(s || "")
    .replace(/[\r\n\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, maxLen);
}

function buildSupportHtml(args: {
  type: string; subject: string; name: string; email: string; message: string; receivedAt: string;
}): string {
  const { type, subject, name, email, message, receivedAt } = args;
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#fdf6f4;font-family:Georgia,serif;color:#3d1a24;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdf6f4;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(139,34,82,0.10);">
        <tr><td style="background:linear-gradient(135deg,#8b2252 0%,#c14b7c 100%);padding:28px 32px;text-align:center;">
          <h1 style="margin:0;font-size:22px;color:#fff;letter-spacing:3px;">ROSA — ${escape(type)}</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-style:italic;font-size:13px;">${escape(subject)}</p>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#6b3a48;">
            <tr><td style="padding:6px 0;width:90px;color:#a85a78;text-transform:uppercase;letter-spacing:1px;font-size:11px;">From</td>
                <td style="padding:6px 0;color:#3d1a24;"><strong>${escape(name)}</strong></td></tr>
            <tr><td style="padding:6px 0;color:#a85a78;text-transform:uppercase;letter-spacing:1px;font-size:11px;">Email</td>
                <td style="padding:6px 0;"><a href="mailto:${escape(email)}" style="color:#8b2252;text-decoration:none;">${escape(email)}</a></td></tr>
            <tr><td style="padding:6px 0;color:#a85a78;text-transform:uppercase;letter-spacing:1px;font-size:11px;">Received</td>
                <td style="padding:6px 0;">${escape(receivedAt)}</td></tr>
          </table>
          <hr style="border:none;border-top:1px solid #fbe8eb;margin:20px 0;">
          <p style="margin:0 0 8px;font-size:11px;color:#a85a78;text-transform:uppercase;letter-spacing:1px;">Message</p>
          <div style="background:#fdf6f4;border-radius:12px;padding:18px;font-size:15px;line-height:1.6;white-space:pre-wrap;color:#3d1a24;">${escape(message)}</div>
          <p style="margin:24px 0 0;font-size:12px;color:#a08591;font-style:italic;">
            Reply directly to this email — your response goes straight to ${escape(name)}.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function sendViaSendGrid(args: {
  to: string; replyTo: string; replyToName: string; subject: string; html: string; text: string;
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
        // Reply-To with the user's name+email so Gmail "Reply" goes to them.
        // The name component lives inside a mail header, so it must be
        // CR/LF-stripped just like the Subject — same RFC 5322 §2.2
        // header-injection concern (see safeForHeader at top of file).
        reply_to: { email: args.replyTo, name: safeForHeader(args.replyToName, 80) || undefined },
        subject: args.subject,
        categories: ["rosa-support"],
        custom_args: { kind: "support", reply_to: args.replyTo },
        // Deliverability-focused headers. Owner specifically requested
        // X-Priority/Importance to flag these as high importance. Gmail
        // treats these as weak hints — main spam signals are SPF/DKIM/
        // DMARC alignment + sender reputation (see comment at bottom).
        //
        // List-Unsubscribe is mailto-only (no HTTPS one-click endpoint
        // exists yet), so we deliberately do NOT send List-Unsubscribe-Post
        // — RFC 8058 only allows that paired with an https:// URI.
        //
        // X-Entity-Ref-ID is a per-message unique id used by Gmail to
        // dedupe and group legitimate transactional traffic.
        headers: {
          "X-Priority": "1",
          "X-MSMail-Priority": "High",
          "Importance": "High",
          "List-Unsubscribe": `<mailto:${args.to}?subject=unsubscribe>`,
          "X-Entity-Ref-ID": `rosa-support-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        },
        mail_settings: { sandbox_mode: { enable: false } },
        tracking_settings: {
          click_tracking: { enable: false, enable_text: false },
          open_tracking: { enable: false },
          subscription_tracking: { enable: false },
        },
        // ORDER MATTERS: per RFC 2046, the *last* part is what most
        // clients render. So plain-text comes first, HTML last — this is
        // the standard Gmail-friendly ordering and what SendGrid examples
        // use too.
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
    return res.status(429).json({ ok: false, error: "Too many messages from this device. Please try again later (limit 3 per hour)." });
  }

  const { type, name, email, message, subject } = (req.body || {}) as Record<string, string>;

  if (!name || !email || !message) {
    return res.status(400).json({ ok: false, error: "Please fill in your name, email, and message." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: "Please enter a valid email address." });
  }
  if (message.length > 5000) {
    return res.status(400).json({ ok: false, error: "Message is too long (max 5000 characters)." });
  }
  if (subject && subject.length > 200) {
    return res.status(400).json({ ok: false, error: "Subject is too long (max 200 characters)." });
  }

  const cleanType = ["support", "feedback", "bug", "feature"].includes(type) ? type : "support";
  // Plain labels — the 🌹 is appended once at the end so we don't get
  // "ROSA Feedback 💌 🌹 — …" double-emoji subjects.
  const typeLabel =
    cleanType === "feedback" ? "Feedback" :
    cleanType === "bug" ? "Bug Report" :
    cleanType === "feature" ? "Feature Request" :
    "Support Request";

  const userSubject = (subject || "").trim() || message.split("\n")[0].slice(0, 80) || typeLabel;
  // Friendly personal subject line. The user-supplied name is sanitised
  // first to strip CR/LF — without this a malicious name like
  //   "Ann\r\nBcc: attacker@x.com"
  // could let a sender inject extra mail headers via SendGrid (header
  // injection, RFC 5322 §2.2). The body of the email still shows the
  // category/subject so the recipient has full context.
  const safeName = safeForHeader(name, 80) || "a sister";
  const emailSubject = `💌 New message from ${safeName} via ROSA`;

  const receivedAt = new Date().toLocaleString("en-US", {
    weekday: "short",
    year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
    timeZoneName: "short",
  });

  // Plain-text version. Gmail's spam classifier penalises HTML-only
  // emails, so we send a clean, well-formatted text/plain part too. Keep
  // the structure scannable so it reads naturally even in a terminal.
  const text =
`Hi Aiswarya,

You have a new ${typeLabel.toLowerCase()} from ${name} on ROSA.

  From:     ${name} <${email}>
  Subject:  ${userSubject}
  Received: ${receivedAt}

Message:
--------
${message}

--
Reply directly to this email and your response goes straight to ${name}.

ROSA — for women, by women 🌹
https://rosainclusive.lifestyle`;

  const html = buildSupportHtml({ type: typeLabel, subject: userSubject, name, email, message, receivedAt });

  const result = await sendViaSendGrid({
    to: SUPPORT_INBOX,
    replyTo: email,
    replyToName: name,
    subject: emailSubject,
    html,
    text,
  });

  if (!result.ok) {
    return res.status(500).json({
      ok: false,
      error: "Couldn't send right now. Please try emailing rosainclusivelifestyle@gmail.com directly 🌹",
    });
  }

  res.json({ ok: true, message: "Sent with love, sister 🌹 — we'll reply within 48 hours." });
});

export default router;
