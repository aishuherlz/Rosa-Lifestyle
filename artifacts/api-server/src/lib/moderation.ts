// Content moderation for user-generated text on the Rose Wall, Rose Circles,
// and anywhere else community content goes live.
//
// Strategy:
//   - Send the text to our existing chat provider (Gemini by default) with a
//     strict, single-purpose prompt that asks for a JSON verdict only.
//   - Fail OPEN on transient infra errors (network, model 5xx, parse error)
//     so we don't punish users for our outages — community posts are recoverable
//     if a bad one slips through (we have reporting + delete).
//   - Fail CLOSED if the model explicitly returns block.
//
// We block these categories (per Step 3 spec):
//   - hate speech / slurs
//   - bullying / harassment / personal attacks on a named person
//   - false allegations against a specific person
//   - sexual / explicit content
//   - threats of violence
//   - encouragement of self-harm or suicide
//   - doxxing (sharing private personal info)
//
// We DO allow (these are the whole point of the wall):
//   - frank discussion of periods, sex education, mental health
//   - venting about partners, family, work in general terms
//   - religious / political views expressed respectfully
//   - swearing for emphasis (not directed as an attack)

import { chatOnce } from "./chat-client";

export type ModerationVerdict = {
  allow: boolean;
  reason: string; // short label, safe to log; never shown to user verbatim
  severity: "ok" | "warn" | "block";
};

const SYSTEM = `You are a content safety classifier for ROSA, a women's wellness community.
Decide if a user's post should be allowed to appear publicly.

BLOCK (severity "block", allow=false) when the post contains:
- hate speech or slurs targeting a group (race, religion, gender, sexuality, disability, etc.)
- bullying, harassment, or a personal attack against a NAMED individual
- false or unverifiable allegations of a crime against a NAMED individual
- sexual or explicit content (graphic descriptions of sex acts, nudity)
- credible threats of violence
- encouragement of self-harm or suicide (NOT someone reaching out for help — that is allowed)
- doxxing (phone numbers, home addresses, full names + locations of private people)
- spam, scams, links to malware, get-rich-quick schemes

ALLOW (severity "ok", allow=true):
- venting about a partner, parent, friend, boss in GENERAL terms (no naming + accusing of a crime)
- frank, non-graphic discussion of periods, sex education, contraception, fertility, menopause
- mental health struggles, including someone disclosing they feel suicidal and asking for support
- swearing used for emphasis, not as a directed attack
- religious or political opinions expressed respectfully
- gratitude, affirmations, jokes, daily life, relationship advice, fitness, food

WARN (severity "warn", allow=true): borderline content that's allowed but you'd want a moderator to keep an eye on.

Respond with ONLY a JSON object on a single line, no markdown fences, no prose:
{"allow": true|false, "reason": "<short label like 'ok' or 'hate' or 'harassment_named_person'>", "severity": "ok"|"warn"|"block"}`;

function parseVerdict(raw: string): ModerationVerdict | null {
  if (!raw) return null;
  // Strip code fences if the model added them despite instructions.
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  // Find the first {...} block in case the model added stray prose.
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[0]);
    if (typeof obj.allow !== "boolean") return null;
    const sev = obj.severity === "block" || obj.severity === "warn" || obj.severity === "ok"
      ? obj.severity
      : (obj.allow ? "ok" : "block");
    return {
      allow: !!obj.allow,
      reason: typeof obj.reason === "string" ? obj.reason.slice(0, 80) : (obj.allow ? "ok" : "blocked"),
      severity: sev,
    };
  } catch {
    return null;
  }
}

export async function moderateText(
  text: string,
  opts: { context?: "post" | "comment" } = {}
): Promise<ModerationVerdict> {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    return { allow: false, reason: "empty", severity: "block" };
  }
  // Hard cap on what we send to the model. The route layer should already
  // cap input length; this is defense-in-depth.
  const sample = trimmed.slice(0, 2000);

  try {
    const raw = await chatOnce(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Type: ${opts.context || "post"}\nContent:\n${sample}` },
      ],
      { maxTokens: 120 }
    );
    const verdict = parseVerdict(raw);
    if (verdict) return verdict;
    // Couldn't parse → fail open with a warn so a moderator could review later.
    // eslint-disable-next-line no-console
    console.warn("[moderation] unparseable verdict, allowing:", raw?.slice(0, 200));
    return { allow: true, reason: "unparseable_allow_open", severity: "warn" };
  } catch (err: any) {
    // Transient AI failure → fail OPEN so the user isn't punished for our outage.
    // eslint-disable-next-line no-console
    console.warn("[moderation] AI error, allowing:", err?.message || err);
    return { allow: true, reason: "ai_error_allow_open", severity: "warn" };
  }
}

// Exported copy of the user-facing block message so the route layer and tests
// stay in sync with the spec wording from Step 3.
export const BLOCK_MESSAGE = "This post couldn't be shared as it goes against our community guidelines 🌹";
