import { useEffect, useState } from "react";
import { useUser } from "@/lib/user-context";
import { useSubscription } from "@/lib/subscription-context";
import { useGarden } from "@/lib/garden-context";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  CloudRain, Sun, Cloud, Wind,
  HeartPulse, CalendarHeart, Droplets, CalendarDays,
  Utensils, Dumbbell, Shirt, Map, Timer, Gift, Crown,
  ClipboardList, BookHeart, Target, Sparkles, Moon, FlameKindling, Flower2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLocalStorage } from "@/hooks/use-local-storage";
import confetti from "canvas-confetti";
import { useToast } from "@/hooks/use-toast";

type PeriodData = { lastPeriodDate?: string; cycleLength?: number };
type CycleLog = { periodStart?: string; periodEnd?: string; cycleLength?: number };
type Milestone = { id: string; title: string; emoji?: string; type?: string; targetDate?: string };
type Destination = { id: string; name: string; type?: string; startDate?: string; endDate?: string; visited?: boolean };

// Predict next period window from cycle logs (preferred) or rosa_period (fallback)
function predictNextPeriod(): { start: Date; end: Date } | null {
  try {
    const logs: CycleLog[] = JSON.parse(localStorage.getItem("rosa_cycle_logs") || "[]");
    let lastStart: Date | null = null;
    let cycleLen = 28;
    let periodLen = 5;
    if (logs.length) {
      const sorted = [...logs].sort((a, b) => (b.periodStart || "").localeCompare(a.periodStart || ""));
      const latest = sorted[0];
      if (latest?.periodStart) {
        lastStart = new Date(latest.periodStart);
        cycleLen = Number(latest.cycleLength) || 28;
        if (latest.periodEnd) {
          const d = Math.floor((new Date(latest.periodEnd).getTime() - lastStart.getTime()) / 86400000);
          if (d >= 0 && d <= 10) periodLen = d + 1;
        }
      }
    }
    if (!lastStart) {
      const pd: PeriodData = JSON.parse(localStorage.getItem("rosa_period") || "{}");
      if (pd?.lastPeriodDate) { lastStart = new Date(pd.lastPeriodDate); cycleLen = pd.cycleLength || 28; }
    }
    if (!lastStart) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let next = new Date(lastStart);
    while (next < today) next.setDate(next.getDate() + cycleLen);
    const end = new Date(next); end.setDate(end.getDate() + periodLen - 1);
    return { start: next, end };
  } catch { return null; }
}

function SyncHub() {
  const [milestones] = useLocalStorage<Milestone[]>("rosa_milestones", []);
  const [destinations] = useLocalStorage<Destination[]>("rosa_destinations", []);
  const today0 = new Date(); today0.setHours(0, 0, 0, 0);

  const nextPeriod = predictNextPeriod();
  const periodAlerts: { kind: "period" | "trip-clash"; title: string; sub: string; href: string; emoji: string }[] = [];

  if (nextPeriod) {
    const daysToPeriod = Math.floor((nextPeriod.start.getTime() - today0.getTime()) / 86400000);
    if (daysToPeriod >= 0 && daysToPeriod <= 5) {
      periodAlerts.push({
        kind: "period",
        title: daysToPeriod === 0 ? "Your period may start today 🩸" : `Period predicted in ${daysToPeriod} day${daysToPeriod === 1 ? "" : "s"}`,
        sub: `${format(nextPeriod.start, "MMM d")}${nextPeriod.start.getTime() !== nextPeriod.end.getTime() ? ` – ${format(nextPeriod.end, "MMM d")}` : ""} · stock essentials & rest`,
        href: "/period",
        emoji: "🌹",
      });
    }
    // Check trip clashes
    for (const d of destinations) {
      if (d.visited || d.type !== "planned" || !d.startDate) continue;
      const ts = new Date(d.startDate);
      const te = d.endDate ? new Date(d.endDate) : ts;
      if (ts <= nextPeriod.end && te >= nextPeriod.start) {
        periodAlerts.push({
          kind: "trip-clash",
          title: `${d.name} trip overlaps your period`,
          sub: `Pack period essentials, painkillers & a heating patch 💝`,
          href: "/travel",
          emoji: "✈️",
        });
        break;
      }
    }
  }

  // Upcoming gift milestones (next 60 days, countdown type)
  const giftMilestones = milestones
    .filter((m) => m.type === "countdown" && m.targetDate)
    .map((m) => ({ ...m, _days: Math.floor((new Date(m.targetDate!).getTime() - today0.getTime()) / 86400000) }))
    .filter((m) => m._days >= 0 && m._days <= 60)
    .sort((a, b) => a._days - b._days)
    .slice(0, 2);

  // Upcoming trips (next 30 days)
  const upcomingTrips = destinations
    .filter((d) => d.type === "planned" && !d.visited && d.startDate)
    .map((d) => ({ ...d, _days: Math.floor((new Date(d.startDate!).getTime() - today0.getTime()) / 86400000) }))
    .filter((d) => d._days >= 0 && d._days <= 30)
    .sort((a, b) => a._days - b._days)
    .slice(0, 2);

  if (!periodAlerts.length && !giftMilestones.length && !upcomingTrips.length) return null;

  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50/60 via-pink-50/40 to-amber-50/40 p-4 space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-rose-500" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-rose-700">Today's Sync</h3>
      </div>
      <div className="space-y-2">
        {periodAlerts.map((a, i) => (
          <Link key={`p-${i}`} href={a.href}>
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/70 border border-rose-100 hover:bg-white cursor-pointer">
              <span className="text-xl">{a.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                <p className="text-xs text-muted-foreground truncate">{a.sub}</p>
              </div>
              <span className="text-xs text-rose-500">→</span>
            </div>
          </Link>
        ))}
        {giftMilestones.map((m) => (
          <Link key={m.id} href="/wishlist">
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/70 border border-rose-100 hover:bg-white cursor-pointer">
              <span className="text-xl">{m.emoji || "🎁"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{m.title}</p>
                <p className="text-xs text-muted-foreground">In {m._days} day{m._days === 1 ? "" : "s"} · check your wishlist</p>
              </div>
              <span className="text-xs text-rose-500">→</span>
            </div>
          </Link>
        ))}
        {upcomingTrips.map((d) => (
          <Link key={d.id} href="/travel">
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/70 border border-rose-100 hover:bg-white cursor-pointer">
              <span className="text-xl">✈️</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{d.name} trip</p>
                <p className="text-xs text-muted-foreground">In {d._days} day{d._days === 1 ? "" : "s"} · view itinerary & outfits</p>
              </div>
              <span className="text-xs text-rose-500">→</span>
            </div>
          </Link>
        ))}
      </div>
    </motion.div>
  );
}

function getCyclePhase(periodData: PeriodData): { phase: string; title: string; day: number } {
  if (!periodData.lastPeriodDate) return { phase: "unknown", title: "Your sanctuary awaits 🌹", day: 0 };
  const start = new Date(periodData.lastPeriodDate);
  const today = new Date();
  const dayOfCycle = Math.floor((today.getTime() - start.getTime()) / 86400000) % (periodData.cycleLength || 28);
  if (dayOfCycle <= 5) return { phase: "menstruation", title: "Rest and Restore Queen 👑", day: dayOfCycle + 1 };
  if (dayOfCycle <= 13) return { phase: "follicular", title: "Fresh Start Energy ✨", day: dayOfCycle + 1 };
  if (dayOfCycle <= 16) return { phase: "ovulation", title: "In Your Power Era 🔥", day: dayOfCycle + 1 };
  return { phase: "luteal", title: "Warrior Mode 💪", day: dayOfCycle + 1 };
}

const DAILY_QUOTES = [
  { text: "A woman is the full circle. Within her is the power to create, nurture and transform.", author: "Diane Mariechild" },
  { text: "She believed she could, so she did.", author: "R.S. Grey" },
  { text: "You are enough. A thousand times enough.", author: "Unknown" },
  { text: "Your self-worth is determined by you. You don't have to depend on someone telling you who you are.", author: "Beyoncé" },
  { text: "I am not afraid of storms, for I am learning how to sail my ship.", author: "Louisa May Alcott" },
  { text: "One is not born a woman, one becomes one.", author: "Simone de Beauvoir" },
  { text: "The most courageous act is still to think for yourself. Aloud.", author: "Coco Chanel" },
];

export default function Home() {
  const { user } = useUser();
  const { plan, daysLeftInTrial, isPremium } = useSubscription();
  const { garden, checkIn, wellnessScore } = useGarden();
  const [weather, setWeather] = useState<{ temp: number; code: number } | null>(null);
  const [periodData] = useLocalStorage<PeriodData>("rosa_period", {});
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [showCelebration, setShowCelebration] = useState<string | null>(null);
  const { toast } = useToast();

  const today = new Date();
  const quote = DAILY_QUOTES[today.getDate() % DAILY_QUOTES.length];
  const cycleInfo = getCyclePhase(periodData);
  const todayStr = format(today, "yyyy-MM-dd");
  const alreadyCheckedIn = garden.lastCheckIn === todayStr;

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current=temperature_2m,weathercode`);
            const data = await res.json();
            if (data.current) setWeather({ temp: Math.round(data.current.temperature_2m), code: data.current.weathercode });
          } catch {}
        }, () => {}
      );
    }
  }, []);

  const getWeatherIcon = (code: number) => {
    if (code <= 3) return <Sun className="w-7 h-7 text-amber-500" />;
    if (code <= 48) return <Cloud className="w-7 h-7 text-slate-400" />;
    if (code <= 67) return <CloudRain className="w-7 h-7 text-blue-400" />;
    return <Wind className="w-7 h-7 text-slate-500" />;
  };

  const getGreeting = () => {
    const h = today.getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const handleCheckIn = () => {
    const { newStreak, celebration } = checkIn();
    setCheckedInToday(true);
    if (celebration === "confetti") {
      confetti({ particleCount: 100, spread: 80, colors: ["#be185d", "#f9a8d4", "#fbbf24"] });
      toast({ title: "7-day streak! 🎉", description: "You're on fire! Keep going." });
    } else if (celebration === "bloom") {
      confetti({ particleCount: 200, spread: 140, colors: ["#be185d", "#f9a8d4", "#fde68a", "#fbcfe8"] });
      toast({ title: "30-day streak! 🌹🌹🌹", description: "A full bloom! You're incredible." });
    } else {
      toast({ title: `Day ${newStreak} streak! 🌹`, description: "Your garden is growing." });
    }
  };

  const QUICK_LINKS = [
    { href: "/mood", label: "Mood", icon: HeartPulse, color: "text-rose-500 bg-rose-50" },
    { href: "/period", label: "Cycle", icon: Droplets, color: "text-pink-500 bg-pink-50" },
    { href: "/food", label: "Food", icon: Utensils, color: "text-amber-500 bg-amber-50", premium: true },
    { href: "/health", label: "Health", icon: Dumbbell, color: "text-emerald-500 bg-emerald-50" },
    { href: "/outfit", label: "Outfits", icon: Shirt, color: "text-fuchsia-500 bg-fuchsia-50", premium: true },
    { href: "/travel", label: "Travel", icon: Map, color: "text-sky-500 bg-sky-50" },
    { href: "/milestones", label: "Milestones", icon: Timer, color: "text-indigo-500 bg-indigo-50" },
    { href: "/wishlist", label: "Wishlist", icon: Gift, color: "text-orange-500 bg-orange-50" },
    { href: "/journal", label: "Journal", icon: BookHeart, color: "text-rose-400 bg-rose-50" },
    { href: "/goals", label: "Goals", icon: Target, color: "text-teal-500 bg-teal-50" },
    { href: "/challenges", label: "Challenges", icon: FlameKindling, color: "text-red-500 bg-red-50" },
    { href: "/skin", label: "Skin", icon: Sparkles, color: "text-violet-500 bg-violet-50" },
    { href: "/letters", label: "Letters", icon: Moon, color: "text-purple-500 bg-purple-50" },
    { href: "/reminders", label: "Reminders", icon: CalendarDays, color: "text-violet-400 bg-violet-50" },
    { href: "/partner", label: "Partner", icon: CalendarHeart, color: "text-rose-400 bg-rose-50" },
    { href: "/surveys", label: "Surveys", icon: ClipboardList, color: "text-blue-500 bg-blue-50" },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-5 md:p-10 space-y-7 max-w-4xl mx-auto pb-24">

      {/* Header */}
      <header className="flex justify-between items-end">
        <div className="space-y-1">
          <p className="text-muted-foreground uppercase tracking-widest text-xs font-medium">{format(today, "EEEE, MMMM do")}</p>
          <h1 className="text-4xl md:text-5xl font-serif text-foreground">
            {getGreeting()},<br />
            <span className="text-primary italic">{user?.name || "Beautiful"}</span>
          </h1>
          {/* Cycle Goddess Title */}
          {cycleInfo.phase !== "unknown" && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-medium text-primary/80 mt-1"
            >
              {cycleInfo.title} · Cycle Day {cycleInfo.day}
            </motion.p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {weather && (
            <div className="flex items-center gap-2 bg-card p-2.5 rounded-2xl border border-border/50 shadow-sm">
              {getWeatherIcon(weather.code)}
              <span className="text-lg font-light">{weather.temp}°</span>
            </div>
          )}
        </div>
      </header>

      {/* Trial / Subscription Banner */}
      {plan === "trial" && daysLeftInTrial <= 7 && (
        <Link href="/subscription">
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl px-5 py-3 cursor-pointer hover:shadow-md transition-all">
            <div className="flex items-center gap-3">
              <Crown className="w-5 h-5 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-900">{daysLeftInTrial} days left in your free trial</p>
                <p className="text-xs text-amber-700">Subscribe for $5/mo or $50/yr</p>
              </div>
            </div>
            <span className="text-xs text-amber-700 font-medium">View →</span>
          </motion.div>
        </Link>
      )}
      {plan === "expired" && (
        <Link href="/subscription">
          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-2xl px-5 py-3 cursor-pointer hover:shadow-md transition-all">
            <p className="text-sm text-gray-700">Your free trial has ended — subscribe to continue</p>
            <span className="text-xs text-gray-600 font-medium">Subscribe →</span>
          </div>
        </Link>
      )}

      <SyncHub />

      {/* ROSA Garden + Wellness Score Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* ROSA Garden */}
        <motion.div
          className="bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-100 rounded-3xl p-5"
          whileTap={{ scale: 0.97 }}
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">ROSA Garden</p>
              <p className="text-2xl font-bold text-primary mt-0.5">🌹 {garden.roses}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Streak</p>
              <p className="text-lg font-bold text-orange-500">🔥 {garden.streak}</p>
            </div>
          </div>
          {/* Petal progress */}
          <div className="flex gap-1 mb-3">
            {Array.from({ length: 10 }, (_, i) => (
              <motion.div
                key={i}
                className={`h-2 flex-1 rounded-full transition-all ${i < garden.petals ? "bg-primary" : "bg-primary/20"}`}
                animate={i === garden.petals - 1 ? { scale: [1, 1.3, 1] } : {}}
              />
            ))}
          </div>
          <button
            onClick={handleCheckIn}
            disabled={alreadyCheckedIn}
            className={`w-full text-xs py-2 rounded-xl font-medium transition-all ${alreadyCheckedIn ? "bg-emerald-100 text-emerald-700" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
          >
            {alreadyCheckedIn ? "✓ Checked in today" : "+ Daily Check-in"}
          </button>
        </motion.div>

        {/* Wellness Score */}
        <motion.div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100 rounded-3xl p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Wellness Score</p>
          <div className="flex items-end gap-1 mb-3">
            <p className="text-4xl font-bold text-violet-600">{wellnessScore}</p>
            <p className="text-lg text-violet-400 mb-1">/100</p>
          </div>
          <div className="w-full bg-violet-100 rounded-full h-2 mb-3">
            <motion.div
              className="bg-violet-500 h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${wellnessScore}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {wellnessScore >= 80 ? "You're thriving! 🌟" : wellnessScore >= 50 ? "Keep it up 💪" : "Log today for a boost →"}
          </p>
        </motion.div>
      </div>

      {/* Achievements Row */}
      {garden.achievements.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Your Badges</p>
          <div className="flex gap-2 flex-wrap">
            {garden.achievements.map((a) => (
              <div key={a.id} className="flex items-center gap-1.5 bg-card border border-border/50 rounded-full px-3 py-1.5 text-sm">
                <span>{a.emoji}</span>
                <span className="font-medium text-xs">{a.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ROSA Daily Whisper */}
      <section className="relative overflow-hidden rounded-3xl bg-secondary/30 p-7 border border-primary/10">
        <div className="absolute top-0 right-0 p-6 opacity-5 text-primary">
          <svg width="100" height="100" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
          </svg>
        </div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">Today's Whisper ✨</p>
        <h3 className="text-xl md:text-2xl font-serif leading-snug text-foreground/90">
          "{quote.text}"
        </h3>
        <p className="mt-3 text-xs tracking-widest uppercase text-muted-foreground">{quote.author}</p>
      </section>

      {/* Quick Access Grid */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3 font-medium">Quick Access</p>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
          {QUICK_LINKS.map((item) => (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileTap={{ scale: 0.92 }}
                className="bg-card hover:bg-muted/40 transition-colors p-3 rounded-2xl border border-border/50 shadow-sm flex flex-col items-center justify-center gap-2 cursor-pointer group relative"
              >
                {item.premium && !isPremium && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-400" />
                )}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform ${item.color}`}>
                  <item.icon className="w-4 h-4" />
                </div>
                <span className="font-medium text-[10px] text-center leading-tight">{item.label}</span>
              </motion.div>
            </Link>
          ))}
        </div>
      </div>

      {/* Community Counter */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="rounded-2xl border border-border/40 bg-card px-5 py-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <Flower2 className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm font-medium">You're part of a sisterhood 🌹</p>
            <p className="text-xs text-muted-foreground">Thousands of women using ROSA right now</p>
          </div>
        </div>
      </motion.div>

      {/* Founder Note */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="text-center px-4">
        <p className="text-xs text-muted-foreground italic leading-relaxed">
          ROSA was built by Aiswarya Saji — a woman who struggled just like you, and created this space so you never have to feel alone.
        </p>
      </motion.div>
    </motion.div>
  );
}
