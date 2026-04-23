import { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Share2, RefreshCw, Sparkles } from "lucide-react";
import { useUser } from "@/lib/user-context";
import { useToast } from "@/hooks/use-toast";

const AFFIRMATIONS = [
  { text: "You are the entire ocean in a drop.", author: "Rumi", color: "from-rose-400 to-pink-300" },
  { text: "She believed she could, so she did.", author: "R.S. Grey", color: "from-amber-400 to-rose-300" },
  { text: "You are allowed to be both a masterpiece and a work in progress.", author: "Sophia Bush", color: "from-violet-400 to-pink-300" },
  { text: "Your softness is not your weakness — it's your superpower.", author: "ROSA", color: "from-pink-400 to-rose-300" },
  { text: "Bloom where you are planted, but also know when to transplant yourself.", author: "ROSA", color: "from-emerald-400 to-rose-300" },
  { text: "You don't have to set yourself on fire to keep others warm.", author: "Penny Reid", color: "from-orange-400 to-rose-300" },
  { text: "The best revenge is to live a soft, beautiful, peaceful life.", author: "ROSA", color: "from-rose-500 to-amber-300" },
  { text: "You are not behind in life. You are exactly where you need to be.", author: "ROSA", color: "from-sky-400 to-violet-300" },
  { text: "Trust yourself. You've survived 100% of your worst days.", author: "ROSA", color: "from-rose-400 to-purple-300" },
  { text: "Romanticise your morning. Romanticise your tea. Romanticise your existence.", author: "ROSA", color: "from-amber-300 to-pink-400" },
  { text: "Boundaries are the distance at which I can love you and me simultaneously.", author: "Prentis Hemphill", color: "from-violet-500 to-pink-300" },
  { text: "She is fierce, she is graceful, she is everything in between.", author: "ROSA", color: "from-rose-500 to-violet-400" },
  { text: "Your only job today is to take soft care of yourself.", author: "ROSA", color: "from-pink-300 to-amber-200" },
  { text: "You are someone's answered prayer.", author: "ROSA", color: "from-rose-400 to-emerald-300" },
  { text: "Let her be soft. Let her be loud. Let her be everything she wants to be.", author: "ROSA", color: "from-fuchsia-400 to-rose-300" },
];

function dailyIndex() {
  const d = new Date();
  const seed = d.getFullYear() * 1000 + d.getMonth() * 31 + d.getDate();
  return seed % AFFIRMATIONS.length;
}

export default function AffirmationPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [index, setIndex] = useState(dailyIndex());
  const [direction, setDirection] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const a = AFFIRMATIONS[index];

  const swipe = (dir: number) => {
    setDirection(dir);
    setIndex((i) => (i + dir + AFFIRMATIONS.length) % AFFIRMATIONS.length);
  };

  const onDrag = (_: any, info: PanInfo) => {
    if (info.offset.x < -80) swipe(1);
    else if (info.offset.x > 80) swipe(-1);
  };

  const share = async () => {
    const text = `"${a.text}" — ${a.author}\n\nFrom ROSA 🌹`;
    if (navigator.share) {
      try { await navigator.share({ title: "ROSA Affirmation", text }); return; } catch {}
    }
    await navigator.clipboard.writeText(text);
    toast({ title: "Copied 🌹", description: "Paste it anywhere — IG story, TikTok, WhatsApp." });
  };

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6 max-w-2xl mx-auto pb-24">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-serif text-foreground flex items-center gap-2">
          <Sparkles className="w-7 h-7 text-rose-500" /> Daily Affirmation
        </h1>
        <p className="text-muted-foreground mt-1">Swipe for a new card · share with your sisters 🌹</p>
      </motion.div>

      <div className="relative h-[420px] flex items-center justify-center select-none">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            ref={cardRef}
            key={index}
            custom={direction}
            initial={{ x: direction * 300, opacity: 0, rotate: direction * 8 }}
            animate={{ x: 0, opacity: 1, rotate: 0 }}
            exit={{ x: -direction * 300, opacity: 0, rotate: -direction * 8 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.7}
            onDragEnd={onDrag}
            className="absolute w-full max-w-md cursor-grab active:cursor-grabbing"
            data-testid={`affirmation-card-${index}`}
          >
            <Card className={`bg-gradient-to-br ${a.color} text-white border-0 shadow-2xl rounded-3xl p-8 md:p-10 min-h-[380px] flex flex-col justify-between`}>
              <div className="text-6xl">🌹</div>
              <div className="space-y-4">
                <p className="font-serif text-2xl md:text-3xl leading-snug">"{a.text}"</p>
                <p className="text-sm opacity-90">— {a.author}</p>
              </div>
              <div className="flex items-center justify-between text-xs uppercase tracking-widest opacity-80">
                <span>For {user?.name || "you"}, sister</span>
                <span>ROSA · {new Date().toLocaleDateString()}</span>
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex justify-center gap-3">
        <Button variant="outline" onClick={() => swipe(-1)} data-testid="button-prev"><RefreshCw className="w-4 h-4 mr-1 rotate-180" /> Previous</Button>
        <Button onClick={share} className="bg-rose-500 hover:bg-rose-600 text-white" data-testid="button-share">
          <Share2 className="w-4 h-4 mr-1" /> Share
        </Button>
        <Button variant="outline" onClick={() => swipe(1)} data-testid="button-next">Next <RefreshCw className="w-4 h-4 ml-1" /></Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        <Heart className="w-3 h-3 inline mb-0.5" /> A new card blooms every day at sunrise
      </p>
    </div>
  );
}
