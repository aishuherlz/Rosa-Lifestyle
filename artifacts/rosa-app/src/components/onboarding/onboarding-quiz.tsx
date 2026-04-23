import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "@/lib/user-context";
import { useLocalStorage } from "@/hooks/use-local-storage";

type OnboardingData = {
  age: string;
  fitnessGoal: string;
  foodPreferences: string[];
  healthConditions: string[];
  relationshipStatus: string;
  cycleLength: string;
  periodLength: string;
  personalityTags: string[];
  completed: boolean;
};

const FOOD_PREFS = ["Vegetarian", "Vegan", "Halal", "Kosher", "Gluten-free", "Dairy-free", "Keto", "Paleo", "No restrictions"];
const FITNESS_GOALS = ["Lose weight", "Maintain weight", "Gain muscle", "Improve fitness", "Manage health condition", "Just feel better"];
const HEALTH_CONDITIONS = ["PCOS", "Endometriosis", "Diabetes", "Thyroid condition", "Anxiety/Depression", "Chronic pain", "Fibromyalgia", "None of the above"];
const RELATIONSHIP_STATUS = ["Single", "In a relationship", "Married", "Separated/Divorced", "It's complicated", "Prefer not to say"];
const PERSONALITY_TAGS = ["feminist", "spiritual", "adventurous", "gentle", "bold", "self-love", "strength", "growth", "homebody", "career focused"];

type Step = {
  id: string;
  title: string;
  subtitle: string;
  type: "text" | "single" | "multi";
  field: keyof OnboardingData;
  options?: string[];
};

const STEPS: Step[] = [
  { id: "age", title: "How old are you?", subtitle: "This helps personalize your wellness plan", type: "text", field: "age" },
  { id: "goal", title: "What's your main goal?", subtitle: "We'll tailor everything around this", type: "single", field: "fitnessGoal", options: FITNESS_GOALS },
  { id: "food", title: "Any dietary preferences?", subtitle: "Select all that apply", type: "multi", field: "foodPreferences", options: FOOD_PREFS },
  { id: "health", title: "Any health conditions?", subtitle: "ROSA adapts to support you better", type: "multi", field: "healthConditions", options: HEALTH_CONDITIONS },
  { id: "relationship", title: "Relationship status?", subtitle: "Helps with partner features", type: "single", field: "relationshipStatus", options: RELATIONSHIP_STATUS },
  { id: "personality", title: "What resonates with you?", subtitle: "Your daily quotes will match your energy", type: "multi", field: "personalityTags", options: PERSONALITY_TAGS },
];

export function OnboardingQuiz({ onComplete }: { onComplete: () => void }) {
  const { user, setUser } = useUser();
  const [step, setStep] = useState(0);
  const [data, setData] = useLocalStorage<OnboardingData>("rosa_onboarding", {
    age: "", fitnessGoal: "", foodPreferences: [], healthConditions: [],
    relationshipStatus: "", cycleLength: "28", periodLength: "5",
    personalityTags: [], completed: false,
  });

  const current = STEPS[step];

  const toggle = (field: keyof OnboardingData, value: string) => {
    setData((d) => {
      const arr = d[field] as string[];
      return { ...d, [field]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value] };
    });
  };

  const setSingle = (field: keyof OnboardingData, value: string) => {
    setData((d) => ({ ...d, [field]: value }));
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else {
      const completed = { ...data, completed: true };
      setData(completed);
      if (user) {
        setUser({
          ...user,
          personalityTags: data.personalityTags,
        });
      }
      onComplete();
    }
  };

  const prev = () => setStep(Math.max(0, step - 1));

  const getValue = () => {
    const v = data[current.field];
    return Array.isArray(v) ? v : [v as string];
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-[#3d1a24] to-[#8b2252] z-50 flex items-center justify-center p-6">
      <motion.div
        key={step}
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -40 }}
        className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
      >
        {/* Progress */}
        <div className="flex gap-1.5 mb-6">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Step {step + 1} of {STEPS.length}</p>
        <h2 className="text-2xl font-serif text-foreground mb-1">{current.title}</h2>
        <p className="text-sm text-muted-foreground mb-6">{current.subtitle}</p>

        {current.type === "text" && (
          <Input
            value={(data[current.field] as string) || ""}
            onChange={(e) => setSingle(current.field, e.target.value)}
            placeholder="Enter here..."
            className="text-lg py-6 border-border/60"
            type={current.field === "age" ? "number" : "text"}
            autoFocus
          />
        )}

        {(current.type === "single" || current.type === "multi") && (
          <div className="flex flex-wrap gap-2">
            {current.options!.map((opt) => {
              const selected = getValue().includes(opt);
              return (
                <button
                  key={opt}
                  onClick={() => current.type === "multi" ? toggle(current.field, opt) : setSingle(current.field, opt)}
                  className={`px-4 py-2 rounded-full text-sm border transition-all font-medium ${selected ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary text-foreground"}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex gap-3 mt-8">
          {step > 0 && (
            <Button variant="outline" onClick={prev} className="gap-2">
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
          )}
          <Button onClick={next} className="flex-1 bg-primary hover:bg-primary/90 gap-2">
            {step === STEPS.length - 1 ? <><Sparkles className="w-4 h-4" /> Start my ROSA journey</> : <>Next <ChevronRight className="w-4 h-4" /></>}
          </Button>
        </div>

        <button onClick={onComplete} className="w-full text-center text-xs text-muted-foreground mt-4 hover:text-primary transition-colors">
          Skip for now
        </button>
      </motion.div>
    </div>
  );
}
