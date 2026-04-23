import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smile, Frown, Meh, Zap, Cloud, Heart, Plus, ChevronRight, Mic, MicOff, Phone, LifeBuoy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useUser } from "@/lib/user-context";

const CRISIS_HELPLINES: Record<string, { name: string; number: string; url?: string }[]> = {
  US: [{ name: "988 Suicide & Crisis Lifeline", number: "988", url: "https://988lifeline.org" }],
  CA: [{ name: "Talk Suicide Canada", number: "1-833-456-4566", url: "https://talksuicide.ca" }],
  GB: [{ name: "Samaritans", number: "116 123", url: "https://samaritans.org" }],
  IN: [{ name: "iCall (Mon-Sat)", number: "9152987821", url: "https://icallhelpline.org" }, { name: "Vandrevala Foundation", number: "1860-2662-345" }],
  AU: [{ name: "Lifeline Australia", number: "13 11 14", url: "https://lifeline.org.au" }],
  NZ: [{ name: "Lifeline NZ", number: "0800 543 354" }],
  DE: [{ name: "Telefonseelsorge", number: "0800 111 0 111" }],
  FR: [{ name: "Suicide Écoute", number: "01 45 39 40 00" }],
  AE: [{ name: "Estijaba", number: "8001717" }],
  ZA: [{ name: "SADAG", number: "0800 567 567" }],
  DEFAULT: [{ name: "International Association for Suicide Prevention", number: "Find local: iasp.info/resources/Crisis_Centres", url: "https://www.iasp.info/resources/Crisis_Centres/" }],
};

type SpeechRecognitionLike = { start: () => void; stop: () => void; onresult: (e: any) => void; onend: () => void; onerror: (e: any) => void; continuous: boolean; interimResults: boolean; lang: string; };

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
  const { locale } = useUser();
  const [moodLogs, setMoodLogs] = useLocalStorage<MoodEntry[]>("rosa_mood_logs", []);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [step, setStep] = useState<"select" | "notes" | "done">("select");
  const [showHistory, setShowHistory] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceUnsupported, setVoiceUnsupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Crisis detection: 2+ consecutive *calendar* days (today or yesterday → backwards) with mood score <= 2
  const lowStreak = (() => {
    const byDate = new Map<string, MoodEntry>();
    for (const l of moodLogs) byDate.set(l.date, l);
    const todayD = new Date();
    let cursor = new Date(todayD.getFullYear(), todayD.getMonth(), todayD.getDate());
    let streak = 0;
    let started = false;
    for (let i = 0; i < 14; i++) {
      const key = cursor.toISOString().split("T")[0];
      const entry = byDate.get(key);
      if (entry && entry.moodScore <= 2) { streak++; started = true; }
      else if (started) break;
      else if (entry && entry.moodScore > 2) break;
      // if no entry on day 0 (today), keep walking back to yesterday before bailing
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  })();
  const inCrisis = lowStreak >= 2;
  const helplines = CRISIS_HELPLINES[locale.countryCode] || CRISIS_HELPLINES.DEFAULT;

  function toggleVoice() {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setVoiceUnsupported(true); return; }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const r: SpeechRecognitionLike = new SR();
    r.continuous = false;
    r.interimResults = false;
    r.lang = locale.language === "en" ? "en-US" : `${locale.language}-${locale.countryCode}`;
    r.onresult = (e: any) => {
      const transcript = Array.from(e.results).map((res: any) => res[0].transcript).join(" ");
      setNotes((prev) => (prev ? prev + " " : "") + transcript);
    };
    r.onend = () => setIsListening(false);
    r.onerror = () => setIsListening(false);
    recognitionRef.current = r;
    r.start();
    setIsListening(true);
  }

  useEffect(() => () => { try { recognitionRef.current?.stop(); } catch {} }, []);

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

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-3xl font-serif text-foreground">How are you feeling?</h1>
        <p className="text-muted-foreground mt-1">Check in with yourself today.</p>
      </motion.div>

      {inCrisis && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-2 border-rose-300 bg-gradient-to-br from-rose-50 to-pink-50 shadow-md">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-white rounded-full shadow-sm">
                  <LifeBuoy className="w-5 h-5 text-rose-500" />
                </div>
                <div className="flex-1">
                  <p className="font-serif text-lg text-foreground">I'm here with you 🌹</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    You've been feeling low for {lowStreak} days. You're not alone — and you don't have to carry this by yourself. Talking to someone who's trained to listen can help so much.
                  </p>
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Free, confidential support</p>
                    {helplines.map((h) => (
                      <a key={h.name} href={h.url || `tel:${h.number}`} target={h.url ? "_blank" : undefined} rel="noreferrer"
                        className="flex items-center gap-2 p-2 rounded-xl bg-white/70 hover:bg-white transition-colors text-sm">
                        <Phone className="w-4 h-4 text-rose-500 flex-shrink-0" />
                        <span className="font-medium text-foreground">{h.name}</span>
                        <span className="ml-auto text-rose-600 font-semibold">{h.number}</span>
                      </a>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground italic mt-3">If you're in immediate danger, please call your local emergency number.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
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
                <div className="relative">
                  <Textarea
                    placeholder="Want to add any thoughts? Use the mic to speak."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="resize-none min-h-[100px] pr-12"
                    data-testid="mood-notes-input"
                  />
                  <button type="button" onClick={toggleVoice}
                    className={`absolute bottom-2 right-2 p-2 rounded-full transition-all ${isListening ? "bg-rose-500 text-white animate-pulse" : "bg-rose-50 text-rose-500 hover:bg-rose-100"}`}
                    aria-label={isListening ? "Stop listening" : "Start voice input"}>
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                </div>
                {voiceUnsupported && <p className="text-xs text-muted-foreground">Voice input isn't supported in this browser. Try Chrome.</p>}
                {isListening && <p className="text-xs text-rose-500 italic">Listening… speak naturally.</p>}
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
