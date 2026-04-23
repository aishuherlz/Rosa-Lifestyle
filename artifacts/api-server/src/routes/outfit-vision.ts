import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";

const router = Router();
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

// Simple in-memory per-IP rate limit: 8 requests / 10 min
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 8;
const ipHits = new Map<string, number[]>();
function rateLimit(ip: string): boolean {
  const now = Date.now();
  const arr = (ipHits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) { ipHits.set(ip, arr); return false; }
  arr.push(now); ipHits.set(ip, arr); return true;
}

router.post("/outfit-vision", async (req, res) => {
  try {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
    if (!rateLimit(ip)) {
      return res.status(429).json({ error: "Too many requests. Please wait a few minutes." });
    }
    const { imageBase64, occasion, weather, mood } = req.body as {
      imageBase64?: string; occasion?: string; weather?: string; mood?: string;
    };
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({ error: "imageBase64 is required" });
    }
    let mime = "image/jpeg"; let b64 = imageBase64;
    if (imageBase64.startsWith("data:")) {
      const m = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (!m) return res.status(400).json({ error: "Invalid data URL" });
      mime = m[1].toLowerCase(); b64 = m[2];
    }
    if (!ALLOWED_MIME.includes(mime)) return res.status(400).json({ error: "Unsupported image type" });
    if (Math.floor((b64.length * 3) / 4) > MAX_IMAGE_BYTES) {
      return res.status(413).json({ error: "Image too large (max 6MB)" });
    }

    const safeOccasion = ["casual","formal","date","workout","cozy","work"].includes(occasion || "") ? occasion : "casual";
    const safeWeather = String(weather || "").slice(0, 40);
    const safeMood = String(mood || "").slice(0, 40);

    const completion = await openai.chat.completions.create({
      model: "gpt-5",
      max_completion_tokens: 700,
      messages: [
        { role: "system", content: "You are ROSA, a luxe stylist for women. Analyze the wardrobe items in the photo and suggest 3 outfit combinations using ONLY items visible. Respond ONLY with valid JSON: {\"items\": [string], \"outfits\": [{\"name\": string, \"pieces\": [string], \"vibe\": string, \"styleTip\": string}], \"missingPiece\": string}. Each outfit's name max 40 chars, vibe max 30 chars, styleTip max 100 chars. Up to 3 outfits. If image isn't clothing, return {\"error\":\"not_clothing\"}." },
        { role: "user", content: [
          { type: "text", text: `Suggest outfits for ${safeOccasion} occasion${safeWeather ? `, ${safeWeather} weather` : ""}${safeMood ? `, feeling ${safeMood}` : ""}.` },
          { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
        ]},
      ],
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "{}";
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    let parsed: any;
    try { parsed = JSON.parse(cleaned); }
    catch { const m = cleaned.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : {}; }
    if (parsed.error === "not_clothing") {
      return res.status(400).json({ error: "Image doesn't seem to show clothing. Try a wardrobe or outfit photo." });
    }
    res.json({
      items: Array.isArray(parsed.items) ? parsed.items.slice(0, 15).map((s: any) => String(s).slice(0, 40)) : [],
      outfits: Array.isArray(parsed.outfits) ? parsed.outfits.slice(0, 3).map((o: any) => ({
        name: String(o.name || "Outfit").slice(0, 40),
        pieces: Array.isArray(o.pieces) ? o.pieces.slice(0, 8).map((p: any) => String(p).slice(0, 40)) : [],
        vibe: String(o.vibe || "").slice(0, 30),
        styleTip: String(o.styleTip || "").slice(0, 120),
      })) : [],
      missingPiece: String(parsed.missingPiece || "").slice(0, 100),
    });
  } catch (err: any) {
    logger.error({ err }, "Outfit vision error");
    res.status(500).json({ error: err.message || "Failed to analyze outfit" });
  }
});

export default router;
