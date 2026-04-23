import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Utensils, Plus, Trash2, Apple, Coffee, Moon, Sun, Lock, Camera, Sparkles, Loader2, X, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useSubscription } from "@/lib/subscription-context";
import { useLocation } from "wouter";
import { differenceInDays, parseISO } from "date-fns";

type FoodEntry = {
  id: string;
  name: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  meal: "breakfast" | "lunch" | "dinner" | "snack";
  date: string;
  imageUrl?: string;
  source?: "manual" | "ai" | "quick";
};

type DietPlan = {
  goal: "lose" | "maintain" | "gain";
  targetCalories: number;
  dietType: string;
  waterGoal: number;
};

type AiResult = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  confidence: "low" | "medium" | "high";
  items: string[];
  healthNote: string;
  imageDataUrl: string;
  thumbDataUrl: string;
};

const MEAL_ICONS = {
  breakfast: <Coffee className="w-4 h-4" />,
  lunch: <Sun className="w-4 h-4" />,
  dinner: <Moon className="w-4 h-4" />,
  snack: <Apple className="w-4 h-4" />,
};

const DIET_PLANS = [
  { id: "balanced", label: "Balanced", desc: "Everything in moderation — sustainable and realistic", calories: 1800 },
  { id: "lowcarb", label: "Low Carb", desc: "Reduce carbs, boost protein and healthy fats", calories: 1600 },
  { id: "mediterranean", label: "Mediterranean", desc: "Whole grains, olive oil, fish, and fresh veg", calories: 1900 },
  { id: "plant", label: "Plant-Based", desc: "Fruits, veggies, legumes — kind to you and the planet", calories: 1700 },
  { id: "intermittent", label: "Intermittent 16:8", desc: "Eat within an 8-hour window each day", calories: 1650 },
];

const COMMON_FOODS: { name: string; calories: number }[] = [
  { name: "Oatmeal (1 cup)", calories: 150 },
  { name: "Banana", calories: 105 },
  { name: "Greek Yogurt (1 cup)", calories: 130 },
  { name: "Grilled Chicken (100g)", calories: 165 },
  { name: "Brown Rice (1 cup)", calories: 215 },
  { name: "Avocado (1/2)", calories: 120 },
  { name: "Salad with dressing", calories: 180 },
  { name: "Salmon (100g)", calories: 208 },
];

const CYCLE_MACRO_GUIDE: Record<string, { phase: string; emoji: string; tip: string; protein: string; carbs: string; fat: string; foods: string[] }> = {
  menstrual: {
    phase: "Menstrual Phase",
    emoji: "🌑",
    tip: "Replenish iron and magnesium. Warm, comforting meals.",
    protein: "20%",
    carbs: "50%",
    fat: "30%",
    foods: ["Lentils 🫘", "Spinach 🥬", "Dark chocolate 🍫", "Bananas 🍌", "Warm soups 🍲"],
  },
  follicular: {
    phase: "Follicular Phase",
    emoji: "🌱",
    tip: "Light, fresh foods. Boost metabolism with protein.",
    protein: "30%",
    carbs: "45%",
    fat: "25%",
    foods: ["Eggs 🥚", "Salads 🥗", "Sprouts 🌱", "Berries 🫐", "Fermented foods 🥒"],
  },
  ovulation: {
    phase: "Ovulation Phase",
    emoji: "🌕",
    tip: "Anti-inflammatory peak. Colourful, raw, vibrant.",
    protein: "30%",
    carbs: "40%",
    fat: "30%",
    foods: ["Salmon 🐟", "Pumpkin seeds 🌻", "Quinoa", "Citrus fruits 🍊", "Asparagus"],
  },
  luteal: {
    phase: "Luteal Phase",
    emoji: "🌘",
    tip: "Stabilize blood sugar. Complex carbs, magnesium-rich foods.",
    protein: "25%",
    carbs: "45%",
    fat: "30%",
    foods: ["Sweet potato 🍠", "Pumpkin seeds", "Dark leafy greens 🥦", "Brown rice", "Walnuts 🌰"],
  },
};

function getCyclePhase(): keyof typeof CYCLE_MACRO_GUIDE {
  const data = localStorage.getItem("rosa_cycle_logs");
  if (!data) return "follicular";
  try {
    const logs = JSON.parse(data);
    if (!logs.length) return "follicular";
    const { periodStart, cycleLength = 28 } = logs[0];
    const start = parseISO(periodStart);
    const elapsed = differenceInDays(new Date(), start);
    if (elapsed < 0) return "follicular";
    const len = Math.max(20, Math.min(45, cycleLength));
    const day = (elapsed % len) + 1;
    if (day <= 5) return "menstrual";
    if (day <= 13) return "follicular";
    if (day <= 17) return "ovulation";
    return "luteal";
  } catch { return "follicular"; }
}

const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
const THUMB_MAX_DIM = 240;

async function fileToCompressedThumb(file: File): Promise<{ fullDataUrl: string; thumbDataUrl: string }> {
  const fullDataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = fullDataUrl;
  });
  const ratio = Math.min(1, THUMB_MAX_DIM / Math.max(img.width, img.height));
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { fullDataUrl, thumbDataUrl: fullDataUrl };
  ctx.drawImage(img, 0, 0, w, h);
  const thumbDataUrl = canvas.toDataURL("image/jpeg", 0.7);
  return { fullDataUrl, thumbDataUrl };
}

const today = new Date().toISOString().split("T")[0];

export default function FoodPlanner() {
  const { isPremium } = useSubscription();
  const [, setLocation] = useLocation();
  const [entries, setEntries] = useLocalStorage<FoodEntry[]>("rosa_food_entries", []);
  const [dietPlan, setDietPlan] = useLocalStorage<DietPlan>("rosa_diet_plan", {
    goal: "maintain", targetCalories: 1800, dietType: "balanced", waterGoal: 8,
  });
  const [waterGlasses, setWaterGlasses] = useLocalStorage<number>("rosa_water_today", 0);
  const [newFood, setNewFood] = useState("");
  const [newCals, setNewCals] = useState("");
  const [newMeal, setNewMeal] = useState<FoodEntry["meal"]>("breakfast");
  const [tab, setTab] = useState<"today" | "plan" | "history">("today");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI photo logging state
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [aiError, setAiError] = useState("");
  const [editName, setEditName] = useState("");
  const [editCals, setEditCals] = useState(0);
  const [editMeal, setEditMeal] = useState<FoodEntry["meal"]>("lunch");

  const cyclePhase = getCyclePhase();
  const cycleGuide = CYCLE_MACRO_GUIDE[cyclePhase];

  if (!isPremium) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
        <Lock className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="font-serif text-2xl font-medium mb-2">Premium Feature</h2>
        <p className="text-muted-foreground text-sm mb-6">Food planning is part of ROSA Premium</p>
        <Button onClick={() => setLocation("/subscription")} className="bg-rose-500 hover:bg-rose-600 text-white rounded-2xl">
          View Plans
        </Button>
      </div>
    );
  }

  const todayEntries = entries.filter((e) => e.date === today);
  const todayCalories = todayEntries.reduce((sum, e) => sum + e.calories, 0);
  const todayProtein = todayEntries.reduce((s, e) => s + (e.protein || 0), 0);
  const todayCarbs = todayEntries.reduce((s, e) => s + (e.carbs || 0), 0);
  const todayFat = todayEntries.reduce((s, e) => s + (e.fat || 0), 0);
  const progress = Math.min(100, (todayCalories / dietPlan.targetCalories) * 100);
  const remaining = dietPlan.targetCalories - todayCalories;

  function addEntry() {
    if (!newFood.trim() || !newCals) return;
    setEntries([...entries, {
      id: Date.now().toString(), name: newFood.trim(), calories: parseInt(newCals),
      meal: newMeal, date: today, source: "manual",
    }]);
    setNewFood(""); setNewCals("");
  }

  function removeEntry(id: string) {
    setEntries(entries.filter((e) => e.id !== id));
  }

  function addQuickFood(food: { name: string; calories: number }) {
    setEntries([...entries, {
      id: Date.now().toString(), name: food.name, calories: food.calories,
      meal: newMeal, date: today, source: "quick",
    }]);
  }

  async function handlePhotoSelect(file: File) {
    setAiError("");
    if (!file.type.startsWith("image/")) {
      setAiError("Please select an image file."); return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setAiError("Image must be under 6MB."); return;
    }
    setAiAnalyzing(true);
    setAiResult(null);
    try {
      const { fullDataUrl, thumbDataUrl } = await fileToCompressedThumb(file);

      const resp = await fetch("/api/openai/food-vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: fullDataUrl, mealHint: newMeal }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Could not analyze image");
      }

      const data = await resp.json();
      setAiResult({ ...data, imageDataUrl: fullDataUrl, thumbDataUrl });
      setEditName(data.name);
      setEditCals(data.calories);
      setEditMeal(newMeal);
    } catch (e: any) {
      setAiError(e.message || "Something went wrong. Please try again.");
    } finally {
      setAiAnalyzing(false);
    }
  }

  function confirmAiEntry() {
    if (!aiResult) return;
    const newEntry: FoodEntry = {
      id: Date.now().toString(),
      name: editName.trim() || aiResult.name,
      calories: editCals,
      protein: aiResult.protein,
      carbs: aiResult.carbs,
      fat: aiResult.fat,
      fiber: aiResult.fiber,
      meal: editMeal,
      date: today,
      imageUrl: aiResult.thumbDataUrl,
      source: "ai",
    };
    try {
      setEntries([...entries, newEntry]);
    } catch {
      const { imageUrl, ...withoutImage } = newEntry;
      setEntries([...entries, withoutImage]);
      setAiError("Saved without photo (storage full).");
    }
    setAiResult(null);
  }

  const mealGroups = ["breakfast", "lunch", "dinner", "snack"] as const;

  return (
    <div className="min-h-screen pb-24">
      <div className="px-4 py-6 max-w-lg mx-auto">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="font-serif text-2xl font-medium text-foreground">Food Planner</h1>
          <p className="text-muted-foreground text-sm mt-1">Nourish your body with intention</p>
        </motion.div>

        <div className="flex gap-2 mb-6">
          {(["today", "plan", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-full text-sm capitalize transition-all ${tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "today" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* AI Snap & Log card */}
            <Card className="border-rose-200 bg-gradient-to-br from-rose-50 via-pink-50 to-amber-50">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-white shadow-sm">
                    <Sparkles className="w-5 h-5 text-rose-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-foreground">Snap & Log a Meal</p>
                    <p className="text-xs text-muted-foreground mt-0.5">AI estimates calories, protein, carbs & fat from a photo</p>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoSelect(f); e.target.value = ""; }}
                />
                <Button onClick={() => fileInputRef.current?.click()} disabled={aiAnalyzing}
                  className="w-full mt-3 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-xl">
                  {aiAnalyzing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing your meal…</>
                  ) : (
                    <><Camera className="w-4 h-4 mr-2" /> Take or Upload Photo</>
                  )}
                </Button>
                {aiError && <p className="text-xs text-red-500 mt-2 text-center">{aiError}</p>}
              </CardContent>
            </Card>

            {/* Cycle macro guide */}
            <Card className="border-rose-100 bg-rose-50/40">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-xl">{cycleGuide.emoji}</span>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide">Cycle-aware nutrition</p>
                    <p className="text-sm font-medium text-foreground">{cycleGuide.phase}</p>
                    <p className="text-xs text-muted-foreground mt-1">{cycleGuide.tip}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="text-center bg-white/60 rounded-xl p-2">
                    <p className="text-xs text-muted-foreground">Protein</p>
                    <p className="font-bold text-sm text-rose-600">{cycleGuide.protein}</p>
                  </div>
                  <div className="text-center bg-white/60 rounded-xl p-2">
                    <p className="text-xs text-muted-foreground">Carbs</p>
                    <p className="font-bold text-sm text-amber-600">{cycleGuide.carbs}</p>
                  </div>
                  <div className="text-center bg-white/60 rounded-xl p-2">
                    <p className="text-xs text-muted-foreground">Fat</p>
                    <p className="font-bold text-sm text-emerald-600">{cycleGuide.fat}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-3">
                  {cycleGuide.foods.map(f => (
                    <Badge key={f} variant="outline" className="text-xs border-rose-200 text-rose-600">{f}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Calories card */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-sm font-medium">Today's Calories</span>
                  <span className="text-xs text-muted-foreground">Goal: {dietPlan.targetCalories} kcal</span>
                </div>
                <Progress value={progress} className="h-3 rounded-full" />
                <div className="flex justify-between mt-2">
                  <span className={`text-xl font-serif font-medium ${todayCalories > dietPlan.targetCalories ? "text-red-500" : "text-foreground"}`}>
                    {todayCalories} <span className="text-sm font-sans font-normal text-muted-foreground">kcal eaten</span>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {remaining > 0 ? `${remaining} left` : `${Math.abs(remaining)} over`}
                  </span>
                </div>
                {(todayProtein > 0 || todayCarbs > 0 || todayFat > 0) && (
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Protein</p>
                      <p className="font-semibold text-sm text-rose-600">{todayProtein}g</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Carbs</p>
                      <p className="font-semibold text-sm text-amber-600">{todayCarbs}g</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Fat</p>
                      <p className="font-semibold text-sm text-emerald-600">{todayFat}g</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Water card */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium">Water ({waterGlasses}/{dietPlan.waterGoal} glasses)</p>
                  <div className="flex gap-1">
                    {Array.from({ length: dietPlan.waterGoal }).map((_, i) => (
                      <button key={i} onClick={() => setWaterGlasses(i < waterGlasses ? i : i + 1)}
                        className={`w-5 h-5 rounded-full border-2 transition-all ${i < waterGlasses ? "bg-blue-400 border-blue-400" : "border-blue-200"}`}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Add food card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Add Manually</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Food name" value={newFood} onChange={(e) => setNewFood(e.target.value)} className="rounded-xl" />
                  <Input placeholder="Calories" type="number" value={newCals} onChange={(e) => setNewCals(e.target.value)} className="rounded-xl" />
                </div>
                <Select value={newMeal} onValueChange={(v: any) => setNewMeal(v)}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="breakfast">Breakfast</SelectItem>
                    <SelectItem value="lunch">Lunch</SelectItem>
                    <SelectItem value="dinner">Dinner</SelectItem>
                    <SelectItem value="snack">Snack</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={addEntry} className="w-full bg-rose-500 hover:bg-rose-600 text-white rounded-xl">
                  <Plus className="w-4 h-4 mr-1" /> Add Entry
                </Button>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Quick add:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_FOODS.slice(0, 8).map((f) => (
                      <button key={f.name} onClick={() => addQuickFood(f)}
                        className="px-2.5 py-1 bg-rose-50 text-rose-700 text-xs rounded-full border border-rose-100 hover:bg-rose-100 transition-colors">
                        {f.name} ({f.calories})
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Meal entries grouped */}
            {mealGroups.map((meal) => {
              const mealEntries = todayEntries.filter((e) => e.meal === meal);
              if (!mealEntries.length) return null;
              return (
                <Card key={meal}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 capitalize">
                      {MEAL_ICONS[meal]} {meal}
                      <Badge variant="outline" className="ml-auto text-xs">
                        {mealEntries.reduce((s, e) => s + e.calories, 0)} kcal
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {mealEntries.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between gap-2">
                        {entry.imageUrl && (
                          <img src={entry.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm text-foreground truncate">{entry.name}</span>
                            {entry.source === "ai" && <Sparkles className="w-3 h-3 text-rose-500 flex-shrink-0" />}
                          </div>
                          {(entry.protein || entry.carbs || entry.fat) && (
                            <p className="text-xs text-muted-foreground">
                              P:{entry.protein || 0}g · C:{entry.carbs || 0}g · F:{entry.fat || 0}g
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground flex-shrink-0">{entry.calories} kcal</span>
                        <button onClick={() => removeEntry(entry.id)} className="text-muted-foreground/50 hover:text-red-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </motion.div>
        )}

        {tab === "plan" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Your Goal</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {(["lose", "maintain", "gain"] as const).map((g) => (
                    <button key={g} onClick={() => setDietPlan({ ...dietPlan, goal: g })}
                      className={`p-2 rounded-xl text-sm border-2 capitalize transition-all ${dietPlan.goal === g ? "border-primary bg-primary/5 text-primary font-medium" : "border-border text-muted-foreground"}`}>
                      {g === "lose" ? "Lose weight" : g === "gain" ? "Build up" : "Maintain"}
                    </button>
                  ))}
                </div>
                <div>
                  <Label className="text-xs">Daily Calorie Target</Label>
                  <Input type="number" value={dietPlan.targetCalories}
                    onChange={(e) => setDietPlan({ ...dietPlan, targetCalories: parseInt(e.target.value) || 1800 })}
                    className="rounded-xl mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Daily Water Goal (glasses)</Label>
                  <Input type="number" value={dietPlan.waterGoal}
                    onChange={(e) => setDietPlan({ ...dietPlan, waterGoal: parseInt(e.target.value) || 8 })}
                    className="rounded-xl mt-1" />
                </div>
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide px-1">Diet Style</p>
            {DIET_PLANS.map((plan) => (
              <motion.div key={plan.id} whileTap={{ scale: 0.98 }}
                onClick={() => setDietPlan({ ...dietPlan, dietType: plan.id, targetCalories: plan.calories })}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${dietPlan.dietType === plan.id ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm text-foreground">{plan.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{plan.desc}</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0 ml-2">{plan.calories} kcal</Badge>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {tab === "history" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {Object.entries(
              entries.reduce<Record<string, FoodEntry[]>>((acc, e) => {
                if (!acc[e.date]) acc[e.date] = [];
                acc[e.date].push(e);
                return acc;
              }, {})
            )
              .sort((a, b) => b[0].localeCompare(a[0]))
              .slice(0, 14)
              .map(([date, dayEntries]) => {
                const total = dayEntries.reduce((s, e) => s + e.calories, 0);
                return (
                  <Card key={date}>
                    <CardContent className="pt-3 pb-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">
                          {new Date(date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        </span>
                        <Badge variant={total > dietPlan.targetCalories ? "destructive" : "secondary"} className="text-xs">
                          {total} kcal
                        </Badge>
                      </div>
                      <Progress value={Math.min(100, (total / dietPlan.targetCalories) * 100)} className="h-2" />
                    </CardContent>
                  </Card>
                );
              })}
            {entries.length === 0 && (
              <p className="text-center text-muted-foreground text-sm pt-8">No history yet — start logging today!</p>
            )}
          </motion.div>
        )}
      </div>

      {/* AI Result Modal */}
      <Dialog open={!!aiResult} onOpenChange={(open) => { if (!open) setAiResult(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-rose-500" /> AI Detected
            </DialogTitle>
          </DialogHeader>
          {aiResult && (
            <div className="space-y-4">
              <img src={aiResult.thumbDataUrl || aiResult.imageDataUrl} alt="meal" className="w-full h-48 object-cover rounded-2xl" />

              <div className="flex items-center justify-between">
                <Badge variant="outline" className={
                  aiResult.confidence === "high" ? "border-emerald-300 text-emerald-700"
                  : aiResult.confidence === "medium" ? "border-amber-300 text-amber-700"
                  : "border-orange-300 text-orange-700"
                }>
                  {aiResult.confidence} confidence
                </Badge>
                {aiResult.healthNote && <p className="text-xs text-muted-foreground italic flex-1 ml-2 text-right">"{aiResult.healthNote}"</p>}
              </div>

              {aiResult.items.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Detected items</p>
                  <div className="flex flex-wrap gap-1">
                    {aiResult.items.map((item, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{item}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-4 gap-2">
                <div className="bg-rose-50 rounded-xl p-2 text-center">
                  <p className="text-xs text-muted-foreground">Cal</p>
                  <p className="font-bold text-base text-rose-600">{aiResult.calories}</p>
                </div>
                <div className="bg-pink-50 rounded-xl p-2 text-center">
                  <p className="text-xs text-muted-foreground">Protein</p>
                  <p className="font-bold text-base text-pink-600">{aiResult.protein}g</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-2 text-center">
                  <p className="text-xs text-muted-foreground">Carbs</p>
                  <p className="font-bold text-base text-amber-600">{aiResult.carbs}g</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-2 text-center">
                  <p className="text-xs text-muted-foreground">Fat</p>
                  <p className="font-bold text-base text-emerald-600">{aiResult.fat}g</p>
                </div>
              </div>

              <div>
                <Label className="text-xs flex items-center gap-1"><Edit3 className="w-3 h-3" /> Edit before saving</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="rounded-xl" />
                  <Input type="number" value={editCals} onChange={(e) => setEditCals(parseInt(e.target.value) || 0)} className="rounded-xl" />
                </div>
                <Select value={editMeal} onValueChange={(v: any) => setEditMeal(v)}>
                  <SelectTrigger className="rounded-xl mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="breakfast">Breakfast</SelectItem>
                    <SelectItem value="lunch">Lunch</SelectItem>
                    <SelectItem value="dinner">Dinner</SelectItem>
                    <SelectItem value="snack">Snack</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setAiResult(null)}>
                  <X className="w-4 h-4 mr-1" /> Discard
                </Button>
                <Button onClick={confirmAiEntry} className="flex-1 bg-rose-500 hover:bg-rose-600 text-white rounded-xl">
                  <Plus className="w-4 h-4 mr-1" /> Log Meal
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
