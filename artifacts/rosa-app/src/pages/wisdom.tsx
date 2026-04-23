import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Heart, Flower2, Brain, Baby, Sparkles, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

type Video = {
  id: string;
  title: string;
  channel: string;
  topic: string;
  duration: string;
  embed: string;
  thumb: string;
  description: string;
};

const VIDEOS: Record<string, Video[]> = {
  cycle: [
    { id: "WOi2Bwvp6hw", title: "Menstrual Cycle, Hormones & The Brain", channel: "TED-Ed", topic: "Cycle Science", duration: "5 min", embed: "https://www.youtube.com/embed/WOi2Bwvp6hw", thumb: "https://i.ytimg.com/vi/WOi2Bwvp6hw/hqdefault.jpg", description: "How estrogen and progesterone shape your body and mind across the month." },
    { id: "QwEcdbDpvBE", title: "What Causes Period Pain?", channel: "TED-Ed", topic: "Period Health", duration: "5 min", embed: "https://www.youtube.com/embed/QwEcdbDpvBE", thumb: "https://i.ytimg.com/vi/QwEcdbDpvBE/hqdefault.jpg", description: "The biology of cramps and what actually helps." },
    { id: "8SpOkokoCFM", title: "Cycle Syncing Workouts & Nutrition", channel: "Doctor Mike", topic: "Cycle Syncing", duration: "12 min", embed: "https://www.youtube.com/embed/8SpOkokoCFM", thumb: "https://i.ytimg.com/vi/8SpOkokoCFM/hqdefault.jpg", description: "Eat and train with your hormones, not against them." },
    { id: "8r1aPV0n6Cw", title: "PMS vs PMDD — Know the Difference", channel: "Mama Doctor Jones", topic: "PMS / PMDD", duration: "10 min", embed: "https://www.youtube.com/embed/8r1aPV0n6Cw", thumb: "https://i.ytimg.com/vi/8r1aPV0n6Cw/hqdefault.jpg", description: "When mood swings cross the line into something more." },
  ],
  sexed: [
    { id: "fLJsdqxnZb0", title: "What Counts as Consent?", channel: "Planned Parenthood", topic: "Consent", duration: "3 min", embed: "https://www.youtube.com/embed/fLJsdqxnZb0", thumb: "https://i.ytimg.com/vi/fLJsdqxnZb0/hqdefault.jpg", description: "Consent is enthusiastic, ongoing, and freely given." },
    { id: "h3bz_GAGNxk", title: "How Birth Control Works", channel: "Planned Parenthood", topic: "Contraception", duration: "4 min", embed: "https://www.youtube.com/embed/h3bz_GAGNxk", thumb: "https://i.ytimg.com/vi/h3bz_GAGNxk/hqdefault.jpg", description: "All your options — pill, IUD, implant, patch, and more." },
    { id: "rcjhOUDZUE4", title: "The Female Orgasm Explained", channel: "Sex Ed Plus", topic: "Pleasure", duration: "8 min", embed: "https://www.youtube.com/embed/rcjhOUDZUE4", thumb: "https://i.ytimg.com/vi/rcjhOUDZUE4/hqdefault.jpg", description: "Anatomy, response cycle, and closing the orgasm gap." },
    { id: "mMxMGcUxlxA", title: "STI Prevention — What Every Woman Should Know", channel: "Mama Doctor Jones", topic: "STI Prevention", duration: "11 min", embed: "https://www.youtube.com/embed/mMxMGcUxlxA", thumb: "https://i.ytimg.com/vi/mMxMGcUxlxA/hqdefault.jpg", description: "Real talk on testing, protection, and your rights." },
    { id: "7JW7g8jEOyA", title: "Healthy Relationships & Red Flags", channel: "Psychology In Seattle", topic: "Relationships", duration: "14 min", embed: "https://www.youtube.com/embed/7JW7g8jEOyA", thumb: "https://i.ytimg.com/vi/7JW7g8jEOyA/hqdefault.jpg", description: "How to spot love that lifts you vs love that drains." },
  ],
  fertility: [
    { id: "5IWZxHWa9k4", title: "How Pregnancy Actually Happens", channel: "TED-Ed", topic: "Conception", duration: "5 min", embed: "https://www.youtube.com/embed/5IWZxHWa9k4", thumb: "https://i.ytimg.com/vi/5IWZxHWa9k4/hqdefault.jpg", description: "From ovulation to implantation, beautifully animated." },
    { id: "sl4Sp_EofbI", title: "Tracking Ovulation Naturally", channel: "Mama Doctor Jones", topic: "Ovulation", duration: "9 min", embed: "https://www.youtube.com/embed/sl4Sp_EofbI", thumb: "https://i.ytimg.com/vi/sl4Sp_EofbI/hqdefault.jpg", description: "Cervical mucus, basal temperature, and fertility windows." },
    { id: "3rSFklwMI8I", title: "Egg Freezing Explained", channel: "Doctor Mike", topic: "Egg Freezing", duration: "13 min", embed: "https://www.youtube.com/embed/3rSFklwMI8I", thumb: "https://i.ytimg.com/vi/3rSFklwMI8I/hqdefault.jpg", description: "Cost, process, and timing for fertility preservation." },
  ],
  mental: [
    { id: "WuyPuH9ojCE", title: "How Anxiety Affects Women's Cycles", channel: "Therapy in a Nutshell", topic: "Mental Health", duration: "10 min", embed: "https://www.youtube.com/embed/WuyPuH9ojCE", thumb: "https://i.ytimg.com/vi/WuyPuH9ojCE/hqdefault.jpg", description: "The hormone-anxiety loop and how to break it." },
    { id: "vzKryaN44ss", title: "Self-Worth: Loving Who You Are", channel: "School of Life", topic: "Self-Worth", duration: "6 min", embed: "https://www.youtube.com/embed/vzKryaN44ss", thumb: "https://i.ytimg.com/vi/vzKryaN44ss/hqdefault.jpg", description: "Where confidence really comes from." },
    { id: "Yi41bVWX7N4", title: "Setting Boundaries Like a Queen", channel: "Therapy in a Nutshell", topic: "Boundaries", duration: "12 min", embed: "https://www.youtube.com/embed/Yi41bVWX7N4", thumb: "https://i.ytimg.com/vi/Yi41bVWX7N4/hqdefault.jpg", description: "Saying no without guilt." },
  ],
  body: [
    { id: "ZAJwRyvY2vg", title: "Hormones & Skin — Cycle Acne Explained", channel: "Dr Dray", topic: "Skin", duration: "11 min", embed: "https://www.youtube.com/embed/ZAJwRyvY2vg", thumb: "https://i.ytimg.com/vi/ZAJwRyvY2vg/hqdefault.jpg", description: "Why your skin breaks out before your period." },
    { id: "fZKnQA-2JhA", title: "Pelvic Floor Health 101", channel: "Vagina University", topic: "Pelvic Health", duration: "8 min", embed: "https://www.youtube.com/embed/fZKnQA-2JhA", thumb: "https://i.ytimg.com/vi/fZKnQA-2JhA/hqdefault.jpg", description: "Kegels, posture, and why this matters at every age." },
    { id: "8hdM9KdDpA8", title: "Perimenopause & Menopause Demystified", channel: "Dr Mary Claire Haver", topic: "Menopause", duration: "15 min", embed: "https://www.youtube.com/embed/8hdM9KdDpA8", thumb: "https://i.ytimg.com/vi/8hdM9KdDpA8/hqdefault.jpg", description: "What to expect from your 30s through 60s." },
  ],
};

const TABS = [
  { id: "cycle", label: "Cycle & Periods", icon: Flower2, color: "rose" },
  { id: "sexed", label: "Sex Ed", icon: Heart, color: "pink" },
  { id: "fertility", label: "Fertility", icon: Baby, color: "amber" },
  { id: "mental", label: "Mind", icon: Brain, color: "violet" },
  { id: "body", label: "Body", icon: Sparkles, color: "emerald" },
];

export default function WisdomPage() {
  const [tab, setTab] = useState("cycle");
  const [playing, setPlaying] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filtered = (list: Video[]) => {
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter(v => v.title.toLowerCase().includes(q) || v.topic.toLowerCase().includes(q) || v.description.toLowerCase().includes(q));
  };

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6 max-w-6xl mx-auto pb-24">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-serif text-foreground flex items-center gap-2">
          <BookOpen className="w-7 h-7 text-rose-500" /> ROSA Wisdom
        </h1>
        <p className="text-muted-foreground mt-1">Real, science-backed education on your body, mind & relationships 🌹</p>
      </motion.div>

      <div className="relative">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search topics — cramps, consent, IUDs, perimenopause…"
          className="pl-9 rounded-2xl" data-testid="input-wisdom-search" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full grid grid-cols-2 md:grid-cols-5 h-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="flex items-center gap-1.5 py-2.5" data-testid={`tab-${t.id}`}>
              <t.icon className="w-4 h-4" /> <span className="text-xs md:text-sm">{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((t) => (
          <TabsContent key={t.id} value={t.id} className="mt-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered(VIDEOS[t.id]).map((v) => (
                <motion.div key={v.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="overflow-hidden hover:shadow-lg transition-shadow border-border/50">
                    <div className="aspect-video bg-black relative cursor-pointer" onClick={() => setPlaying(playing === v.id ? null : v.id)} data-testid={`video-${v.id}`}>
                      {playing === v.id ? (
                        <iframe src={`${v.embed}?autoplay=1&rel=0`} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                      ) : (
                        <>
                          <img src={v.thumb} alt={v.title} className="w-full h-full object-cover" loading="lazy" />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center hover:bg-black/40 transition-colors">
                            <div className="w-14 h-14 rounded-full bg-rose-500 flex items-center justify-center shadow-xl">
                              <span className="text-white text-2xl ml-1">▶</span>
                            </div>
                          </div>
                          <Badge className="absolute bottom-2 right-2 bg-black/70 text-white text-xs">{v.duration}</Badge>
                        </>
                      )}
                    </div>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium text-sm leading-tight">{v.title}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground">{v.description}</p>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-muted-foreground">{v.channel}</span>
                        <Badge variant="outline" className="text-xs">{v.topic}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
            {filtered(VIDEOS[t.id]).length === 0 && (
              <p className="text-center text-muted-foreground py-12">No videos match "{query}". Try another keyword 🌸</p>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Card className="bg-gradient-to-br from-rose-50 to-pink-50 border-rose-200">
        <CardContent className="pt-5">
          <p className="text-sm text-rose-900 font-serif">🌹 Knowledge is power, sister.</p>
          <p className="text-xs text-muted-foreground mt-1">Videos are sourced from trusted channels — TED-Ed, Planned Parenthood, board-certified MDs, and licensed therapists. Always consult your own healthcare provider for medical questions.</p>
        </CardContent>
      </Card>
    </div>
  );
}
