import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Heart, Send, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

type Post = { id: string; text: string; emoji: string; ts: number; roses: number };

const EMOJIS = ["🌹", "✨", "💗", "🌸", "🦋", "🕊️", "🌙", "☀️", "💫"];

export default function RoseWallPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [draft, setDraft] = useState("");
  const [emoji, setEmoji] = useState("🌹");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  async function load() {
    try {
      const r = await fetch("/api/rose-wall");
      const d = await r.json();
      setPosts(d.posts || []);
    } catch {}
  }
  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, []);

  async function post() {
    if (!draft.trim() || submitting) return;
    setSubmitting(true);
    try {
      const r = await fetch("/api/rose-wall", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: draft.trim(), emoji }) });
      const d = await r.json();
      if (!r.ok) { toast({ title: "Hold on 🌹", description: d.error || "Try again" }); return; }
      setPosts(p => [d.post, ...p]);
      setDraft("");
      toast({ title: "Posted to the wall 🌹", description: "Your light just reached every sister." });
    } finally { setSubmitting(false); }
  }

  async function rose(id: string) {
    setPosts(p => p.map(x => x.id === id ? { ...x, roses: x.roses + 1 } : x));
    try { await fetch(`/api/rose-wall/${id}/rose`, { method: "POST" }); } catch {}
  }

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6 max-w-3xl mx-auto pb-24">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-serif text-foreground flex items-center gap-2">
          <Sparkles className="w-7 h-7 text-rose-500" /> Rose Wall
        </h1>
        <p className="text-muted-foreground mt-1">Anonymous gratitude · sisters lifting sisters 🌹</p>
      </motion.div>

      <Card className="border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50">
        <CardContent className="pt-5 space-y-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Share something a sister might need to hear today… (anonymous, max 280 chars)"
            maxLength={280}
            className="bg-white/60 border-rose-200"
            rows={3}
            data-testid="textarea-wall"
          />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-1">
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setEmoji(e)}
                  className={`text-xl rounded-lg p-1.5 transition ${emoji === e ? "bg-rose-200 ring-2 ring-rose-400" : "hover:bg-rose-100"}`}
                  data-testid={`emoji-${e}`}>{e}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{draft.length}/280</span>
              <Button onClick={post} disabled={!draft.trim() || submitting} className="bg-rose-500 hover:bg-rose-600 text-white" data-testid="button-post">
                <Send className="w-4 h-4 mr-1" /> Post
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <AnimatePresence>
          {posts.map(p => (
            <motion.div key={p.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}>
              <Card className="border-border/50 hover:border-rose-300 transition-colors">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{p.emoji}</div>
                    <div className="flex-1">
                      <p className="text-foreground leading-relaxed">{p.text}</p>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-xs text-muted-foreground">a sister · {formatDistanceToNow(p.ts, { addSuffix: true })}</span>
                        <button onClick={() => rose(p.id)} className="flex items-center gap-1 text-rose-500 hover:text-rose-600 transition" data-testid={`rose-${p.id}`}>
                          <Heart className="w-4 h-4 fill-current" /> <span className="text-sm">{p.roses}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
        {posts.length === 0 && (
          <p className="text-center text-muted-foreground py-12">Be the first to bloom on the wall 🌹</p>
        )}
      </div>
    </div>
  );
}
