import { useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Flame, CheckCircle2, Lock, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { format, addDays, parseISO, isToday } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type Challenge = {
  id: string;
  title: string;
  emoji: string;
  description: string;
  duration: number;
  category: string;
  dailyAction: string;
};

type ActiveChallenge = {
  challengeId: string;
  startDate: string;
  checkins: string[];
  completed: boolean;
};

const CHALLENGES: Challenge[] = [
  { id: "hydration_7", title: "Hydration Week", emoji: "💧", description: "Drink 8 glasses of water every day for 7 days", duration: 7, category: "Health", dailyAction: "Log 8 glasses of water today" },
  { id: "gratitude_7", title: "Gratitude Practice", emoji: "🙏", description: "Write 3 things you're grateful for each day for 7 days", duration: 7, category: "Mindset", dailyAction: "Write 3 gratitude entries today" },
  { id: "steps_7", title: "10K Steps Week", emoji: "👟", description: "Walk 10,000 steps every day for 7 days", duration: 7, category: "Fitness", dailyAction: "Hit 10,000 steps today" },
  { id: "sleep_7", title: "Sleep Reset", emoji: "🌙", description: "Sleep by 10pm and wake at 6am for 7 days", duration: 7, category: "Wellness", dailyAction: "Sleep before 10pm tonight" },
  { id: "nophone_7", title: "Phone-Free Mornings", emoji: "📵", description: "No phone for the first hour after waking up — 7 days", duration: 7, category: "Mindset", dailyAction: "First hour: no phone today" },
  { id: "workout_30", title: "30-Day Fitness", emoji: "💪", description: "Move your body every day for 30 days", duration: 30, category: "Fitness", dailyAction: "Complete a workout today" },
  { id: "water_30", title: "Hydration Month", emoji: "🌊", description: "Drink 2L of water daily for 30 days", duration: 30, category: "Health", dailyAction: "Reach your water goal today" },
  { id: "meditation_30", title: "Mindful Month", emoji: "🧘", description: "Meditate for at least 5 minutes every day for 30 days", duration: 30, category: "Wellness", dailyAction: "Meditate for 5+ minutes today" },
];

export default function ChallengesPage() {
  const [activeChallenges, setActiveChallenges] = useLocalStorage<ActiveChallenge[]>("rosa_challenges", []);
  const [tab, setTab] = useState<"active" | "explore">("explore");
  const { toast } = useToast();

  const startChallenge = (c: Challenge) => {
    if (activeChallenges.some((a) => a.challengeId === c.id)) {
      toast({ title: "You're already doing this challenge!" });
      return;
    }
    const active: ActiveChallenge = {
      challengeId: c.id,
      startDate: new Date().toISOString(),
      checkins: [],
      completed: false,
    };
    setActiveChallenges([...activeChallenges, active]);
    toast({ title: `${c.emoji} Challenge started!`, description: `${c.title} — Day 1 of ${c.duration}` });
    setTab("active");
  };

  const checkIn = (challengeId: string) => {
    const today = format(new Date(), "yyyy-MM-dd");
    setActiveChallenges(activeChallenges.map((a) => {
      if (a.challengeId !== challengeId) return a;
      if (a.checkins.includes(today)) return a;
      const checkins = [...a.checkins, today];
      const challenge = CHALLENGES.find((c) => c.id === challengeId)!;
      const completed = checkins.length >= challenge.duration;
      if (completed) toast({ title: `🏆 Challenge Complete! "${challenge.title}"`, description: "You earned a badge!" });
      return { ...a, checkins, completed };
    }));
  };

  const myActive = activeChallenges.filter((a) => !a.completed);
  const myCompleted = activeChallenges.filter((a) => a.completed);

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6 max-w-2xl pb-24">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-serif text-foreground flex items-center gap-2">
          <Trophy className="w-7 h-7 text-primary" /> Wellness Challenges
        </h1>
        <p className="text-muted-foreground mt-1">7-day and 30-day wellness journeys</p>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 bg-muted rounded-xl p-1">
        {(["explore", "active"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize ${tab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
          >
            {t === "active" ? `Active (${myActive.length})` : "Explore"}
          </button>
        ))}
      </div>

      {tab === "active" && (
        <div className="space-y-4">
          {myCompleted.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">Completed 🏆</p>
              {myCompleted.map((ac) => {
                const c = CHALLENGES.find((c) => c.id === ac.challengeId)!;
                return (
                  <Card key={ac.challengeId} className="border-amber-200 bg-amber-50/40 mb-3">
                    <CardContent className="pt-4 pb-4 flex items-center gap-3">
                      <span className="text-2xl">{c.emoji}</span>
                      <div>
                        <p className="font-medium text-sm">{c.title}</p>
                        <p className="text-xs text-amber-700">Completed {c.duration} days! 🎉</p>
                      </div>
                      <Star className="w-5 h-5 text-amber-500 ml-auto" />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {myActive.length === 0 && myCompleted.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Trophy className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="font-serif text-lg">No challenges yet.</p>
              <p className="text-sm mt-1">Explore and start a challenge to build healthy habits.</p>
            </div>
          )}

          {myActive.map((ac) => {
            const c = CHALLENGES.find((c) => c.id === ac.challengeId)!;
            const today = format(new Date(), "yyyy-MM-dd");
            const checkedToday = ac.checkins.includes(today);
            const progress = (ac.checkins.length / c.duration) * 100;
            const dayNum = ac.checkins.length + 1;
            return (
              <Card key={ac.challengeId} className="border-border/50">
                <CardContent className="pt-4 pb-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{c.emoji}</span>
                      <div>
                        <p className="font-medium">{c.title}</p>
                        <p className="text-xs text-muted-foreground">Day {Math.min(dayNum, c.duration)} of {c.duration}</p>
                      </div>
                    </div>
                    <Badge variant="secondary">{c.category}</Badge>
                  </div>
                  <Progress value={progress} className="h-2 mb-3" />
                  <p className="text-sm text-muted-foreground mb-3 italic">"{c.dailyAction}"</p>
                  <Button
                    onClick={() => checkIn(ac.challengeId)}
                    disabled={checkedToday}
                    size="sm"
                    className={checkedToday ? "bg-emerald-100 text-emerald-700" : "bg-primary hover:bg-primary/90"}
                  >
                    {checkedToday ? <><CheckCircle2 className="w-4 h-4 mr-1" /> Done for today!</> : <><Flame className="w-4 h-4 mr-1" /> Check In</>}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {tab === "explore" && (
        <div className="space-y-4">
          {["7", "30"].map((days) => (
            <div key={days}>
              <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">{days}-Day Challenges</p>
              {CHALLENGES.filter((c) => c.duration === Number(days)).map((c) => {
                const isActive = activeChallenges.some((a) => a.challengeId === c.id);
                return (
                  <Card key={c.id} className="border-border/50 mb-3 hover:shadow-sm transition-shadow">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex gap-4 items-start">
                        <span className="text-3xl">{c.emoji}</span>
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <p className="font-medium">{c.title}</p>
                            <Badge variant="outline" className="text-xs">{c.category}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{c.description}</p>
                          <Button
                            onClick={() => startChallenge(c)}
                            disabled={isActive}
                            size="sm"
                            className="mt-3 gap-2"
                            variant={isActive ? "outline" : "default"}
                          >
                            {isActive ? <><CheckCircle2 className="w-3 h-3" /> Active</> : `Start ${days}-day Challenge`}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
