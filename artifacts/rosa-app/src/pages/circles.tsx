import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useUser } from "@/lib/user-context";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Send, Copy, Heart, Trash2, LogOut } from "lucide-react";
import { format } from "date-fns";

type CircleMessage = { id: string; author: string; text: string; ts: number; reactions: number };
type Circle = { id: string; name: string; code: string; createdBy: string; members: string[]; messages: CircleMessage[]; createdAt: number };

function genCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function CirclesPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const me = user?.name || "You";
  const [circles, setCircles] = useLocalStorage<Circle[]>("rosa_circles", []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [draft, setDraft] = useState("");

  const active = circles.find(c => c.id === activeId) || null;

  function createCircle() {
    if (!newName.trim()) return;
    const c: Circle = {
      id: Date.now().toString(), name: newName.trim(), code: genCode(),
      createdBy: me, members: [me], messages: [], createdAt: Date.now(),
    };
    setCircles([c, ...circles]); setActiveId(c.id); setNewName(""); setCreateOpen(false);
    toast({ title: "Circle created 🌸", description: `Share code ${c.code} to invite up to 9 sisters.` });
  }

  function joinCircle() {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    const existing = circles.find(c => c.code === code);
    if (existing) {
      if (!existing.members.includes(me)) {
        if (existing.members.length >= 10) { toast({ title: "Circle is full", description: "Circles are limited to 10 members." }); return; }
        existing.members = [...existing.members, me];
        setCircles([...circles]);
      }
      setActiveId(existing.id); setJoinCode(""); setJoinOpen(false);
      toast({ title: "You're in 💝", description: `Welcome to ${existing.name}` });
      return;
    }
    // Joining a code from outside — create a placeholder circle (real cross-device sync needs backend)
    const placeholder: Circle = {
      id: Date.now().toString(), name: `Circle ${code}`, code, createdBy: "—",
      members: [me], messages: [], createdAt: Date.now(),
    };
    setCircles([placeholder, ...circles]); setActiveId(placeholder.id); setJoinCode(""); setJoinOpen(false);
    toast({ title: "Circle saved", description: "Cross-device sync requires the upcoming ROSA cloud — for now, share this device or invite locally." });
  }

  function send() {
    if (!active || !draft.trim()) return;
    const msg: CircleMessage = { id: Date.now().toString(), author: me, text: draft.trim(), ts: Date.now(), reactions: 0 };
    setCircles(circles.map(c => c.id === active.id ? { ...c, messages: [...c.messages, msg] } : c));
    setDraft("");
  }

  function react(msgId: string) {
    if (!active) return;
    setCircles(circles.map(c => c.id !== active.id ? c : {
      ...c, messages: c.messages.map(m => m.id === msgId ? { ...m, reactions: m.reactions + 1 } : m),
    }));
  }

  function leave(circleId: string) {
    const c = circles.find(x => x.id === circleId); if (!c) return;
    if (!confirm(`Leave "${c.name}"?`)) return;
    const next = c.members.filter(m => m !== me);
    if (next.length === 0) setCircles(circles.filter(x => x.id !== circleId));
    else setCircles(circles.map(x => x.id === circleId ? { ...x, members: next } : x));
    if (activeId === circleId) setActiveId(null);
  }

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6 max-w-3xl mx-auto pb-24">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-serif text-foreground flex items-center gap-2">
          <Users className="w-7 h-7 text-rose-500" /> ROSA Circles
        </h1>
        <p className="text-muted-foreground mt-1">Your private sisterhood — up to 10 women per circle. Share moods, hold each other up. 💝</p>
        <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5 inline-block">
          ✨ Beta: stays on this device today. Cross-device cloud sync coming soon.
        </div>
      </motion.div>

      <div className="flex flex-wrap gap-2">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-rose-500 hover:bg-rose-600 text-white"><Plus className="w-4 h-4 mr-1" /> Create circle</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-serif">New circle</DialogTitle></DialogHeader>
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
            <Card key={c.id} className={`cursor-pointer transition-all ${activeId === c.id ? "border-rose-400 bg-rose-50/50" : "hover:bg-muted/40"}`}
              onClick={() => setActiveId(c.id)}>
              <CardContent className="p-3">
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <p className="font-serif font-semibold text-sm truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.members.length} member{c.members.length !== 1 ? "s" : ""} · code <span className="font-mono">{c.code}</span></p>
                  </div>
                  <Button size="sm" variant="ghost" className="text-muted-foreground h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); leave(c.id); }}>
                    <LogOut className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="md:col-span-2">
          {!active ? (
            <Card className="border-dashed text-center py-12">
              <CardContent>
                <Heart className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground font-serif">Select or create a circle to start sharing 🌹</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="font-serif">{active.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">Created {format(new Date(active.createdAt), "MMM d, yyyy")}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(active.code); toast({ title: "Copied", description: `Code ${active.code}` }); }}>
                    <Copy className="w-3.5 h-3.5 mr-1" /> {active.code}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {active.members.map(m => <Badge key={m} variant="outline" className="text-xs">{m}</Badge>)}
                </div>
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
                <div className="flex gap-2">
                  <Input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Share what's on your heart..." onKeyDown={e => { if (e.key === "Enter") send(); }} />
                  <Button onClick={send} className="bg-rose-500 hover:bg-rose-600 text-white"><Send className="w-4 h-4" /></Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
