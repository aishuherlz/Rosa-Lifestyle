import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dumbbell, ChevronDown, ChevronUp, Target, Heart, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLocalStorage } from "@/hooks/use-local-storage";

type HealthProfile = {
  height: number;
  weight: number;
  age: number;
  goal: string;
};

type WorkoutSection = {
  title: string;
  icon: React.ReactNode;
  color: string;
  workouts: { name: string; duration: string; desc: string }[];
};

const WORKOUTS: WorkoutSection[] = [
  {
    title: "Home Workouts",
    icon: <Dumbbell className="w-5 h-5" />,
    color: "bg-rose-100 text-rose-700 border-rose-200",
    workouts: [
      { name: "Full Body HIIT", duration: "20 min", desc: "Jumping jacks, burpees, mountain climbers, squat jumps. No equipment needed." },
      { name: "Core Blast", duration: "15 min", desc: "Plank variations, crunches, leg raises, Russian twists. Burn that core!" },
      { name: "Booty Burn", duration: "25 min", desc: "Glute bridges, fire hydrants, donkey kicks, squats. Bodyweight only." },
      { name: "Upper Body Tone", duration: "20 min", desc: "Push-ups, tricep dips, shoulder circles, arm circles with light weights." },
    ],
  },
  {
    title: "Yoga Routines",
    icon: <Wind className="w-5 h-5" />,
    color: "bg-violet-100 text-violet-700 border-violet-200",
    workouts: [
      { name: "Morning Flow", duration: "20 min", desc: "Sun salutations, cat-cow, downward dog, warrior sequence to start your day." },
      { name: "Stress Relief", duration: "30 min", desc: "Child's pose, pigeon pose, forward folds. Great for anxiety and tension." },
      { name: "Period Yoga", duration: "20 min", desc: "Gentle poses to ease cramps: child's pose, supine twist, butterfly pose." },
      { name: "Bedtime Wind Down", duration: "15 min", desc: "Legs up the wall, seated forward fold, savasana. Perfect before sleep." },
    ],
  },
  {
    title: "Meditation",
    icon: <Heart className="w-5 h-5" />,
    color: "bg-sky-100 text-sky-700 border-sky-200",
    workouts: [
      { name: "Box Breathing", duration: "5 min", desc: "Inhale 4 counts, hold 4, exhale 4, hold 4. Reduces anxiety instantly." },
      { name: "Body Scan", duration: "15 min", desc: "Progressive relaxation from head to toe. Perfect for falling asleep." },
      { name: "Loving-Kindness", duration: "10 min", desc: "Send love to yourself and others. Improves mood and empathy." },
      { name: "Morning Intention", duration: "5 min", desc: "Set your intention for the day with mindful breathing and visualization." },
    ],
  },
  {
    title: "Gym Workouts",
    icon: <Target className="w-5 h-5" />,
    color: "bg-amber-100 text-amber-700 border-amber-200",
    workouts: [
      { name: "Push/Pull/Legs Split", duration: "45 min", desc: "Classic 3-day split for muscle building. Chest/back/legs alternating." },
      { name: "Circuit Training", duration: "40 min", desc: "Move station to station with minimal rest. Burns fat and builds endurance." },
      { name: "Strength Foundation", duration: "50 min", desc: "Deadlifts, squats, bench press. Build real strength from the ground up." },
      { name: "Cardio Mix", duration: "30 min", desc: "Treadmill intervals, rowing machine, elliptical. Heart-pumping cardio." },
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
  const [profile, setProfile] = useLocalStorage<HealthProfile | null>("rosa_health", null);
  const [form, setForm] = useState<HealthProfile>(profile || { height: 0, weight: 0, age: 0, goal: "maintain" });
  const [editing, setEditing] = useState(!profile);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const bmi = profile && profile.height > 0 ? profile.weight / ((profile.height / 100) ** 2) : null;
  const bmiCategory = bmi ? BMI_CATEGORIES.find(c => bmi <= c.max) : null;
  const bmiProgress = bmi ? Math.min((bmi / 40) * 100, 100) : 0;

  const handleSave = () => {
    setProfile(form);
    setEditing(false);
  };

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-serif text-foreground">Health & Fitness</h1>
        <p className="text-muted-foreground mt-1">Your wellbeing, beautifully supported.</p>
      </motion.div>

      {/* Profile */}
      {editing ? (
        <Card className="border-border/50 shadow-sm">
          <CardHeader><CardTitle className="font-serif text-lg">Your Profile</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Height (cm)</Label>
                <Input type="number" placeholder="165" value={form.height || ""} onChange={e => setForm(f => ({ ...f, height: parseFloat(e.target.value) || 0 }))} data-testid="input-height" />
              </div>
              <div>
                <Label>Weight (kg)</Label>
                <Input type="number" placeholder="60" value={form.weight || ""} onChange={e => setForm(f => ({ ...f, weight: parseFloat(e.target.value) || 0 }))} data-testid="input-weight" />
              </div>
              <div>
                <Label>Age</Label>
                <Input type="number" placeholder="28" value={form.age || ""} onChange={e => setForm(f => ({ ...f, age: parseInt(e.target.value) || 0 }))} data-testid="input-age" />
              </div>
            </div>
            <div>
              <Label>Fitness Goal</Label>
              <Select value={form.goal} onValueChange={v => setForm(f => ({ ...f, goal: v }))}>
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
            <Button onClick={handleSave} disabled={!form.height || !form.weight} className="w-full bg-primary" data-testid="button-save-health">Save Profile</Button>
          </CardContent>
        </Card>
      ) : profile && (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="border-border/50 shadow-sm bg-gradient-to-br from-rose-50 to-pink-50 border-rose-200">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-4 text-sm">
                  <span><span className="font-semibold">{profile.height}cm</span> <span className="text-muted-foreground">height</span></span>
                  <span><span className="font-semibold">{profile.weight}kg</span> <span className="text-muted-foreground">weight</span></span>
                  <span><span className="font-semibold">{profile.age}</span> <span className="text-muted-foreground">years</span></span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)} data-testid="button-edit-health">Edit</Button>
              </div>
              {bmi && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">BMI: <span className={`font-bold ${bmiCategory?.color}`}>{bmi.toFixed(1)}</span></span>
                    <Badge className={`text-xs ${bmiCategory?.color} bg-white border`}>{bmiCategory?.label}</Badge>
                  </div>
                  <Progress value={bmiProgress} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Under</span><span>Healthy</span><span>Over</span><span>Obese</span>
                  </div>
                </div>
              )}
              <div className="mt-3">
                <p className="text-sm text-muted-foreground">Goal: <span className="font-medium text-foreground capitalize">{profile.goal}</span></p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Workout sections */}
      <div className="space-y-3">
        <h2 className="text-xl font-serif">Your Free Workout Library</h2>
        {WORKOUTS.map((section) => (
          <Card key={section.title} className="border-border/50 shadow-sm overflow-hidden">
            <button
              className="w-full text-left"
              onClick={() => setExpandedSection(expandedSection === section.title ? null : section.title)}
              data-testid={`section-toggle-${section.title}`}
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
                        <p className="text-xs text-muted-foreground">{w.desc}</p>
                      </div>
                    ))}
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        ))}
      </div>
    </div>
  );
}
