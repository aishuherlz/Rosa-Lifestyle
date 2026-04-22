import { useState } from "react";
import { motion } from "framer-motion";
import { format, addDays, differenceInDays, parseISO, isWithinInterval, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { Plus, Droplets, Activity, Heart, Flower, ChevronLeft, ChevronRight } from "lucide-react";
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
};

const SYMPTOMS = ["Cramps", "Bloating", "Headache", "Fatigue", "Mood swings", "Back pain", "Tender breasts", "Nausea", "Acne", "Food cravings"];

const PERIOD_SUGGESTIONS = [
  { icon: "🍫", title: "Comfort foods", desc: "Dark chocolate, warm soups, bananas, oats" },
  { icon: "🧘", title: "Gentle movement", desc: "Restorative yoga, short walks, light stretching" },
  { icon: "🛁", title: "Self care", desc: "Warm bath, heating pad, cozy blanket time" },
  { icon: "💊", title: "Helpful tips", desc: "Stay hydrated, magnesium supplements, chamomile tea" },
];

export default function PeriodPage() {
  const [cycleLogs, setCycleLogs] = useLocalStorage<CycleLog[]>("rosa_cycle_logs", []);
  const [open, setOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [form, setForm] = useState({ periodStart: "", periodEnd: "", cycleLength: "28", symptoms: [] as string[], notes: "" });

  const lastCycle = cycleLogs[0];
  const today = new Date();

  let cycleDay: number | null = null;
  let phase: string = "";
  let phaseColor: string = "";
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

    if (cycleDay >= 1 && cycleDay <= 5) { phase = "Menstrual Phase"; phaseColor = "text-rose-600"; }
    else if (cycleDay >= 6 && cycleDay <= 13) { phase = "Follicular Phase"; phaseColor = "text-emerald-600"; }
    else if (cycleDay >= 14 && cycleDay <= 17) { phase = "Ovulation Phase"; phaseColor = "text-amber-600"; pregnancyProb = "High"; }
    else { phase = "Luteal Phase"; phaseColor = "text-violet-600"; pregnancyProb = "Very Low"; }

    if (isWithinInterval(today, { start: ovulationStart, end: ovulationEnd })) {
      pregnancyProb = "High";
    }
  }

  const handleSave = () => {
    const entry: CycleLog = { id: Date.now().toString(), ...form, cycleLength: parseInt(form.cycleLength) };
    setCycleLogs([entry, ...cycleLogs]);
    setOpen(false);
    setForm({ periodStart: "", periodEnd: "", cycleLength: "28", symptoms: [], notes: "" });
  };

  const toggleSymptom = (s: string) => {
    setForm(f => ({ ...f, symptoms: f.symptoms.includes(s) ? f.symptoms.filter(x => x !== s) : [...f.symptoms, s] }));
  };

  // Calendar
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
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle className="font-serif text-xl">Log Your Cycle</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Period Start</Label>
                    <Input type="date" value={form.periodStart} onChange={e => setForm(f => ({ ...f, periodStart: e.target.value }))} data-testid="input-period-start" />
                  </div>
                  <div>
                    <Label>Period End</Label>
                    <Input type="date" value={form.periodEnd} onChange={e => setForm(f => ({ ...f, periodEnd: e.target.value }))} data-testid="input-period-end" />
                  </div>
                </div>
                <div>
                  <Label>Average Cycle Length (days)</Label>
                  <Input type="number" value={form.cycleLength} onChange={e => setForm(f => ({ ...f, cycleLength: e.target.value }))} min="21" max="35" />
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
                <Button onClick={handleSave} className="w-full bg-primary" disabled={!form.periodStart} data-testid="button-save-cycle">Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {lastCycle ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Cycle Day", value: cycleDay ? `Day ${cycleDay}` : "—", icon: <Droplets className="w-5 h-5 text-rose-500" />, sub: phase, subColor: phaseColor },
            { label: "Next Period", value: nextPeriod ? format(nextPeriod, "MMM d") : "—", icon: <Activity className="w-5 h-5 text-violet-500" />, sub: nextPeriod ? `In ${differenceInDays(nextPeriod, today)} days` : "" },
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

      {lastCycle && (
        <div>
          <h2 className="text-xl font-serif mb-3">Period Day Suggestions</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {PERIOD_SUGGESTIONS.map(s => (
              <Card key={s.title} className="border-border/50 shadow-sm">
                <CardContent className="pt-4 flex items-start gap-3">
                  <span className="text-2xl">{s.icon}</span>
                  <div>
                    <p className="font-medium text-sm">{s.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {cycleLogs.length > 0 && (
        <div>
          <h2 className="text-xl font-serif mb-3">Cycle History</h2>
          <div className="space-y-2">
            {cycleLogs.map(log => (
              <Card key={log.id} className="border-border/50">
                <CardContent className="pt-4 pb-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{format(parseISO(log.periodStart), "MMM d, yyyy")}</p>
                    <p className="text-xs text-muted-foreground">Cycle: {log.cycleLength} days</p>
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
    </div>
  );
}
