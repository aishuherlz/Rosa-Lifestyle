import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dumbbell, ChevronDown, ChevronUp, Target, Heart, Wind, Plus, Trash2, TrendingDown, Activity, Clock, AlertCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useSubscription } from "@/lib/subscription-context";
import { useLocation } from "wouter";

type HealthProfile = {
  height: number;
  weight: number;
  age: number;
  goal: string;
  targetWeight?: number;
  conditions?: string[];
};

type WeightEntry = { date: string; weight: number };

type GymSession = {
  id: string;
  title: string;
  day: string;
  time: string;
  type: string;
  notes: string;
};

const HEALTH_CONDITIONS = [
  "PCOS / PCOD",
  "Endometriosis",
  "Fibromyalgia",
  "Chronic fatigue syndrome",
  "Rheumatoid arthritis",
  "Thyroid condition",
  "Diabetes / prediabetes",
  "Scoliosis",
  "Anxiety / depression",
  "Chronic pain",
  "Asthma",
  "Osteoporosis",
  "Autoimmune condition",
  "Mobility limitations",
  "Post-surgery recovery",
];

const WORKOUT_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type WorkoutSection = {
  title: string;
  icon: React.ReactNode;
  color: string;
  youtubeKeywords: string;
  workouts: { name: string; duration: string; desc: string; videoQuery: string; steps: string[] }[];
};

const WORKOUTS: WorkoutSection[] = [
  {
    title: "Home Workouts",
    icon: <Dumbbell className="w-5 h-5" />,
    color: "bg-rose-100 text-rose-700 border-rose-200",
    youtubeKeywords: "home workout women no equipment",
    workouts: [
      {
        name: "Full Body HIIT",
        duration: "20 min",
        desc: "Jumping jacks, burpees, mountain climbers, squat jumps. No equipment needed.",
        videoQuery: "full body HIIT workout women 20 min",
        steps: ["Warm up: 5 min jog in place", "Jumping jacks: 3 sets × 30 sec", "Burpees: 3 sets × 10 reps", "Mountain climbers: 3 sets × 30 sec", "Squat jumps: 3 sets × 15 reps", "Cool down: 3 min stretching"],
      },
      {
        name: "Core Blast",
        duration: "15 min",
        desc: "Plank variations, crunches, leg raises, Russian twists.",
        videoQuery: "ab core workout women 15 minutes",
        steps: ["Plank: 3 × 45 sec", "Crunches: 3 × 20", "Leg raises: 3 × 15", "Russian twists: 3 × 20", "Bicycle crunches: 3 × 20"],
      },
      {
        name: "Booty Burn",
        duration: "25 min",
        desc: "Glute bridges, fire hydrants, donkey kicks, squats. Bodyweight only.",
        videoQuery: "glute workout women bodyweight booty",
        steps: ["Glute bridges: 4 × 20", "Fire hydrants: 3 × 15 each side", "Donkey kicks: 3 × 15 each side", "Sumo squats: 3 × 20", "Hip thrusts: 3 × 15"],
      },
      {
        name: "Upper Body Tone",
        duration: "20 min",
        desc: "Push-ups, tricep dips, shoulder circles, arm circles.",
        videoQuery: "upper body toning workout women at home",
        steps: ["Push-ups: 3 × 10-15", "Tricep dips: 3 × 12", "Shoulder taps: 3 × 20", "Wall push-ups: 3 × 15", "Arm circles: 3 × 30 sec each direction"],
      },
    ],
  },
  {
    title: "Yoga Routines",
    icon: <Wind className="w-5 h-5" />,
    color: "bg-violet-100 text-violet-700 border-violet-200",
    youtubeKeywords: "yoga routine women beginner",
    workouts: [
      {
        name: "Morning Flow",
        duration: "20 min",
        desc: "Sun salutations, cat-cow, downward dog, warrior sequence.",
        videoQuery: "morning yoga flow women 20 minutes",
        steps: ["Mountain pose: 1 min", "Sun salutation A: 5 rounds", "Cat-cow: 10 rounds", "Downward dog: hold 5 breaths", "Warrior I & II: 5 breaths each", "Child's pose: 2 min"],
      },
      {
        name: "Stress Relief",
        duration: "30 min",
        desc: "Child's pose, pigeon pose, forward folds. Great for anxiety and tension.",
        videoQuery: "yoga stress relief anxiety women",
        steps: ["Deep breathing: 3 min", "Child's pose: 3 min", "Thread the needle: 2 min each side", "Pigeon pose: 3 min each side", "Seated forward fold: 3 min", "Legs up the wall: 5 min"],
      },
      {
        name: "Period Yoga",
        duration: "20 min",
        desc: "Gentle poses to ease cramps: child's pose, supine twist, butterfly pose.",
        videoQuery: "yoga for period cramps relief women",
        steps: ["Butterfly pose: 3 min", "Child's pose: 3 min", "Supine twist: 3 min each side", "Reclined bound angle: 4 min", "Legs up wall: 5 min"],
      },
      {
        name: "Bedtime Wind Down",
        duration: "15 min",
        desc: "Legs up the wall, seated forward fold, savasana.",
        videoQuery: "bedtime yoga relaxation sleep women",
        steps: ["Seated forward fold: 3 min", "Reclined butterfly: 3 min", "Spinal twist: 2 min each side", "Legs up the wall: 3 min", "Savasana: 2 min"],
      },
    ],
  },
  {
    title: "Meditation",
    icon: <Heart className="w-5 h-5" />,
    color: "bg-sky-100 text-sky-700 border-sky-200",
    youtubeKeywords: "guided meditation women anxiety",
    workouts: [
      {
        name: "Box Breathing",
        duration: "5 min",
        desc: "Inhale 4 counts, hold 4, exhale 4, hold 4. Reduces anxiety instantly.",
        videoQuery: "box breathing 4-4-4-4 technique",
        steps: ["Sit comfortably, close eyes", "Inhale slowly for 4 counts", "Hold breath for 4 counts", "Exhale slowly for 4 counts", "Hold for 4 counts", "Repeat 6-8 rounds"],
      },
      {
        name: "Body Scan",
        duration: "15 min",
        desc: "Progressive relaxation from head to toe. Perfect for falling asleep.",
        videoQuery: "body scan meditation sleep relaxation",
        steps: ["Lie flat, close eyes", "Take 3 deep breaths", "Relax your face and jaw", "Soften your shoulders and arms", "Release tension in your belly", "Let your legs grow heavy", "Breathe naturally for 5 min"],
      },
      {
        name: "Loving-Kindness",
        duration: "10 min",
        desc: "Send love to yourself and others. Improves mood and empathy.",
        videoQuery: "loving kindness meditation metta practice",
        steps: ["Sit quietly, close eyes", "Breathe into your heart center", "Silently say: 'May I be happy, may I be well'", "Extend this wish to a loved one", "Extend to a neutral person", "Extend to all beings"],
      },
      {
        name: "Morning Intention",
        duration: "5 min",
        desc: "Set your intention for the day with mindful breathing.",
        videoQuery: "morning intention setting meditation",
        steps: ["Sit up, spine tall", "3 deep breaths to arrive", "Ask: what do I need today?", "Set one intention for the day", "Breathe it in for 2 min", "Open eyes slowly, carry it with you"],
      },
    ],
  },
  {
    title: "Gym Workouts",
    icon: <Target className="w-5 h-5" />,
    color: "bg-amber-100 text-amber-700 border-amber-200",
    youtubeKeywords: "gym workout plan women beginners",
    workouts: [
      {
        name: "Push/Pull/Legs Split",
        duration: "45 min",
        desc: "Classic 3-day split for muscle building.",
        videoQuery: "push pull legs workout women gym",
        steps: ["Warm-up: 5 min treadmill", "Push: chest press, shoulder press, tricep extensions", "Pull: lat pulldown, cable rows, bicep curls", "Legs: squats, leg press, leg curls", "Cool down: 5 min stretching"],
      },
      {
        name: "Circuit Training",
        duration: "40 min",
        desc: "Move station to station with minimal rest.",
        videoQuery: "circuit training women gym fat burn",
        steps: ["Treadmill: 5 min warm-up", "Station 1: Jump rope 1 min", "Station 2: Kettlebell swings 15 reps", "Station 3: Box jumps 10 reps", "Station 4: Battle ropes 30 sec", "Repeat 3-4 rounds with 30 sec rest"],
      },
      {
        name: "Strength Foundation",
        duration: "50 min",
        desc: "Deadlifts, squats, bench press. Build real strength.",
        videoQuery: "strength training women beginners barbell",
        steps: ["Warm-up: 5 min", "Barbell squats: 4 × 8", "Romanian deadlifts: 3 × 10", "Bench press: 3 × 8", "Bent-over rows: 3 × 10", "Overhead press: 3 × 8", "Core finisher: 5 min"],
      },
      {
        name: "Cardio Mix",
        duration: "30 min",
        desc: "Treadmill intervals, rowing machine, elliptical.",
        videoQuery: "cardio workout women gym treadmill intervals",
        steps: ["Treadmill: 10 min (alternate 1 min sprint, 2 min walk)", "Rowing machine: 10 min moderate pace", "Elliptical: 10 min with arm resistance"],
      },
    ],
  },
];

const BMI_CATEGORIES = [
  { label: "Underweight", max: 18.5, color: "text-blue-600" },
  { label: "Healthy", max: 24.9, color: "text-emerald-600" },
  { label: "Overweight", max: 29.9, color: "text-amber-600" },
  { label: "Obese", max: 100, color: "text-rose-600" },
];

export default function HealthPage() {
  const { isPremium } = useSubscription();
  const [, setLocation] = useLocation();
  const [profile, setProfile] = useLocalStorage<HealthProfile | null>("rosa_health", null);
  const [form, setForm] = useState<HealthProfile>(profile || { height: 0, weight: 0, age: 0, goal: "maintain", conditions: [] });
  const [editing, setEditing] = useState(!profile);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [expandedWorkout, setExpandedWorkout] = useState<string | null>(null);
  const [weightLog, setWeightLog] = useLocalStorage<WeightEntry[]>("rosa_weight_log", []);
  const [gymSessions, setGymSessions] = useLocalStorage<GymSession[]>("rosa_gym_schedule", []);
  const [newWeight, setNewWeight] = useState("");
  const [tab, setTab] = useState<"workouts" | "weight" | "gym" | "profile">("workouts");
  const [gymForm, setGymForm] = useState({ title: "", day: "Monday", time: "07:00", type: "Gym", notes: "" });
  const [showGymForm, setShowGymForm] = useState(false);

  const bmi = profile && profile.height > 0 ? profile.weight / ((profile.height / 100) ** 2) : null;
  const bmiCategory = bmi ? BMI_CATEGORIES.find((c) => bmi <= c.max) : null;
  const bmiProgress = bmi ? Math.min((bmi / 40) * 100, 100) : 0;

  const handleSave = () => {
    setProfile(form);
    setEditing(false);
  };

  const logWeight = () => {
    if (!newWeight) return;
    const entry: WeightEntry = { date: new Date().toISOString().split("T")[0], weight: parseFloat(newWeight) };
    setWeightLog([...weightLog, entry]);
    setNewWeight("");
  };

  const addGymSession = () => {
    if (!gymForm.title) return;
    setGymSessions([...gymSessions, { ...gymForm, id: Date.now().toString() }]);
    setGymForm({ title: "", day: "Monday", time: "07:00", type: "Gym", notes: "" });
    setShowGymForm(false);
  };

  const weightChange = weightLog.length >= 2
    ? (weightLog[weightLog.length - 1].weight - weightLog[0].weight).toFixed(1)
    : null;

  const todayDay = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const todaySessions = gymSessions.filter((s) => s.day === todayDay);

  return (
    <div className="min-h-full p-4 md:p-8 space-y-5 pb-24">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-serif text-foreground">Health & Fitness</h1>
        <p className="text-muted-foreground mt-1">Your wellbeing, beautifully supported.</p>
      </motion.div>

      {todaySessions.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {todaySessions.map((s) => (
            <Badge key={s.id} className="bg-amber-100 text-amber-800 border-amber-200 shrink-0 text-xs px-3 py-1">
              <Clock className="w-3 h-3 mr-1" /> {s.time} — {s.title}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {(["workouts", "weight", "gym", "profile"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm capitalize transition-all ${tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            {t === "weight" ? "Weight Journey" : t === "gym" ? "Schedule" : t}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {editing ? (
            <Card className="border-border/50 shadow-sm">
              <CardHeader><CardTitle className="font-serif text-lg">Your Health Profile</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Height (cm)</Label>
                    <Input type="number" placeholder="165" value={form.height || ""} onChange={(e) => setForm((f) => ({ ...f, height: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <Label>Weight (kg)</Label>
                    <Input type="number" placeholder="60" value={form.weight || ""} onChange={(e) => setForm((f) => ({ ...f, weight: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <Label>Age</Label>
                    <Input type="number" placeholder="28" value={form.age || ""} onChange={(e) => setForm((f) => ({ ...f, age: parseInt(e.target.value) || 0 }))} />
                  </div>
                </div>
                <div>
                  <Label>Target Weight (kg) — optional</Label>
                  <Input type="number" placeholder="55" value={form.targetWeight || ""} onChange={(e) => setForm((f) => ({ ...f, targetWeight: parseFloat(e.target.value) || undefined }))} />
                </div>
                <div>
                  <Label>Fitness Goal</Label>
                  <Select value={form.goal} onValueChange={(v) => setForm((f) => ({ ...f, goal: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lose">Lose weight</SelectItem>
                      <SelectItem value="maintain">Maintain weight</SelectItem>
                      <SelectItem value="gain">Build muscle</SelectItem>
                      <SelectItem value="tone">Tone & strengthen</SelectItem>
                      <SelectItem value="flex">Improve flexibility</SelectItem>
                      <SelectItem value="energy">Boost energy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-2 block">Health Conditions (select all that apply)</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {HEALTH_CONDITIONS.map((c) => (
                      <div key={c} className="flex items-center gap-2">
                        <Checkbox
                          id={c}
                          checked={(form.conditions || []).includes(c)}
                          onCheckedChange={(checked) => {
                            const conditions = checked
                              ? [...(form.conditions || []), c]
                              : (form.conditions || []).filter((x) => x !== c);
                            setForm((f) => ({ ...f, conditions }));
                          }}
                        />
                        <label htmlFor={c} className="text-sm text-foreground cursor-pointer">{c}</label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 flex items-start gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                    ROSA adapts workout suggestions based on your conditions.
                  </p>
                </div>
                <Button onClick={handleSave} disabled={!form.height || !form.weight} className="w-full bg-primary">Save Profile</Button>
              </CardContent>
            </Card>
          ) : profile ? (
            <Card className="border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50">
              <CardContent className="pt-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex gap-4 text-sm">
                    <span><span className="font-semibold">{profile.height}cm</span> <span className="text-muted-foreground">height</span></span>
                    <span><span className="font-semibold">{profile.weight}kg</span> <span className="text-muted-foreground">weight</span></span>
                    <span><span className="font-semibold">{profile.age}</span> <span className="text-muted-foreground">yrs</span></span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>
                </div>
                {bmi && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">BMI: <span className={`font-bold ${bmiCategory?.color}`}>{bmi.toFixed(1)}</span></span>
                      <Badge className={`text-xs ${bmiCategory?.color} bg-white border`}>{bmiCategory?.label}</Badge>
                    </div>
                    <Progress value={bmiProgress} className="h-2" />
                  </div>
                )}
                {profile.targetWeight && (
                  <p className="text-sm text-muted-foreground mt-3">
                    Target: <span className="font-medium text-foreground">{profile.targetWeight}kg</span>
                    {profile.weight > profile.targetWeight && (
                      <span className="text-rose-500 ml-2">({(profile.weight - profile.targetWeight).toFixed(1)}kg to go)</span>
                    )}
                  </p>
                )}
                {(profile.conditions || []).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(profile.conditions || []).map((c) => (
                      <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed border-2 border-border text-center py-12 cursor-pointer" onClick={() => setEditing(true)}>
              <CardContent>
                <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Set up your health profile</p>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

      {tab === "weight" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {!isPremium ? (
            <Card className="text-center py-10 border-dashed border-2">
              <CardContent>
                <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm mb-3">Weight tracking is a Premium feature</p>
                <Button onClick={() => setLocation("/subscription")} size="sm" className="bg-rose-500 hover:bg-rose-600 text-white rounded-2xl">
                  View Plans
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm font-medium mb-3">Log Today's Weight</p>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="e.g. 62.5 kg"
                      value={newWeight}
                      onChange={(e) => setNewWeight(e.target.value)}
                      className="rounded-xl"
                    />
                    <Button onClick={logWeight} className="bg-rose-500 hover:bg-rose-600 text-white rounded-xl px-6">Log</Button>
                  </div>
                  {weightChange !== null && (
                    <p className={`text-sm mt-3 ${parseFloat(weightChange) < 0 ? "text-emerald-600" : parseFloat(weightChange) > 0 ? "text-rose-500" : "text-muted-foreground"}`}>
                      <TrendingDown className="w-4 h-4 inline mr-1" />
                      {parseFloat(weightChange) < 0 ? `Lost ${Math.abs(parseFloat(weightChange))}kg` : `Gained ${weightChange}kg`} since you started tracking
                    </p>
                  )}
                </CardContent>
              </Card>

              {profile?.targetWeight && weightLog.length > 0 && (
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm font-medium mb-2">Progress to Goal</p>
                    {(() => {
                      const current = weightLog[weightLog.length - 1].weight;
                      const start = weightLog[0].weight;
                      const target = profile.targetWeight!;
                      const totalToLose = start - target;
                      const lost = start - current;
                      const progress = totalToLose > 0 ? Math.min(100, Math.max(0, (lost / totalToLose) * 100)) : 0;
                      return (
                        <>
                          <Progress value={progress} className="h-3 rounded-full mb-2" />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{start}kg start</span>
                            <span className="font-medium text-foreground">{current}kg now</span>
                            <span>{target}kg goal</span>
                          </div>
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">History</p>
                {[...weightLog].reverse().slice(0, 20).map((entry, i) => (
                  <div key={i} className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-2.5">
                    <span className="text-sm text-muted-foreground">
                      {new Date(entry.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                    <span className="font-medium text-foreground">{entry.weight} kg</span>
                  </div>
                ))}
                {weightLog.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm pt-6">No entries yet — log your first weight above</p>
                )}
              </div>
            </>
          )}
        </motion.div>
      )}

      {tab === "gym" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {!isPremium ? (
            <Card className="text-center py-10 border-dashed border-2">
              <CardContent>
                <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm mb-3">Gym scheduling is a Premium feature</p>
                <Button onClick={() => setLocation("/subscription")} size="sm" className="bg-rose-500 hover:bg-rose-600 text-white rounded-2xl">
                  View Plans
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <p className="text-sm font-medium text-foreground">Your Schedule</p>
                <Button size="sm" onClick={() => setShowGymForm(!showGymForm)} className="bg-rose-500 hover:bg-rose-600 text-white rounded-xl">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add
                </Button>
              </div>

              <AnimatePresence>
                {showGymForm && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                    <Card className="border-rose-200">
                      <CardContent className="pt-4 space-y-3">
                        <Input placeholder="Session name e.g. Leg Day" value={gymForm.title} onChange={(e) => setGymForm({ ...gymForm, title: e.target.value })} className="rounded-xl" />
                        <div className="grid grid-cols-2 gap-2">
                          <Select value={gymForm.day} onValueChange={(v) => setGymForm({ ...gymForm, day: v })}>
                            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent>{WORKOUT_DAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                          </Select>
                          <Input type="time" value={gymForm.time} onChange={(e) => setGymForm({ ...gymForm, time: e.target.value })} className="rounded-xl" />
                        </div>
                        <Select value={gymForm.type} onValueChange={(v) => setGymForm({ ...gymForm, type: v })}>
                          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Gym">Gym</SelectItem>
                            <SelectItem value="Yoga">Yoga</SelectItem>
                            <SelectItem value="HIIT">HIIT</SelectItem>
                            <SelectItem value="Run">Run</SelectItem>
                            <SelectItem value="Walk">Walk</SelectItem>
                            <SelectItem value="Swim">Swim</SelectItem>
                            <SelectItem value="Dance">Dance</SelectItem>
                            <SelectItem value="Rest">Rest day</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input placeholder="Notes (optional)" value={gymForm.notes} onChange={(e) => setGymForm({ ...gymForm, notes: e.target.value })} className="rounded-xl" />
                        <Button onClick={addGymSession} disabled={!gymForm.title} className="w-full bg-rose-500 hover:bg-rose-600 text-white rounded-xl">
                          Save Session
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              {WORKOUT_DAYS.map((day) => {
                const sessions = gymSessions.filter((s) => s.day === day);
                return (
                  <div key={day}>
                    <p className={`text-xs font-medium mb-1.5 uppercase tracking-wide ${day === todayDay ? "text-rose-500" : "text-muted-foreground"}`}>
                      {day} {day === todayDay && "• Today"}
                    </p>
                    {sessions.length === 0 ? (
                      <div className="h-10 rounded-xl bg-muted/30 border border-dashed border-border flex items-center px-4">
                        <span className="text-xs text-muted-foreground">Rest day</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {sessions.map((s) => (
                          <div key={s.id} className={`flex items-center justify-between rounded-xl px-4 py-2.5 border ${day === todayDay ? "bg-rose-50 border-rose-200" : "bg-card border-border"}`}>
                            <div>
                              <p className="text-sm font-medium text-foreground">{s.title}</p>
                              <p className="text-xs text-muted-foreground">{s.time} · {s.type}{s.notes && ` · ${s.notes}`}</p>
                            </div>
                            <button onClick={() => setGymSessions(gymSessions.filter((x) => x.id !== s.id))} className="text-muted-foreground/50 hover:text-red-400">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </motion.div>
      )}

      {tab === "workouts" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {(profile?.conditions || []).length > 0 && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
              <p className="text-xs text-blue-700">
                <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
                Showing gentle, condition-aware options based on your health profile. Always consult your doctor before starting a new routine.
              </p>
            </div>
          )}
          {WORKOUTS.map((section) => (
            <Card key={section.title} className="border-border/50 shadow-sm overflow-hidden">
              <button
                className="w-full text-left"
                onClick={() => setExpandedSection(expandedSection === section.title ? null : section.title)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl border ${section.color}`}>{section.icon}</div>
                      <CardTitle className="font-serif text-lg">{section.title}</CardTitle>
                    </div>
                    {expandedSection === section.title ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                  </div>
                </CardHeader>
              </button>
              <AnimatePresence>
                {expandedSection === section.title && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                    <CardContent className="pt-0 pb-4 space-y-3">
                      {section.workouts.map((w) => (
                        <div key={w.name} className="p-3 rounded-xl bg-muted/40 border border-border/30">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{w.name}</span>
                            <Badge variant="outline" className="text-xs">{w.duration}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">{w.desc}</p>
                          <button
                            onClick={() => setExpandedWorkout(expandedWorkout === w.name ? null : w.name)}
                            className="text-xs text-primary hover:underline"
                          >
                            {expandedWorkout === w.name ? "Hide steps" : "Show steps"}
                          </button>
                          <AnimatePresence>
                            {expandedWorkout === w.name && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                <ol className="mt-2 space-y-1">
                                  {w.steps.map((step, i) => (
                                    <li key={i} className="text-xs text-foreground flex gap-2">
                                      <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                                      {step}
                                    </li>
                                  ))}
                                </ol>
                                <a
                                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(w.videoQuery)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 mt-2 text-xs text-red-500 hover:underline"
                                >
                                  Watch on YouTube →
                                </a>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          ))}
        </motion.div>
      )}
    </div>
  );
}
