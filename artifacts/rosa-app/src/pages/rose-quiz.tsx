import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Share2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/lib/user-context";

type Archetype = { id: string; name: string; emoji: string; color: string; desc: string; vibe: string };

const ARCHETYPES: Record<string, Archetype> = {
  red: { id: "red", name: "The Red Rose", emoji: "🌹", color: "from-rose-500 to-red-400", desc: "Bold, magnetic, unapologetically yourself. You walk into rooms and shift the energy.", vibe: "Confidence · passion · leadership" },
  pink: { id: "pink", name: "The Pink Rose", emoji: "🌸", color: "from-pink-400 to-rose-300", desc: "Soft strength. You make everyone feel seen, held, loved. Your gentleness is gravity.", vibe: "Empathy · grace · nurturing" },
  white: { id: "white", name: "The White Rose", emoji: "🤍", color: "from-slate-200 to-rose-100", desc: "Pure clarity. Calm waters. You think deeply and choose your moves with intention.", vibe: "Wisdom · peace · poise" },
  gold: { id: "gold", name: "The Golden Rose", emoji: "✨", color: "from-amber-400 to-yellow-300", desc: "Sun in human form. Ambitious, glowing, manifesting. You attract abundance because you ARE abundance.", vibe: "Ambition · radiance · luxury" },
  purple: { id: "purple", name: "The Purple Rose", emoji: "💜", color: "from-violet-500 to-fuchsia-400", desc: "Mystical, intuitive, deep. You see what others miss. Your energy is magnetic and a little untouchable.", vibe: "Intuition · depth · mystery" },
  black: { id: "black", name: "The Black Rose", emoji: "🖤", color: "from-zinc-700 to-rose-900", desc: "Edge with elegance. You've been through fire and turned it into art. Powerful, magnetic, unforgettable.", vibe: "Resilience · edge · transformation" },
};

const QUESTIONS = [
  { q: "How do you walk into a party?", options: [
    { text: "Confidently — owning the room", points: { red: 3, gold: 2 } },
    { text: "Quietly observe first, then connect 1-on-1", options: { white: 3, purple: 2 } },
    { text: "Hugging everyone, lighting up the room", points: { pink: 3, gold: 2 } },
    { text: "Mysterious entrance, sit in the corner with intent", points: { black: 3, purple: 2 } },
  ]},
  { q: "Your dream Sunday is…", options: [
    { text: "Brunch + outfit shoot + cocktails", points: { red: 2, gold: 3 } },
    { text: "Reading by candlelight with tea", points: { white: 3, purple: 2 } },
    { text: "Cooking for everyone you love", points: { pink: 3, white: 1 } },
    { text: "Solo dance party in all black", points: { black: 3, red: 1 } },
  ]},
  { q: "Pick a scent", options: [
    { text: "Rose + oud — bold and warm", points: { red: 3, black: 2 } },
    { text: "Vanilla + amber — cozy and cuddly", points: { pink: 3, white: 1 } },
    { text: "Jasmine + sea salt — fresh and ethereal", points: { white: 3, gold: 1 } },
    { text: "Patchouli + leather — moody and rich", points: { black: 2, purple: 3 } },
  ]},
  { q: "When you fall in love, you…", options: [
    { text: "Go all in, all flames, all poetry", points: { red: 3, purple: 1 } },
    { text: "Build a soft little world together", points: { pink: 3, white: 1 } },
    { text: "Take it slow, study them like a book", points: { white: 2, purple: 3 } },
    { text: "Show with actions; words feel cheap", points: { black: 3, gold: 1 } },
  ]},
  { q: "Your shadow is…", options: [
    { text: "Burning bridges in a fit of passion", points: { red: 3, black: 1 } },
    { text: "Saying yes when you mean no", points: { pink: 3, white: 1 } },
    { text: "Disappearing when overwhelmed", points: { white: 2, purple: 3 } },
    { text: "Chasing perfection until you break", points: { gold: 3, white: 1 } },
  ]},
];

export default function RoseQuizPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [done, setDone] = useState<Archetype | null>(null);

  function answer(opt: any) {
    const next = { ...scores };
    const pts = opt.points || opt.options || {};
    Object.keys(pts).forEach(k => { next[k] = (next[k] || 0) + pts[k]; });
    setScores(next);
    if (step + 1 >= QUESTIONS.length) {
      const winner = Object.entries(next).sort((a, b) => b[1] - a[1])[0]?.[0] || "pink";
      setDone(ARCHETYPES[winner]);
    } else {
      setStep(step + 1);
    }
  }

  function reset() { setStep(0); setScores({}); setDone(null); }

  async function share() {
    if (!done) return;
    const text = `I'm ${done.name} ${done.emoji}\n\n${done.desc}\n\nWhat rose are you? Take the quiz on ROSA 🌹`;
    if (navigator.share) {
      try { await navigator.share({ title: "What rose am I?", text }); return; } catch {}
    }
    await navigator.clipboard.writeText(text);
    toast({ title: "Copied 🌹", description: "Share it on TikTok or IG story" });
  }

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6 max-w-2xl mx-auto pb-24">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-serif text-foreground flex items-center gap-2">
          <Sparkles className="w-7 h-7 text-rose-500" /> What Rose Are You?
        </h1>
        <p className="text-muted-foreground mt-1">5 quick questions · share your archetype</p>
      </motion.div>

      <AnimatePresence mode="wait">
        {!done && (
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Question {step + 1} of {QUESTIONS.length}</span>
                  <span>🌹</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div className="h-full bg-rose-500" initial={{ width: 0 }} animate={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }} />
                </div>
                <p className="font-serif text-xl text-foreground pt-2">{QUESTIONS[step].q}</p>
                <div className="grid gap-2">
                  {QUESTIONS[step].options.map((o, i) => (
                    <button key={i} onClick={() => answer(o)}
                      className="text-left p-4 rounded-2xl border border-border hover:border-rose-300 hover:bg-rose-50/40 transition-all"
                      data-testid={`answer-${step}-${i}`}>
                      {o.text}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {done && (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
            <Card className={`bg-gradient-to-br ${done.color} text-white border-0 shadow-2xl rounded-3xl overflow-hidden`}>
              <CardContent className="pt-8 pb-8 text-center space-y-3">
                <div className="text-7xl">{done.emoji}</div>
                <p className="text-xs uppercase tracking-widest opacity-90">{user?.name || "You"} are…</p>
                <h2 className="font-serif text-4xl">{done.name}</h2>
                <p className="text-base opacity-95 max-w-md mx-auto leading-relaxed">{done.desc}</p>
                <p className="text-sm uppercase tracking-widest opacity-80 pt-2">{done.vibe}</p>
              </CardContent>
            </Card>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={reset}><RefreshCw className="w-4 h-4 mr-1" /> Retake</Button>
              <Button onClick={share} className="bg-rose-500 hover:bg-rose-600 text-white"><Share2 className="w-4 h-4 mr-1" /> Share</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
