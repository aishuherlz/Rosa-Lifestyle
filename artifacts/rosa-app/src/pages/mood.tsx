import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smile, Frown, Meh, Zap, Cloud, Heart, Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { readCyclePhase, PHASE_MOOD } from "@/lib/sync";
import { Link } from "wouter";
import { PartnerShareToggle } from "@/components/partner-share-toggle";

type MoodEntry = {
  id: string;
  date: string;
  mood: string;
  moodScore: number;
  notes: string;
};

const MOODS = [
  { id: "amazing", label: "Amazing", icon: "✨", color: "from-amber-400 to-yellow-300", textColor: "text-amber-700", score: 5, bg: "bg-amber-50 border-amber-200" },
  { id: "good", label: "Good", icon: "😊", color: "from-emerald-400 to-green-300", textColor: "text-emerald-700", score: 4, bg: "bg-emerald-50 border-emerald-200" },
  { id: "okay", label: "Okay", icon: "😌", color: "from-blue-400 to-sky-300", textColor: "text-blue-700", score: 3, bg: "bg-blue-50 border-blue-200" },
  { id: "low", label: "Low", icon: "😔", color: "from-violet-400 to-purple-300", textColor: "text-violet-700", score: 2, bg: "bg-violet-50 border-violet-200" },
  { id: "sad", label: "Sad", icon: "😢", color: "from-indigo-400 to-blue-300", textColor: "text-indigo-700", score: 1, bg: "bg-indigo-50 border-indigo-200" },
  { id: "anxious", label: "Anxious", icon: "😰", color: "from-rose-400 to-pink-300", textColor: "text-rose-700", score: 1, bg: "bg-rose-50 border-rose-200" },
];

const SUGGESTIONS: Record<string, { activities: string[]; food: string[]; workout: string[] }> = {
  amazing: {
    activities: ["Try something new today", "Call someone you love", "Journal your gratitude"],
    food: ["Celebrate with your favourite meal", "Fresh fruit bowl", "Sparkling water with herbs"],
    workout: ["High-intensity cardio", "Dance workout", "Run outdoors"],
  },
  good: {
    activities: ["Go for a walk", "Read a chapter of your book", "Cook something new"],
    food: ["Balanced meal with veggies", "Smoothie bowl", "Herbal tea"],
    workout: ["Yoga flow", "Pilates", "Brisk walk"],
  },
  okay: {
    activities: ["Take a slow morning", "Light journaling", "Watch something cozy"],
    food: ["Comfort soup", "Warm chamomile tea", "Dark chocolate"],
    workout: ["Gentle stretching", "Short walk", "10-min yoga"],
  },
  low: {
    activities: ["Rest without guilt", "Take a warm bath", "Listen to music"],
    food: ["Warm soup or stew", "Banana for serotonin", "Ginger tea"],
    workout: ["Restorative yoga", "5-min deep breathing", "Light stretching"],
  },
  sad: {
    activities: ["Write how you feel", "Reach out to a friend", "Let yourself cry — it helps"],
    food: ["Foods high in omega-3", "Dark chocolate", "Chamomile or lavender tea"],
    workout: ["Gentle yoga", "Short outdoor walk", "Deep breathing exercises"],
  },
  anxious: {
    activities: ["Box breathing (4-4-4-4)", "Write your worries down", "Ground yourself: 5-4-3-2-1 senses"],
    food: ["Magnesium-rich foods (leafy greens)", "Avoid caffeine", "Warm lemon water"],
    workout: ["Yoga nidra", "Slow walk in nature", "Gentle stretching"],
  },
};

const today = new Date().toISOString().split("T")[0];

export default function MoodPage() {
  const [moodLogs, setMoodLogs] = useLocalStorage<MoodEntry[]>("rosa_mood_logs", []);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [step, setStep] = useState<"select" | "notes" | "done">("select");
  const [showHistory, setShowHistory] = useState(false);

  const todayLog = moodLogs.find((l) => l.date === today);
  const currentMoodData = MOODS.find((m) => m.id === (todayLog?.mood || selectedMood));

  const handleSave = () => {
    const entry: MoodEntry = {
      id: Date.now().toString(),
      date: today,
      mood: selectedMood!,
      moodScore: MOODS.find((m) => m.id === selectedMood)?.score || 3,
      notes,
    };
    const filtered = moodLogs.filter((l) => l.date !== today);
    setMoodLogs([entry, ...filtered]);
    setStep("done");
  };

  const displayMood = todayLog || (step === "done" ? { mood: selectedMood! } : null);
  const suggestions = displayMood ? SUGGESTIONS[displayMood.mood] : null;
  const cyc = readCyclePhase();
  const cycMood = cyc.phase !== "unknown" ? PHASE_MOOD[cyc.phase] : null;

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-3xl font-serif text-foreground">How are you feeling?</h1>
        <p className="text-muted-foreground mt-1">Check in with yourself today.</p>
      </motion.div>

      <PartnerShareToggle feature="mood" />

      {cycMood && (
        <Link href="/period">
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            className="cursor-pointer rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 via-pink-50 to-amber-50 p-4 flex items-center gap-3 hover:shadow-md transition" data-testid="banner-cycle-mood">
            <div className="text-3xl">{cycMood.emoji}</div>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-widest text-rose-600">Day {cyc.day} · {cyc.phase}</p>
              <p className="font-serif text-sm text-rose-900 mt-0.5">{cycMood.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{cycMood.tip}</p>
            </div>
          </motion.div>
        </Link>
      )}

      <AnimatePresence mode="wait">
        {(step === "select" && !todayLog) && (
          <motion.div key="select" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {MOODS.map((mood, i) => (
                <motion.button
                  key={mood.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.07 }}
                  onClick={() => { setSelectedMood(mood.id); setStep("notes"); }}
                  data-testid={`mood-button-${mood.id}`}
                  className={`p-6 rounded-2xl border-2 text-center transition-all duration-200 hover:scale-105 hover:shadow-md ${mood.bg} ${selectedMood === mood.id ? "ring-2 ring-primary scale-105" : ""}`}
                >
                  <div className="text-4xl mb-2">{mood.icon}</div>
                  <div className={`font-medium ${mood.textColor}`}>{mood.label}</div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {step === "notes" && (
          <motion.div key="notes" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4">
            <Card className="border-border/50 shadow-sm">
              <CardContent className="pt-6 space-y-4">
                <div className="text-center">
                  <div className="text-5xl mb-2">{currentMoodData?.icon}</div>
                  <p className="text-muted-foreground">Feeling <span className={`font-semibold ${currentMoodData?.textColor}`}>{currentMoodData?.label}</span></p>
                </div>
                <Textarea
                  placeholder="Want to add any thoughts? (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="resize-none min-h-[100px]"
                  data-testid="mood-notes-input"
                />
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep("select")} className="flex-1">Back</Button>
                  <Button onClick={handleSave} className="flex-1 bg-primary hover:bg-primary/90" data-testid="button-save-mood">Save Mood</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {(step === "done" || todayLog) && suggestions && (
          <motion.div key="done" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <Card className={`border-2 ${MOODS.find(m => m.id === (todayLog?.mood || selectedMood))?.bg} overflow-hidden`}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="text-5xl">{MOODS.find(m => m.id === (todayLog?.mood || selectedMood))?.icon}</div>
                  <div>
                    <p className="text-sm text-muted-foreground">Today you feel</p>
                    <h2 className="text-2xl font-serif font-semibold text-foreground">{MOODS.find(m => m.id === (todayLog?.mood || selectedMood))?.label}</h2>
                    {todayLog?.notes && <p className="text-sm text-muted-foreground mt-1 italic">"{todayLog.notes}"</p>}
                  </div>
                  {!todayLog && <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setStep("select")}>Edit</Button>}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { title: "Suggested Activities", items: suggestions.activities, icon: <Heart className="w-4 h-4" /> },
                { title: "Nourishing Foods", items: suggestions.food, icon: <Zap className="w-4 h-4" /> },
                { title: "Movement for You", items: suggestions.workout, icon: <Cloud className="w-4 h-4" /> },
              ].map((section) => (
                <Card key={section.title} className="border-border/50 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                      {section.icon} {section.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {section.items.map((item) => (
                      <div key={item} className="flex items-start gap-2 text-sm">
                        <ChevronRight className="w-3 h-3 mt-0.5 text-primary flex-shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {moodLogs.length > 0 && (
        <div>
          <button onClick={() => setShowHistory(!showHistory)} className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
            {showHistory ? "Hide" : "Show"} mood history ({moodLogs.length} entries)
          </button>
          <AnimatePresence>
            {showHistory && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3 space-y-2 overflow-hidden">
                {moodLogs.slice(0, 14).map((log) => {
                  const m = MOODS.find((m) => m.id === log.mood);
                  return (
                    <div key={log.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 text-sm">
                      <span>{m?.icon}</span>
                      <span className="text-muted-foreground">{log.date}</span>
                      <Badge variant="outline" className={`${m?.textColor} text-xs`}>{m?.label}</Badge>
                      {log.notes && <span className="text-muted-foreground truncate italic">"{log.notes}"</span>}
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
