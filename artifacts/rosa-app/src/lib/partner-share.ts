import { useEffect, useState, useCallback } from "react";

export type ShareableFeature =
  | "cycle"
  | "mood"
  | "sleep"
  | "milestones"
  | "goals"
  | "journal"
  | "food"
  | "fitness"
  | "outfit"
  | "travel"
  | "wellness"
  | "garden"
  | "water"
  | "skin"
  | "challenges";

export const FEATURE_LABELS: Record<ShareableFeature, { label: string; emoji: string; desc: string }> = {
  cycle:      { label: "Cycle & period",      emoji: "🌸", desc: "Current phase, period days, predictions" },
  mood:       { label: "Mood",                emoji: "💗", desc: "Today's mood and recent trend" },
  sleep:      { label: "Sleep",               emoji: "🌙", desc: "Bedtime, hours slept, sleep quality" },
  milestones: { label: "Milestones",          emoji: "🏆", desc: "Anniversaries and special dates" },
  goals:      { label: "Goals",               emoji: "🎯", desc: "Personal goals and progress" },
  journal:    { label: "Journal entries",     emoji: "📓", desc: "Recent journal entries (titles only)" },
  food:       { label: "Food & meal plans",   emoji: "🥗", desc: "Today's meal plan" },
  fitness:    { label: "Fitness & workouts",  emoji: "💪", desc: "Workouts and activity" },
  outfit:     { label: "Outfit of the day",   emoji: "👗", desc: "Today's outfit pick" },
  travel:     { label: "Travel plans",        emoji: "✈️", desc: "Trips and bucket list (not surprises)" },
  wellness:   { label: "Wellness score",      emoji: "✨", desc: "Daily wellness score" },
  garden:     { label: "ROSA Garden",         emoji: "🌹", desc: "Petals, level, and bloom progress" },
  water:      { label: "Hydration",           emoji: "💧", desc: "Water intake today" },
  skin:       { label: "Skin care",           emoji: "🪞", desc: "Skin routine and check-ins" },
  challenges: { label: "Challenges",          emoji: "🔥", desc: "Active challenges and streaks" },
};

export type SharePrefs = Record<ShareableFeature, boolean>;

const DEFAULT_PREFS: SharePrefs = {
  cycle: false, mood: false, sleep: false, milestones: false, goals: false,
  journal: false, food: false, fitness: false, outfit: false, travel: false,
  wellness: false, garden: false, water: false, skin: false, challenges: false,
};

const PREFS_KEY = "rosa_partner_share_prefs";
const SNAPSHOT_KEY = "rosa_partner_incoming_snapshot";
const EVENT = "rosa-partner-share-changed";

export function getSharePrefs(): SharePrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch { return { ...DEFAULT_PREFS }; }
}

export function setSharePref(feature: ShareableFeature, value: boolean) {
  const next = { ...getSharePrefs(), [feature]: value };
  localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function isSharing(feature: ShareableFeature): boolean {
  return !!getSharePrefs()[feature];
}

export function useSharePrefs(): [SharePrefs, (f: ShareableFeature, v: boolean) => void] {
  const [prefs, setPrefs] = useState<SharePrefs>(() => (typeof window !== "undefined" ? getSharePrefs() : DEFAULT_PREFS));
  useEffect(() => {
    const refresh = () => setPrefs(getSharePrefs());
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(EVENT, refresh); window.removeEventListener("storage", refresh); };
  }, []);
  const update = useCallback((f: ShareableFeature, v: boolean) => setSharePref(f, v), []);
  return [prefs, update];
}

export function useIsSharing(feature: ShareableFeature): [boolean, (v: boolean) => void] {
  const [prefs, update] = useSharePrefs();
  return [!!prefs[feature], (v: boolean) => update(feature, v)];
}

// Build a snapshot bundle of ONLY the features user has opted in to share.
// We pull the relevant localStorage keys so the partner sees real (recent) data.
export function buildShareSnapshot(meta: { fromName?: string }): {
  v: number; from: string; at: string; data: Record<string, any>;
} {
  const prefs = getSharePrefs();
  const data: Record<string, any> = {};
  const grab = (k: string) => { try { const v = localStorage.getItem(k); if (v) data[k] = JSON.parse(v); } catch {} };

  if (prefs.cycle) { grab("rosa_period_data"); grab("rosa_cycle_length"); }
  if (prefs.mood) grab("rosa_moods");
  if (prefs.sleep) grab("rosa_sleep_logs");
  if (prefs.milestones) grab("rosa_milestones");
  if (prefs.goals) grab("rosa_goals");
  if (prefs.journal) {
    try {
      const j = localStorage.getItem("rosa_journal_entries");
      if (j) {
        const parsed = JSON.parse(j) as Array<{ id: string; date: string; title?: string }>;
        data["rosa_journal_titles"] = parsed.slice(0, 10).map(e => ({ id: e.id, date: e.date, title: e.title || "(untitled)" }));
      }
    } catch {}
  }
  if (prefs.food) grab("rosa_meal_plan");
  if (prefs.fitness) grab("rosa_workouts");
  if (prefs.outfit) grab("rosa_outfit_today");
  if (prefs.travel) grab("rosa_travel_trips");
  if (prefs.wellness) grab("rosa_wellness_score");
  if (prefs.garden) grab("rosa_garden");
  if (prefs.water) grab("rosa_water_today");
  if (prefs.skin) grab("rosa_skin");
  if (prefs.challenges) grab("rosa_challenges");

  return {
    v: 1,
    from: meta.fromName || "Your partner",
    at: new Date().toISOString(),
    data,
  };
}

export type IncomingSnapshot = ReturnType<typeof buildShareSnapshot>;

export function saveIncomingSnapshot(snap: IncomingSnapshot) {
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function getIncomingSnapshot(): IncomingSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearIncomingSnapshot() {
  localStorage.removeItem(SNAPSHOT_KEY);
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function useIncomingSnapshot(): IncomingSnapshot | null {
  const [snap, setSnap] = useState<IncomingSnapshot | null>(() => (typeof window !== "undefined" ? getIncomingSnapshot() : null));
  useEffect(() => {
    const refresh = () => setSnap(getIncomingSnapshot());
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(EVENT, refresh); window.removeEventListener("storage", refresh); };
  }, []);
  return snap;
}

// Compact base64 encoding so users can copy-paste a single string instead of raw JSON.
export function encodeSnapshot(snap: IncomingSnapshot): string {
  const json = JSON.stringify(snap);
  // unicode-safe base64
  return btoa(unescape(encodeURIComponent(json)));
}

export function decodeSnapshot(code: string): IncomingSnapshot | null {
  try {
    const trimmed = code.trim();
    const json = decodeURIComponent(escape(atob(trimmed)));
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object" && parsed.v && parsed.data) return parsed;
    return null;
  } catch { return null; }
}
