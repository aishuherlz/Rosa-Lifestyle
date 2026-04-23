import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Utensils, Plus, Trash2, TrendingDown, Apple, Coffee, Moon, Sun, Lock, Camera, Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useSubscription } from "@/lib/subscription-context";
import { useLocation } from "wouter";
import { readCyclePhase, PHASE_FOOD, getNextPlannedTrip } from "@/lib/sync";
import { apiUrl } from "@/lib/api";

type FoodEntry = {
  id: string;
  name: string;
  calories: number;
  meal: "breakfast" | "lunch" | "dinner" | "snack";
  date: string;
};

type DietPlan = {
  goal: "lose" | "maintain" | "gain";
  targetCalories: number;
  dietType: string;
  waterGoal: number;
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
  { name: "Sweet Potato (medium)", calories: 130 },
  { name: "Dark Chocolate (30g)", calories: 170 },
  { name: "Almonds (30g)", calories: 170 },
  { name: "Coffee with milk", calories: 50 },
  { name: "Green Smoothie", calories: 150 },
  { name: "Quinoa (1 cup)", calories: 222 },
  { name: "Eggs (2)", calories: 155 },
];

const today = new Date().toISOString().split("T")[0];

export default function FoodPlanner() {
  const { isPremium } = useSubscription();
  const [, setLocation] = useLocation();
  const [entries, setEntries] = useLocalStorage<FoodEntry[]>("rosa_food_entries", []);
  const [dietPlan, setDietPlan] = useLocalStorage<DietPlan>("rosa_diet_plan", {
    goal: "maintain",
    targetCalories: 1800,
    dietType: "balanced",
    waterGoal: 8,
  });
  const [waterGlasses, setWaterGlasses] = useLocalStorage<number>("rosa_water_today", 0);
  const [newFood, setNewFood] = useState("");
  const [newCals, setNewCals] = useState("");
  const [newMeal, setNewMeal] = useState<"breakfast" | "lunch" | "dinner" | "snack">("breakfast");
  const [tab, setTab] = useState<"today" | "plan" | "history">("today");
  const { toast } = useToast();
  const aiInputRef = useRef<HTMLInputElement>(null);
  const [aiPreview, setAiPreview] = useState<string | null>(null);
  const [aiMeal, setAiMeal] = useState<"breakfast" | "lunch" | "dinner" | "snack">("lunch");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{ name?: string; calories?: number; protein?: number; carbs?: number; fat?: number; healthNote?: string; items?: string[]; error?: string } | null>(null);

  const handleAiFile = (file: File) => {
    if (file.size > 6 * 1024 * 1024) { toast({ title: "Image too large", description: "Please use a photo under 6MB.", variant: "destructive" }); return; }
    const reader = new FileReader();
    reader.onload = () => { setAiPreview(reader.result as string); setAiResult(null); };
    reader.readAsDataURL(file);
  };
  const analyzeFood = async () => {
    if (!aiPreview) return;
    setAiLoading(true);
    try {
      const r = await fetch(apiUrl("/api/food-vision"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: aiPreview, mealHint: aiMeal }),
      });
      const data = await r.json();
      if (!r.ok || data.error) {
        toast({ title: "Couldn't analyze", description: data.error === "not_food" ? "That doesn't look like food — try a clearer meal photo." : (data.error || "Try again."), variant: "destructive" });
        setAiResult(null);
      } else { setAiResult(data); }
    } catch { toast({ title: "Network error", description: "Please try again.", variant: "destructive" }); }
    finally { setAiLoading(false); }
  };
  const logAiFood = () => {
    if (!aiResult?.name || !aiResult?.calories) return;
    const newEntry: FoodEntry = { id: Date.now().toString(), name: aiResult.name, calories: Math.round(aiResult.calories), meal: aiMeal, date: today };
    setEntries([...entries, newEntry]);
    toast({ title: "Logged 🌹", description: `${aiResult.name} · ${Math.round(aiResult.calories)} kcal` });
    setAiPreview(null); setAiResult(null);
  };

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
  const progress = Math.min(100, (todayCalories / dietPlan.targetCalories) * 100);
  const remaining = dietPlan.targetCalories - todayCalories;

  function addEntry() {
    if (!newFood.trim() || !newCals) return;
    const entry: FoodEntry = {
      id: Date.now().toString(),
      name: newFood.trim(),
      calories: parseInt(newCals),
      meal: newMeal,
      date: today,
    };
    setEntries([...entries, entry]);
    setNewFood("");
    setNewCals("");
  }

  function removeEntry(id: string) {
    setEntries(entries.filter((e) => e.id !== id));
  }

  function addQuickFood(food: { name: string; calories: number }) {
    const entry: FoodEntry = {
      id: Date.now().toString(),
      name: food.name,
      calories: food.calories,
      meal: newMeal,
      date: today,
    };
    setEntries([...entries, entry]);
  }

  const mealGroups = ["breakfast", "lunch", "dinner", "snack"] as const;
  const cyc = readCyclePhase();
  const cycFood = cyc.phase !== "unknown" ? PHASE_FOOD[cyc.phase] : null;
  const nextTrip = getNextPlannedTrip();

  return (
    <div className="min-h-screen pb-24">
      <div className="px-4 py-6 max-w-lg mx-auto">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="font-serif text-2xl font-medium text-foreground">Food Planner</h1>
          <p className="text-muted-foreground text-sm mt-1">Nourish your body with intention</p>
        </motion.div>

        {cycFood && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50 p-4" data-testid="banner-cycle-food">
            <p className="text-xs uppercase tracking-widest text-rose-600">Day {cyc.day} · {cyc.phase} phase</p>
            <p className="font-serif text-sm text-rose-900 mt-1">{cycFood.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{cycFood.foods}</p>
          </motion.div>
        )}

        {nextTrip && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-4" data-testid="banner-trip-food">
            <p className="text-xs uppercase tracking-widest text-amber-700">Trip coming up ✈️</p>
            <p className="font-serif text-sm text-amber-900 mt-1">{nextTrip.name}, {nextTrip.country}</p>
            <p className="text-xs text-muted-foreground mt-1">Stock travel snacks · hydrate extra · pre-pack supplements</p>
          </motion.div>
        )}

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
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium">Water ({waterGlasses}/{dietPlan.waterGoal} glasses)</p>
                  <div className="flex gap-1">
                    {Array.from({ length: dietPlan.waterGoal }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setWaterGlasses(i < waterGlasses ? i : i + 1)}
                        className={`w-5 h-5 rounded-full border-2 transition-all ${i < waterGlasses ? "bg-blue-400 border-blue-400" : "border-blue-200"}`}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-rose-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" /> AI Calorie Camera
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!aiPreview && (
                  <button onClick={() => aiInputRef.current?.click()} className="w-full border-2 border-dashed border-amber-300 rounded-2xl p-5 text-center hover:bg-amber-100/40 transition-all" data-testid="button-food-ai-upload">
                    <Camera className="w-7 h-7 text-amber-500 mx-auto mb-1.5" />
                    <p className="text-sm font-medium text-amber-700">Snap your meal</p>
                    <p className="text-xs text-muted-foreground mt-0.5">ROSA estimates calories &amp; macros for you.</p>
                  </button>
                )}
                <input ref={aiInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && handleAiFile(e.target.files[0])} />
                {aiPreview && (
                  <>
                    <img src={aiPreview} alt="meal" className="w-full max-h-56 object-cover rounded-2xl" />
                    <div className="flex gap-2 flex-wrap items-center">
                      <Select value={aiMeal} onValueChange={(v) => setAiMeal(v as any)}>
                        <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(["breakfast","lunch","dinner","snack"] as const).map(m => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={analyzeFood} disabled={aiLoading} className="bg-amber-500 hover:bg-amber-600 text-white" data-testid="button-food-ai-analyze">
                        {aiLoading ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Estimating…</> : <><Sparkles className="w-4 h-4 mr-1.5" /> Analyze</>}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setAiPreview(null); setAiResult(null); }}>Reset</Button>
                    </div>
                    {aiResult?.name && (
                      <div className="bg-white/70 rounded-xl p-3 border border-amber-100 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{aiResult.name}</p>
                          <Badge className="bg-amber-100 text-amber-700 border-0">{Math.round(aiResult.calories || 0)} kcal</Badge>
                        </div>
                        {(aiResult.protein || aiResult.carbs || aiResult.fat) && (
                          <p className="text-xs text-muted-foreground">P {Math.round(aiResult.protein||0)}g · C {Math.round(aiResult.carbs||0)}g · F {Math.round(aiResult.fat||0)}g</p>
                        )}
                        {aiResult.healthNote && <p className="text-xs italic text-amber-700">💛 {aiResult.healthNote}</p>}
                        <Button size="sm" onClick={logAiFood} className="w-full mt-1 h-8 bg-rose-500 hover:bg-rose-600 text-white" data-testid="button-food-ai-log">
                          Log this meal
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Add Food</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Input
                      placeholder="Food name"
                      value={newFood}
                      onChange={(e) => setNewFood(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                  <div>
                    <Input
                      placeholder="Calories"
                      type="number"
                      value={newCals}
                      onChange={(e) => setNewCals(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                </div>
                <Select value={newMeal} onValueChange={(v: any) => setNewMeal(v)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
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
                      <button
                        key={f.name}
                        onClick={() => addQuickFood(f)}
                        className="px-2.5 py-1 bg-rose-50 text-rose-700 text-xs rounded-full border border-rose-100 hover:bg-rose-100 transition-colors"
                      >
                        {f.name} ({f.calories})
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

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
                  <CardContent className="space-y-1.5">
                    {mealEntries.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between">
                        <span className="text-sm text-foreground">{entry.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{entry.calories} kcal</span>
                          <button onClick={() => removeEntry(entry.id)} className="text-muted-foreground/50 hover:text-red-400">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Your Goal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {(["lose", "maintain", "gain"] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setDietPlan({ ...dietPlan, goal: g })}
                      className={`p-2 rounded-xl text-sm border-2 capitalize transition-all ${dietPlan.goal === g ? "border-primary bg-primary/5 text-primary font-medium" : "border-border text-muted-foreground"}`}
                    >
                      {g === "lose" ? "Lose weight" : g === "gain" ? "Build up" : "Maintain"}
                    </button>
                  ))}
                </div>
                <div>
                  <Label className="text-xs">Daily Calorie Target</Label>
                  <Input
                    type="number"
                    value={dietPlan.targetCalories}
                    onChange={(e) => setDietPlan({ ...dietPlan, targetCalories: parseInt(e.target.value) || 1800 })}
                    className="rounded-xl mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Daily Water Goal (glasses)</Label>
                  <Input
                    type="number"
                    value={dietPlan.waterGoal}
                    onChange={(e) => setDietPlan({ ...dietPlan, waterGoal: parseInt(e.target.value) || 8 })}
                    className="rounded-xl mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide px-1">Diet Style</p>
            {DIET_PLANS.map((plan) => (
              <motion.div
                key={plan.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => setDietPlan({ ...dietPlan, dietType: plan.id, targetCalories: plan.calories })}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${dietPlan.dietType === plan.id ? "border-primary bg-primary/5" : "border-border bg-card"}`}
              >
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
    </div>
  );
}
