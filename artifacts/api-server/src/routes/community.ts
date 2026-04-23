import { Router } from "express";
import express from "express";
import fs from "fs";
import path from "path";

const router = Router();
router.use(express.json({ limit: "100kb" }));

const STATS_FILE = path.join(process.cwd(), ".rosa-community-stats.json");
const BASELINE = 12847;

type Stats = { totalCheckIns: number; activeToday: number; lastReset: string };
type State = { stats: Stats; ipToday: Record<string, number> };

function loadState(): State {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(STATS_FILE, "utf-8"));
      if (parsed?.stats) return parsed as State;
    }
  } catch {}
  return { stats: { totalCheckIns: BASELINE, activeToday: 0, lastReset: new Date().toISOString().split("T")[0] }, ipToday: {} };
}
function saveState(s: State) { try { fs.writeFileSync(STATS_FILE, JSON.stringify(s)); } catch {} }

let state: State = loadState();

function rollIfNewDay() {
  const today = new Date().toISOString().split("T")[0];
  if (state.stats.lastReset !== today) {
    state.stats.lastReset = today;
    state.stats.activeToday = 0;
    state.ipToday = {};
    saveState(state);
  }
}

router.get("/community/stats", (_req, res) => {
  rollIfNewDay();
  const goal = Math.max(500, Math.ceil(state.stats.activeToday / 100) * 100 + 200);
  res.json({
    totalCheckIns: state.stats.totalCheckIns,
    activeToday: state.stats.activeToday,
    goalToday: goal,
    petalsFilled: Math.min(48, Math.floor((state.stats.activeToday / goal) * 48)),
  });
});

router.post("/community/checkin", (req, res) => {
  rollIfNewDay();
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
  const last = state.ipToday[ip] || 0;
  const now = Date.now();
  if (now - last < 12 * 60 * 60 * 1000) {
    return res.json({ ok: true, alreadyToday: true, totalCheckIns: state.stats.totalCheckIns, activeToday: state.stats.activeToday });
  }
  state.ipToday[ip] = now;
  state.stats.totalCheckIns += 1;
  state.stats.activeToday += 1;
  saveState(state);
  res.json({ ok: true, totalCheckIns: state.stats.totalCheckIns, activeToday: state.stats.activeToday });
});

export default router;
