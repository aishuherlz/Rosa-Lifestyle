import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Plus, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { format, subDays, parseISO } from "date-fns";

type SkinLog = {
  date: string;
  condition: string[];
  notes: string;
  cyclePhase?: string;
};

const CONDITIONS = ["✨ Glowing", "😊 Clear", "🌸 Normal", "💧 Dry", "🛢 Oily", "😤 Breakout", "🔴 Redness", "😴 Dull", "💢 Hormonal acne", "🌿 Sensitive"];

const PHASE_TIPS: Record<string, { skin: string; products: string[] }> = {
  menstruation: {
    skin: "Your skin may be more sensitive and prone to dryness. Focus on gentle, hydrating products.",
    products: ["Hyaluronic acid serum", "Gentle cleanser", "Rich moisturizer", "SPF 30+"],
  },
  follicular: {
    skin: "Estrogen rises — skin starts glowing! Great time for antioxidant serums.",
    products: ["Vitamin C serum", "Light moisturizer", "Exfoliant (mild)", "SPF 30+"],
  },
  ovulation: {
    skin: "Peak glow! Skin looks its best. Maintain your routine.",
    products: ["Niacinamide serum", "Lightweight moisturizer", "SPF 50+"],
  },
  luteal: {
    skin: "Progesterone can increase oil production. Breakouts may appear around the chin and jaw.",
    products: ["Salicylic acid cleanser", "Oil-control moisturizer", "Spot treatment", "Clay mask (1x/week)"],
  },
};

export default function SkinPage() {
  const [logs, setLogs] = useLocalStorage<SkinLog[]>("rosa_skin", []);
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const today = format(new Date(), "yyyy-MM-dd");
  const hasLoggedToday = logs.some((l) => l.date === today);

  const logToday = () => {
    if (selected.length === 0) return;
    const entry: SkinLog = { date: today, condition: selected, notes };
    setLogs([entry, ...logs.filter((l) => l.date !== today)]);
    setSelected([]);
    setNotes("");
  };

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = format(subDays(new Date(), i), "yyyy-MM-dd");
    return logs.find((l) => l.date === d) || null;
  }).reverse();

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6 max-w-2xl pb-24">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-serif text-foreground flex items-center gap-2">
          <Sparkles className="w-7 h-7 text-primary" /> Skin Tracker
        </h1>
        <p className="text-muted-foreground mt-1">Track your skin through your cycle.</p>
      </motion.div>

      {/* Today's Log */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-lg">How's your skin today?</CardTitle>
          <p className="text-xs text-muted-foreground">{format(new Date(), "EEEE, MMMM do")}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {CONDITIONS.map((c) => (
              <button
                key={c}
                onClick={() => setSelected((p) => p.includes(c) ? p.filter((x) => x !== c) : [...p, c])}
                className={`px-3 py-1.5 rounded-full text-sm border transition-all ${selected.includes(c) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary"}`}
              >
                {c}
              </button>
            ))}
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes? (products used, diet, stress...)"
            className="w-full text-sm border border-border rounded-xl px-3 py-2 resize-none h-20 focus:outline-none focus:border-primary/50 bg-background"
          />
          <Button onClick={logToday} disabled={selected.length === 0} className="bg-primary hover:bg-primary/90">
            {hasLoggedToday ? "Update Today's Log" : "Save Skin Log"}
          </Button>
        </CardContent>
      </Card>

      {/* 7-Day View */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-base flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" /> Last 7 Days
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1">
            {last7.map((log, i) => {
              const d = format(subDays(new Date(), 6 - i), "EEE");
              const hasLog = log !== null;
              const isGlowing = log?.condition.some((c) => c.includes("Glow") || c.includes("Clear"));
              return (
                <div key={i} className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">{d}</p>
                  <div className={`w-8 h-8 rounded-full mx-auto flex items-center justify-center text-sm ${hasLog ? (isGlowing ? "bg-amber-100 text-amber-600" : "bg-primary/10 text-primary") : "bg-muted text-muted-foreground"}`}>
                    {hasLog ? (isGlowing ? "✨" : "🌸") : "·"}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Cycle Phase Tips */}
      <Card className="border-border/50 bg-rose-50/40">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-base">✨ Skin by Cycle Phase</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(PHASE_TIPS).map(([phase, tips]) => (
            <div key={phase} className="border-b border-border/30 last:border-0 pb-3 last:pb-0">
              <p className="font-medium text-sm capitalize mb-1">{phase} phase</p>
              <p className="text-xs text-muted-foreground mb-2">{tips.skin}</p>
              <div className="flex flex-wrap gap-1">
                {tips.products.map((p) => (
                  <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* History */}
      {logs.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">History</p>
          <div className="space-y-2">
            {logs.slice(0, 10).map((log) => (
              <Card key={log.date} className="border-border/40">
                <CardContent className="pt-3 pb-3">
                  <div className="flex justify-between items-start">
                    <p className="text-xs text-muted-foreground">{format(parseISO(log.date + "T00:00:00"), "MMM do")}</p>
                    <div className="flex flex-wrap gap-1 justify-end max-w-[70%]">
                      {log.condition.map((c) => <Badge key={c} variant="outline" className="text-xs">{c}</Badge>)}
                    </div>
                  </div>
                  {log.notes && <p className="text-xs text-muted-foreground mt-1 italic">{log.notes}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
