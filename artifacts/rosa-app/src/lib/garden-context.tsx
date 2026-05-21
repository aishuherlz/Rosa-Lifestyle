import { scopedStorage } from "./scoped-storage";
import { createContext, useContext, useEffect, useState } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { format } from "date-fns";

export type RoseColor = "red" | "gold" | "purple" | "blue" | "pink";

export type Achievement = {
  id: string;
  title: string;
  emoji: string;
  description: string;
  earnedAt?: string;
};

type GardenData = {
  roses: number;
  streak: number;
  lastCheckIn: string | null;
  totalCheckIns: number;
  achievements: Achievement[];
  petals: number;
  roseColors: RoseColor[];
  wellnessLog: Record<string, { mood?: number; water?: number; workout?: boolean; sleep?: number }>;
};

const DEFAULT: GardenData = {
  roses: 0,
  streak: 0,
  lastCheckIn: null,
  totalCheckIns: 0,
  achievements: [],
  petals: 0,
  roseColors: [],
  wellnessLog: {},
};

type GardenCtx = {
  garden: GardenData;
  checkIn: () => { newStreak: number; newRoses: number; celebration?: string };
  logWellness: (date: string, data: Partial<GardenData["wellnessLog"][string]>) => void;
  earnAchievement: (id: string) => void;
  hasAchievement: (id: string) => boolean;
  wellnessScore: number;
};

const GardenContext = createContext<GardenCtx | null>(null);

const ACHIEVEMENTS: Achievement[] = [
  { id: "mood_7", title: "Mood Master 🌙", emoji: "🌙", description: "Logged mood 7 days in a row" },
  { id: "food_14", title: "Nutrition Queen 🥗", emoji: "🥗", description: "Logged food for 14 days" },
  { id: "workout_30", title: "Fitness Goddess 💪", emoji: "💪", description: "Completed workouts for 30 days" },
  { id: "checkin_100", title: "ROSA Legend 🌹", emoji: "🌹", description: "Checked in 100 total days" },
  { id: "partner", title: "Love is in the Air 💕", emoji: "💕", description: "Invited a partner" },
  { id: "profile_complete", title: "ROSA Pro ⭐", emoji: "⭐", description: "Completed all profile sections" },
];

export function GardenProvider({ children }: { children: React.ReactNode }) {
  const [garden, setGarden] = useLocalStorage<GardenData>("rosa_garden", DEFAULT);

  const checkIn = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    if (garden.lastCheckIn === today) {
      return { newStreak: garden.streak, newRoses: garden.roses };
    }

    const yesterday = format(new Date(Date.now() - 86400000), "yyyy-MM-dd");
    const newStreak = garden.lastCheckIn === yesterday ? garden.streak + 1 : 1;
    const newPetals = (garden.petals + 1) % 10;
    const completedRoses = Math.floor((garden.petals + 1) / 10);
    const newRoses = garden.roses + completedRoses;

    const newColors = [...garden.roseColors];
    if (newStreak >= 30 && !newColors.includes("gold")) newColors.push("gold");
    if (newStreak >= 7 && !newColors.includes("red")) newColors.push("red");

    const newTotal = garden.totalCheckIns + 1;
    let celebration: string | undefined;
    if (newStreak === 7) celebration = "confetti";
    else if (newStreak === 30) celebration = "bloom";
    else if (newTotal === 100) celebration = "legend";

    const updated: GardenData = {
      ...garden,
      streak: newStreak,
      lastCheckIn: today,
      totalCheckIns: newTotal,
      petals: newPetals,
      roses: newRoses,
      roseColors: newColors,
    };
    setGarden(updated);
    return { newStreak, newRoses, celebration };
  };

  const logWellness = (date: string, data: Partial<GardenData["wellnessLog"][string]>) => {
    setGarden((prev) => ({
      ...prev,
      wellnessLog: {
        ...prev.wellnessLog,
        [date]: { ...prev.wellnessLog[date], ...data },
      },
    }));
  };

  const earnAchievement = (id: string) => {
    if (garden.achievements.some((a) => a.id === id)) return;
    const a = ACHIEVEMENTS.find((a) => a.id === id);
    if (!a) return;
    setGarden((prev) => ({
      ...prev,
      achievements: [...prev.achievements, { ...a, earnedAt: new Date().toISOString() }],
    }));
  const hasAchievement = (id: string) => garden.achievements.some((a) => a.id === id);
  };

  const calcWellness = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const log = garden.wellnessLog[today] || {};
    let score = 0;
    if (garden.lastCheckIn === today) score += 20;
    try {
      const moodLogs = JSON.parse(scopedStorage.getItem("rosa_mood_logs") || "[]");
      const todayMood = moodLogs.find((l: any) => l.date === today);
      if (todayMood?.moodScore && todayMood.moodScore >= 3) score += 20;
    } catch {}
    if (log.water && log.water >= 6) score += 20;
    if (log.workout) { score += 20; } else { try { const h = JSON.parse(scopedStorage.getItem("rosa_health_logs") || "[]"); const th = h.find((l: any) => l.date === today); if (th?.workout || th?.steps > 5000) score += 20; } catch {} }
    if (log.sleep && log.sleep >= 7) { score += 20; } else { try { const s = JSON.parse(scopedStorage.getItem("rosa_sleep_logs") || "[]"); const ts = s.find((l: any) => l.date === today); if (ts?.hours && ts.hours >= 7) score += 20; } catch {} }
    return Math.min(score, 100);
  };
  const [wellnessScore, setWellnessScore] = useState(() => calcWellness());
  useEffect(() => { setWellnessScore(calcWellness()); }, [garden]);

  useEffect(() => { const h = () => setWellnessScore(calcWellness()); window.addEventListener("rosa:mood-saved", h); window.addEventListener("storage", h); return () => { window.removeEventListener("rosa:mood-saved", h); window.removeEventListener("storage", h); }; }, []);
  return (
    <GardenContext.Provider value={{ garden, checkIn, logWellness, earnAchievement, hasAchievement, wellnessScore }}>
      {children}
    </GardenContext.Provider>
  );
}

export function useGarden() {
  const ctx = useContext(GardenContext);
  if (!ctx) throw new Error("useGarden must be used within GardenProvider");
  return ctx;
}

export { ACHIEVEMENTS };
