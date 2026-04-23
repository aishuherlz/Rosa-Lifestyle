import { useState } from "react";
import { motion } from "framer-motion";
import { Users, Link as LinkIcon, Heart, Gift, MapPin, Copy, Check, Sparkles, Share2, Inbox, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useToast } from "@/hooks/use-toast";
import {
  useSharePrefs, FEATURE_LABELS, type ShareableFeature,
  buildShareSnapshot, encodeSnapshot, decodeSnapshot,
  saveIncomingSnapshot, useIncomingSnapshot, clearIncomingSnapshot,
} from "@/lib/partner-share";

type PartnerData = {
  myCode: string;
  partnerCode: string;
  linkedAt: string;
  partnerName: string;
  myName?: string;
  birthday?: string;
  anniversary?: string;
  surpriseTrip: { destination: string; date: string; message: string } | null;
};

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const FEATURE_ORDER: ShareableFeature[] = [
  "cycle", "mood", "sleep", "wellness", "garden", "milestones", "goals",
  "journal", "food", "fitness", "water", "outfit", "skin", "challenges", "travel",
];

export default function PartnerPage() {
  const [partner, setPartner] = useLocalStorage<PartnerData | null>("rosa_partner", null);
  const [myCode] = useLocalStorage<string>("rosa_my_code", generateCode());
  const [inputCode, setInputCode] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [myName, setMyName] = useLocalStorage<string>("rosa_my_name", "");
  const [copied, setCopied] = useState<"code" | "snap" | null>(null);
  const [tripForm, setTripForm] = useState({ destination: "", date: "", message: "" });
  const [snapshotPaste, setSnapshotPaste] = useState("");
  const [generatedSnap, setGeneratedSnap] = useState<string>("");
  const [prefs, setPref] = useSharePrefs();
  const incoming = useIncomingSnapshot();
  const { toast } = useToast();

  const handleConnect = () => {
    if (!inputCode.trim()) return;
    setPartner({
      myCode,
      partnerCode: inputCode.toUpperCase(),
      linkedAt: new Date().toISOString(),
      partnerName: partnerName || "Your Partner",
      myName: myName || undefined,
      surpriseTrip: null,
    });
    toast({ title: "Connected 💗", description: `You're linked with ${partnerName || "your partner"}.` });
  };

  const handleDisconnect = () => {
    setPartner(null);
    clearIncomingSnapshot();
    toast({ title: "Disconnected", description: "Partner link and shared data removed." });
  };

  const copyCode = () => {
    navigator.clipboard.writeText(myCode).then(() => { setCopied("code"); setTimeout(() => setCopied(null), 2000); });
  };

  const generateAndCopy = () => {
    const snap = buildShareSnapshot({ fromName: myName || partner?.myName });
    const encoded = encodeSnapshot(snap);
    setGeneratedSnap(encoded);
    navigator.clipboard.writeText(encoded).then(() => {
      setCopied("snap"); setTimeout(() => setCopied(null), 2500);
      toast({ title: "Snapshot copied 💗", description: `Send this to ${partner?.partnerName || "your partner"} — they'll paste it on their Partner page.` });
    });
  };

  const enabledCount = Object.values(prefs).filter(Boolean).length;

  const importSnapshot = () => {
    const decoded = decodeSnapshot(snapshotPaste);
    if (!decoded) { toast({ title: "Couldn't read that code", description: "Make sure you pasted the full snapshot from your partner." }); return; }
    saveIncomingSnapshot(decoded);
    setSnapshotPaste("");
    toast({ title: `${decoded.from} shared with you 💗`, description: "Their snapshot is loaded — see it in the 'From them' tab." });
  };

  const saveTrip = () => {
    if (!partner || !tripForm.destination) return;
    setPartner({ ...partner, surpriseTrip: { ...tripForm } });
    toast({ title: "Surprise saved!", description: "Outfit suggestions will be weather-based." });
    setTripForm({ destination: "", date: "", message: "" });
  };

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6 max-w-4xl mx-auto pb-24">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-serif text-foreground flex items-center gap-2">
          <Heart className="w-7 h-7 text-rose-500" /> Partner
        </h1>
        <p className="text-muted-foreground mt-1">Love made thoughtful — you choose what to share, always.</p>
      </motion.div>

      {/* Connection Code */}
      <Card className="border-border/50 shadow-sm bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-400" /> Your Connection Code
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="font-mono text-3xl font-bold tracking-widest text-primary bg-white dark:bg-background px-6 py-3 rounded-xl border border-rose-200 shadow-sm">
              {myCode}
            </div>
            <Button size="icon" variant="outline" onClick={copyCode} data-testid="button-copy-code">
              {copied === "code" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Share this code with your partner so they know it's you.</p>
        </CardContent>
      </Card>

      {!partner ? (
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="font-serif text-lg flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-primary" /> Connect with Partner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Your name (optional)</Label>
              <Input placeholder="So they know who shared" value={myName} onChange={e => setMyName(e.target.value)} data-testid="input-my-name" />
            </div>
            <div>
              <Label>Partner's name (optional)</Label>
              <Input placeholder="e.g. Alex" value={partnerName} onChange={e => setPartnerName(e.target.value)} data-testid="input-partner-name" />
            </div>
            <div>
              <Label>Partner's code</Label>
              <Input placeholder="6 characters" value={inputCode} onChange={e => setInputCode(e.target.value.toUpperCase())} maxLength={6} className="font-mono tracking-widest text-lg" data-testid="input-partner-code" />
            </div>
            <Button onClick={handleConnect} disabled={inputCode.length < 6} className="w-full bg-primary hover:bg-primary/90" data-testid="button-connect-partner">
              <Users className="w-4 h-4 mr-2" /> Connect
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 shadow-sm">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-200 dark:bg-emerald-900 flex items-center justify-center">
                    <Heart className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />
                  </div>
                  <div>
                    <p className="font-semibold">{partner.partnerName}</p>
                    <p className="text-xs text-muted-foreground">Code: {partner.partnerCode} · Connected {new Date(partner.linkedAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <Badge className="bg-emerald-500 text-white">Connected</Badge>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="share" className="w-full">
            <TabsList className="w-full grid grid-cols-3 h-auto">
              <TabsTrigger value="share" className="py-2.5"><Share2 className="w-4 h-4 mr-1" /> What I share</TabsTrigger>
              <TabsTrigger value="incoming" className="py-2.5"><Inbox className="w-4 h-4 mr-1" /> From them {incoming && <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px]">new</Badge>}</TabsTrigger>
              <TabsTrigger value="extras" className="py-2.5"><Sparkles className="w-4 h-4 mr-1" /> Surprises</TabsTrigger>
            </TabsList>

            {/* WHAT I SHARE */}
            <TabsContent value="share" className="mt-6 space-y-4">
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-serif text-lg">Sharing matrix</CardTitle>
                    <Badge variant="secondary" className="bg-rose-100 text-rose-700 dark:bg-rose-950/40">{enabledCount} of {FEATURE_ORDER.length} on</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Everything is <strong>off by default</strong>. Flip on only what you want {partner.partnerName} to see. You can change any of these at any time.</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {FEATURE_ORDER.map(f => {
                    const m = FEATURE_LABELS[f];
                    return (
                      <div key={f} className="flex items-center justify-between gap-3 py-2.5 border-b border-border/40 last:border-0">
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="text-xl flex-shrink-0">{m.emoji}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{m.label}</p>
                            <p className="text-xs text-muted-foreground">{m.desc}</p>
                          </div>
                        </div>
                        <Switch checked={!!prefs[f]} onCheckedChange={(v) => setPref(f, v)} data-testid={`pref-${f}`} />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="border-rose-200/60 bg-gradient-to-br from-rose-50/50 to-pink-50/50 dark:from-rose-950/20 dark:to-pink-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="font-serif text-lg flex items-center gap-2"><Share2 className="w-5 h-5 text-rose-500" /> Send a snapshot to {partner.partnerName}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">A snapshot is a one-tap bundle of everything you've turned on above. Generate it, copy the code, send it (text, WhatsApp, email — your call). Your partner pastes it on their Partner page.</p>
                  <div className="flex items-center gap-2">
                    <Button onClick={generateAndCopy} disabled={enabledCount === 0} className="bg-rose-500 hover:bg-rose-600 text-white" data-testid="button-generate-snapshot">
                      <Share2 className="w-4 h-4 mr-1.5" /> {enabledCount === 0 ? "Turn something on first" : "Generate & copy snapshot"}
                    </Button>
                    {copied === "snap" && <span className="text-xs text-emerald-600 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> copied</span>}
                  </div>
                  {generatedSnap && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Show snapshot code</summary>
                      <textarea readOnly value={generatedSnap} rows={3} className="w-full mt-2 p-2 rounded border border-border bg-background font-mono text-[10px]" />
                    </details>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* INCOMING */}
            <TabsContent value="incoming" className="mt-6 space-y-4">
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="font-serif text-lg flex items-center gap-2"><Inbox className="w-5 h-5 text-primary" /> Paste a snapshot from {partner.partnerName}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">When they send you their snapshot code, paste it here to see what they chose to share with you.</p>
                  <textarea value={snapshotPaste} onChange={(e) => setSnapshotPaste(e.target.value)} placeholder="Paste snapshot code…" rows={3} className="w-full p-2 rounded border border-border bg-background font-mono text-xs" data-testid="input-snapshot-paste" />
                  <Button onClick={importSnapshot} disabled={!snapshotPaste.trim()} className="w-full bg-primary hover:bg-primary/90" data-testid="button-import-snapshot">
                    <Inbox className="w-4 h-4 mr-1.5" /> Load snapshot
                  </Button>
                </CardContent>
              </Card>

              {incoming ? (
                <Card className="border-rose-200/60 bg-gradient-to-br from-rose-50/40 to-pink-50/40 dark:from-rose-950/20 dark:to-pink-950/20">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="font-serif text-lg flex items-center gap-2"><Eye className="w-5 h-5 text-rose-500" /> Shared by {incoming.from}</CardTitle>
                      <button onClick={() => clearIncomingSnapshot()} className="text-muted-foreground hover:text-destructive p-1" data-testid="button-clear-snapshot"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <p className="text-xs text-muted-foreground">Received {new Date(incoming.at).toLocaleString()}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Object.keys(incoming.data).length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">They haven't turned on any sharing yet.</p>
                    ) : (
                      <IncomingPreview data={incoming.data} />
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-dashed border-border">
                  <CardContent className="pt-6 pb-6 text-center text-muted-foreground text-sm">
                    Nothing yet — when {partner.partnerName} sends a snapshot, it'll appear here 🌹
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* EXTRAS */}
            <TabsContent value="extras" className="mt-6 space-y-4">
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="font-serif text-lg flex items-center gap-2"><Sparkles className="w-5 h-5 text-amber-500" /> Surprise Trip Planner</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {partner.surpriseTrip ? (
                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200">
                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-amber-600 mt-0.5" />
                        <div>
                          <p className="font-semibold">{partner.surpriseTrip.destination}</p>
                          {partner.surpriseTrip.date && <p className="text-xs text-muted-foreground">{new Date(partner.surpriseTrip.date).toLocaleDateString()}</p>}
                          {partner.surpriseTrip.message && <p className="text-sm italic text-muted-foreground mt-1">"{partner.surpriseTrip.message}"</p>}
                        </div>
                      </div>
                      <p className="text-xs text-amber-700 mt-2">Outfit suggestions will be based on the weather at this destination — destination hidden from your partner.</p>
                      <Button size="sm" variant="outline" className="mt-2" onClick={() => setPartner({ ...partner, surpriseTrip: null })}>Remove Trip</Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">Plan a secret surprise! Outfits suggest the right weather without revealing the destination.</p>
                      <div><Label>Destination</Label><Input placeholder="e.g. Paris, France" value={tripForm.destination} onChange={e => setTripForm(f => ({ ...f, destination: e.target.value }))} data-testid="input-trip-destination" /></div>
                      <div><Label>Date</Label><Input type="date" value={tripForm.date} onChange={e => setTripForm(f => ({ ...f, date: e.target.value }))} /></div>
                      <div><Label>Secret message</Label><Input placeholder="Can't wait to take you there!" value={tripForm.message} onChange={e => setTripForm(f => ({ ...f, message: e.target.value }))} /></div>
                      <Button onClick={saveTrip} disabled={!tripForm.destination} className="w-full" data-testid="button-save-trip">Save Surprise Trip</Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30">
                <CardHeader className="pb-2">
                  <CardTitle className="font-serif text-lg flex items-center gap-2"><Gift className="w-5 h-5 text-rose-500" /> Special Dates</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">Wishlist & Reminders will surface them automatically 🌹</p>
                  <div><Label className="text-xs">{partner.partnerName}'s birthday</Label><Input type="date" value={partner.birthday || ""} onChange={e => setPartner({ ...partner, birthday: e.target.value || undefined })} data-testid="input-partner-birthday" /></div>
                  <div><Label className="text-xs">Your anniversary</Label><Input type="date" value={partner.anniversary || ""} onChange={e => setPartner({ ...partner, anniversary: e.target.value || undefined })} data-testid="input-partner-anniversary" /></div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Button variant="outline" className="w-full text-destructive border-destructive/30" onClick={handleDisconnect} data-testid="button-disconnect">Disconnect Partner</Button>
        </>
      )}
    </div>
  );
}

function IncomingPreview({ data }: { data: Record<string, any> }) {
  const items: { label: string; emoji: string; render: () => React.ReactNode }[] = [];

  if (data["rosa_period_data"]) {
    const p = data["rosa_period_data"];
    items.push({ label: "Cycle", emoji: "🌸", render: () => (
      <p>Last period: {p.lastPeriodDate || "—"} · Cycle length: {data["rosa_cycle_length"] || p.cycleLength || 28} days</p>
    )});
  }
  if (data["rosa_moods"]) {
    const arr = Array.isArray(data["rosa_moods"]) ? data["rosa_moods"] : [];
    const last = arr[arr.length - 1];
    items.push({ label: "Mood", emoji: "💗", render: () => (
      <p>{arr.length} entries{last ? ` · latest: ${last.mood || last.label || "—"} (${last.date || ""})` : ""}</p>
    )});
  }
  if (data["rosa_sleep_logs"]) {
    const arr = Array.isArray(data["rosa_sleep_logs"]) ? data["rosa_sleep_logs"] : [];
    const last = arr[0];
    items.push({ label: "Sleep", emoji: "🌙", render: () => (
      <p>{arr.length} nights tracked{last ? ` · last: ${last.bedtime} → ${last.waketime}` : ""}</p>
    )});
  }
  if (data["rosa_milestones"]) {
    const arr = Array.isArray(data["rosa_milestones"]) ? data["rosa_milestones"] : [];
    items.push({ label: "Milestones", emoji: "🏆", render: () => <p>{arr.length} milestone{arr.length === 1 ? "" : "s"}: {arr.slice(0, 3).map((m: any) => m.title || m.name).filter(Boolean).join(", ")}{arr.length > 3 ? "…" : ""}</p> });
  }
  if (data["rosa_goals"]) {
    const arr = Array.isArray(data["rosa_goals"]) ? data["rosa_goals"] : [];
    items.push({ label: "Goals", emoji: "🎯", render: () => <p>{arr.length} goal{arr.length === 1 ? "" : "s"}: {arr.slice(0, 3).map((g: any) => g.title || g.name).filter(Boolean).join(", ")}{arr.length > 3 ? "…" : ""}</p> });
  }
  if (data["rosa_journal_titles"]) {
    const arr = data["rosa_journal_titles"] as Array<{ title: string; date: string }>;
    items.push({ label: "Journal", emoji: "📓", render: () => (
      <ul className="space-y-1">{arr.slice(0, 5).map((e, i) => <li key={i}>· {e.title} <span className="text-muted-foreground">({e.date})</span></li>)}</ul>
    )});
  }
  if (data["rosa_meal_plan"]) items.push({ label: "Meal plan", emoji: "🥗", render: () => <p>Today's plan shared</p> });
  if (data["rosa_workouts"]) {
    const arr = Array.isArray(data["rosa_workouts"]) ? data["rosa_workouts"] : [];
    items.push({ label: "Workouts", emoji: "💪", render: () => <p>{arr.length} session{arr.length === 1 ? "" : "s"} logged</p> });
  }
  if (data["rosa_outfit_today"]) items.push({ label: "Outfit", emoji: "👗", render: () => <p>Today's outfit pick shared</p> });
  if (data["rosa_travel_trips"]) {
    const arr = Array.isArray(data["rosa_travel_trips"]) ? data["rosa_travel_trips"] : [];
    items.push({ label: "Travel", emoji: "✈️", render: () => <p>{arr.length} trip{arr.length === 1 ? "" : "s"}: {arr.slice(0, 3).map((t: any) => t.destination || t.name).filter(Boolean).join(", ")}</p> });
  }
  if (data["rosa_wellness_score"]) items.push({ label: "Wellness", emoji: "✨", render: () => <p>Score: {data["rosa_wellness_score"].score ?? data["rosa_wellness_score"]}</p> });
  if (data["rosa_garden"]) {
    const g = data["rosa_garden"];
    items.push({ label: "Garden", emoji: "🌹", render: () => <p>Level {g.level ?? "—"} · {g.petals ?? 0} petals</p> });
  }
  if (data["rosa_water_today"]) items.push({ label: "Water", emoji: "💧", render: () => <p>{data["rosa_water_today"].cups ?? data["rosa_water_today"]} today</p> });
  if (data["rosa_skin"]) items.push({ label: "Skin", emoji: "🪞", render: () => <p>Skin care shared</p> });
  if (data["rosa_challenges"]) {
    const arr = Array.isArray(data["rosa_challenges"]) ? data["rosa_challenges"] : [];
    items.push({ label: "Challenges", emoji: "🔥", render: () => <p>{arr.length} active</p> });
  }

  if (items.length === 0) return <p className="text-sm text-muted-foreground italic">Nothing visible — check back when they share more.</p>;

  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i} className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0">
          <span className="text-xl flex-shrink-0">{it.emoji}</span>
          <div className="min-w-0 text-sm">
            <p className="font-medium">{it.label}</p>
            <div className="text-xs text-muted-foreground mt-0.5">{it.render()}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
