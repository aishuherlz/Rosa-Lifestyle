import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Shirt, Cloud, Sun, Snowflake, Umbrella, ChevronLeft, ChevronRight, Camera, Sparkles, ShoppingBag, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const AFFILIATE_STORES = [
  { name: "ASOS", url: "https://www.asos.com/search/?q=", color: "bg-black text-white" },
  { name: "Zara", url: "https://www.zara.com/search?searchTerm=", color: "bg-stone-900 text-white" },
  { name: "H&M", url: "https://www2.hm.com/en_us/search-results.html?q=", color: "bg-rose-500 text-white" },
  { name: "Amazon", url: "https://www.amazon.com/s?k=", color: "bg-amber-400 text-stone-900" },
];

type OutfitSuggestion = { name: string; pieces: string[]; vibe: string; styleTip: string };

async function compressImage(file: File, maxDim = 1200, quality = 0.82): Promise<string> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl;
  });
  const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
  const w = Math.round(img.width * ratio), h = Math.round(img.height * ratio);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  c.getContext("2d")!.drawImage(img, 0, 0, w, h);
  return c.toDataURL("image/jpeg", quality);
}

type OutfitPlan = {
  id: string;
  date: string;
  description: string;
  occasion: string;
  mood: string;
};

type PartnerData = {
  surpriseTrip: { destination: string; date: string } | null;
};

const OUTFIT_SUGGESTIONS: Record<string, string[]> = {
  casual: ["Jeans + oversized knit", "Linen trousers + crop top", "Mini skirt + chunky sneakers"],
  formal: ["Tailored blazer + wide leg trousers", "Wrap dress + heels", "Midi dress + structured bag"],
  date: ["Silk slip dress + heels", "Off-shoulder top + high-waist trousers", "Little black dress"],
  workout: ["Matching set + trainers", "Bike shorts + sports bra + cardigan", "Leggings + oversized tee"],
  cozy: ["Oversized hoodie + joggers", "Knit set + ugg boots", "Sweatsuit + plush slippers"],
  work: ["Blazer + tailored trousers + loafers", "Button-down + pencil skirt", "Structured dress + mules"],
};

const WEATHER_SUGGESTIONS = {
  cold: "Layer up! Thick coat, turtleneck, boots, and warm accessories.",
  warm: "Light fabrics — cotton, linen. Breathable and flowy looks.",
  rainy: "Trench coat, waterproof boots, and a structured tote.",
  mild: "Perfect for transitional layering — denim jacket, midi skirts.",
};

export default function OutfitPage() {
  const [outfits, setOutfits] = useLocalStorage<OutfitPlan[]>("rosa_outfits", []);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ description: "", occasion: "casual", mood: "happy" });
  const [partner] = useLocalStorage<PartnerData | null>("rosa_partner", null);
  const [weather, setWeather] = useState<{ temp: number; code: number } | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<{ items: string[]; outfits: OutfitSuggestion[]; missingPiece: string } | null>(null);
  const [aiOccasion, setAiOccasion] = useState("casual");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(file.type)) {
      toast({ title: "Unsupported file type", description: "Please upload a JPG, PNG, or WEBP photo.", variant: "destructive" });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "Photo too large", description: "Please choose a photo under 8MB.", variant: "destructive" });
      return;
    }
    try {
      setAnalyzing(true);
      setAiResult(null);
      const compressed = await compressImage(file);
      setPhotoPreview(compressed);
      const weatherLabel = weather ? `${Math.round(weather.temp)}°C` : "";
      const res = await fetch(`${import.meta.env.BASE_URL}api/openai/outfit-vision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: compressed, occasion: aiOccasion, weather: weatherLabel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to analyze");
      setAiResult(data);
    } catch (err: any) {
      toast({ title: "Couldn't analyze photo", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(async pos => {
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current=temperature_2m,weathercode`);
        const data = await res.json();
        setWeather({ temp: data.current.temperature_2m, code: data.current.weathercode });
      } catch {}
    });
  }, []);

  const getWeatherAdvice = () => {
    if (!weather) return null;
    const { temp, code } = weather;
    if (code >= 61 && code <= 82) return { advice: WEATHER_SUGGESTIONS.rainy, icon: <Umbrella className="w-4 h-4" />, label: "Rainy" };
    if (temp < 10) return { advice: WEATHER_SUGGESTIONS.cold, icon: <Snowflake className="w-4 h-4" />, label: `${Math.round(temp)}°C` };
    if (temp > 22) return { advice: WEATHER_SUGGESTIONS.warm, icon: <Sun className="w-4 h-4" />, label: `${Math.round(temp)}°C` };
    return { advice: WEATHER_SUGGESTIONS.mild, icon: <Cloud className="w-4 h-4" />, label: `${Math.round(temp)}°C` };
  };

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const selectedOutfit = outfits.find(o => o.date === selectedDate);
  const todayOutfits = outfits.filter(o => o.date === selectedDate);
  const weatherAdvice = getWeatherAdvice();

  const handleSave = () => {
    if (!selectedDate) return;
    const item: OutfitPlan = { id: Date.now().toString(), date: selectedDate, ...form };
    setOutfits([...outfits, item]);
    setOpen(false);
    setForm({ description: "", occasion: "casual", mood: "happy" });
  };

  const suggestions = OUTFIT_SUGGESTIONS[form.occasion] || OUTFIT_SUGGESTIONS.casual;

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-serif text-foreground">Outfit Planner</h1>
        <p className="text-muted-foreground mt-1">Dress with intention, every day.</p>
      </motion.div>

      {/* AI Outfit Camera */}
      <Card className="border-rose-200 bg-gradient-to-br from-rose-50 via-pink-50 to-amber-50 shadow-sm">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-white rounded-full shadow-sm"><Sparkles className="w-5 h-5 text-rose-500" /></div>
            <div className="flex-1">
              <p className="font-serif text-lg text-foreground">AI Outfit Stylist 📸</p>
              <p className="text-sm text-muted-foreground mt-0.5">Snap your wardrobe — I'll style 3 looks just for you.</p>
              <Dialog open={cameraOpen} onOpenChange={(v) => { setCameraOpen(v); if (!v) { setAiResult(null); setPhotoPreview(null); } }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="mt-3 bg-rose-500 hover:bg-rose-600" data-testid="button-open-outfit-camera">
                    <Camera className="w-4 h-4 mr-1" /> Style Me
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                  <DialogHeader><DialogTitle className="font-serif text-xl">AI Outfit Stylist</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Occasion</Label>
                      <Select value={aiOccasion} onValueChange={setAiOccasion}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="casual">Casual</SelectItem>
                          <SelectItem value="formal">Formal</SelectItem>
                          <SelectItem value="date">Date Night</SelectItem>
                          <SelectItem value="workout">Workout</SelectItem>
                          <SelectItem value="work">Work</SelectItem>
                          <SelectItem value="cozy">Cozy</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {!photoPreview && !analyzing && (
                      <button onClick={() => fileInputRef.current?.click()}
                        className="w-full py-10 border-2 border-dashed border-rose-300 rounded-2xl text-center hover:bg-rose-50 transition-colors"
                        data-testid="outfit-photo-dropzone">
                        <Camera className="w-8 h-8 text-rose-400 mx-auto" />
                        <p className="text-sm font-medium text-rose-700 mt-2">Tap to take or upload a photo</p>
                        <p className="text-xs text-muted-foreground mt-1">Your wardrobe, an outfit, or pieces you want to mix</p>
                      </button>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} data-testid="outfit-photo-input" />
                    {photoPreview && (
                      <div className="relative rounded-2xl overflow-hidden">
                        <img src={photoPreview} alt="Wardrobe preview" className="w-full max-h-64 object-cover" />
                        <button onClick={() => { setPhotoPreview(null); setAiResult(null); }} className="absolute top-2 right-2 p-1 bg-white/90 rounded-full shadow">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {analyzing && (
                      <div className="flex items-center justify-center gap-2 py-6 text-rose-600">
                        <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Styling your look…</span>
                      </div>
                    )}
                    {aiResult && (
                      <div className="space-y-3">
                        {aiResult.items.length > 0 && (
                          <div>
                            <p className="text-xs uppercase font-semibold text-muted-foreground mb-1">I see</p>
                            <div className="flex flex-wrap gap-1">
                              {aiResult.items.map((it) => <Badge key={it} variant="outline" className="text-xs">{it}</Badge>)}
                            </div>
                          </div>
                        )}
                        {aiResult.outfits.map((o, i) => (
                          <Card key={i} className="border-rose-200 bg-white">
                            <CardContent className="pt-4 pb-4">
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-serif font-medium text-foreground">{o.name}</p>
                                <Badge className="bg-rose-100 text-rose-700 border-0 text-xs">{o.vibe}</Badge>
                              </div>
                              <ul className="mt-2 space-y-0.5 text-sm">
                                {o.pieces.map((p, j) => (
                                  <li key={j} className="flex items-start gap-1.5"><span className="text-rose-400">•</span><span>{p}</span></li>
                                ))}
                              </ul>
                              {o.styleTip && <p className="text-xs italic text-muted-foreground mt-2">💡 {o.styleTip}</p>}
                            </CardContent>
                          </Card>
                        ))}
                        {aiResult.missingPiece && (
                          <Card className="border-amber-200 bg-amber-50">
                            <CardContent className="pt-4 pb-4">
                              <div className="flex items-start gap-2">
                                <ShoppingBag className="w-4 h-4 text-amber-600 mt-0.5" />
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-amber-800">Wishlist piece</p>
                                  <p className="text-sm text-foreground mt-0.5">{aiResult.missingPiece}</p>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {AFFILIATE_STORES.map((s) => (
                                      <a key={s.name} href={`${s.url}${encodeURIComponent(aiResult.missingPiece)}`} target="_blank" rel="noreferrer"
                                        className={`text-xs px-3 py-1 rounded-full ${s.color} hover:opacity-90 transition-opacity`}>
                                        Shop on {s.name}
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                        <Button variant="outline" className="w-full" onClick={() => { setPhotoPreview(null); setAiResult(null); }}>
                          Try Another Photo
                        </Button>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {weatherAdvice && (
        <Card className="border-sky-200 bg-sky-50 shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <span className="text-sky-500 mt-0.5">{weatherAdvice.icon}</span>
              <div>
                <p className="text-sm font-medium text-sky-700">Today's weather: {weatherAdvice.label}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{weatherAdvice.advice}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {partner?.surpriseTrip && (
        <Card className="border-amber-200 bg-amber-50 shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Shirt className="w-5 h-5 text-amber-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-700">Surprise trip packing hint</p>
                <p className="text-sm text-muted-foreground mt-0.5">Your partner has a special trip planned. Pack versatile layers and both dressy and casual options — destination is a surprise!</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calendar */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="font-serif text-lg">Outfit Calendar</CardTitle>
            <div className="flex gap-2 items-center">
              <Button size="icon" variant="ghost" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium min-w-[100px] text-center">{format(currentMonth, "MMMM yyyy")}</span>
              <Button size="icon" variant="ghost" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
              <div key={d} className="text-xs text-muted-foreground font-medium py-1">{d}</div>
            ))}
            {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => <div key={`e${i}`} />)}
            {days.map(day => {
              const dateStr = format(day, "yyyy-MM-dd");
              const hasOutfit = outfits.some(o => o.date === dateStr);
              const isSelected = selectedDate === dateStr;
              const isToday = isSameDay(day, new Date());
              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={cn(
                    "w-8 h-8 flex items-center justify-center text-sm mx-auto rounded-full transition-all relative",
                    isSelected && "bg-primary text-primary-foreground",
                    isToday && !isSelected && "ring-1 ring-primary",
                    !isSelected && "hover:bg-muted"
                  )}
                  data-testid={`calendar-day-${dateStr}`}
                >
                  {format(day, "d")}
                  {hasOutfit && !isSelected && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected date panel */}
      {selectedDate && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="font-serif text-lg">{format(new Date(selectedDate + "T12:00:00"), "MMMM d, yyyy")}</CardTitle>
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-primary" data-testid="button-add-outfit">
                      <Plus className="w-4 h-4 mr-1" /> Plan Outfit
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle className="font-serif text-xl">Plan Your Outfit</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Occasion</Label>
                        <Select value={form.occasion} onValueChange={v => setForm(f => ({ ...f, occasion: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="casual">Casual</SelectItem>
                            <SelectItem value="formal">Formal</SelectItem>
                            <SelectItem value="date">Date Night</SelectItem>
                            <SelectItem value="workout">Workout</SelectItem>
                            <SelectItem value="work">Work</SelectItem>
                            <SelectItem value="cozy">Cozy Day</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Outfit description</Label>
                        <Input placeholder="e.g. Silk midi dress + strappy heels" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} data-testid="input-outfit-desc" />
                      </div>
                      <div>
                        <Label className="mb-2 block">Need inspiration?</Label>
                        <div className="space-y-1">
                          {suggestions.map(s => (
                            <button key={s} onClick={() => setForm(f => ({ ...f, description: s }))} className="text-left text-sm p-2 rounded-lg hover:bg-muted transition-colors w-full">
                              <span className="text-muted-foreground">→</span> {s}
                            </button>
                          ))}
                        </div>
                      </div>
                      <Button onClick={handleSave} disabled={!form.description} className="w-full bg-primary" data-testid="button-save-outfit">Save Outfit</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {todayOutfits.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">No outfit planned for this day yet.</p>
              ) : (
                <div className="space-y-2">
                  {todayOutfits.map(o => (
                    <div key={o.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40" data-testid={`outfit-item-${o.id}`}>
                      <div className="flex items-center gap-3">
                        <Shirt className="w-4 h-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{o.description}</p>
                          <Badge variant="outline" className="text-xs mt-0.5">{o.occasion}</Badge>
                        </div>
                      </div>
                      <button onClick={() => setOutfits(outfits.filter(x => x.id !== o.id))} className="text-muted-foreground hover:text-destructive p-1 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
