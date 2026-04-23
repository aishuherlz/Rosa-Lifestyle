import { differenceInCalendarDays, parseISO } from "date-fns";

export type CyclePhase = "menstrual" | "follicular" | "ovulation" | "luteal" | "unknown";

export function readCyclePhase(): { phase: CyclePhase; day: number } {
  if (typeof window === "undefined") return { phase: "unknown", day: 0 };
  try {
    const raw = localStorage.getItem("rosa_cycle_logs");
    if (!raw) return { phase: "unknown", day: 0 };
    const logs = JSON.parse(raw);
    if (!Array.isArray(logs) || !logs.length) return { phase: "unknown", day: 0 };
    const last = logs[0];
    const start: string | undefined = last.periodStart;
    const cycleLen: number = last.cycleLength || 28;
    if (!start) return { phase: "unknown", day: 0 };
    const day = (differenceInCalendarDays(new Date(), parseISO(start)) % cycleLen + cycleLen) % cycleLen + 1;
    let phase: CyclePhase = "follicular";
    if (day <= 5) phase = "menstrual";
    else if (day <= 13) phase = "follicular";
    else if (day <= 16) phase = "ovulation";
    else phase = "luteal";
    return { phase, day };
  } catch { return { phase: "unknown", day: 0 }; }
}

export const PHASE_MOOD: Record<CyclePhase, { title: string; tip: string; emoji: string }> = {
  menstrual: { title: "Rest & Restore Queen 🌹", tip: "Lower energy is normal. Be soft with yourself — rest is productive.", emoji: "🌙" },
  follicular: { title: "Rising Energy 🌸", tip: "Your spark is returning — great time for new ideas and bold moves.", emoji: "🌸" },
  ovulation: { title: "In Your Power Era ✨", tip: "Confidence peaks now — connect, create, lead. You're radiant.", emoji: "✨" },
  luteal: { title: "Warrior Mode 🛡️", tip: "Feelings may run high. Slow your pace, lean into comfort. It will pass.", emoji: "🛡️" },
  unknown: { title: "", tip: "", emoji: "" },
};

export const PHASE_FOOD: Record<CyclePhase, { title: string; foods: string }> = {
  menstrual: { title: "Restore your iron", foods: "Iron-rich (spinach, lentils, red meat) · warming soups · dark chocolate · ginger tea" },
  follicular: { title: "Fuel fresh energy", foods: "Sprouted grains · fermented foods (kimchi) · light proteins · leafy greens" },
  ovulation: { title: "Glow nutrients", foods: "Antioxidant berries · citrus · cruciferous veg · plenty of water" },
  luteal: { title: "Calm cravings", foods: "Complex carbs (sweet potato) · magnesium (pumpkin seeds, dark chocolate) · B6 (banana, salmon)" },
  unknown: { title: "", foods: "" },
};

export type Destination = {
  id: string;
  name: string;
  country: string;
  type: "planned" | "bucket";
  startDate?: string;
  endDate?: string;
  visited?: boolean;
};

export function getNextPlannedTrip(): Destination | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("rosa_destinations");
    if (!raw) return null;
    const list: Destination[] = JSON.parse(raw);
    const now = Date.now();
    const upcoming = list
      .filter((d) => d.type === "planned" && d.startDate && parseISO(d.startDate).getTime() > now - 86400000 && !d.visited)
      .sort((a, b) => parseISO(a.startDate!).getTime() - parseISO(b.startDate!).getTime());
    return upcoming[0] || null;
  } catch { return null; }
}

export type Milestone = { id: string; title: string; date: string };

export function getUpcomingMilestones(withinDays = 60): Milestone[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("rosa_milestones");
    if (!raw) return [];
    const list: Milestone[] = JSON.parse(raw);
    const now = Date.now();
    const cutoff = now + withinDays * 86400000;
    return list
      .filter((m) => {
        const t = parseISO(m.date).getTime();
        return t >= now && t <= cutoff;
      })
      .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
  } catch { return []; }
}
