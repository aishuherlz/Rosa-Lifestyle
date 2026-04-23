import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useUser } from "@/lib/user-context";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Send, Copy, Heart, LogOut, Globe, Lock, Sparkles, Gamepad2 } from "lucide-react";
import { format } from "date-fns";
import { ShareButton } from "@/components/share-button";
import { apiUrl } from "@/lib/api";

type CircleMessage = { id: string; author: string; text: string; ts: number; reactions: number };
type Circle = { id: string; name: string; code: string; createdBy: string; members: string[]; messages: CircleMessage[]; createdAt: number };

type PublicSummary = { id: string; name: string; topic: string; emoji: string; memberCount: number; messageCount: number; lastActivity: number; gameOfTheDay?: string };
type PublicMsg = { id: string; author: string; text: string; ts: number; roses: number; anonymous: boolean };
type PublicCircle = PublicSummary & { members: string[]; messages: PublicMsg[]; createdBy: string; createdAt: number };

function genCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const GAME_PROMPTS = [
  "🌹 What's one tiny win you had today?",
  "🌹 If your week had a soundtrack, what's the title track?",
  "🌹 Drop one thing you'd tell your 16-year-old self.",
  "🌹 What's lighting you up this week?",
  "🌹 One soft girl ritual you swear by?",
  "🌹 Describe today in three emojis.",
  "🌹 What boundary are you proud of holding lately?",
  "🌹 Compliment the sister who posts after you 💗",
];
const CONFIDENCE_CARDS = [
  "✨ You are exactly where you're meant to be.",
  "✨ Your softness is your strength.",
  "✨ Today, choose yourself first.",
  "✨ You don't have to earn your rest.",
  "✨ The right rooms will open for you.",
  "✨ Your worth isn't a negotiation.",
  "✨ You're allowed to take up space.",
  "✨ Slow is still moving forward, sister.",
];
const GAMES = [
  { id: "rose-roulette", name: "Rose Roulette 🌹", desc: "Daily prompt every sister answers — see today's at the top of each lounge." },
  { id: "two-truths", name: "Two Truths & a Rose 🥀", desc: "Post 3 things — 2 true, 1 false. Sisters guess which is the rose (lie)." },
  { id: "confidence-cards", name: "Confidence Cards ✨", desc: "Pull a daily affirmation card. Reply with how you'll embody it today." },
  { id: "compliment-chain", name: "Compliment Chain 💖", desc: "Reply to the message above with a genuine compliment. Keep the chain alive." },
];

function ConfidenceCard() {
  const cards = [
    "I am the love I've been searching for 💗",
    "My softness is my strength 🌸",
    "I trust my journey, even the bends 🌿",
    "I deserve to take up space ✨",
    "My voice matters today 🎙️",
    "I release what isn't mine to carry 🕊️",
    "I am rooted, rising, radiant 🌹",
  ];
  const [card, setCard] = useState(() => cards[Math.floor(Math.random() * cards.length)]);
  return (
    <div className="rounded-2xl bg-gradient-to-br from-rose-100 via-pink-50 to-amber-50 border border-rose-200 p-6 text-center">
      <p className="text-xs uppercase tracking-widest text-rose-600 mb-3">Your card today</p>
      <p className="font-serif text-xl text-rose-900 leading-relaxed">{card}</p>
      <Button size="sm" variant="outline" className="mt-4" onClick={() => setCard(cards[Math.floor(Math.random() * cards.length)])}>
        <Sparkles className="w-3.5 h-3.5 mr-1" /> Pull another
      </Button>
    </div>
  );
}

export default function CirclesPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const me = user?.name || "You";

  const [tab, setTab] = useState<"public" | "private" | "games">("public");

  // Private circles (local only)
  const [circles, setCircles] = useLocalStorage<Circle[]>("rosa_circles", []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [draft, setDraft] = useState("");
  const active = circles.find(c => c.id === activeId) || null;

  // Public circles (synced)
  const [publicList, setPublicList] = useState<PublicSummary[]>([]);
  const [activePublicId, setActivePublicId] = useState<string | null>(null);
  const [activePublic, setActivePublic] = useState<PublicCircle | null>(null);
  const [publicDraft, setPublicDraft] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [createPubOpen, setCreatePubOpen] = useState(false);
  const [pubName, setPubName] = useState("");
  const [pubTopic, setPubTopic] = useState("");
  const [pubEmoji, setPubEmoji] = useState("🌹");
  const [loadingPub, setLoadingPub] = useState(false);

  const refreshPublicList = useCallback(async () => {
    try {
      const r = await fetch(apiUrl("/api/circles/public"));
      const d = await r.json();
      if (d.ok) setPublicList(d.circles);
    } catch {}
  }, []);

  const loadPublicCircle = useCallback(async (id: string) => {
    setLoadingPub(true);
    try {
      const r = await fetch(apiUrl(`/api/circles/public/${id}`));
      const d = await r.json();
      if (d.ok) setActivePublic(d.circle);
    } catch {} finally { setLoadingPub(false); }
  }, []);

  useEffect(() => { refreshPublicList(); }, [refreshPublicList]);
  useEffect(() => {
    if (!activePublicId) { setActivePublic(null); return; }
    loadPublicCircle(activePublicId);
    fetch(apiUrl(`/api/circles/public/${activePublicId}/join`), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: me }),
    }).catch(() => {});
    const t = setInterval(() => loadPublicCircle(activePublicId), 8000);
    return () => clearInterval(t);
  }, [activePublicId, loadPublicCircle, me]);

  // Private functions
  function createCircle() {
    if (!newName.trim()) return;
    const c: Circle = { id: Date.now().toString(), name: newName.trim(), code: genCode(), createdBy: me, members: [me], messages: [], createdAt: Date.now() };
    setCircles([c, ...circles]); setActiveId(c.id); setNewName(""); setCreateOpen(false);
    toast({ title: "Circle created 🌸", description: `Share code ${c.code} to invite up to 9 sisters.` });
  }
  function joinCircle() {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    const existing = circles.find(c => c.code === code);
    if (existing) {
      if (!existing.members.includes(me)) {
        if (existing.members.length >= 10) { toast({ title: "Circle is full" }); return; }
        existing.members = [...existing.members, me]; setCircles([...circles]);
      }
      setActiveId(existing.id); setJoinCode(""); setJoinOpen(false);
      toast({ title: "You're in 💝", description: `Welcome to ${existing.name}` }); return;
    }
    const placeholder: Circle = { id: Date.now().toString(), name: `Circle ${code}`, code, createdBy: "—", members: [me], messages: [], createdAt: Date.now() };
    setCircles([placeholder, ...circles]); setActiveId(placeholder.id); setJoinCode(""); setJoinOpen(false);
    toast({ title: "Circle saved", description: "Cross-device sync needs the upcoming ROSA cloud — share this device or invite locally." });
  }
  function send() {
    if (!active || !draft.trim()) return;
    const msg: CircleMessage = { id: Date.now().toString(), author: me, text: draft.trim(), ts: Date.now(), reactions: 0 };
    setCircles(circles.map(c => c.id === active.id ? { ...c, messages: [...c.messages, msg] } : c));
    setDraft("");
  }
  function react(msgId: string) {
    if (!active) return;
    setCircles(circles.map(c => c.id !== active.id ? c : { ...c, messages: c.messages.map(m => m.id === msgId ? { ...m, reactions: m.reactions + 1 } : m) }));
  }
  function leave(circleId: string) {
    const c = circles.find(x => x.id === circleId); if (!c) return;
    if (!confirm(`Leave "${c.name}"?`)) return;
    const next = c.members.filter(m => m !== me);
    if (next.length === 0) setCircles(circles.filter(x => x.id !== circleId));
    else setCircles(circles.map(x => x.id === circleId ? { ...x, members: next } : x));
    if (activeId === circleId) setActiveId(null);
  }

  // Public functions
  async function sendPublic() {
    if (!activePublicId || !publicDraft.trim()) return;
    const text = publicDraft.trim();
    setPublicDraft("");
    try {
      const r = await fetch(apiUrl(`/api/circles/public/${activePublicId}/messages`), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author: me, text, anonymous }),
      });
      const d = await r.json();
      if (d.ok) loadPublicCircle(activePublicId);
    } catch { toast({ title: "Couldn't send" }); }
  }
  async function rosePublic(msgId: string) {
    if (!activePublicId) return;
    try {
      const r = await fetch(apiUrl(`/api/circles/public/${activePublicId}/messages/${msgId}/rose`), { method: "POST" });
      const d = await r.json();
      if (d.ok) {
        loadPublicCircle(activePublicId);
        if (d.authorTotalRoses) toast({ title: "🌹 sent", description: `She has ${d.authorTotalRoses} ${d.authorTotalRoses === 1 ? "rose" : "roses"} now` });
      }
    } catch {}
  }
  async function createPublic() {
    if (!pubName.trim() || !pubTopic.trim()) return;
    try {
      const r = await fetch(apiUrl("/api/circles/public"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: pubName, topic: pubTopic, emoji: pubEmoji, createdBy: me }),
      });
      const d = await r.json();
      if (d.ok) {
        setCreatePubOpen(false); setPubName(""); setPubTopic(""); setPubEmoji("🌹");
        await refreshPublicList(); setActivePublicId(d.circle.id);
        toast({ title: "Lounge created 🌹", description: "Open to all ROSA sisters." });
      }
    } catch { toast({ title: "Couldn't create" }); }
  }

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6 max-w-5xl mx-auto pb-24">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-serif text-foreground flex items-center gap-2">
          <Users className="w-7 h-7 text-rose-500" /> ROSA Circles
        </h1>
        <p className="text-muted-foreground mt-1">Public lounges for all sisters · private circles for your inner crew · games to bond 💝</p>
      </motion.div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="public"><Globe className="w-4 h-4 mr-1.5" /> Public Lounges</TabsTrigger>
          <TabsTrigger value="private"><Lock className="w-4 h-4 mr-1.5" /> My Private Circles</TabsTrigger>
          <TabsTrigger value="games"><Gamepad2 className="w-4 h-4 mr-1.5" /> Games</TabsTrigger>
        </TabsList>

        {/* PUBLIC LOUNGES */}
        <TabsContent value="public" className="mt-4">
          {(() => {
            const sisters = ["Aaliyah 🌹","Sofia ✨","Priya 🌸","Mei 💗","Zara 🦋","Camila 🌙","Aisha 👑","Jade 🍓","Naomi 🌿","Luna 💎"];
            const today = new Date().getDate();
            const sister = sisters[today % sisters.length];
            return (
              <div className="rounded-2xl bg-gradient-to-r from-rose-100 to-pink-100 p-4 mb-3 border border-rose-200">
                <p className="text-xs uppercase tracking-widest text-rose-600">Sister Spotlight ✨ Today</p>
                <p className="font-serif text-lg text-rose-900 mt-1">{sister}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Most kind energy in the lounges this week — drop her a 🌹</p>
              </div>
            );
          })()}
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-muted-foreground">{publicList.length} lounges · open to every ROSA sister 🌍</p>
            <Dialog open={createPubOpen} onOpenChange={setCreatePubOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-rose-500 hover:bg-rose-600 text-white"><Plus className="w-4 h-4 mr-1" /> New lounge</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-serif">Open a public lounge 🌹</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Lounge name</Label><Input value={pubName} onChange={e => setPubName(e.target.value)} placeholder="e.g. Soft Girl Era" maxLength={50} /></div>
                  <div><Label>Topic / vibe</Label><Input value={pubTopic} onChange={e => setPubTopic(e.target.value)} placeholder="What sisters can expect here" maxLength={200} /></div>
                  <div><Label>Emoji</Label>
                    <div className="flex gap-1 flex-wrap">
                      {["🌹","🌸","💖","✨","👑","🌈","🦋","🌙","☁️","🍓","🌿","💎"].map(e => (
                        <button key={e} type="button" onClick={() => setPubEmoji(e)} className={`text-xl rounded-lg p-1.5 ${pubEmoji === e ? "bg-rose-100 ring-2 ring-rose-400" : "hover:bg-muted"}`}>{e}</button>
                      ))}
                    </div>
                  </div>
                  <Button onClick={createPublic} className="w-full bg-rose-500 hover:bg-rose-600 text-white">Open the doors 🌸</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-1 space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {publicList.map(c => (
                <Card key={c.id} className={`cursor-pointer transition-all ${activePublicId === c.id ? "border-rose-400 bg-rose-50/60" : "hover:bg-muted/40"}`}
                  onClick={() => setActivePublicId(c.id)}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <span className="text-2xl leading-none">{c.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-serif font-semibold text-sm truncate">{c.name}</p>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">{c.topic}</p>
                        <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
                          <span>👥 {c.memberCount}</span>
                          <span>💬 {c.messageCount}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="md:col-span-2">
              {!activePublic ? (
                <Card className="border-dashed text-center py-12">
                  <CardContent>
                    <Globe className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground font-serif">Pick a lounge to join the conversation 🌍</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="font-serif flex items-center gap-2">{activePublic.emoji} {activePublic.name}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">{activePublic.topic}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">👥 {activePublic.members.length} sisters here</p>
                      </div>
                      <ShareButton title="Join me on ROSA 🌹" text={`Come join "${activePublic.name}" lounge on ROSA — ${activePublic.topic}`} />
                    </div>
                    {activePublic.gameOfTheDay && (
                      <div className="mt-3 rounded-xl bg-gradient-to-r from-rose-100 to-pink-50 border border-rose-200 p-3">
                        <p className="text-[10px] uppercase tracking-widest text-rose-600 font-semibold mb-1">🌹 Rose Roulette · today's prompt</p>
                        <p className="text-sm text-rose-900 font-serif italic">{activePublic.gameOfTheDay}</p>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                      {activePublic.messages.length === 0 && <p className="text-xs text-muted-foreground italic text-center py-6">Be the first to share 💝</p>}
                      {activePublic.messages.map(m => (
                        <div key={m.id} className={`flex ${m.author === me && !m.anonymous ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${m.author === me && !m.anonymous ? "bg-rose-500 text-white" : "bg-muted"}`}>
                            <p className="text-[11px] font-semibold opacity-80 mb-0.5">{m.author}</p>
                            <p className="text-sm whitespace-pre-line">{m.text}</p>
                            <div className="flex items-center justify-between mt-1 text-[10px] opacity-70">
                              <span>{format(m.ts, "MMM d · h:mm a")}</span>
                              <button onClick={() => rosePublic(m.id)} className="hover:scale-110 transition-transform">🌹 {m.roses || ""}</button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {loadingPub && <p className="text-[10px] text-center text-muted-foreground">syncing…</p>}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Switch checked={anonymous} onCheckedChange={setAnonymous} id="anon" />
                      <label htmlFor="anon" className="text-muted-foreground select-none cursor-pointer">
                        Post as <span className="font-semibold text-rose-600">A Sister 🌹</span> (anonymous)
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" className="text-xs h-7 rounded-full"
                        onClick={() => setPublicDraft(d => (d ? d + " " : "") + GAME_PROMPTS[Math.floor(Math.random() * GAME_PROMPTS.length)])}>
                        🌹 Drop a prompt
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs h-7 rounded-full"
                        onClick={() => setPublicDraft(d => (d ? d + " " : "") + CONFIDENCE_CARDS[Math.floor(Math.random() * CONFIDENCE_CARDS.length)])}>
                        ✨ Pull a card
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs h-7 rounded-full"
                        onClick={() => setPublicDraft("Two Truths & a Rose 🌹\n1. \n2. \n3. (the lie)")}>
                        💝 Two Truths & a Rose
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Input value={publicDraft} onChange={e => setPublicDraft(e.target.value)} placeholder="Share with the lounge..." onKeyDown={e => { if (e.key === "Enter") sendPublic(); }} />
                      <Button onClick={sendPublic} className="bg-rose-500 hover:bg-rose-600 text-white"><Send className="w-4 h-4" /></Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">🌹 = a rose · sent to her profile (anonymous roses don't count to a name)</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* PRIVATE CIRCLES */}
        <TabsContent value="private" className="mt-4 space-y-4">
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5 inline-block">
            ✨ Private circles stay on this device today. Cross-device cloud sync coming soon.
          </div>
          <div className="flex flex-wrap gap-2">
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="bg-rose-500 hover:bg-rose-600 text-white"><Plus className="w-4 h-4 mr-1" /> Create circle</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-serif">New private circle</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Label>Circle name</Label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Soul Sisters" maxLength={40} />
                  <Button onClick={createCircle} className="w-full bg-rose-500 hover:bg-rose-600 text-white">Create 🌸</Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
              <DialogTrigger asChild><Button variant="outline">Join with code</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-serif">Join a circle</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Label>Invite code</Label>
                  <Input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={6} className="font-mono tracking-widest text-center text-lg" />
                  <Button onClick={joinCircle} className="w-full bg-rose-500 hover:bg-rose-600 text-white">Join 💕</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-1 space-y-2">
              {circles.length === 0 && <p className="text-sm text-muted-foreground italic">No circles yet — create your first sisterhood ✨</p>}
              {circles.map(c => (
                <Card key={c.id} className={`cursor-pointer transition-all ${activeId === c.id ? "border-rose-400 bg-rose-50/50" : "hover:bg-muted/40"}`} onClick={() => setActiveId(c.id)}>
                  <CardContent className="p-3">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 flex-1">
                        <p className="font-serif font-semibold text-sm truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.members.length} member{c.members.length !== 1 ? "s" : ""} · code <span className="font-mono">{c.code}</span></p>
                      </div>
                      <Button size="sm" variant="ghost" className="text-muted-foreground h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); leave(c.id); }}><LogOut className="w-3.5 h-3.5" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="md:col-span-2">
              {!active ? (
                <Card className="border-dashed text-center py-12">
                  <CardContent><Heart className="w-10 h-10 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground font-serif">Select or create a circle to start sharing 🌹</p></CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="font-serif">{active.name}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">Created {format(new Date(active.createdAt), "MMM d, yyyy")}</p>
                      </div>
                      <div className="flex gap-2">
                        <ShareButton title="Join my ROSA circle 💝" text={`Join my private circle "${active.name}" on ROSA — use code ${active.code}`} />
                        <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(active.code); toast({ title: "Copied", description: `Code ${active.code}` }); }}>
                          <Copy className="w-3.5 h-3.5 mr-1" /> {active.code}
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">{active.members.map(m => <Badge key={m} variant="outline" className="text-xs">{m}</Badge>)}</div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                      {active.messages.length === 0 && <p className="text-xs text-muted-foreground italic text-center py-6">Be the first to share 💝</p>}
                      {active.messages.map(m => (
                        <div key={m.id} className={`flex ${m.author === me ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${m.author === me ? "bg-rose-500 text-white" : "bg-muted"}`}>
                            {m.author !== me && <p className="text-[11px] font-semibold opacity-80 mb-0.5">{m.author}</p>}
                            <p className="text-sm whitespace-pre-line">{m.text}</p>
                            <div className="flex items-center justify-between mt-1 text-[10px] opacity-70">
                              <span>{format(m.ts, "h:mm a")}</span>
                              <button onClick={() => react(m.id)} className="hover:opacity-100">💗 {m.reactions || ""}</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" className="text-xs h-7 rounded-full"
                        onClick={() => setDraft(d => (d ? d + " " : "") + GAME_PROMPTS[Math.floor(Math.random() * GAME_PROMPTS.length)])}>
                        🌹 Drop a prompt
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs h-7 rounded-full"
                        onClick={() => setDraft(d => (d ? d + " " : "") + CONFIDENCE_CARDS[Math.floor(Math.random() * CONFIDENCE_CARDS.length)])}>
                        ✨ Pull a card
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs h-7 rounded-full"
                        onClick={() => setDraft("Two Truths & a Rose 🌹\n1. \n2. \n3. (the lie)")}>
                        💝 Two Truths & a Rose
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Share what's on your heart..." onKeyDown={e => { if (e.key === "Enter") send(); }} />
                      <Button onClick={send} className="bg-rose-500 hover:bg-rose-600 text-white"><Send className="w-4 h-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* GAMES */}
        <TabsContent value="games" className="mt-4 space-y-4">
          <ConfidenceCard />
          <div className="grid md:grid-cols-2 gap-3">
            {GAMES.map(g => (
              <Card key={g.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <h3 className="font-serif text-lg text-rose-700">{g.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{g.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground italic text-center">More games dropping every week 🌹 · play them inside any public lounge</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
