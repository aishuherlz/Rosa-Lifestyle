import { useEffect, useState } from "react";
import { ShareableCard } from "@/components/shareable-card";
import { useUser } from "@/lib/user-context";
import { useSubscription } from "@/lib/subscription-context";
import { useGarden } from "@/lib/garden-context";
import { FoundersBanner } from "@/components/founders-banner";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  CloudRain, Sun, Cloud, Wind,
  HeartPulse, CalendarHeart, Droplets, CalendarDays,
  Utensils, Dumbbell, Shirt, Map, Timer, Gift, Crown,
  ClipboardList, BookHeart, Target, Sparkles, Moon, FlameKindling, Flower2, Users, Info,
  BedDouble, Lightbulb, UserHeart,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLocalStorage } from "@/hooks/use-local-storage";
import confetti from "canvas-confetti";
import { useToast } from "@/hooks/use-toast";
import { scopedStorage } from "@/lib/scoped-storage";
import { apiUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Tutorial } from "@/components/tutorial";
import { getIsMale } from "@/App";

type PeriodData = { lastPeriodDate?: string; cycleLength?: number };

function getCyclePhase(periodData: PeriodData, isMale: boolean): { phase: string; title: string; day: number } {
  if (!periodData.lastPeriodDate) return { phase: "unknown", title: "Your sanctuary awaits 🌹", day: 0 };
  const start = new Date(periodData.lastPeriodDate);
  const today = new Date();
  const dayOfCycle = Math.floor((today.getTime() - start.getTime()) / 86400000) % (periodData.cycleLength || 28);
  if (dayOfCycle <= 5) return { phase: "menstruation", title: isMale ? "Support and Restore 🌹" : "Rest and Restore Queen 👑", day: dayOfCycle + 1 };
  if (dayOfCycle <= 13) return { phase: "follicular", title: isMale ? "Active Energy ✨" : "Fresh Start Energy ✨", day: dayOfCycle + 1 };
  if (dayOfCycle <= 16) return { phase: "ovulation", title: isMale ? "Peak Power Era 🔥" : "In Your Power Era 🔥", day: dayOfCycle + 1 };
  return { phase: "luteal", title: isMale ? "Patience and Care 💪" : "Warrior Mode 💪", day: dayOfCycle + 1 };
}

const GET_DAILY_QUOTES = (isMale: boolean) => [
  { text: "A woman is the full circle. Within her is the power to create, nurture and transform.", author: "Diane Mariechild", femaleOnly: true },
  { text: "Strength does not come from winning. Your struggles develop your strengths.", author: "Arnold Schwarzenegger", maleOnly: true },
  { text: "She believed she could, so she did.", author: "R.S. Grey", femaleOnly: true },
  { text: "It is not the mountain we conquer, but ourselves.", author: "Sir Edmund Hillary", maleOnly: true },
  { text: "You are enough. A thousand times enough.", author: "Unknown" },
  { text: "Your self-worth is determined by you. You don't have to depend on someone telling you who you are.", author: "Beyoncé" },
  { text: "I am not afraid of storms, for I am learning how to sail my ship.", author: "Louisa May Alcott" },
  { text: "The greatest glory in living lies not in never falling, but in rising every time we fall.", author: "Nelson Mandela" },
  { text: "One is not born a woman, one becomes one.", author: "Simone de Beauvoir", femaleOnly: true },
  { text: "Hardships often prepare ordinary people for an extraordinary destiny.", author: "C.S. Lewis", maleOnly: true },
  { text: "The most courageous act is still to think for yourself. Aloud.", author: "Coco Chanel" },
].filter(q => isMale ? !q.femaleOnly : !q.maleOnly);

export default function Home() {
  const { user, getAuthHeaders } = useUser();
  const { plan, daysLeftInTrial, isPremium } = useSubscription();
  const { garden, checkIn, wellnessScore } = useGarden();
  const [weather, setWeather] = useState<{ temp: number; code: number } | null>(null);
  const [periodData] = useLocalStorage<PeriodData>("rosa_period", {});
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [showCelebration, setShowCelebration] = useState<string | null>(null);
  const [shareAch, setShareAch] = useState<{ id: string; emoji: string; title: string; description?: string } | null>(null);
  const { toast } = useToast();

  const [partnerData, setPartnerData] = useState<any>(null);
  const [isPartnerLoading, setIsPartnerLoading] = useState(false);

  const today = new Date();
  const isMale = getIsMale(user?.gender);
  const quotes = GET_DAILY_QUOTES(isMale);

  // Show tutorial for new users who haven't seen it yet
  const [showTutorial, setShowTutorial] = useState(() => {
    const done = scopedStorage.getItem("rosa_tutorial_done");
    const joinedRecently = user?.joinedAt && (Date.now() - new Date(user.joinedAt).getTime()) < 1000 * 60 * 60 * 24 * 3; // within 3 days
    return !done && !!joinedRecently;
  });
  const quote = quotes[today.getDate() % quotes.length];
  
  const cycleInfo = isMale && partnerData?.partnerData?.cycle?.logs?.[0] 
    ? getCyclePhase({ 
        lastPeriodDate: partnerData.partnerData.cycle.logs[0].periodStart,
        cycleLength: partnerData.partnerData.cycle.logs[0].cycleLength 
      }, true)
    : getCyclePhase(periodData, false);

  const todayStr = format(today, "yyyy-MM-dd");
  const alreadyCheckedIn = garden.lastCheckIn === todayStr;

  const greetingSuffix = isMale ? "Sir" : (user?.name || "Beautiful");

  useEffect(() => {
    const fetchWeather = async (lat: number, lon: number) => {
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode`);
        const data = await res.json();
        if (data.current) setWeather({ temp: Math.round(data.current.temperature_2m), code: data.current.weathercode });
      } catch {}
    };
    // Timezone-based fallback coordinates instead of hardcoded Toronto
    const getTimezoneCoords = (): [number, number] => {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz.includes("London") || tz.includes("Dublin")) return [51.5, -0.12];
        if (tz.includes("New_York") || tz.includes("Toronto")) return [40.71, -74.01];
        if (tz.includes("Los_Angeles") || tz.includes("Vancouver")) return [34.05, -118.24];
        if (tz.includes("Chicago")) return [41.88, -87.63];
        if (tz.includes("Kolkata") || tz.includes("Calcutta")) return [22.57, 88.36];
        if (tz.includes("Dubai")) return [25.2, 55.27];
        if (tz.includes("Sydney") || tz.includes("Melbourne")) return [-33.87, 151.21];
        if (tz.includes("Paris") || tz.includes("Berlin")) return [48.86, 2.35];
        if (tz.includes("Tokyo")) return [35.68, 139.69];
        if (tz.includes("Singapore")) return [1.35, 103.82];
      } catch {}
      return [51.5, -0.12]; // Default London — more internationally neutral than Toronto
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => { const [lat, lon] = getTimezoneCoords(); fetchWeather(lat, lon); }
      );
    } else {
      const [lat, lon] = getTimezoneCoords();
      fetchWeather(lat, lon);
    }
  }, []);

  useEffect(() => {
    if (isMale) {
      fetchPartnerData();
    }
  }, [isMale]);

  const fetchPartnerData = async () => {
    setIsPartnerLoading(true);
    try {
      const res = await fetch(apiUrl("/api/partner/shared-data"), { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.linked) {
        setPartnerData(data);
      }
    } catch (e) {
      console.error("[HOME] Failed to fetch partner data:", e);
    } finally {
      setIsPartnerLoading(false);
    }
  };

  const getWeatherIcon = (code: number) => {
    if (code <= 3) return <Sun className="w-7 h-7 text-amber-500" />;
    if (code <= 48) return <Cloud className="w-7 h-7 text-slate-400" />;
    if (code <= 67) return <CloudRain className="w-7 h-7 text-blue-400" />;
    return <Wind className="w-7 h-7 text-slate-500" />;
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h >= 0 && h < 5) return "Sweet dreams";
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    if (h < 21) return "Good evening";
    return "Good night";
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
    { href: "/mood", label: "Mood", icon: HeartPulse, color: isMale ? "text-blue-500 bg-blue-50" : "text-rose-500 bg-rose-50" },
    { href: "/period", label: isMale ? "Partner Cycle" : "Cycle", icon: Droplets, color: isMale ? "text-blue-500 bg-blue-50" : "text-pink-500 bg-pink-50" },
    { href: "/food", label: "Food", icon: Utensils, color: "text-amber-500 bg-amber-50", premium: true },
    { href: "/health", label: "Health", icon: Dumbbell, color: "text-emerald-500 bg-emerald-50" },
    { href: "/outfit", label: "Outfits", icon: Shirt, color: isMale ? "text-blue-400 bg-blue-50" : "text-fuchsia-500 bg-fuchsia-50", premium: true },
    { href: "/travel", label: "Travel", icon: Map, color: "text-sky-500 bg-sky-50" },
    { href: "/milestones", label: "Milestones", icon: Timer, color: "text-indigo-500 bg-indigo-50" },
    { href: "/wishlist", label: "Wishlist", icon: Gift, color: "text-orange-500 bg-orange-50" },
    { href: "/journal", label: "Journal", icon: BookHeart, color: isMale ? "text-blue-400 bg-blue-50" : "text-rose-400 bg-rose-50" },
    { href: "/goals", label: "Goals", icon: Target, color: "text-teal-500 bg-teal-50" },
    { href: "/challenges", label: "Challenges", icon: FlameKindling, color: "text-red-500 bg-red-50" },
    { href: "/skin", label: "Skin", icon: Sparkles, color: "text-violet-500 bg-violet-50" },
    { href: "/letters", label: "Letters", icon: Moon, color: "text-purple-500 bg-purple-50" },
    { href: "/reminders", label: "Reminders", icon: CalendarDays, color: "text-violet-400 bg-violet-50" },
    { href: "/partner", label: "Partner", icon: CalendarHeart, color: isMale ? "text-blue-400 bg-blue-50" : "text-rose-400 bg-rose-50" },
    { href: "/surveys", label: "Surveys", icon: ClipboardList, color: "text-blue-500 bg-blue-50" },
    { href: "/affirmation", label: "Affirmation", icon: Flower2, color: isMale ? "text-blue-500 bg-blue-50" : "text-rose-500 bg-rose-50" },
    { href: "/rose-wall", label: "Rose Wall", icon: Users, color: isMale ? "text-blue-400 bg-blue-50" : "text-pink-500 bg-pink-50" },
    { href: "/rose-quiz", label: "Rose Quiz", icon: Lightbulb, color: "text-violet-500 bg-violet-50" },
    { href: "/sos", label: "Support", icon: HeartPulse, color: "text-red-500 bg-red-50" },
    { href: "/sanctuary", label: "Sanctuary", icon: Moon, color: "text-indigo-500 bg-indigo-50" },
    { href: "/wisdom", label: "Wisdom", icon: Lightbulb, color: "text-amber-500 bg-amber-50" },
    { href: "/sleep", label: "Sleep", icon: BedDouble, color: "text-slate-500 bg-slate-50" },
  ];

  const weeklyRecap = (() => {
    const journal = JSON.parse(scopedStorage.getItem("rosa_journal") || "[]");
    const moods = JSON.parse(scopedStorage.getItem("rosa_moods") || "[]");
    const weekAgo = Date.now() - 7 * 86400000;
    const j = journal.filter((e: any) => new Date(e.date).getTime() > weekAgo).length;
    const m = Array.isArray(moods) ? moods.filter((e: any) => (typeof e.date === "string" ? new Date(e.date).getTime() : e.date) > weekAgo).length : 0;
    return { j, m };
  })();

  return (
    <>
      {showTutorial && (
        <Tutorial onComplete={() => setShowTutorial(false)} />
      )}
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-5 md:p-10 space-y-7 max-w-4xl mx-auto pb-24">

      {/* Header */}
      <header className="flex justify-between items-end">
        <div className="space-y-1">
          <p className="text-muted-foreground uppercase tracking-widest text-xs font-medium">{format(today, "EEEE, MMMM do")}</p>
          <h1 className="text-4xl md:text-5xl font-serif text-foreground">
            {getGreeting()},<br />
            <span className="text-primary italic">{greetingSuffix}</span>
          </h1>
          {user?.pronouns && (
            <p className="text-xs uppercase tracking-widest text-muted-foreground/80 mt-1" data-testid="text-pronouns-badge">
              {user.pronouns}
            </p>
          )}
          {/* Cycle Title */}
          {cycleInfo.phase !== "unknown" && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-medium text-primary/80 mt-1"
            >
              {isMale ? `Partner is in her ${cycleInfo.phase} phase` : `${cycleInfo.title} · Cycle Day ${cycleInfo.day}`}
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

      {/* Founding member banner */}
      <FoundersBanner />

      {/* Partner Status Card (Male Only) */}
      {isMale && isPartnerLoading && (
        <div className="bg-gradient-to-br from-blue-50 to-slate-50 border border-blue-100 rounded-3xl p-5 animate-pulse">
          <div className="h-4 bg-blue-200/60 rounded w-1/3 mb-3" />
          <div className="h-6 bg-blue-200/60 rounded w-1/2 mb-2" />
          <div className="h-3 bg-blue-100/60 rounded w-2/3" />
        </div>
      )}
      {isMale && !isPartnerLoading && partnerData?.linked && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Link href="/period">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-5 rounded-3xl shadow-lg cursor-pointer group hover:shadow-xl transition-all border border-blue-400/30">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-sm">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-blue-100 text-xs font-bold uppercase tracking-wider">Partner Status</p>
                    <h3 className="text-xl font-serif">{partnerData.partner.nickname || partnerData.partner.name}</h3>
                  </div>
                </div>
                <Badge className="bg-white/20 hover:bg-white/30 text-white border-none backdrop-blur-sm">Synced 🌹</Badge>
              </div>
              
              {partnerData.partnerData?.cycle ? (
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md">
                    <p className="text-[10px] text-blue-100 uppercase tracking-widest mb-1">Current Phase</p>
                    <p className="font-bold text-lg">{cycleInfo.phase.charAt(0).toUpperCase() + cycleInfo.phase.slice(1)}</p>
                  </div>
                  <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md">
                    <p className="text-[10px] text-blue-100 uppercase tracking-widest mb-1">How to Help</p>
                    <p className="text-xs italic leading-tight">Tap to see care tips for this phase →</p>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-2 text-blue-100 text-sm italic">
                  <Info className="w-4 h-4" />
                  <span>Waiting for partner to share cycle data...</span>
                </div>
              )}
            </div>
          </Link>
        </motion.div>
      )}

      {/* ROSA Garden + Wellness Score Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* ROSA Garden */}
        <motion.div
          className={cn("bg-gradient-to-br border rounded-3xl p-5", isMale ? "from-blue-50 to-slate-50 border-blue-100" : "from-rose-50 to-pink-50 border-rose-100")}
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
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Your Badges · tap to share</p>
          <div className="flex gap-2 flex-wrap">
            {garden.achievements.map((a) => (
              <button
                key={a.id}
                onClick={() => setShareAch(a)}
                className={cn("flex items-center gap-1.5 bg-card border border-border/50 rounded-full px-3 py-1.5 text-sm transition-colors", isMale ? "hover:border-blue-300 hover:bg-blue-50" : "hover:border-rose-300 hover:bg-rose-50")}
                data-testid={`share-ach-${a.id}`}
              >
                <span>{a.emoji}</span>
                <span className="font-medium text-xs">{a.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Weekly Recap */}
      <section className={cn("rounded-3xl p-5 border shadow-sm", isMale ? "bg-gradient-to-r from-blue-200 to-slate-200 dark:from-blue-900/40 dark:to-slate-900/40 border-blue-300/60" : "bg-gradient-to-r from-rose-200 to-pink-200 dark:from-rose-900/40 dark:to-pink-900/40 border-rose-300/60")}>
        <p className={cn("text-xs uppercase tracking-widest mb-3 font-semibold", isMale ? "text-blue-800 dark:text-blue-200" : "text-rose-800 dark:text-rose-200")}>This week, you bloomed 🌹</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center"><p className={cn("text-3xl font-bold", isMale ? "text-blue-900 dark:text-blue-100" : "text-rose-900 dark:text-rose-100")}>{weeklyRecap.j}</p><p className={cn("text-xs font-medium mt-0.5", isMale ? "text-blue-800 dark:text-blue-200" : "text-rose-800 dark:text-rose-200")}>journal entries</p></div>
          <div className="text-center"><p className={cn("text-3xl font-bold", isMale ? "text-slate-900 dark:text-slate-100" : "text-pink-900 dark:text-pink-100")}>{weeklyRecap.m}</p><p className={cn("text-xs font-medium mt-0.5", isMale ? "text-slate-800 dark:text-slate-200" : "text-pink-800 dark:text-pink-200")}>moods logged</p></div>
          <div className="text-center"><p className="text-3xl font-bold text-amber-900 dark:text-amber-100">{garden.streak}🔥</p><p className="text-xs text-amber-800 dark:text-amber-200 font-medium mt-0.5">day streak</p></div>
        </div>
      </section>

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
            <p className="text-sm font-medium">{isMale ? "You're part of the ROSA family 🌹" : "You're part of a sisterhood 🌹"}</p>
            <p className="text-xs text-muted-foreground">{isMale ? "Thousands of people using ROSA right now" : "Thousands of women using ROSA right now"}</p>
          </div>
        </div>
      </motion.div>

      {/* Founder Note */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="text-center px-4">
        <p className="text-xs text-muted-foreground italic leading-relaxed">
          ROSA was built by Aiswarya Saji — to create a safe, supportive space where everyone belongs and no one has to feel alone.
        </p>
      </motion.div>

      <ShareableCard
        open={!!shareAch}
        onOpenChange={(o) => { if (!o) setShareAch(null); }}
        title={shareAch?.title || ""}
        subtitle="Achievement unlocked"
        bigText={shareAch?.emoji || "🌹"}
        smallText={shareAch?.description || "Earned in ROSA"}
        emoji="🏆"
        variant={isMale ? "blue" : "amber"}
        authorName={user?.name}
      />
    </motion.div>
    </>
  );
}
