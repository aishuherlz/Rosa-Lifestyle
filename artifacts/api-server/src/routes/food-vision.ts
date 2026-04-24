import { Router } from "express";
import { getOpenAI } from "../lib/openai-client";
import { logger } from "../lib/logger";

const router = Router();

const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // 6MB raw decoded
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

router.post("/food-vision", async (req, res) => {
  try {
    const { imageBase64, mealHint } = req.body as { imageBase64?: string; mealHint?: string };
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({ error: "imageBase64 is required" });
    }

    let mime = "image/jpeg";
    let b64 = imageBase64;
    if (imageBase64.startsWith("data:")) {
      const m = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (!m) return res.status(400).json({ error: "Invalid data URL" });
      mime = m[1].toLowerCase();
      b64 = m[2];
    }
    if (!ALLOWED_MIME.includes(mime)) {
      return res.status(400).json({ error: `Unsupported image type. Use JPEG, PNG, WebP, or HEIC.` });
    }
    const approxBytes = Math.floor((b64.length * 3) / 4);
    if (approxBytes > MAX_IMAGE_BYTES) {
      return res.status(413).json({ error: "Image too large. Please use a photo under 6MB." });
    }

    const dataUrl = `data:${mime};base64,${b64}`;
    const safeMealHint = typeof mealHint === "string" && /^(breakfast|lunch|dinner|snack)$/.test(mealHint)
      ? mealHint : undefined;

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-5",
      max_completion_tokens: 800,
      messages: [
        {
          role: "system",
          content:
            "You are a nutritionist analyzing meal photos for a women's wellness app. Respond ONLY with valid JSON matching this schema: {\"name\": string, \"calories\": number, \"protein\": number, \"carbs\": number, \"fat\": number, \"fiber\": number, \"confidence\": \"low\"|\"medium\"|\"high\", \"items\": string[], \"healthNote\": string}. Estimate per the visible portion. healthNote is a short, supportive sentence (max 80 chars). If the image isn't food, return {\"error\": \"not_food\"} as JSON.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: safeMealHint ? `This is for ${safeMealHint}. Analyze and estimate.` : "Analyze this meal and estimate nutrition." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "{}";
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { error: "parse_failed" };
    }

    if (parsed.error === "not_food") {
      return res.status(400).json({ error: "Image doesn't appear to contain food. Try another photo." });
    }

    const clamp = (n: any, max: number) => {
      const v = Number(n);
      if (!Number.isFinite(v) || v < 0) return 0;
      return Math.min(Math.round(v), max);
    };
    const conf = ["low", "medium", "high"].includes(parsed.confidence) ? parsed.confidence : "medium";
    res.json({
      name: String(parsed.name || "Detected meal").slice(0, 80),
      calories: clamp(parsed.calories, 5000),
      protein: clamp(parsed.protein, 500),
      carbs: clamp(parsed.carbs, 1000),
      fat: clamp(parsed.fat, 500),
      fiber: clamp(parsed.fiber, 200),
      confidence: conf,
      items: Array.isArray(parsed.items) ? parsed.items.slice(0, 12).map((s: any) => String(s).slice(0, 60)) : [],
      healthNote: String(parsed.healthNote || "").slice(0, 160),
    });
  } catch (err: any) {
    logger.error({ err }, "Food vision error");
    res.status(500).json({ error: err.message || "Failed to analyze image" });
  }
});

export default router;
