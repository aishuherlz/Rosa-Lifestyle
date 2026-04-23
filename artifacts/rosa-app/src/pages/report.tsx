import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Heart, Flame, Trophy, BookHeart, Target, Utensils, Calendar, Download } from "lucide-react";
import { ShareButton } from "@/components/share-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useGarden } from "@/lib/garden-context";
import { useUser } from "@/lib/user-context";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, parseISO, isWithinInterval, startOfYear, endOfYear } from "date-fns";

const MOOD_EMOJI: Record<string, string> = {
  amazing: "✨", good: "😊", okay: "😌", low: "😔", sad: "😢", anxious: "😰",
};

function pickTopMood(logs: any[]): { mood: string; count: number } | null {
  if (!logs.length) return null;
  const counts = logs.reduce<Record<string, number>>((acc, l) => { acc[l.mood] = (acc[l.mood] || 0) + 1; return acc; }, {});
  const [mood, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return { mood, count };
}

export default function ReportPage() {
  const { user } = useUser();
  const { garden } = useGarden();
  const { toast } = useToast();
  const [view, setView] = useState<"month" | "year">("month");
  const [moodLogs] = useLocalStorage<any[]>("rosa_mood_logs", []);
  const [journal] = useLocalStorage<any[]>("rosa_journal_entries", []);
  const [goals] = useLocalStorage<any[]>("rosa_goals", []);
  const [challenges] = useLocalStorage<any[]>("rosa_challenges", []);
  const [meals] = useLocalStorage<any[]>("rosa_meals", []);
  const [milestones] = useLocalStorage<any[]>("rosa_milestones", []);
  const [letters] = useLocalStorage<any[]>("rosa_letters", []);

  const now = new Date();
  const range = view === "month"
    ? { start: startOfMonth(now), end: endOfMonth(now), label: format(now, "MMMM yyyy") }
    : { start: startOfYear(now), end: endOfYear(now), label: format(now, "yyyy") };

  const inRange = (dateStr?: string) => {
    if (!dateStr) return false;
    try { return isWithinInterval(parseISO(dateStr), { start: range.start, end: range.end }); } catch { return false; }
  };

  const stats = useMemo(() => {
    const moodsInRange = moodLogs.filter((l) => inRange(l.date));
    const topMood = pickTopMood(moodsInRange);
    const avgMood = moodsInRange.length ? (moodsInRange.reduce((s, l) => s + (l.moodScore || 3), 0) / moodsInRange.length) : 0;
    const journalsInRange = journal.filter((j) => inRange(j.createdAt || j.date));
    const goalsCompleted = goals.filter((g) => g.completed && inRange(g.completedAt || g.createdAt)).length;
    const challengesDone = challenges.filter((c) => c.completed && inRange(c.completedAt || c.createdAt)).length;
    const mealsInRange = meals.filter((m) => inRange(m.date || m.createdAt));
    const totalCalories = mealsInRange.reduce((s, m) => s + (m.calories || 0), 0);
    const lettersInRange = letters.filter((l) => inRange(l.createdAt || l.date));
    const milestonesCelebrated = milestones.filter((m) => {
      if (!inRange(m.targetDate)) return false;
      try { return parseISO(m.targetDate) <= new Date(); } catch { return false; }
    }).length;
    return {
      topMood, avgMood, moodCount: moodsInRange.length,
      journalCount: journalsInRange.length,
      goalsCompleted, challengesDone,
      mealCount: mealsInRange.length, totalCalories,
      lettersCount: lettersInRange.length,
      milestonesCelebrated,
    };
  }, [moodLogs, journal, goals, challenges, meals, letters, milestones, view]);

  const goddessTitle = useMemo(() => {
    if (stats.avgMood >= 4) return "Radiant Goddess 👑";
    if (stats.goalsCompleted >= 3) return "Achieving Queen 🏆";
    if (stats.journalCount >= 10) return "Reflective Soul 📖";
    if (stats.challengesDone >= 1) return "Fierce Warrior 🔥";
    if (garden.roses >= 5) return "Blooming Beauty 🌸";
    return "Soft & Steady 🌷";
  }, [stats, garden]);

  const shareText = `My ROSA ${view === "month" ? "Monthly Report" : "Wrapped"} — ${range.label}\n\n` +
    `🌹 ${goddessTitle}\n` +
    `${stats.topMood ? `${MOOD_EMOJI[stats.topMood.mood]} Mood: ${stats.topMood.mood} (${stats.topMood.count}x)\n` : ""}` +
    `📖 Journal: ${stats.journalCount}\n` +
    `🎯 Goals: ${stats.goalsCompleted}\n` +
    `🔥 Challenges: ${stats.challengesDone}\n` +
    `🌸 Garden: ${garden.roses} flowers · ${garden.streak}d streak\n\nMade with ROSA 💖`;

  const cards = [
    { icon: <Heart className="w-5 h-5 text-rose-500" />, label: "Mood check-ins", value: stats.moodCount, sub: stats.topMood ? `Most: ${MOOD_EMOJI[stats.topMood.mood]} ${stats.topMood.mood}` : "—" },
    { icon: <BookHeart className="w-5 h-5 text-violet-500" />, label: "Journal entries", value: stats.journalCount, sub: stats.journalCount >= 10 ? "Reflective soul" : "Keep writing" },
    { icon: <Target className="w-5 h-5 text-emerald-500" />, label: "Goals completed", value: stats.goalsCompleted, sub: stats.goalsCompleted ? "Proud of you" : "Set one today" },
    { icon: <Flame className="w-5 h-5 text-amber-500" />, label: "Challenges", value: stats.challengesDone, sub: stats.challengesDone ? "Fierce" : "Try one" },
    { icon: <Utensils className="w-5 h-5 text-pink-500" />, label: "Meals logged", value: stats.mealCount, sub: stats.totalCalories ? `${stats.totalCalories.toLocaleString()} kcal` : "—" },
    { icon: <Sparkles className="w-5 h-5 text-yellow-500" />, label: "Garden flowers", value: garden.roses, sub: `${garden.streak}d streak` },
  ];

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-serif text-foreground">ROSA {view === "month" ? "Report" : "Wrapped"}</h1>
            <p className="text-muted-foreground mt-1">Your story, beautifully told.</p>
          </div>
          <ShareButton title={`My ROSA ${view === "month" ? "Report" : "Wrapped"} 💖`} text={shareText} />
        </div>
      </motion.div>

      <Tabs value={view} onValueChange={(v) => setView(v as any)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="month">This Month</TabsTrigger>
          <TabsTrigger value="year">This Year</TabsTrigger>
        </TabsList>
      </Tabs>

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <Card className="border-2 border-rose-200 bg-gradient-to-br from-rose-50 via-pink-50 to-amber-50 shadow-md overflow-hidden">
          <CardContent className="pt-6 pb-6 text-center">
            <p className="text-xs uppercase tracking-widest text-rose-600 font-semibold">{range.label}</p>
            <p className="text-sm text-muted-foreground mt-2">{user?.name || "Beautiful"}, you are a</p>
            <h2 className="text-3xl font-serif text-foreground mt-1">{goddessTitle}</h2>
            <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
              <Badge className="bg-rose-100 text-rose-700 border-0">{stats.moodCount} mood check-ins</Badge>
              <Badge className="bg-violet-100 text-violet-700 border-0">{stats.journalCount} journals</Badge>
              <Badge className="bg-emerald-100 text-emerald-700 border-0">{stats.goalsCompleted} goals ✓</Badge>
              <Badge className="bg-amber-100 text-amber-700 border-0">{garden.roses} 🌸</Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-2">{c.icon}<p className="text-xs uppercase font-semibold text-muted-foreground">{c.label}</p></div>
                <p className="text-3xl font-serif font-semibold text-foreground mt-2">{c.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {stats.lettersCount > 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="pt-5 pb-5">
            <p className="text-sm font-semibold text-foreground">Words for your future self</p>
            <p className="text-sm text-muted-foreground mt-1">You wrote {stats.lettersCount} {stats.lettersCount === 1 ? "letter" : "letters"} this {view === "month" ? "month" : "year"}. Each one a hug from the present you.</p>
          </CardContent>
        </Card>
      )}

      {stats.milestonesCelebrated > 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-rose-500" /><p className="text-sm font-semibold text-foreground">Milestones</p></div>
            <p className="text-sm text-muted-foreground mt-1">{stats.milestonesCelebrated} special {stats.milestonesCelebrated === 1 ? "moment" : "moments"} marked on your timeline.</p>
          </CardContent>
        </Card>
      )}

      <Card className="border-rose-200 bg-rose-50/50">
        <CardContent className="pt-4 pb-4 text-center">
          <p className="text-xs italic text-muted-foreground">"Bloom with intention. You are the garden and the gardener." 🌹</p>
        </CardContent>
      </Card>
    </div>
  );
}
