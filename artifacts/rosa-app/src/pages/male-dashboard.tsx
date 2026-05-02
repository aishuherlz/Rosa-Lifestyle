import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Heart, Target, Star, Gift, Map, Brain, Zap, ChevronRight, Sunrise, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/lib/user-context";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api";
import { Link } from "wouter";

const MENTAL_CHECK_INS = [
  { emoji: "😤", label: "Stressed" },
  { emoji: "😌", label: "Calm" },
  { emoji: "💪", label: "Strong" },
  { emoji: "😔", label: "Low" },
  { emoji: "🔥", label: "Motivated" },
  { emoji: "😴", label: "Tired" },
  { emoji: "🎉", label: "Happy" },
  { emoji: "🤔", label: "Unsure" },
];

const QUICK_LINKS = [
  { label: "Goals", emoji: "🎯", href: "/goals", color: "bg-blue-50 border-blue-200 text-blue-700" },
  { label: "Wishlist", emoji: "🎁", href: "/wishlist", color: "bg-amber-50 border-amber-200 text-amber-700" },
  { label: "Milestones", emoji: "🏆", href: "/milestones", color: "bg-purple-50 border-purple-200 text-purple-700" },
  { label: "Partner", emoji: "💑", href: "/partner", color: "bg-rose-50 border-rose-200 text-rose-700" },
  { label: "Journal", emoji: "📖", href: "/journal", color: "bg-indigo-50 border-indigo-200 text-indigo-700" },
  { label: "Sleep", emoji: "😴", href: "/sleep", color: "bg-slate-50 border-slate-200 text-slate-700" },
  { label: "Travel", emoji: "✈️", href: "/travel", color: "bg-sky-50 border-sky-200 text-sky-700" },
  { label: "Food", emoji: "🍽️", href: "/food", color: "bg-orange-50 border-orange-200 text-orange-700" },
];

const DAILY_TIPS = [
  "A 10-min walk today can shift your mood more than scrolling ever will.",
  "Check in on her without her asking — it means more than you know.",
  "Your consistency is your superpower. Show up, every day.",
  "Name one thing you're grateful for before you check your phone.",
  "Drink water. Seriously. 💧",
  "A small act of service is worth more than a grand gesture.",
  "You are allowed to feel your feelings and still handle your responsibilities.",
];

export default function MaleDashboard() {
  const { user, getAuthHeaders } = useUser();
  const { toast } = useToast();
  const [mood, setMood] = useState<string | null>(null);
  const [partnerData, setPartnerData] = useState<any>(null);
  const [savingMood, setSavingMood] = useState(false);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const tip = DAILY_TIPS[new Date().getDate() % DAILY_TIPS.length];

  useEffect(() => {
    if (user?.authToken) fetchPartnerData();
  }, [user]);

  const fetchPartnerData = async () => {
    try {
      const res = await fetch(apiUrl("/api/partner/shared-data"), { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.linked) setPartnerData(data);
    } catch {}
  };

  const saveMoodCheckin = async (selected: string) => {
    setMood(selected);
    setSavingMood(true);
    try {
      await fetch(apiUrl("/api/sync/push"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ type: "mood", data: { mood: selected, date: new Date().toISOString() } }),
      });
      toast({ title: "Mood logged 💙", description: "Keep going, brother." });
    } catch {}
    setSavingMood(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-4 max-w-2xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F]">
            {greeting()}, {user?.name?.split(" ")[0] || "Hero"} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Your daily dashboard</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
          {(user?.name?.[0] || "H").toUpperCase()}
        </div>
      </div>

      {/* Daily Tip */}
      <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardContent className="p-4 flex gap-3 items-start">
          <Sunrise className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-800 font-medium">{tip}</p>
        </CardContent>
      </Card>

      {/* Mental Health Check-in */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-[#1E3A5F] text-base flex items-center gap-2">
            <Brain className="w-4 h-4" /> How are you feeling today?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2">
            {MENTAL_CHECK_INS.map(m => (
              <button
                key={m.label}
                onClick={() => saveMoodCheckin(m.label)}
                className={`p-2 rounded-xl border text-center transition-all ${
                  mood === m.label
                    ? "border-blue-500 bg-blue-50 scale-105"
                    : "border-slate-200 bg-white hover:border-blue-300"
                }`}
              >
                <div className="text-2xl">{m.emoji}</div>
                <p className="text-xs text-slate-600 mt-1">{m.label}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Partner Insights */}
      {partnerData?.linked && (
        <Card className="border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-rose-700 text-base flex items-center gap-2">
              <Heart className="w-4 h-4" /> {partnerData.partner?.name}'s Updates
            </CardTitle>
            <p className="text-xs text-rose-400">Data she chose to share with you</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {partnerData.partnerData?.cycle && (
              <div className="p-3 bg-white rounded-xl border border-rose-100">
                <p className="text-xs font-semibold text-rose-600">🌸 Cycle Phase</p>
                <p className="text-sm text-slate-700 mt-0.5">
                  {typeof partnerData.partnerData.cycle === "object"
                    ? partnerData.partnerData.cycle.phase || "Active"
                    : String(partnerData.partnerData.cycle)}
                </p>
              </div>
            )}
            {partnerData.partnerData?.mood && (
              <div className="p-3 bg-white rounded-xl border border-pink-100">
                <p className="text-xs font-semibold text-pink-600">💗 Mood</p>
                <p className="text-sm text-slate-700 mt-0.5">
                  {typeof partnerData.partnerData.mood === "object"
                    ? partnerData.partnerData.mood.mood || "Good"
                    : String(partnerData.partnerData.mood)}
                </p>
              </div>
            )}
            {partnerData.partnerData?.wishlist && Array.isArray(partnerData.partnerData.wishlist) && partnerData.partnerData.wishlist.length > 0 && (
              <div className="p-3 bg-white rounded-xl border border-amber-100">
                <p className="text-xs font-semibold text-amber-600">🎁 Her Wishlist</p>
                {partnerData.partnerData.wishlist.slice(0, 3).map((item: any, i: number) => (
                  <p key={i} className="text-sm text-slate-700">• {item.name || item.title}</p>
                ))}
              </div>
            )}
            {!partnerData.partnerData?.cycle && !partnerData.partnerData?.mood && !partnerData.partnerData?.wishlist && (
              <p className="text-xs text-rose-400 text-center py-2">
                She hasn't shared any data yet. Ask her to enable sharing in her Partner settings 🌹
              </p>
            )}
            <Link href="/partner">
              <Button variant="outline" size="sm" className="w-full border-rose-200 text-rose-600 hover:bg-rose-50 mt-1">
                View all partner data <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Not linked yet */}
      {!partnerData?.linked && (
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-4 text-center space-y-2">
            <p className="text-2xl">💑</p>
            <p className="text-sm font-semibold text-slate-700">Connect with your partner</p>
            <p className="text-xs text-slate-500">Link your accounts to see her shared updates here.</p>
            <Link href="/partner">
              <Button size="sm" className="bg-[#B06B8B] text-white">Go to Partner page</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Quick Access */}
      <div>
        <p className="text-sm font-semibold text-[#1E3A5F] mb-3">Your Space</p>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_LINKS.map(link => (
            <Link key={link.href} href={link.href}>
              <div className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer hover:scale-[1.02] transition-transform ${link.color}`}>
                <span className="text-2xl">{link.emoji}</span>
                <span className="text-sm font-medium">{link.label}</span>
                <ChevronRight className="w-3 h-3 ml-auto opacity-60" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Affirmation */}
      <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50">
        <CardContent className="p-4 text-center">
          <p className="text-2xl mb-2">💙</p>
          <p className="text-sm font-semibold text-indigo-800">
            You showing up today matters. Keep going.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
