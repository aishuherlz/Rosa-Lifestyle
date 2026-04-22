import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ClipboardList, ChevronRight, Check, Heart, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useLocalStorage } from "@/hooks/use-local-storage";

type SurveyQuestion = {
  id: string;
  text: string;
  options: string[];
};

type Survey = {
  id: string;
  title: string;
  description: string;
  questions: SurveyQuestion[];
  category: string;
};

const SURVEYS: Survey[] = [
  {
    id: "wellness",
    title: "Weekly Wellness Check",
    description: "How are you really doing this week?",
    category: "Health",
    questions: [
      { id: "q1", text: "How would you rate your overall energy levels this week?", options: ["Very low", "Low", "Average", "Good", "Excellent"] },
      { id: "q2", text: "How well have you been sleeping?", options: ["Very poorly", "Poorly", "Okay", "Well", "Very well"] },
      { id: "q3", text: "How is your stress level?", options: ["Overwhelmed", "Stressed", "Manageable", "Calm", "Very relaxed"] },
      { id: "q4", text: "How connected do you feel to yourself and others?", options: ["Very disconnected", "Disconnected", "Neutral", "Connected", "Very connected"] },
      { id: "q5", text: "Are you taking time for things you love?", options: ["Not at all", "Rarely", "Sometimes", "Often", "Always"] },
    ],
  },
  {
    id: "body_image",
    title: "Body & Self-Confidence",
    description: "An honest check-in with how you feel in your skin.",
    category: "Mindset",
    questions: [
      { id: "q1", text: "How do you feel about your body today?", options: ["Very negative", "Struggling", "Neutral", "Mostly positive", "Confident and loving it"] },
      { id: "q2", text: "Do you compare yourself to others?", options: ["Constantly", "Often", "Sometimes", "Rarely", "Never"] },
      { id: "q3", text: "Do you speak kindly to yourself?", options: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "q4", text: "How much does social media affect how you see yourself?", options: ["A lot negatively", "Somewhat negatively", "Neutral", "It inspires me", "Not at all"] },
    ],
  },
  {
    id: "relationships",
    title: "Relationships & Support",
    description: "Reflect on the connections that shape your life.",
    category: "Connections",
    questions: [
      { id: "q1", text: "Do you feel supported by people in your life?", options: ["Not at all", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "q2", text: "How comfortable are you expressing your needs?", options: ["Very uncomfortable", "Uncomfortable", "It depends", "Comfortable", "Very comfortable"] },
      { id: "q3", text: "Do you have at least one person you can be completely honest with?", options: ["No", "Not sure", "Kind of", "Yes", "Absolutely"] },
      { id: "q4", text: "How are your boundaries holding up?", options: ["No boundaries", "Often crossed", "Working on it", "Mostly good", "Strong and clear"] },
    ],
  },
  {
    id: "goals",
    title: "Goals & Growth",
    description: "Where are you in your personal journey?",
    category: "Growth",
    questions: [
      { id: "q1", text: "How clear are your goals right now?", options: ["No idea", "Vague", "Getting clearer", "Pretty clear", "Crystal clear"] },
      { id: "q2", text: "Are you making progress toward what matters most?", options: ["Not really", "Very slowly", "Some progress", "Good progress", "Thriving"] },
      { id: "q3", text: "How do you handle setbacks?", options: ["Fall apart", "Struggle a lot", "Get through it", "Bounce back", "Grow from them"] },
      { id: "q4", text: "Do you celebrate your small wins?", options: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
    ],
  },
];

type SurveyResult = {
  surveyId: string;
  answers: Record<string, string>;
  completedAt: string;
};

export default function Surveys() {
  const [results, setResults] = useLocalStorage<SurveyResult[]>("rosa_survey_results", []);
  const [activeSurvey, setActiveSurvey] = useState<Survey | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState(false);

  function startSurvey(survey: Survey) {
    setActiveSurvey(survey);
    setCurrentQ(0);
    setAnswers({});
    setCompleted(false);
  }

  function answerQuestion(option: string) {
    if (!activeSurvey) return;
    const q = activeSurvey.questions[currentQ];
    const newAnswers = { ...answers, [q.id]: option };
    setAnswers(newAnswers);
    if (currentQ + 1 < activeSurvey.questions.length) {
      setTimeout(() => setCurrentQ(currentQ + 1), 300);
    } else {
      const result: SurveyResult = {
        surveyId: activeSurvey.id,
        answers: newAnswers,
        completedAt: new Date().toISOString(),
      };
      setResults([...results.filter((r) => r.surveyId !== activeSurvey.id), result]);
      setCompleted(true);
    }
  }

  function getLastResult(surveyId: string) {
    return results.filter((r) => r.surveyId === surveyId).sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
  }

  if (activeSurvey && !completed) {
    const q = activeSurvey.questions[currentQ];
    const progress = ((currentQ) / activeSurvey.questions.length) * 100;
    return (
      <div className="min-h-screen flex flex-col pb-24">
        <div className="px-4 py-6 max-w-lg mx-auto w-full flex-1">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setActiveSurvey(null)} className="text-muted-foreground text-sm">
              ← Back
            </button>
            <div className="flex-1">
              <Progress value={progress} className="h-2" />
            </div>
            <span className="text-xs text-muted-foreground">{currentQ + 1}/{activeSurvey.questions.length}</span>
          </div>

          <motion.div
            key={q.id}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            className="space-y-6"
          >
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{activeSurvey.title}</p>
              <h2 className="font-serif text-xl font-medium text-foreground leading-snug">{q.text}</h2>
            </div>
            <div className="space-y-2.5">
              {q.options.map((option) => (
                <motion.button
                  key={option}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => answerQuestion(option)}
                  className={`w-full text-left p-4 rounded-2xl border-2 transition-all text-sm ${
                    answers[q.id] === option
                      ? "border-primary bg-primary/5 text-primary font-medium"
                      : "border-border bg-card text-foreground hover:border-primary/40"
                  }`}
                >
                  {option}
                </motion.button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  if (completed && activeSurvey) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-4">
          <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center mx-auto">
            <Heart className="w-8 h-8 text-rose-500" />
          </div>
          <h2 className="font-serif text-2xl font-medium">Thank you for sharing</h2>
          <p className="text-muted-foreground text-sm max-w-xs">
            Your reflections are saved. Being honest with yourself is the first step toward growth.
          </p>
          <Button
            onClick={() => setActiveSurvey(null)}
            className="bg-rose-500 hover:bg-rose-600 text-white rounded-2xl mt-4"
          >
            Back to Surveys
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="px-4 py-6 max-w-lg mx-auto">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="font-serif text-2xl font-medium text-foreground">Surveys</h1>
          <p className="text-muted-foreground text-sm mt-1">Honest check-ins for your inner life</p>
        </motion.div>

        <div className="space-y-3">
          {SURVEYS.map((survey, i) => {
            const last = getLastResult(survey.id);
            return (
              <motion.div
                key={survey.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
              >
                <Card
                  className="cursor-pointer hover:shadow-md transition-all border-border"
                  onClick={() => startSurvey(survey)}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{survey.category}</span>
                          {last && <Check className="w-3.5 h-3.5 text-green-500" />}
                        </div>
                        <h3 className="font-medium text-foreground text-sm">{survey.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{survey.description}</p>
                        {last && (
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            Last taken {new Date(last.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />
                    </div>
                    <div className="flex items-center gap-1 mt-2">
                      {survey.questions.map((_, qi) => (
                        <div key={qi} className="h-1 flex-1 rounded-full bg-muted" />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{survey.questions.length} questions</p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
