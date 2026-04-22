import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Bell, BellOff, RefreshCw, Heart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useToast } from "@/hooks/use-toast";

const ALL_QUOTES = [
  { text: "She remembered who she was and the game changed.", author: "Lalah Delia", tags: ["feminist", "empowerment"] },
  { text: "You are not a drop in the ocean. You are the entire ocean in a drop.", author: "Rumi", tags: ["spiritual", "worth"] },
  { text: "The most courageous act is still to think for yourself. Aloud.", author: "Coco Chanel", tags: ["feminist", "strength"] },
  { text: "You yourself, as much as anybody in the entire universe, deserve your love and affection.", author: "Buddha", tags: ["gentle", "self-love"] },
  { text: "Well-behaved women seldom make history.", author: "Laurel Thatcher Ulrich", tags: ["feminist", "bold"] },
  { text: "A woman is like a tea bag; you never know how strong it is until it's in hot water.", author: "Eleanor Roosevelt", tags: ["strength", "empowerment"] },
  { text: "She is water. Powerful enough to drown you. Soft enough to cleanse you. Deep enough to save you.", author: "Unknown", tags: ["spiritual", "feminine"] },
  { text: "The question isn't who's going to let me; it's who's going to stop me.", author: "Ayn Rand", tags: ["bold", "feminist"] },
  { text: "Beauty begins the moment you decide to be yourself.", author: "Coco Chanel", tags: ["self-love", "confidence"] },
  { text: "You were given this life because you were strong enough to live it.", author: "Unknown", tags: ["strength", "gentle"] },
  { text: "Not all those who wander are lost.", author: "J.R.R. Tolkien", tags: ["adventurous", "spiritual"] },
  { text: "Darling, you are allowed to be a masterpiece and a work in progress simultaneously.", author: "Sophia Bush", tags: ["gentle", "self-love"] },
  { text: "She needed a hero, so that's what she became.", author: "Unknown", tags: ["feminist", "strength"] },
  { text: "One day you will look back and see that all along you were blooming.", author: "Morgan Harper Nichols", tags: ["gentle", "growth"] },
  { text: "In a society that profits from your self-doubt, liking yourself is a rebellious act.", author: "Unknown", tags: ["feminist", "empowerment"] },
  { text: "Your present circumstances don't determine where you can go; they merely determine where you start.", author: "Nido Qubein", tags: ["growth", "adventurous"] },
  { text: "Real queens fix each other's crowns.", author: "Unknown", tags: ["feminine", "empowerment"] },
  { text: "And though she be but little, she is fierce.", author: "William Shakespeare", tags: ["strength", "bold"] },
  { text: "Travel often. Getting lost will help you find yourself.", author: "Unknown", tags: ["adventurous", "spiritual"] },
  { text: "What you seek is seeking you.", author: "Rumi", tags: ["spiritual", "gentle"] },
];

const PERSONALITY_TAGS = [
  { id: "feminist", label: "Feminist" },
  { id: "spiritual", label: "Spiritual" },
  { id: "adventurous", label: "Adventurous" },
  { id: "gentle", label: "Gentle" },
  { id: "bold", label: "Bold" },
  { id: "self-love", label: "Self Love" },
  { id: "strength", label: "Strength" },
  { id: "growth", label: "Growth" },
];

function getDailyQuote(tags: string[]) {
  const today = new Date().toDateString();
  const seed = today.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const filtered = tags.length > 0 ? ALL_QUOTES.filter(q => q.tags.some(t => tags.includes(t))) : ALL_QUOTES;
  const pool = filtered.length > 0 ? filtered : ALL_QUOTES;
  return pool[seed % pool.length];
}

export default function QuotesPage() {
  const [personalityTags, setPersonalityTags] = useLocalStorage<string[]>("rosa_personality_tags", []);
  const [notifEnabled, setNotifEnabled] = useLocalStorage<boolean>("rosa_quote_notif", false);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const { toast } = useToast();

  const dailyQuote = getDailyQuote(personalityTags);
  const filteredQuotes = personalityTags.length > 0 ? ALL_QUOTES.filter(q => q.tags.some(t => personalityTags.includes(t))) : ALL_QUOTES;

  const toggleTag = (tag: string) => {
    setPersonalityTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleNotification = async () => {
    if (!notifEnabled) {
      if ("Notification" in window) {
        const perm = await Notification.requestPermission();
        if (perm === "granted") {
          setNotifEnabled(true);
          toast({ title: "Reminders on!", description: "You'll get a daily quote reminder." });
          new Notification("ROSA", { body: dailyQuote.text, icon: "/favicon.ico" });
        } else {
          toast({ title: "Permission denied", description: "Enable notifications in your browser settings." });
        }
      }
    } else {
      setNotifEnabled(false);
      toast({ title: "Reminders off", description: "Daily quote reminders disabled." });
    }
  };

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif text-foreground">Daily Quotes</h1>
            <p className="text-muted-foreground mt-1">Words that lift you up.</p>
          </div>
          <Button variant={notifEnabled ? "default" : "outline"} size="sm" onClick={handleNotification} data-testid="button-toggle-notif">
            {notifEnabled ? <Bell className="w-4 h-4 mr-1" /> : <BellOff className="w-4 h-4 mr-1" />}
            {notifEnabled ? "Reminders On" : "Remind Me"}
          </Button>
        </div>
      </motion.div>

      {/* Daily quote hero */}
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
        <Card className="border-none shadow-lg bg-gradient-to-br from-rose-500 to-pink-600 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          <CardContent className="pt-10 pb-10 px-8 relative z-10 text-center">
            <Sparkles className="w-6 h-6 mx-auto mb-4 opacity-80" />
            <p className="text-xl md:text-2xl font-serif italic leading-relaxed mb-4">"{dailyQuote.text}"</p>
            <p className="text-sm opacity-80">— {dailyQuote.author}</p>
            <div className="flex gap-2 justify-center mt-4 flex-wrap">
              {dailyQuote.tags.map(t => (
                <span key={t} className="px-2 py-0.5 rounded-full bg-white/20 text-xs">{t}</span>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Personality tags */}
      <div>
        <h2 className="text-lg font-serif mb-3">Personalise Your Quotes</h2>
        <div className="flex flex-wrap gap-2">
          {PERSONALITY_TAGS.map(tag => (
            <button
              key={tag.id}
              onClick={() => toggleTag(tag.id)}
              data-testid={`tag-${tag.id}`}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                personalityTags.includes(tag.id) 
                  ? "bg-primary text-primary-foreground border-primary" 
                  : "bg-background text-muted-foreground border-border hover:border-primary hover:text-primary"
              }`}
            >
              {tag.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quote collection */}
      <div>
        <h2 className="text-lg font-serif mb-3">Quote Collection</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {filteredQuotes.map((quote, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="pt-5 pb-4">
                  <p className="text-sm font-serif italic text-foreground/90 leading-relaxed mb-3">"{quote.text}"</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">— {quote.author}</span>
                    <div className="flex gap-1">
                      {quote.tags.slice(0, 2).map(t => <Badge key={t} variant="outline" className="text-xs px-1.5">{t}</Badge>)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
