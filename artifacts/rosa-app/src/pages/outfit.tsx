import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Shirt, Cloud, Sun, Snowflake, Umbrella, ChevronLeft, ChevronRight } from "lucide-react";
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
