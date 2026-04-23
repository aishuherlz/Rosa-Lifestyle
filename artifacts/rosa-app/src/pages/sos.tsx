import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Wind, Flame, Pill, Phone, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

const RELIEF_TIPS = [
  { icon: Flame, color: "rose", title: "Heat is your best friend", tip: "Heating pad or hot water bottle on lower abdomen — 15 min. Increases blood flow, relaxes muscles. Warm bath with epsom salts works too 🛁" },
  { icon: Pill, color: "amber", title: "Magnesium + Ibuprofen combo", tip: "200-400mg magnesium glycinate eases cramps in 30 min. Pair with ibuprofen (taken WITH food) for stacked relief. Skip aspirin — increases flow." },
  { icon: Heart, color: "pink", title: "Position: child's pose", tip: "Knees wide, big toes touching, forehead on floor, arms stretched forward. Hold 2 min. Releases pelvic tension and lower back." },
  { icon: Wind, color: "violet", title: "4-7-8 breath × 4 rounds", tip: "Inhale 4 seconds → hold 7 → exhale 8. Activates parasympathetic system, reduces pain perception by up to 30%." },
];

const FOOD_FIXES = [
  { emoji: "🍫", name: "Dark chocolate (70%+)", why: "Magnesium + endorphins" },
  { emoji: "🍌", name: "Banana", why: "Potassium + B6 for cramps" },
  { emoji: "🍵", name: "Ginger or peppermint tea", why: "Anti-inflammatory" },
  { emoji: "🐟", name: "Salmon / walnuts", why: "Omega-3s reduce prostaglandins" },
  { emoji: "🥬", name: "Leafy greens", why: "Iron replenishment" },
  { emoji: "💧", name: "Water + electrolytes", why: "Bloating relief" },
];

const AVOID = ["☕ Caffeine (worsens cramps)", "🍷 Alcohol (dehydrates)", "🧂 Salty processed food (bloats)", "🍩 Refined sugar (inflames)"];

export default function SOSPage() {
  const [breathing, setBreathing] = useState(false);
  const [breathPhase, setBreathPhase] = useState<"in" | "hold" | "out">("in");
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!breathing) return;
    const cycle = [{ p: "in" as const, ms: 4000 }, { p: "hold" as const, ms: 7000 }, { p: "out" as const, ms: 8000 }];
    let i = 0; setBreathPhase(cycle[0].p);
    let t: any;
    const tick = () => {
      i = (i + 1) % cycle.length;
      setBreathPhase(cycle[i].p);
      if (i === 0) setRound(r => r + 1);
      t = setTimeout(tick, cycle[i].ms);
    };
    t = setTimeout(tick, cycle[0].ms);
    return () => clearTimeout(t);
  }, [breathing]);

  return (
    <div className="min-h-full bg-gradient-to-br from-rose-50 via-pink-50 to-amber-50 p-4 md:p-8 pb-24">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/period"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button></Link>
          <span className="text-xs uppercase tracking-widest text-rose-600">Period SOS 🌹</span>
        </div>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <h1 className="text-4xl font-serif text-rose-900">Breathe, sister.</h1>
          <p className="text-rose-700 mt-2">You're going to be okay. Let's ease this together.</p>
        </motion.div>

        <Card className="border-rose-300 bg-white/70 backdrop-blur shadow-lg">
          <CardContent className="pt-6 flex flex-col items-center gap-4 pb-6">
            <motion.div
              animate={{ scale: breathing ? (breathPhase === "out" ? 1 : 1.5) : 1 }}
              transition={{ duration: breathing ? (breathPhase === "in" ? 4 : breathPhase === "hold" ? 0.3 : 8) : 0.5, ease: "easeInOut" }}
              className="w-40 h-40 rounded-full bg-gradient-to-br from-rose-300 to-pink-400 shadow-lg flex items-center justify-center text-white font-serif text-xl"
              data-testid="sos-breath"
            >
              {breathing ? (breathPhase === "in" ? "Breathe in" : breathPhase === "hold" ? "Hold" : "Breathe out") : "Tap to breathe"}
            </motion.div>
            <Button onClick={() => { setBreathing(b => !b); if (breathing) setRound(0); }}
              className={breathing ? "bg-rose-100 text-rose-700 hover:bg-rose-200" : "bg-rose-500 hover:bg-rose-600 text-white"}>
              {breathing ? `Stop · Round ${round}` : "Start 4-7-8 breath"}
            </Button>
          </CardContent>
        </Card>

        <div className="grid sm:grid-cols-2 gap-3">
          {RELIEF_TIPS.map((t, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="border-border/50 bg-white/70 backdrop-blur h-full">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-full bg-${t.color}-100 flex items-center justify-center shrink-0`}>
                      <t.icon className={`w-5 h-5 text-${t.color}-600`} />
                    </div>
                    <div>
                      <p className="font-serif text-base text-foreground">{t.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">{t.tip}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Card className="bg-white/70 backdrop-blur">
          <CardContent className="pt-5">
            <p className="font-serif text-lg text-foreground mb-3">🌹 Eat this</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FOOD_FIXES.map(f => (
                <div key={f.name} className="text-center p-2 rounded-xl bg-rose-50/60">
                  <div className="text-2xl">{f.emoji}</div>
                  <p className="text-xs font-medium mt-1">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{f.why}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-50/70 border-amber-200 backdrop-blur">
          <CardContent className="pt-5">
            <p className="font-serif text-lg text-amber-900 mb-2">⚠️ Avoid right now</p>
            <ul className="text-sm text-amber-800 space-y-1">
              {AVOID.map(a => <li key={a}>• {a}</li>)}
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-rose-100/80 border-rose-300 backdrop-blur">
          <CardContent className="pt-5 text-center">
            <Phone className="w-6 h-6 text-rose-600 mx-auto mb-2" />
            <p className="font-serif text-rose-900">Pain is severe or doesn't ease?</p>
            <p className="text-xs text-muted-foreground mt-1">Pain rated 7+/10, fever, fainting, or unusual bleeding — please call your doctor or local emergency line.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
