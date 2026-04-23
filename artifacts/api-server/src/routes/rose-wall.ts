import { Router } from "express";
import express from "express";
import fs from "fs";
import path from "path";

const router = Router();
router.use(express.json({ limit: "10kb" }));

const FILE = path.join(process.cwd(), ".rosa-rose-wall.json");
const MAX_POSTS = 500;
const RATE_PER_HOUR = 5;

type Post = { id: string; text: string; emoji: string; ts: number; roses: number };
type State = { posts: Post[]; ipRate: Record<string, number[]> };

function load(): State {
  try {
    if (fs.existsSync(FILE)) return JSON.parse(fs.readFileSync(FILE, "utf-8"));
  } catch {}
  return { posts: [], ipRate: {} };
}
function save(s: State) { try { fs.writeFileSync(FILE, JSON.stringify(s)); } catch {} }
let state = load();

function ip(req: any) { return (req.headers["x-forwarded-for"]?.split(",")[0] || req.ip || "0").toString(); }

router.get("/rose-wall", (_req, res) => {
  res.json({ posts: state.posts.slice(0, 50) });
});

router.post("/rose-wall", (req, res) => {
  const { text, emoji } = req.body || {};
  if (!text || typeof text !== "string") return res.status(400).json({ error: "text required" });
  const trimmed = text.trim().slice(0, 280);
  if (!trimmed) return res.status(400).json({ error: "empty" });
  const key = ip(req);
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  state.ipRate[key] = (state.ipRate[key] || []).filter(t => now - t < oneHour);
  if (state.ipRate[key].length >= RATE_PER_HOUR) return res.status(429).json({ error: "Slow down sister 🌹 — try again later" });
  state.ipRate[key].push(now);
  const post: Post = { id: now.toString(36) + Math.random().toString(36).slice(2, 6), text: trimmed, emoji: (emoji || "🌹").slice(0, 4), ts: now, roses: 0 };
  state.posts.unshift(post);
  if (state.posts.length > MAX_POSTS) state.posts = state.posts.slice(0, MAX_POSTS);
  save(state);
  res.json({ post });
});

router.post("/rose-wall/:id/rose", (req, res) => {
  const post = state.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: "not found" });
  post.roses += 1;
  save(state);
  res.json({ roses: post.roses });
});

export default router;
