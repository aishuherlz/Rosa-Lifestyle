import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookHeart, Plus, Search, Mic, X, Image, Tag, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type JournalEntry = {
  id: string;
  date: string;
  text: string;
  mood: string;
  tags: string[];
  photo?: string;
};

const MOODS = ["😊 Happy", "😢 Sad", "😤 Angry", "😴 Tired", "💪 Strong", "🥰 Loved", "😰 Anxious", "✨ Grateful", "🌸 Peaceful", "🔥 Motivated"];
const TAGS = ["personal", "goals", "gratitude", "dreams", "love", "growth", "health", "work", "family", "travel"];

export default function JournalPage() {
  const [entries, setEntries] = useLocalStorage<JournalEntry[]>("rosa_journal", []);
  const [writing, setWriting] = useState(false);
  const [search, setSearch] = useState("");
  const [filterMood, setFilterMood] = useState("");
  const [form, setForm] = useState({ text: "", mood: "", tags: [] as string[], photo: "" });
  const { toast } = useToast();

  const saveEntry = () => {
    if (!form.text.trim()) return;
    const entry: JournalEntry = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      text: form.text,
      mood: form.mood,
      tags: form.tags,
      photo: form.photo,
    };
    setEntries([entry, ...entries]);
    setForm({ text: "", mood: "", tags: [], photo: "" });
    setWriting(false);
    toast({ title: "Journal entry saved 🌹" });
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setForm((f) => ({ ...f, photo: ev.target?.result as string }));
    reader.readAsDataURL(file);
  };

  const handleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast({ title: "Voice not supported in this browser" }); return; }
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setForm((f) => ({ ...f, text: f.text + (f.text ? " " : "") + transcript }));
    };
    recognition.start();
  };

  const filtered = entries.filter((e) => {
    const matchSearch = !search || e.text.toLowerCase().includes(search.toLowerCase()) || e.tags.some((t) => t.includes(search.toLowerCase()));
    const matchMood = !filterMood || e.mood === filterMood;
    return matchSearch && matchMood;
  });

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6 max-w-2xl pb-24">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif text-foreground flex items-center gap-2">
              <BookHeart className="w-7 h-7 text-primary" /> My Journal
            </h1>
            <p className="text-muted-foreground mt-1">Your private sanctuary. Write freely.</p>
          </div>
          <Button onClick={() => setWriting(true)} className="bg-primary hover:bg-primary/90 gap-2">
            <Plus className="w-4 h-4" /> Write
          </Button>
        </div>
      </motion.div>

      {/* Write Modal */}
      <AnimatePresence>
        {writing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setWriting(false)}
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              className="bg-card w-full max-w-lg rounded-3xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center">
                <h2 className="font-serif text-xl">New Entry — {format(new Date(), "MMMM do")}</h2>
                <button onClick={() => setWriting(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
              </div>

              <Textarea
                value={form.text}
                onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
                placeholder="What's on your heart today? Write freely, this is just for you..."
                className="min-h-[140px] resize-none text-base leading-relaxed border-border/50 focus:border-primary/50"
                autoFocus
              />

              {/* Voice Input */}
              <Button variant="outline" size="sm" onClick={handleVoice} className="gap-2">
                <Mic className="w-4 h-4" /> Speak your thoughts
              </Button>

              {/* Mood */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">How are you feeling?</p>
                <div className="flex flex-wrap gap-2">
                  {MOODS.map((m) => (
                    <button
                      key={m}
                      onClick={() => setForm((f) => ({ ...f, mood: f.mood === m ? "" : m }))}
                      className={`px-3 py-1 rounded-full text-sm border transition-all ${form.mood === m ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary"}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {TAGS.map((t) => (
                    <button
                      key={t}
                      onClick={() => setForm((f) => ({ ...f, tags: f.tags.includes(t) ? f.tags.filter((x) => x !== t) : [...f.tags, t] }))}
                      className={`px-3 py-1 rounded-full text-xs border transition-all capitalize ${form.tags.includes(t) ? "bg-rose-50 text-rose-700 border-rose-300" : "border-border hover:border-rose-200"}`}
                    >
                      #{t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Photo */}
              <div className="flex items-center gap-3">
                <label className="cursor-pointer flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <Image className="w-4 h-4" />
                  <span>Add photo</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                </label>
                {form.photo && <img src={form.photo} alt="" className="w-16 h-16 rounded-xl object-cover" />}
              </div>

              <div className="flex gap-3 pt-2">
                <Button onClick={saveEntry} className="flex-1 bg-primary hover:bg-primary/90">Save Entry 🌹</Button>
                <Button variant="outline" onClick={() => setWriting(false)}>Cancel</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search + Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search entries..." className="pl-9" />
        </div>
        <select
          value={filterMood}
          onChange={(e) => setFilterMood(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
        >
          <option value="">All moods</option>
          {MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Entries */}
      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <BookHeart className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-serif text-lg">Your story begins with a single word.</p>
          <p className="text-sm mt-1">Tap Write to start your first entry.</p>
        </div>
      )}

      <div className="space-y-4">
        {filtered.map((entry) => (
          <motion.div key={entry.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-border/50 overflow-hidden hover:shadow-md transition-shadow">
              {entry.photo && (
                <img src={entry.photo} alt="" className="w-full h-40 object-cover" />
              )}
              <CardContent className="pt-4 pb-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-xs text-muted-foreground">{format(parseISO(entry.date), "EEEE, MMMM do 'at' h:mm a")}</p>
                    {entry.mood && <p className="text-sm mt-0.5">{entry.mood}</p>}
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-foreground/80 line-clamp-4">{entry.text}</p>
                {entry.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {entry.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs capitalize">#{t}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
