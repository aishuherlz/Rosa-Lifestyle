import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, MapPin, Compass, Globe, ExternalLink, Navigation,
  Briefcase, Calendar, CheckSquare, Square, Heart, Plane, Anchor, Mountain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { cn } from "@/lib/utils";
import { format, parseISO, differenceInDays } from "date-fns";

type TripType = "planned" | "bucket";

type Destination = {
  id: string;
  type: TripType;
  name: string;
  country: string;
  notes: string;
  addedAt: string;
  startDate?: string;
  endDate?: string;
  packingList?: string[];
  itinerary?: string;
  visited?: boolean;
};

const SEASONAL_SUGGESTIONS: Record<string, { title: string; icon: string; ideas: string[] }[]> = {
  winter: [
    { icon: "☕", title: "Cosy indoor escapes", ideas: ["Hygge café hopping", "Museum day trip", "Spa weekend retreat", "Hot spring visit"] },
    { icon: "❄️", title: "Winter wonderland", ideas: ["Snow hiking trail", "Christmas market tour", "Ice skating adventure", "Ski resort day trip"] },
  ],
  spring: [
    { icon: "🌸", title: "Blooming outdoors", ideas: ["Cherry blossom picnic", "Botanical garden walk", "Farmer's market tour", "Sunset hike"] },
    { icon: "🏙️", title: "City discovery", ideas: ["Street art walking tour", "Local food market", "Rooftop cocktails", "Hidden neighbourhood"] },
  ],
  summer: [
    { icon: "🏖️", title: "Beach & water", ideas: ["Coastal road trip", "Snorkelling adventure", "Sunset boat cruise", "Wild swimming spot"] },
    { icon: "🌿", title: "Outdoor adventures", ideas: ["Camping under stars", "Waterfall hike", "Island hopping", "Open air festival"] },
  ],
  autumn: [
    { icon: "🍂", title: "Golden season", ideas: ["Forest foliage hike", "Apple orchard visit", "Harvest festival", "Scenic train journey"] },
    { icon: "🎨", title: "Cultural escapes", ideas: ["Wine country tour", "Art gallery weekend", "Literary city tour", "Cosy village stay"] },
  ],
};

const CYCLE_TRAVEL_TIPS: Record<string, { phase: string; emoji: string; tip: string; bestFor: string[] }> = {
  menstrual: {
    phase: "Menstrual Phase",
    emoji: "🌑",
    tip: "Opt for slow, restorative travel. Spa retreats, hot springs, or staycations. Pack your essentials kit!",
    bestFor: ["Wellness retreats", "Hot spring villages", "Cosy cabin stays", "Nearby day trips"],
  },
  follicular: {
    phase: "Follicular Phase",
    emoji: "🌱",
    tip: "Great time for adventure planning. Book tickets, explore new cities, try active itineraries!",
    bestFor: ["City breaks", "Hiking trips", "New destinations", "Cultural tours"],
  },
  ovulation: {
    phase: "Ovulation Phase",
    emoji: "🌕",
    tip: "Peak social energy — ideal for group trips, beach holidays, or romantic escapes.",
    bestFor: ["Beach holidays", "Group adventures", "Romantic getaways", "Festival travel"],
  },
  luteal: {
    phase: "Luteal Phase",
    emoji: "🌘",
    tip: "Quieter, familiar destinations work best. Avoid overpacking your itinerary.",
    bestFor: ["Familiar favourites", "Countryside escapes", "Yoga retreats", "National parks"],
  },
};

function getSeason(): string {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "autumn";
  return "winter";
}

function getCyclePhase(): string {
  const cycleData = localStorage.getItem("rosa_cycle_logs");
  if (!cycleData) return "follicular";
  try {
    const logs = JSON.parse(cycleData);
    if (!logs.length) return "follicular";
    const { periodStart, cycleLength = 28 } = logs[0];
    const start = parseISO(periodStart);
    const day = differenceInDays(new Date(), start) + 1;
    if (day >= 1 && day <= 5) return "menstrual";
    if (day >= 6 && day <= 13) return "follicular";
    if (day >= 14 && day <= 17) return "ovulation";
    return "luteal";
  } catch { return "follicular"; }
}

// Predict the next 6 period windows from latest cycle log
function predictPeriods(): { start: Date; end: Date; cycleNumber: number }[] {
  try {
    const logs = JSON.parse(localStorage.getItem("rosa_cycle_logs") || "[]");
    if (!logs.length) return [];
    const sorted = [...logs].sort((a: any, b: any) => (b.periodStart || "").localeCompare(a.periodStart || ""));
    const latest = sorted[0];
    if (!latest?.periodStart) return [];
    const lastStart = parseISO(latest.periodStart);
    const cycleLen = Number(latest.cycleLength) || 28;
    let periodLen = 5;
    if (latest.periodEnd) {
      const d = differenceInDays(parseISO(latest.periodEnd), lastStart);
      if (d >= 1 && d <= 10) periodLen = d + 1;
    }
    const out: { start: Date; end: Date; cycleNumber: number }[] = [];
    for (let i = 0; i <= 6; i++) {
      const start = new Date(lastStart);
      start.setDate(start.getDate() + i * cycleLen);
      const end = new Date(start);
      end.setDate(end.getDate() + periodLen - 1);
      if (end >= new Date(new Date().getFullYear() - 1, 0, 1)) out.push({ start, end, cycleNumber: i });
    }
    return out;
  } catch { return []; }
}

function getTripPeriodOverlap(tripStart?: string, tripEnd?: string) {
  if (!tripStart) return null;
  try {
    const ts = parseISO(tripStart);
    const te = tripEnd ? parseISO(tripEnd) : ts;
    const periods = predictPeriods();
    for (const p of periods) {
      if (ts <= p.end && te >= p.start) {
        const overlapStart = ts > p.start ? ts : p.start;
        const overlapEnd = te < p.end ? te : p.end;
        return { start: overlapStart, end: overlapEnd, predicted: p.cycleNumber > 0 };
      }
    }
    return null;
  } catch { return null; }
}

const DESTINATION_GRADIENTS = [
  "from-rose-400 to-orange-300", "from-violet-400 to-blue-300",
  "from-emerald-400 to-teal-300", "from-amber-400 to-rose-300",
  "from-sky-400 to-indigo-300", "from-fuchsia-400 to-violet-300",
];

const DEFAULT_PACKING = [
  "Period essentials kit", "Medications & vitamins",
  "Comfortable walking shoes", "Reusable water bottle",
  "Travel insurance docs", "Chargers & adapters",
];

export default function TravelPage() {
  const [destinations, setDestinations] = useLocalStorage<Destination[]>("rosa_destinations", []);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"planned" | "bucket" | "inspire">("planned");
  const [form, setForm] = useState({
    name: "", country: "", notes: "", type: "bucket" as TripType,
    startDate: "", endDate: "", itinerary: "", packingList: [] as string[],
  });
  const [newPackItem, setNewPackItem] = useState("");
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const season = getSeason();
  const cyclePhase = getCyclePhase();
  const cycleTip = CYCLE_TRAVEL_TIPS[cyclePhase];

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(pos => {
      setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
    });
  }, []);

  const handleAdd = () => {
    const item: Destination = {
      id: Date.now().toString(), ...form,
      addedAt: new Date().toISOString(),
      packingList: form.packingList.length ? form.packingList : DEFAULT_PACKING,
    };
    setDestinations([...destinations, item]);
    setOpen(false);
    setForm({ name: "", country: "", notes: "", type: "bucket", startDate: "", endDate: "", itinerary: "", packingList: [] });
    setNewPackItem("");
  };

  const toggleVisited = (id: string) => {
    setDestinations(destinations.map(d => d.id === id ? { ...d, visited: !d.visited } : d));
  };

  const getMapsLink = (dest: Destination) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${dest.name}, ${dest.country}`)}`;
  const getLocalMapsLink = () => userLocation
    ? `https://www.google.com/maps/search/?api=1&query=things+to+do+near+me&ll=${userLocation.lat},${userLocation.lon}`
    : "https://www.google.com/maps/";

  const planned = destinations.filter(d => d.type === "planned");
  const bucket = destinations.filter(d => d.type === "bucket");
  const visited = destinations.filter(d => d.visited);

  const TABS = [
    { id: "planned", label: "Planned Trips", icon: Plane },
    { id: "bucket", label: "Bucket List", icon: Heart },
    { id: "inspire", label: "Inspire Me", icon: Compass },
  ] as const;

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif text-foreground">Travel & Places</h1>
            <p className="text-muted-foreground mt-1">Wanderlust, captured.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-1" /> Add Trip
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-serif text-xl">Add a Destination</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setForm(f => ({ ...f, type: "planned" }))}
                    className={cn("py-2 rounded-xl text-sm font-medium border-2 transition-all flex items-center justify-center gap-2",
                      form.type === "planned" ? "border-primary bg-primary/10 text-primary" : "border-border")}>
                    <Plane className="w-4 h-4" /> Planned Trip
                  </button>
                  <button onClick={() => setForm(f => ({ ...f, type: "bucket" }))}
                    className={cn("py-2 rounded-xl text-sm font-medium border-2 transition-all flex items-center justify-center gap-2",
                      form.type === "bucket" ? "border-primary bg-primary/10 text-primary" : "border-border")}>
                    <Heart className="w-4 h-4" /> Bucket List
                  </button>
                </div>
                <div>
                  <Label>City or Place</Label>
                  <Input placeholder="e.g. Kyoto" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <Label>Country</Label>
                  <Input placeholder="e.g. Japan" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} />
                </div>
                {form.type === "planned" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Start Date</Label>
                        <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                      </div>
                      <div>
                        <Label>End Date</Label>
                        <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <Label>Itinerary Notes</Label>
                      <Textarea placeholder="Day 1: Arrive, check in, explore..." value={form.itinerary} onChange={e => setForm(f => ({ ...f, itinerary: e.target.value }))} className="resize-none" rows={3} />
                    </div>
                    <div>
                      <Label className="mb-2 block">Packing List</Label>
                      <div className="flex gap-2 mb-2">
                        <Input placeholder="Add item..." value={newPackItem} onChange={e => setNewPackItem(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter" && newPackItem.trim()) { setForm(f => ({ ...f, packingList: [...f.packingList, newPackItem.trim()] })); setNewPackItem(""); } }} />
                        <Button size="sm" variant="outline" onClick={() => { if (newPackItem.trim()) { setForm(f => ({ ...f, packingList: [...f.packingList, newPackItem.trim()] })); setNewPackItem(""); } }}>Add</Button>
                      </div>
                      <div className="space-y-1">
                        {(form.packingList.length ? form.packingList : DEFAULT_PACKING).map((item, i) => (
                          <div key={i} className="text-xs flex items-center gap-2 text-muted-foreground">
                            <CheckSquare className="w-3 h-3 text-primary" /> {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                <div>
                  <Label>Notes & Dreams</Label>
                  <Textarea placeholder="Things you want to do there..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="resize-none" />
                </div>
                <Button onClick={handleAdd} disabled={!form.name} className="w-full bg-primary">
                  {form.type === "planned" ? "Add Planned Trip" : "Add to Bucket List"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Planned", count: planned.length, icon: Plane, color: "text-sky-600", bg: "bg-sky-50" },
          { label: "Bucket List", count: bucket.length, icon: Heart, color: "text-rose-600", bg: "bg-rose-50" },
          { label: "Visited", count: visited.length, icon: Anchor, color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map(stat => (
          <div key={stat.label} className={cn("rounded-2xl p-3 text-center", stat.bg)}>
            <stat.icon className={cn("w-5 h-5 mx-auto mb-1", stat.color)} />
            <p className={cn("font-bold text-lg", stat.color)}>{stat.count}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-2xl">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-sm font-medium transition-all",
              activeTab === tab.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}>
            <tab.icon className="w-4 h-4" />{tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "planned" && (
          <motion.div key="planned" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
            {/* Cycle travel tip */}
            <Card className="bg-gradient-to-br from-rose-50 to-pink-50 border-rose-200">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{cycleTip.emoji}</span>
                  <div>
                    <p className="font-medium text-sm text-rose-700">{cycleTip.phase} Travel Tip</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{cycleTip.tip}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {cycleTip.bestFor.map(b => <Badge key={b} variant="outline" className="text-xs border-rose-200 text-rose-600">{b}</Badge>)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {planned.length > 0 ? (
              <div className="space-y-3">
                {planned.map((dest, i) => {
                  const isExpanded = expandedId === dest.id;
                  const daysUntil = dest.startDate ? differenceInDays(parseISO(dest.startDate), new Date()) : null;
                  const periodOverlap = getTripPeriodOverlap(dest.startDate, dest.endDate);
                  return (
                    <motion.div key={dest.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                      <Card className={cn("border-border/50 shadow-sm overflow-hidden", dest.visited && "opacity-60")}>
                        <div className={`h-24 bg-gradient-to-br ${DESTINATION_GRADIENTS[i % DESTINATION_GRADIENTS.length]} flex items-end p-4 relative`}>
                          {dest.visited && <div className="absolute inset-0 bg-black/30 flex items-center justify-center"><Badge className="bg-emerald-500 text-white text-sm">✓ Visited</Badge></div>}
                          <div className="text-white">
                            <h3 className="font-serif font-semibold text-xl leading-tight">{dest.name}</h3>
                            <p className="text-sm opacity-90">{dest.country}</p>
                          </div>
                          {daysUntil !== null && daysUntil >= 0 && (
                            <div className="absolute top-3 right-3 bg-white/90 rounded-xl px-2 py-1 text-xs font-bold text-rose-600">
                              {daysUntil === 0 ? "Today! 🎉" : `${daysUntil}d away`}
                            </div>
                          )}
                        </div>
                        <CardContent className="pt-3 pb-4">
                          {dest.startDate && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                              <Calendar className="w-3.5 h-3.5" />
                              {format(parseISO(dest.startDate), "MMM d")}
                              {dest.endDate && ` – ${format(parseISO(dest.endDate), "MMM d, yyyy")}`}
                            </div>
                          )}
                          {periodOverlap && !dest.visited && (
                            <div className="mb-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2">
                              <span className="text-lg">🩸</span>
                              <div className="flex-1">
                                <p className="text-xs font-semibold text-rose-700">Heads up — your period may arrive on this trip</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Predicted: {format(periodOverlap.start, "MMM d")}{periodOverlap.start.getTime() !== periodOverlap.end.getTime() && ` – ${format(periodOverlap.end, "MMM d")}`}.
                                  Pack period essentials, painkillers, and a heating patch. 💝
                                </p>
                              </div>
                            </div>
                          )}
                          {dest.notes && <p className="text-sm text-muted-foreground mb-2 italic">"{dest.notes}"</p>}
                          <div className="flex gap-2 flex-wrap">
                            <button onClick={() => setExpandedId(isExpanded ? null : dest.id)}
                              className="text-xs text-primary underline underline-offset-2">
                              {isExpanded ? "Hide details" : "Show details"}
                            </button>
                            <a href={getMapsLink(dest)} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="outline" className="text-xs h-7 px-2">
                                <MapPin className="w-3 h-3 mr-1" /> Maps
                              </Button>
                            </a>
                            <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => toggleVisited(dest.id)}>
                              {dest.visited ? "Mark unvisited" : "Mark visited ✓"}
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive h-7 px-2" onClick={() => setDestinations(destinations.filter(d => d.id !== dest.id))}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-3 overflow-hidden">
                                {dest.itinerary && (
                                  <div className="mb-3">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Itinerary</p>
                                    <p className="text-xs text-foreground whitespace-pre-line">{dest.itinerary}</p>
                                  </div>
                                )}
                                {dest.packingList && dest.packingList.length > 0 && (
                                  <div className="mb-3">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Packing List</p>
                                    <div className="grid grid-cols-2 gap-1">
                                      {dest.packingList.map((item, j) => (
                                        <div key={j} className="flex items-center gap-1 text-xs text-muted-foreground">
                                          <CheckSquare className="w-3 h-3 text-primary" /> {item}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {/* Local Discoveries — things to do, stay, eat, shop, gym */}
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">In {dest.name} 🌹</p>
                                  <div className="grid grid-cols-2 gap-1.5">
                                    {(() => {
                                      const place = encodeURIComponent(`${dest.name}, ${dest.country}`);
                                      const links = [
                                        { emoji: "🎯", label: "Things to do", url: `https://www.google.com/search?q=top+things+to+do+in+${place}` },
                                        { emoji: "🏨", label: "Hotels", url: `https://www.booking.com/searchresults.html?ss=${place}` },
                                        { emoji: "🍽️", label: "Best eats", url: `https://www.tripadvisor.com/Search?q=${place}+restaurants` },
                                        { emoji: "🛍️", label: "Local shopping", url: `https://www.google.com/search?q=best+shopping+malls+and+boutiques+in+${place}` },
                                        { emoji: "👗", label: "Outfit shops", url: `https://www.google.com/search?q=women+clothing+stores+in+${place}` },
                                        { emoji: "💪", label: "Gyms / studios", url: `https://www.classpass.com/search/${place}` },
                                        { emoji: "💆", label: "Spas & wellness", url: `https://www.google.com/search?q=best+spas+in+${place}` },
                                        { emoji: "🚖", label: "Getting around", url: `https://www.google.com/search?q=public+transport+and+taxis+in+${place}` },
                                      ];
                                      return links.map(l => (
                                        <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
                                          className="flex items-center gap-1.5 text-xs px-2.5 py-2 rounded-lg bg-rose-50/60 border border-rose-100 hover:bg-rose-50 transition-colors text-foreground">
                                          <span>{l.emoji}</span> <span className="truncate">{l.label}</span>
                                        </a>
                                      ));
                                    })()}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <Card className="border-dashed border-2 border-border text-center py-12">
                <CardContent>
                  <Plane className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground font-serif">No planned trips yet</p>
                  <p className="text-muted-foreground text-sm mt-1">Add your next adventure!</p>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}

        {activeTab === "bucket" && (
          <motion.div key="bucket" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
            {bucket.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {bucket.map((dest, i) => (
                  <motion.div key={dest.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                    <Card className={cn("border-border/50 shadow-sm hover:shadow-md transition-shadow overflow-hidden", dest.visited && "opacity-60")}>
                      <div className={`h-20 bg-gradient-to-br ${DESTINATION_GRADIENTS[i % DESTINATION_GRADIENTS.length]} flex items-end p-4 relative`}>
                        {dest.visited && <div className="absolute inset-0 bg-black/20 flex items-center justify-center"><p className="text-white text-sm font-bold">✓ Done!</p></div>}
                        <div className="text-white">
                          <h3 className="font-serif font-semibold text-lg leading-tight">{dest.name}</h3>
                          <p className="text-sm opacity-90">{dest.country}</p>
                        </div>
                      </div>
                      <CardContent className="pt-3 pb-4">
                        {dest.notes && <p className="text-sm text-muted-foreground mb-3 line-clamp-2 italic">"{dest.notes}"</p>}
                        <div className="flex gap-2">
                          <a href={getMapsLink(dest)} target="_blank" rel="noopener noreferrer" className="flex-1">
                            <Button size="sm" variant="outline" className="w-full text-xs">
                              <MapPin className="w-3 h-3 mr-1" /> Maps
                            </Button>
                          </a>
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => toggleVisited(dest.id)}>
                            {dest.visited ? <Square className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />}
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDestinations(destinations.filter(d => d.id !== dest.id))}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <Card className="border-dashed border-2 border-border text-center py-12">
                <CardContent>
                  <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground text-lg font-serif">Your bucket list awaits</p>
                  <p className="text-muted-foreground text-sm mt-1">Add destinations you dream of visiting</p>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}

        {activeTab === "inspire" && (
          <motion.div key="inspire" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-5">
            {/* Near you */}
            <Card className="bg-gradient-to-br from-sky-50 to-blue-50 border-sky-200">
              <CardHeader className="pb-2">
                <CardTitle className="font-serif text-lg flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-sky-500" /> Near You
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Discover what's around you this {season}.</p>
                <a href={getLocalMapsLink()} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="border-sky-300 text-sky-700 hover:bg-sky-50">
                    <MapPin className="w-4 h-4 mr-1" /> Explore on Maps <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                </a>
              </CardContent>
            </Card>

            {/* Cycle travel recommendation */}
            <Card className="bg-gradient-to-br from-rose-50 to-pink-50 border-rose-200">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs font-semibold text-rose-600 uppercase tracking-wide mb-2">Travel with Your Cycle</p>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{cycleTip.emoji}</span>
                  <div>
                    <p className="font-medium text-sm text-foreground">{cycleTip.phase}</p>
                    <p className="text-xs text-muted-foreground mt-1">{cycleTip.tip}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {cycleTip.bestFor.map(b => (
                        <Badge key={b} variant="outline" className="text-xs border-rose-200 text-rose-600">{b}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Seasonal ideas */}
            <div>
              <h2 className="text-xl font-serif mb-3 flex items-center gap-2 capitalize">
                <Compass className="w-5 h-5 text-primary" /> {season} Weekend Ideas
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {SEASONAL_SUGGESTIONS[season].map((group) => (
                  <Card key={group.title} className="border-border/50 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <span className="text-lg">{group.icon}</span> {group.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {group.ideas.map(idea => (
                        <div key={idea} className="flex items-center gap-2 text-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                          {idea}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Dream destinations by mood */}
            <div>
              <h2 className="text-xl font-serif mb-3 flex items-center gap-2">
                <Mountain className="w-5 h-5 text-primary" /> Dream Destinations by Mood
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { mood: "Adventure", emoji: "🧗‍♀️", places: ["Patagonia, Argentina", "New Zealand", "Iceland", "Nepal"] },
                  { mood: "Romance", emoji: "💕", places: ["Santorini, Greece", "Paris, France", "Tuscany, Italy", "Bali, Indonesia"] },
                  { mood: "Wellness", emoji: "🌿", places: ["Ubud, Bali", "Costa Rica", "Sedona, Arizona", "Rishikesh, India"] },
                  { mood: "Culture", emoji: "🏛️", places: ["Kyoto, Japan", "Marrakech, Morocco", "Istanbul, Turkey", "Lisbon, Portugal"] },
                ].map(m => (
                  <Card key={m.mood} className="border-border/50">
                    <CardContent className="pt-3 pb-3">
                      <p className="font-medium text-sm flex items-center gap-1.5 mb-2"><span>{m.emoji}</span>{m.mood}</p>
                      {m.places.map(p => (
                        <div key={p} className="flex items-center gap-2 text-xs text-muted-foreground py-0.5">
                          <Globe className="w-3 h-3" /> {p}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
