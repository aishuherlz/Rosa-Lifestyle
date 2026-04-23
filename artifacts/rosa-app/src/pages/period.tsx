import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, addDays, differenceInDays, parseISO, isWithinInterval, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { Plus, Droplets, Activity, Heart, Flower, ChevronLeft, ChevronRight, Stamp, Video, Zap, Salad, Dumbbell, Moon, Sun, Flame, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { cn } from "@/lib/utils";

type CycleLog = {
  id: string;
  periodStart: string;
  periodEnd: string;
  cycleLength: number;
  symptoms: string[];
  notes: string;
  flow?: "light" | "medium" | "heavy";
  mood?: string;
};

const SYMPTOMS = [
  "Cramps", "Bloating", "Headache", "Fatigue", "Mood swings",
  "Back pain", "Tender breasts", "Nausea", "Acne", "Food cravings",
  "Insomnia", "Anxiety", "Brain fog", "Hot flashes", "Joint pain",
];

const FLOW_OPTIONS = [
  { value: "light", label: "Light", color: "bg-rose-200" },
  { value: "medium", label: "Medium", color: "bg-rose-400" },
  { value: "heavy", label: "Heavy", color: "bg-rose-600" },
];

const MOODS = ["😌 Calm", "😢 Low", "😤 Irritable", "🥰 Loved", "😴 Tired", "💪 Strong", "😰 Anxious", "✨ Glowing"];

type PhaseInfo = {
  name: string;
  emoji: string;
  tagline: string;
  color: string;
  bg: string;
  textColor: string;
  borderColor: string;
  food: string[];
  movement: string[];
  selfCare: string[];
  energy: string;
  videoTitle: string;
  videoUrl: string;
};

const PHASE_INFO: Record<string, PhaseInfo> = {
  menstrual: {
    name: "Menstrual Phase",
    emoji: "🌑",
    tagline: "Rest, release, renew.",
    color: "rose",
    bg: "bg-rose-50",
    textColor: "text-rose-700",
    borderColor: "border-rose-200",
    energy: "Low — honour your body's need for rest",
    food: ["Dark chocolate 🍫", "Warm soups & stews 🍲", "Iron-rich foods (spinach, lentils) 🥬", "Bananas for cramps 🍌", "Chamomile tea 🍵"],
    movement: ["Restorative yoga 🧘‍♀️", "Gentle walk 🚶‍♀️", "Stretching & foam rolling", "Yin yoga", "Rest — movement is optional!"],
    selfCare: ["Heating pad on abdomen 🔥", "Warm bath with Epsom salts 🛁", "Castor oil massage", "Early bedtime", "Journal your feelings 📓"],
    videoTitle: "Gentle Yoga for Period Pain",
    videoUrl: "https://www.youtube.com/results?search_query=gentle+yoga+for+period+pain",
  },
  follicular: {
    name: "Follicular Phase",
    emoji: "🌱",
    tagline: "Fresh energy rising.",
    color: "emerald",
    bg: "bg-emerald-50",
    textColor: "text-emerald-700",
    borderColor: "border-emerald-200",
    energy: "Rising — great time to start new projects",
    food: ["Light salads & raw veggies 🥗", "Fermented foods for gut health 🥒", "Eggs & lean protein 🥚", "Flaxseed smoothies 🥤", "Green tea ☕"],
    movement: ["HIIT workouts 💪", "Running or cycling 🚴‍♀️", "Dance class 💃", "Strength training", "Try something new!"],
    selfCare: ["Skin care refresh ✨", "Plan your goals 📋", "Connect with friends 👯‍♀️", "Start a creative project 🎨", "Morning walks in sunlight 🌞"],
    videoTitle: "Energising Workout for Follicular Phase",
    videoUrl: "https://www.youtube.com/results?search_query=follicular+phase+workout+energy",
  },
  ovulation: {
    name: "Ovulation Phase",
    emoji: "🌕",
    tagline: "Peak power. You're magnetic.",
    color: "amber",
    bg: "bg-amber-50",
    textColor: "text-amber-700",
    borderColor: "border-amber-200",
    energy: "Peak — you're confident, social & powerful",
    food: ["Anti-inflammatory foods 🫐", "Zinc-rich foods (pumpkin seeds) 🌻", "Colourful vegetables 🌈", "Light proteins 🐟", "Plenty of water 💧"],
    movement: ["Intense cardio 🏃‍♀️", "Group fitness classes", "Rock climbing 🧗‍♀️", "Competitive sports ⚽", "Power yoga"],
    selfCare: ["Schedule important meetings 📅", "Go on a date 💕", "Public speaking or presentations", "Vision boarding 🗺️", "Celebrate yourself 🎉"],
    videoTitle: "Peak Performance Workout",
    videoUrl: "https://www.youtube.com/results?search_query=ovulation+phase+peak+performance+workout",
  },
  luteal: {
    name: "Luteal Phase",
    emoji: "🌘",
    tagline: "Slow down, turn inward.",
    color: "violet",
    bg: "bg-violet-50",
    textColor: "text-violet-700",
    borderColor: "border-violet-200",
    energy: "Slowing — honour your need for solitude",
    food: ["Complex carbs (sweet potato, oats) 🍠", "Magnesium-rich foods (dark leafy greens) 🥦", "Dark chocolate for mood 🍫", "Reduce caffeine ☕→🍵", "Omega-3s (salmon, walnuts) 🐟"],
    movement: ["Pilates 🧘", "Walking in nature 🌿", "Swimming 🏊‍♀️", "Light strength training", "Bike rides"],
    selfCare: ["Set boundaries & say no 🙅‍♀️", "Organise your space 🏠", "Creative solo projects 🎨", "Deep sleep hygiene 😴", "Reduce social commitments"],
    videoTitle: "Calming Luteal Phase Yoga",
    videoUrl: "https://www.youtube.com/results?search_query=luteal+phase+yoga+PMS+relief",
  },
};

function getPhaseKey(cycleDay: number): keyof typeof PHASE_INFO {
  if (cycleDay >= 1 && cycleDay <= 5) return "menstrual";
  if (cycleDay >= 6 && cycleDay <= 13) return "follicular";
  if (cycleDay >= 14 && cycleDay <= 17) return "ovulation";
  return "luteal";
}

export default function PeriodPage() {
  const [cycleLogs, setCycleLogs] = useLocalStorage<CycleLog[]>("rosa_cycle_logs", []);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"tracker" | "passport" | "guide">("tracker");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [form, setForm] = useState({
    periodStart: "", periodEnd: "", cycleLength: "28",
    symptoms: [] as string[], notes: "", flow: "medium" as CycleLog["flow"], mood: "",
  });

  const lastCycle = cycleLogs[0];
  const today = new Date();

  let cycleDay: number | null = null;
  let phaseKey: keyof typeof PHASE_INFO = "luteal";
  let ovulationStart: Date | null = null;
  let ovulationEnd: Date | null = null;
  let nextPeriod: Date | null = null;
  let pregnancyProb = "Low";

  if (lastCycle) {
    const start = parseISO(lastCycle.periodStart);
    const cl = lastCycle.cycleLength || 28;
    cycleDay = differenceInDays(today, start) + 1;
    nextPeriod = addDays(start, cl);
    ovulationStart = addDays(start, cl - 16);
    ovulationEnd = addDays(start, cl - 10);
    phaseKey = getPhaseKey(cycleDay);
    if (phaseKey === "ovulation" || (ovulationStart && ovulationEnd && isWithinInterval(today, { start: ovulationStart, end: ovulationEnd }))) {
      pregnancyProb = "High";
    }
  }

  const phase = PHASE_INFO[phaseKey];

  const handleSave = () => {
    const entry: CycleLog = { id: Date.now().toString(), ...form, cycleLength: parseInt(form.cycleLength) };
    setCycleLogs([entry, ...cycleLogs]);
    setOpen(false);
    setForm({ periodStart: "", periodEnd: "", cycleLength: "28", symptoms: [], notes: "", flow: "medium", mood: "" });
  };

  const toggleSymptom = (s: string) => {
    setForm(f => ({ ...f, symptoms: f.symptoms.includes(s) ? f.symptoms.filter(x => x !== s) : [...f.symptoms, s] }));
  };

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const getDayClass = (day: Date) => {
    if (!lastCycle) return "";
    const ps = parseISO(lastCycle.periodStart);
    const pe = lastCycle.periodEnd ? parseISO(lastCycle.periodEnd) : addDays(ps, 4);
    if (isWithinInterval(day, { start: ps, end: pe })) return "bg-rose-400 text-white rounded-full";
    if (ovulationStart && ovulationEnd && isWithinInterval(day, { start: ovulationStart, end: ovulationEnd })) return "bg-amber-400 text-white rounded-full";
    if (nextPeriod && isSameDay(day, nextPeriod)) return "bg-rose-200 text-rose-800 rounded-full ring-2 ring-rose-400";
    return "";
  };

  const TABS = [
    { id: "tracker", label: "Tracker", icon: Droplets },
    { id: "guide", label: "Phase Guide", icon: Zap },
    { id: "passport", label: "Passport", icon: Stamp },
  ] as const;

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif text-foreground">Cycle Tracker</h1>
            <p className="text-muted-foreground mt-1">Know your body, love yourself.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90" data-testid="button-log-period">
                <Plus className="w-4 h-4 mr-1" /> Log Period
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-serif text-xl">Log Your Cycle</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Period Start</Label>
                    <Input type="date" value={form.periodStart} onChange={e => setForm(f => ({ ...f, periodStart: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Period End</Label>
                    <Input type="date" value={form.periodEnd} onChange={e => setForm(f => ({ ...f, periodEnd: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>Average Cycle Length (days)</Label>
                  <Input type="number" value={form.cycleLength} onChange={e => setForm(f => ({ ...f, cycleLength: e.target.value }))} min="21" max="35" />
                </div>
                <div>
                  <Label className="mb-2 block">Flow</Label>
                  <div className="flex gap-2">
                    {FLOW_OPTIONS.map(fo => (
                      <button key={fo.value} onClick={() => setForm(f => ({ ...f, flow: fo.value as CycleLog["flow"] }))}
                        className={cn("flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-all", form.flow === fo.value ? "border-primary bg-primary/10" : "border-border")}>
                        <span className={cn("w-3 h-3 rounded-full inline-block mr-1.5", fo.color)} />{fo.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">Mood</Label>
                  <div className="flex flex-wrap gap-2">
                    {MOODS.map(m => (
                      <button key={m} onClick={() => setForm(f => ({ ...f, mood: f.mood === m ? "" : m }))}
                        className={cn("px-3 py-1 rounded-full text-xs border transition-all", form.mood === m ? "bg-primary text-white border-primary" : "border-border")}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">Symptoms</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {SYMPTOMS.map(s => (
                      <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={form.symptoms.includes(s)} onCheckedChange={() => toggleSymptom(s)} />
                        {s}
                      </label>
                    ))}
                  </div>
                </div>
                <Button onClick={handleSave} className="w-full bg-primary" disabled={!form.periodStart}>Save Cycle</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-2xl">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-sm font-medium transition-all",
              activeTab === tab.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}>
            <tab.icon className="w-4 h-4" />{tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "tracker" && (
          <motion.div key="tracker" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-6">
            {/* Phase banner */}
            {lastCycle && (
              <motion.div className={cn("p-5 rounded-2xl border", phase.bg, phase.borderColor)}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">{phase.emoji}</span>
                  <div>
                    <p className={cn("font-semibold text-lg", phase.textColor)}>{phase.name}</p>
                    <p className="text-muted-foreground text-sm">{phase.tagline}</p>
                  </div>
                  {cycleDay && <Badge variant="outline" className="ml-auto">{`Day ${cycleDay}`}</Badge>}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Zap className={cn("w-4 h-4", phase.textColor)} />
                  <p className={cn("text-sm", phase.textColor)}>{phase.energy}</p>
                </div>
              </motion.div>
            )}

            {lastCycle ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Cycle Day", value: cycleDay ? `Day ${cycleDay}` : "—", icon: <Droplets className="w-5 h-5 text-rose-500" />, sub: phase.name, subColor: phase.textColor },
                  { label: "Next Period", value: nextPeriod ? format(nextPeriod, "MMM d") : "—", icon: <Activity className="w-5 h-5 text-violet-500" />, sub: nextPeriod ? `In ${Math.max(0, differenceInDays(nextPeriod, today))} days` : "" },
                  { label: "Ovulation Window", value: ovulationStart ? `${format(ovulationStart, "MMM d")} – ${format(ovulationEnd!, "MMM d")}` : "—", icon: <Flower className="w-5 h-5 text-amber-500" />, sub: "Fertile window" },
                  { label: "Pregnancy Chance", value: pregnancyProb, icon: <Heart className="w-5 h-5 text-pink-500" />, sub: "Based on cycle phase" },
                ].map((item) => (
                  <motion.div key={item.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                    <Card className="border-border/50 shadow-sm">
                      <CardContent className="pt-5">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-xl bg-muted/50">{item.icon}</div>
                          <div>
                            <p className="text-xs text-muted-foreground">{item.label}</p>
                            <p className="font-semibold text-lg">{item.value}</p>
                            <p className={`text-xs ${item.subColor || "text-muted-foreground"}`}>{item.sub}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <Card className="border-dashed border-2 border-border text-center py-12">
                <CardContent>
                  <Droplets className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Log your first period to start tracking</p>
                </CardContent>
              </Card>
            )}

            {/* Calendar */}
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-serif text-lg">Cycle Calendar</CardTitle>
                  <div className="flex gap-2">
                    <Button size="icon" variant="ghost" onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm font-medium self-center min-w-[100px] text-center">{format(currentMonth, "MMMM yyyy")}</span>
                    <Button size="icon" variant="ghost" onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
                    <div key={d} className="text-xs text-muted-foreground font-medium py-1">{d}</div>
                  ))}
                  {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => <div key={`e${i}`} />)}
                  {days.map(day => (
                    <div key={day.toISOString()} className={cn("w-8 h-8 flex items-center justify-center text-sm mx-auto cursor-default transition-all", getDayClass(day), isSameDay(day, today) && !getDayClass(day) && "ring-1 ring-primary rounded-full")}>
                      {format(day, "d")}
                    </div>
                  ))}
                </div>
                <div className="flex gap-4 mt-4 text-xs text-muted-foreground justify-center flex-wrap">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-rose-400 inline-block" /> Period</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> Ovulation</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-rose-200 ring-1 ring-rose-400 inline-block" /> Next Period</span>
                </div>
              </CardContent>
            </Card>

            {/* Cycle history */}
            {cycleLogs.length > 0 && (
              <div>
                <h2 className="text-xl font-serif mb-3">Cycle History</h2>
                <div className="space-y-2">
                  {cycleLogs.map(log => (
                    <Card key={log.id} className="border-border/50">
                      <CardContent className="pt-4 pb-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{format(parseISO(log.periodStart), "MMM d, yyyy")}</p>
                          <p className="text-xs text-muted-foreground">
                            Cycle: {log.cycleLength} days
                            {log.flow && ` · ${log.flow} flow`}
                            {log.mood && ` · ${log.mood}`}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1 justify-end">
                          {log.symptoms.slice(0, 3).map(s => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}
                          {log.symptoms.length > 3 && <Badge variant="outline" className="text-xs">+{log.symptoms.length - 3}</Badge>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "guide" && (
          <motion.div key="guide" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-5">
            {Object.entries(PHASE_INFO).map(([key, info]) => (
              <Card key={key} className={cn("border", phaseKey === key && info.borderColor, phaseKey === key && info.bg)}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{info.emoji}</span>
                    <div>
                      <CardTitle className={cn("font-serif text-lg", phaseKey === key && info.textColor)}>{info.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{info.tagline}</p>
                    </div>
                    {phaseKey === key && <Badge className="ml-auto bg-primary/90 text-white">You are here</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1 mb-2"><Salad className="w-3 h-3" /> Nourish</p>
                      <ul className="space-y-1">
                        {info.food.map(f => <li key={f} className="text-xs text-foreground">{f}</li>)}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1 mb-2"><Dumbbell className="w-3 h-3" /> Move</p>
                      <ul className="space-y-1">
                        {info.movement.map(m => <li key={m} className="text-xs text-foreground">{m}</li>)}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1 mb-2"><Heart className="w-3 h-3" /> Care</p>
                      <ul className="space-y-1">
                        {info.selfCare.map(s => <li key={s} className="text-xs text-foreground">{s}</li>)}
                      </ul>
                    </div>
                  </div>
                  <a href={info.videoUrl} target="_blank" rel="noopener noreferrer"
                    className={cn("flex items-center gap-2 text-xs px-3 py-2 rounded-xl border transition-all hover:opacity-80 w-fit", info.textColor, info.borderColor, info.bg)}>
                    <Video className="w-3.5 h-3.5" /> Watch: {info.videoTitle}
                  </a>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        )}

        {activeTab === "passport" && (
          <motion.div key="passport" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-5">
            <div className="text-center py-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rose-400 to-pink-600 flex items-center justify-center mx-auto mb-3 shadow-lg">
                <Stamp className="w-10 h-10 text-white" />
              </div>
              <h2 className="font-serif text-2xl text-foreground">Period Passport</h2>
              <p className="text-muted-foreground text-sm mt-1">Every cycle is a journey. Collect your stamps.</p>
              <div className="flex items-center justify-center gap-4 mt-4">
                <div className="text-center">
                  <p className="font-bold text-2xl text-primary">{cycleLogs.length}</p>
                  <p className="text-xs text-muted-foreground">Cycles logged</p>
                </div>
                <div className="w-px h-10 bg-border" />
                <div className="text-center">
                  <p className="font-bold text-2xl text-amber-500">{Math.floor(cycleLogs.length / 3)}</p>
                  <p className="text-xs text-muted-foreground">Quarterly stamps</p>
                </div>
                <div className="w-px h-10 bg-border" />
                <div className="text-center">
                  <p className="font-bold text-2xl text-emerald-500">{Math.floor(cycleLogs.length / 12)}</p>
                  <p className="text-xs text-muted-foreground">Annual badges</p>
                </div>
              </div>
            </div>

            {cycleLogs.length > 0 ? (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {cycleLogs.map((log, i) => {
                  const phaseK = log.periodStart ? getPhaseKey(1) : "menstrual";
                  const pInfo = PHASE_INFO[phaseK];
                  const isSpecial = (i + 1) % 12 === 0;
                  const isQuarterly = (i + 1) % 3 === 0;
                  return (
                    <motion.div key={log.id} initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: i * 0.05 }}
                      className="aspect-square rounded-2xl flex flex-col items-center justify-center p-2 bg-gradient-to-br from-rose-100 to-pink-200 border-2 border-rose-300 shadow-sm relative overflow-hidden">
                      {isSpecial && <div className="absolute top-1 right-1 text-amber-500 text-xs">🏅</div>}
                      {isQuarterly && !isSpecial && <div className="absolute top-1 right-1 text-xs">⭐</div>}
                      <span className="text-2xl">{pInfo.emoji}</span>
                      <p className="text-xs font-bold text-rose-700 mt-1">#{i + 1}</p>
                      <p className="text-xs text-rose-600">{format(parseISO(log.periodStart), "MMM yy")}</p>
                    </motion.div>
                  );
                })}
                {/* Empty slots */}
                {Array.from({ length: Math.max(0, 12 - cycleLogs.length) }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square rounded-2xl border-2 border-dashed border-border flex items-center justify-center">
                    <p className="text-muted-foreground text-lg">+</p>
                  </div>
                ))}
              </div>
            ) : (
              <Card className="border-dashed border-2 border-border text-center py-10">
                <CardContent>
                  <Stamp className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">Log your first period to earn your first stamp</p>
                </CardContent>
              </Card>
            )}

            <Card className="border-rose-200 bg-rose-50/50">
              <CardContent className="pt-4 pb-4">
                <h3 className="font-serif text-base font-semibold mb-2 text-rose-700">Passport Milestones</h3>
                <div className="space-y-2">
                  {[
                    { label: "First Stamp", need: 1, emoji: "🌹", desc: "Log your first cycle" },
                    { label: "3-Month Streak", need: 3, emoji: "⭐", desc: "3 cycles logged" },
                    { label: "Half Year", need: 6, emoji: "🌸", desc: "6 cycles logged" },
                    { label: "Annual Badge", need: 12, emoji: "🏅", desc: "A full year of tracking" },
                    { label: "Cycle Goddess", need: 24, emoji: "👑", desc: "2 years of self-knowledge" },
                  ].map(m => (
                    <div key={m.label} className={cn("flex items-center gap-3 p-2 rounded-xl", cycleLogs.length >= m.need ? "bg-rose-100" : "opacity-50")}>
                      <span className="text-xl">{m.emoji}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{m.label}</p>
                        <p className="text-xs text-muted-foreground">{m.desc}</p>
                      </div>
                      {cycleLogs.length >= m.need ? (
                        <Badge className="bg-rose-500 text-white text-xs">Earned</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">{m.need - cycleLogs.length} to go</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
