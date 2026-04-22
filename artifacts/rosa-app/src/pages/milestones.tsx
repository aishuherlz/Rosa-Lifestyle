import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Clock, Calendar, Share2, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { differenceInDays, parseISO, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type Milestone = {
  id: string;
  title: string;
  type: "countdown" | "since";
  targetDate: string;
  emoji: string;
  color: string;
};

const EMOJIS = ["🎄", "🎂", "✈️", "💍", "🌸", "🎓", "❤️", "🌟", "🏆", "💪", "🌈", "🎉"];
const COLORS = [
  { bg: "from-rose-400 to-pink-400", text: "text-rose-700", card: "bg-rose-50 border-rose-200" },
  { bg: "from-violet-400 to-purple-400", text: "text-violet-700", card: "bg-violet-50 border-violet-200" },
  { bg: "from-amber-400 to-yellow-400", text: "text-amber-700", card: "bg-amber-50 border-amber-200" },
  { bg: "from-emerald-400 to-green-400", text: "text-emerald-700", card: "bg-emerald-50 border-emerald-200" },
  { bg: "from-sky-400 to-blue-400", text: "text-sky-700", card: "bg-sky-50 border-sky-200" },
  { bg: "from-fuchsia-400 to-pink-400", text: "text-fuchsia-700", card: "bg-fuchsia-50 border-fuchsia-200" },
];

export default function MilestonesPage() {
  const [milestones, setMilestones] = useLocalStorage<Milestone[]>("rosa_milestones", []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", type: "countdown" as "countdown" | "since", targetDate: "", emoji: "🌟", color: "0" });
  const { toast } = useToast();

  const handleAdd = () => {
    const item: Milestone = { id: Date.now().toString(), ...form };
    setMilestones([...milestones, item]);
    setOpen(false);
    setForm({ title: "", type: "countdown", targetDate: "", emoji: "🌟", color: "0" });
  };

  const getDays = (m: Milestone) => {
    const target = parseISO(m.targetDate);
    const today = new Date();
    return differenceInDays(target, today);
  };

  const handleShare = (m: Milestone) => {
    const days = getDays(m);
    const text = m.type === "countdown"
      ? `${Math.abs(days)} days until ${m.title}! ${m.emoji} #ROSA`
      : `${Math.abs(days)} days since ${m.title} ${m.emoji} #ROSA`;
    navigator.clipboard.writeText(text).then(() =>
      toast({ title: "Copied!", description: "Share text copied to clipboard." })
    );
  };

  const countdowns = milestones.filter(m => m.type === "countdown");
  const sinces = milestones.filter(m => m.type === "since");

  const MilestoneCard = ({ m }: { m: Milestone }) => {
    const days = getDays(m);
    const colorIndex = parseInt(m.color) % COLORS.length;
    const color = COLORS[colorIndex];
    const absDays = Math.abs(days);
    const displayDays = m.type === "countdown" ? (days > 0 ? days : 0) : absDays;
    const label = m.type === "countdown" ? (days > 0 ? "days to go" : "arrived!") : "days";

    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <Card className={`border-2 ${color.card} shadow-sm hover:shadow-md transition-all`} data-testid={`card-milestone-${m.id}`}>
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <span className="text-3xl">{m.emoji}</span>
                <div>
                  <p className="font-semibold">{m.title}</p>
                  <p className="text-xs text-muted-foreground">{format(parseISO(m.targetDate), "MMMM d, yyyy")}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => handleShare(m)} className="text-muted-foreground hover:text-primary p-1 transition-colors" data-testid={`button-share-${m.id}`}>
                  <Share2 className="w-4 h-4" />
                </button>
                <button onClick={() => setMilestones(milestones.filter(x => x.id !== m.id))} className="text-muted-foreground hover:text-destructive p-1 transition-colors" data-testid={`button-delete-${m.id}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className={`mt-4 p-3 rounded-xl bg-gradient-to-r ${color.bg} text-white text-center`}>
              <div className="text-4xl font-bold font-serif">{displayDays}</div>
              <div className="text-sm opacity-90">{label}</div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif text-foreground">Milestones</h1>
            <p className="text-muted-foreground mt-1">Count what matters.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90" data-testid="button-add-milestone">
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle className="font-serif text-xl">New Milestone</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Tabs value={form.type} onValueChange={(v: any) => setForm(f => ({ ...f, type: v }))}>
                  <TabsList className="w-full">
                    <TabsTrigger value="countdown" className="flex-1"><Clock className="w-4 h-4 mr-1" /> Countdown</TabsTrigger>
                    <TabsTrigger value="since" className="flex-1"><Timer className="w-4 h-4 mr-1" /> Days Since</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div>
                  <Label>Title</Label>
                  <Input placeholder={form.type === "countdown" ? "e.g. My Birthday" : "e.g. First Date"} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} data-testid="input-milestone-title" />
                </div>
                <div>
                  <Label>{form.type === "countdown" ? "Target Date" : "Date It Happened"}</Label>
                  <Input type="date" value={form.targetDate} onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))} data-testid="input-milestone-date" />
                </div>
                <div>
                  <Label>Emoji</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {EMOJIS.map(e => (
                      <button key={e} onClick={() => setForm(f => ({ ...f, emoji: e }))} className={`text-xl p-1.5 rounded-lg border-2 transition-all ${form.emoji === e ? "border-primary bg-primary/10" : "border-transparent hover:border-border"}`}>
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Color</Label>
                  <div className="flex gap-2 mt-1">
                    {COLORS.map((c, i) => (
                      <button key={i} onClick={() => setForm(f => ({ ...f, color: String(i) }))} className={`w-8 h-8 rounded-full bg-gradient-to-r ${c.bg} border-2 transition-all ${form.color === String(i) ? "border-foreground scale-110" : "border-transparent"}`} />
                    ))}
                  </div>
                </div>
                <Button onClick={handleAdd} disabled={!form.title || !form.targetDate} className="w-full bg-primary" data-testid="button-save-milestone">Save Milestone</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {milestones.length === 0 ? (
        <Card className="border-dashed border-2 border-border text-center py-16">
          <CardContent>
            <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-lg font-serif">No milestones yet</p>
            <p className="text-muted-foreground text-sm mt-1">Add a countdown or track something meaningful</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {countdowns.length > 0 && (
            <div>
              <h2 className="text-xl font-serif mb-3 flex items-center gap-2"><Clock className="w-5 h-5 text-primary" /> Countdowns</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence>{countdowns.map(m => <MilestoneCard key={m.id} m={m} />)}</AnimatePresence>
              </div>
            </div>
          )}
          {sinces.length > 0 && (
            <div>
              <h2 className="text-xl font-serif mb-3 flex items-center gap-2"><Timer className="w-5 h-5 text-primary" /> Days Since</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence>{sinces.map(m => <MilestoneCard key={m.id} m={m} />)}</AnimatePresence>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
