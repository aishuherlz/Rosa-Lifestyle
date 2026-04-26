import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type CycleProfile = {
  avgCycleLength: number;
  avgPeriodLength: number;
  isIrregular: boolean;
  conditions: string[];
  contraception: string;
  symptoms: string[];
  stressLevel: string;
  exerciseLevel: string;
  completed: boolean;
};

const CONDITIONS = [
  "PCOS / PCOD", "Endometriosis", "Fibroids", "Thyroid condition",
  "Diabetes", "Adenomyosis", "Ovarian cysts", "Perimenopause",
  "Anxiety / depression", "Autoimmune condition", "None of the above"
];

const CONTRACEPTION = [
  "None", "Hormonal pill", "Hormonal IUD (Mirena)",
  "Copper IUD (non-hormonal)", "Implant", "Injection (Depo-Provera)",
  "Patch", "Ring (NuvaRing)", "Condoms only", "Other"
];

const SYMPTOMS = [
  "Severe cramps", "Light spotting", "Heavy bleeding", "Irregular timing",
  "PMS mood swings", "Bloating", "Breast tenderness", "Headaches / migraines",
  "Fatigue", "Acne breakouts", "Back pain", "Nausea", "Clots", "No symptoms"
];

type Props = { onComplete: (profile: CycleProfile) => void; existing?: Partial<CycleProfile> };

export function CycleHealthQuestionnaire({ onComplete, existing }: Props) {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<Partial<CycleProfile>>(existing || {
    conditions: [], symptoms: [], isIrregular: false
  });

  const update = (key: keyof CycleProfile, value: any) =>
    setProfile(p => ({ ...p, [key]: value }));

  const toggleItem = (key: "conditions" | "symptoms", item: string) => {
    const current = (profile[key] || []) as string[];
    if (item === "None of the above" || item === "No symptoms") {
      setProfile(p => ({ ...p, [key]: [item] }));
      return;
    }
    const filtered = current.filter(i => i !== "None of the above" && i !== "No symptoms");
    setProfile(p => ({
      ...p,
      [key]: filtered.includes(item) ? filtered.filter(i => i !== item) : [...filtered, item]
    }));
  };

  const steps = [
    {
      title: "How long is your average cycle?",
      subtitle: "Count from the first day of your period to the day before your next period",
      content: (
        <div className="space-y-3">
          {[21, 24, 26, 28, 30, 32, 35, 40].map(days => (
            <button key={days} onClick={() => update("avgCycleLength", days)}
              className={`w-full p-3 rounded-xl border text-left transition-all ${
                profile.avgCycleLength === days
                  ? "border-[#B06B8B] bg-[#FBEAF0] text-[#6B3050]"
                  : "border-[#E8C4B8] text-[#9E7B8A] hover:border-[#B06B8B]"
              }`}>
              {days} days {days === 28 ? "(average)" : days < 24 ? "(short)" : days > 35 ? "(long)" : ""}
            </button>
          ))}
          <button onClick={() => { update("avgCycleLength", 0); update("isIrregular", true); }}
            className={`w-full p-3 rounded-xl border text-left transition-all ${
              profile.isIrregular
                ? "border-[#B06B8B] bg-[#FBEAF0] text-[#6B3050]"
                : "border-[#E8C4B8] text-[#9E7B8A] hover:border-[#B06B8B]"
            }`}>
            My cycle is irregular 🌊
          </button>
        </div>
      ),
      canNext: profile.avgCycleLength !== undefined || profile.isIrregular
    },
    {
      title: "How long does your period usually last?",
      subtitle: "Average number of days of bleeding",
      content: (
        <div className="space-y-3">
          {[2, 3, 4, 5, 6, 7, 8].map(days => (
            <button key={days} onClick={() => update("avgPeriodLength", days)}
              className={`w-full p-3 rounded-xl border text-left transition-all ${
                profile.avgPeriodLength === days
                  ? "border-[#B06B8B] bg-[#FBEAF0] text-[#6B3050]"
                  : "border-[#E8C4B8] text-[#9E7B8A] hover:border-[#B06B8B]"
              }`}>
              {days} days {days <= 3 ? "(short)" : days >= 7 ? "(long)" : ""}
            </button>
          ))}
        </div>
      ),
      canNext: profile.avgPeriodLength !== undefined
    },
    {
      title: "Do you have any of these conditions?",
      subtitle: "This helps us give you more accurate predictions and advice",
      content: (
        <div className="space-y-2">
          {CONDITIONS.map(c => (
            <button key={c} onClick={() => toggleItem("conditions", c)}
              className={`w-full p-3 rounded-xl border text-left transition-all ${
                (profile.conditions || []).includes(c)
                  ? "border-[#B06B8B] bg-[#FBEAF0] text-[#6B3050]"
                  : "border-[#E8C4B8] text-[#9E7B8A] hover:border-[#B06B8B]"
              }`}>
              {c}
            </button>
          ))}
        </div>
      ),
      canNext: (profile.conditions || []).length > 0
    },
    {
      title: "Are you using any contraception?",
      subtitle: "Hormonal contraception affects your cycle predictions",
      content: (
        <div className="space-y-2">
          {CONTRACEPTION.map(c => (
            <button key={c} onClick={() => update("contraception", c)}
              className={`w-full p-3 rounded-xl border text-left transition-all ${
                profile.contraception === c
                  ? "border-[#B06B8B] bg-[#FBEAF0] text-[#6B3050]"
                  : "border-[#E8C4B8] text-[#9E7B8A] hover:border-[#B06B8B]"
              }`}>
              {c}
            </button>
          ))}
        </div>
      ),
      canNext: profile.contraception !== undefined
    },
    {
      title: "Which symptoms do you experience?",
      subtitle: "Select all that apply",
      content: (
        <div className="space-y-2">
          {SYMPTOMS.map(s => (
            <button key={s} onClick={() => toggleItem("symptoms", s)}
              className={`w-full p-3 rounded-xl border text-left transition-all ${
                (profile.symptoms || []).includes(s)
                  ? "border-[#B06B8B] bg-[#FBEAF0] text-[#6B3050]"
                  : "border-[#E8C4B8] text-[#9E7B8A] hover:border-[#B06B8B]"
              }`}>
              {s}
            </button>
          ))}
        </div>
      ),
      canNext: (profile.symptoms || []).length > 0
    },
    {
      title: "How would you describe your stress level?",
      subtitle: "Stress significantly affects your cycle",
      content: (
        <div className="space-y-3">
          {["Low — I feel mostly calm", "Moderate — some stress", "High — I am often stressed", "Very high — burnout level"].map(s => (
            <button key={s} onClick={() => update("stressLevel", s)}
              className={`w-full p-3 rounded-xl border text-left transition-all ${
                profile.stressLevel === s
                  ? "border-[#B06B8B] bg-[#FBEAF0] text-[#6B3050]"
                  : "border-[#E8C4B8] text-[#9E7B8A] hover:border-[#B06B8B]"
              }`}>
              {s}
            </button>
          ))}
        </div>
      ),
      canNext: profile.stressLevel !== undefined
    },
    {
      title: "How active are you?",
      subtitle: "Exercise affects hormone levels and cycle regularity",
      content: (
        <div className="space-y-3">
          {["Sedentary — mostly sitting", "Lightly active — walks occasionally", "Moderately active — exercise 2-3x/week", "Very active — exercise most days", "Athlete — intense training daily"].map(e => (
            <button key={e} onClick={() => update("exerciseLevel", e)}
              className={`w-full p-3 rounded-xl border text-left transition-all ${
                profile.exerciseLevel === e
                  ? "border-[#B06B8B] bg-[#FBEAF0] text-[#6B3050]"
                  : "border-[#E8C4B8] text-[#9E7B8A] hover:border-[#B06B8B]"
              }`}>
              {e}
            </button>
          ))}
        </div>
      ),
      canNext: profile.exerciseLevel !== undefined
    }
  ];

  const currentStep = steps[step];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-[#FDF6F0] p-4 flex items-center justify-center">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-playfair text-[#8B4F6E] font-bold">Your Cycle Profile 🌹</h1>
          <p className="text-sm text-[#9E7B8A] mt-1">Help us give you 99% accurate predictions</p>
        </div>

        <div className="flex gap-1">
          {steps.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= step ? "bg-[#B06B8B]" : "bg-[#E8C4B8]"}`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card className="border-[#E8C4B8]">
              <CardHeader>
                <CardTitle className="text-[#6B3050] text-lg">{currentStep.title}</CardTitle>
                <p className="text-sm text-[#9E7B8A]">{currentStep.subtitle}</p>
              </CardHeader>
              <CardContent className="max-h-96 overflow-y-auto">
                {currentStep.content}
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>

        <div className="flex gap-3">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(s => s - 1)} className="border-[#E8C4B8] text-[#8B4F6E] flex-1">
              Back
            </Button>
          )}
          {step < steps.length - 1 ? (
            <Button onClick={() => setStep(s => s + 1)} disabled={!currentStep.canNext}
              className="bg-[#B06B8B] text-white flex-1">
              Continue
            </Button>
          ) : (
            <Button onClick={() => onComplete({ ...profile, completed: true } as CycleProfile)}
              disabled={!currentStep.canNext}
              className="bg-[#B06B8B] text-white flex-1">
              Save my cycle profile 🌹
            </Button>
          )}
        </div>

        <p className="text-xs text-center text-[#9E7B8A]">
          This information is completely private and only used to improve your predictions 🔒
        </p>
      </div>
    </motion.div>
  );
}
