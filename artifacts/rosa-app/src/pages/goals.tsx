import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Plus, CheckCircle2, Circle, Sparkles, X, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";

type Goal = {
  id: string;
  title: string;
  month: string;
  steps: { text: string; done: boolean }[];
  completed: boolean;
  createdAt: string;
};

const GOAL_SUGGESTIONS = [
  "Drink 8 glasses of water daily",
  "Meditate for 10 minutes every morning",
  "Exercise 3 times a week",
  "Read one book this month",
  "Practice gratitude journaling",
  "Get 7-8 hours of sleep each night",
  "Limit social media to 1 hour/day",
  "Cook at home 5 days a week",
];

const currentMonth = format(new Date(), "MMMM yyyy");

export default function GoalsPage() {
  const [goals, setGoals] = useLocalStorage<Goal[]>("rosa_goals", []);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", steps: ["", "", ""] });
  const { toast } = useToast();

  const monthGoals = goals.filter((g) => g.month === currentMonth);
  const canAdd = monthGoals.length < 5;

  const saveGoal = () => {
    if (!form.title.trim()) return;
    const goal: Goal = {
      id: Date.now().toString(),
      title: form.title,
      month: currentMonth,
      steps: form.steps.filter((s) => s.trim()).map((s) => ({ text: s, done: false })),
      completed: false,
      createdAt: new Date().toISOString(),
    };
    setGoals([...goals, goal]);
    setForm({ title: "", steps: ["", "", ""] });
    setAdding(false);
    toast({ title: "Goal set! 🌹 You've got this." });
  };

  const toggleStep = (goalId: string, stepIdx: number) => {
    setGoals(
      goals.map((g) => {
        if (g.id !== goalId) return g;
        const steps = g.steps.map((s, i) => (i === stepIdx ? { ...s, done: !s.done } : s));
        const completed = steps.every((s) => s.done) && steps.length > 0;
        if (completed && !g.completed) {
          confetti({ particleCount: 80, spread: 70, colors: ["#be185d", "#f9a8d4", "#fbbf24"] });
          toast({ title: `Goal achieved! "${g.title}" 🌹✨` });
        }
        return { ...g, steps, completed };
      })
    );
  };

  const deleteGoal = (id: string) => setGoals(goals.filter((g) => g.id !== id));

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6 max-w-2xl pb-24">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-serif text-foreground flex items-center gap-2">
              <Target className="w-7 h-7 text-primary" /> Monthly Goals
            </h1>
            <p className="text-muted-foreground mt-1">{currentMonth} — up to 5 intentions</p>
          </div>
          {canAdd && (
            <Button onClick={() => setAdding(true)} className="bg-primary hover:bg-primary/90 gap-2">
              <Plus className="w-4 h-4" /> Add Goal
            </Button>
          )}
        </div>
      </motion.div>

      {/* Progress Summary */}
      {monthGoals.length > 0 && (
        <Card className="border-border/50 bg-primary/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex justify-between mb-2 text-sm">
              <span className="font-medium">This month's progress</span>
              <span className="text-muted-foreground">{monthGoals.filter((g) => g.completed).length}/{monthGoals.length} complete</span>
            </div>
            <Progress value={(monthGoals.filter((g) => g.completed).length / monthGoals.length) * 100} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Add Goal Modal */}
      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: 60 }}
              animate={{ y: 0 }}
              exit={{ y: 60 }}
              className="bg-card w-full max-w-lg rounded-3xl p-6 space-y-4 shadow-2xl"
            >
              <div className="flex justify-between items-center">
                <h2 className="font-serif text-xl">Set an Intention</h2>
                <button onClick={() => setAdding(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
              </div>

              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="My intention for this month..."
                className="text-base"
              />

              {/* Suggestions */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Quick ideas:</p>
                <div className="flex flex-wrap gap-2">
                  {GOAL_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setForm((f) => ({ ...f, title: s }))}
                      className="text-xs px-2.5 py-1.5 rounded-full border border-border hover:border-primary hover:text-primary transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Steps (optional)</p>
                {form.steps.map((s, i) => (
                  <Input
                    key={i}
                    value={s}
                    onChange={(e) => {
                      const steps = [...form.steps];
                      steps[i] = e.target.value;
                      setForm((f) => ({ ...f, steps }));
                    }}
                    placeholder={`Step ${i + 1}...`}
                    className="mb-2 text-sm"
                  />
                ))}
              </div>

              <div className="flex gap-3">
                <Button onClick={saveGoal} className="flex-1 bg-primary hover:bg-primary/90">Set Goal 🌹</Button>
                <Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {monthGoals.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-serif text-lg">What will you create this month?</p>
          <p className="text-sm mt-1">Set up to 5 intentions for {currentMonth}.</p>
        </div>
      )}

      <div className="space-y-4">
        {monthGoals.map((goal) => {
          const progress = goal.steps.length > 0 ? (goal.steps.filter((s) => s.done).length / goal.steps.length) * 100 : 0;
          return (
            <motion.div key={goal.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className={`border-border/50 transition-all ${goal.completed ? "bg-emerald-50/50 border-emerald-200" : ""}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      {goal.completed ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> : <Circle className="w-5 h-5 text-muted-foreground shrink-0" />}
                      <p className={`font-medium text-sm ${goal.completed ? "line-through text-muted-foreground" : ""}`}>{goal.title}</p>
                    </div>
                    <button onClick={() => deleteGoal(goal.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {goal.steps.length > 0 && (
                    <>
                      <Progress value={progress} className="h-1.5 mb-3" />
                      <div className="space-y-2">
                        {goal.steps.map((step, i) => (
                          <button
                            key={i}
                            onClick={() => toggleStep(goal.id, i)}
                            className="flex items-center gap-2 w-full text-left text-sm hover:text-primary transition-colors"
                          >
                            {step.done ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <Circle className="w-4 h-4 text-muted-foreground shrink-0" />}
                            <span className={step.done ? "line-through text-muted-foreground" : ""}>{step.text}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {goal.completed && (
                    <p className="text-xs text-emerald-600 mt-2 font-medium">✨ Goal achieved! You're amazing.</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {!canAdd && (
        <p className="text-center text-sm text-muted-foreground">You've set all 5 intentions for this month. Complete some to add more next month.</p>
      )}
    </div>
  );
}
