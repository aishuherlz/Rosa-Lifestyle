import { motion } from "framer-motion";
import { Crown, Star, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSubscription } from "@/lib/subscription-context";
import { useState } from "react";

const FREE_FEATURES = [
  "Period & cycle tracking",
  "Basic mood check-ins",
  "Daily wellness reminders",
  "Partner sharing (essentials)",
  "Health profile",
];

const PREMIUM_FEATURES = [
  "AI chatbot — mental & emotional support",
  "Personalized outfit planner",
  "Food & diet plans with calorie tracking",
  "Gym scheduling & animated workouts",
  "Photo milestones",
  "Things to do & travel planning",
  "Advanced partner sharing",
  "Wishlist with shop links",
  "Weight loss journey tracker",
  "Disability & health condition adaptations",
  "Timezone-aware scheduling",
];

export default function Subscription() {
  const { plan, isPremium, daysLeftInTrial, trialEndsAt, subscribedAt, renewsAt, subscribe, cancelSubscription } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("yearly");
  const [showConfirm, setShowConfirm] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = () => {
    setShowConfirm(true);
  };

  const confirmSubscribe = () => {
    subscribe(selectedPlan);
    setShowConfirm(false);
    setSubscribed(true);
  };

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-background to-muted/30">
      <div className="px-4 py-8 max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <Crown className="w-10 h-10 mx-auto mb-3 text-amber-500" />
          <h1 className="font-serif text-3xl font-medium text-foreground mb-2">ROSA Premium</h1>
          <p className="text-muted-foreground text-sm">
            Unlock the full ROSA experience — everything you need, in one place.
          </p>
        </motion.div>

        {plan === "trial" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-center"
          >
            <p className="text-amber-800 font-medium text-sm">
              You have <span className="font-bold text-amber-900">{daysLeftInTrial} days</span> left in your free trial
            </p>
            <p className="text-amber-700 text-xs mt-1">
              Trial ends {trialEndsAt ? new Date(trialEndsAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : ""}
            </p>
          </motion.div>
        )}

        {(plan === "monthly" || plan === "yearly") && !subscribed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-center"
          >
            <Badge className="bg-rose-500 text-white mb-2">Active</Badge>
            <p className="text-rose-800 font-medium text-sm capitalize">{plan} plan</p>
            <p className="text-rose-600 text-xs mt-1">
              Subscribed {subscribedAt ? new Date(subscribedAt).toLocaleDateString() : ""} · Renews {renewsAt ? new Date(renewsAt).toLocaleDateString() : ""}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-rose-500 text-xs"
              onClick={cancelSubscription}
            >
              Cancel subscription
            </Button>
          </motion.div>
        )}

        {subscribed && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mb-6 p-6 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white text-center"
          >
            <Sparkles className="w-8 h-8 mx-auto mb-2" />
            <p className="font-serif text-lg font-medium">Welcome to Premium!</p>
            <p className="text-white/80 text-sm mt-1">Your ROSA journey just got fuller.</p>
          </motion.div>
        )}

        {plan === "expired" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 p-4 rounded-2xl bg-gray-50 border border-gray-200 text-center"
          >
            <p className="text-gray-700 font-medium text-sm">Your free trial has ended</p>
            <p className="text-gray-500 text-xs mt-1">Subscribe to continue your premium journey</p>
          </motion.div>
        )}

        {(plan === "trial" || plan === "expired") && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <motion.div
                whileTap={{ scale: 0.97 }}
                onClick={() => setSelectedPlan("monthly")}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  selectedPlan === "monthly"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card"
                }`}
              >
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Monthly</p>
                <p className="font-serif text-2xl font-medium text-foreground">$5</p>
                <p className="text-xs text-muted-foreground">per month</p>
              </motion.div>

              <motion.div
                whileTap={{ scale: 0.97 }}
                onClick={() => setSelectedPlan("yearly")}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all relative ${
                  selectedPlan === "yearly"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card"
                }`}
              >
                <Badge className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs px-2">Save 17%</Badge>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Yearly</p>
                <p className="font-serif text-2xl font-medium text-foreground">$50</p>
                <p className="text-xs text-muted-foreground">per year</p>
              </motion.div>
            </div>

            {!showConfirm ? (
              <Button
                onClick={handleSubscribe}
                className="w-full bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-2xl h-12 font-medium text-base shadow-lg"
              >
                <Crown className="w-4 h-4 mr-2" />
                Start {selectedPlan === "monthly" ? "Monthly" : "Yearly"} Plan
              </Button>
            ) : (
              <Card className="border-rose-200">
                <CardContent className="pt-4 text-center">
                  <p className="text-sm text-foreground mb-1 font-medium">Confirm subscription</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    {selectedPlan === "monthly" ? "$5/month" : "$50/year"} — cancel anytime
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 rounded-xl"
                      onClick={() => setShowConfirm(false)}
                    >
                      Back
                    </Button>
                    <Button
                      className="flex-1 bg-rose-500 hover:bg-rose-600 text-white rounded-xl"
                      onClick={confirmSubscribe}
                    >
                      Confirm
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Demo mode — subscription is simulated locally
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        <div className="mt-8 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Always Free</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {FREE_FEATURES.map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                  {f}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-rose-200 bg-rose-50/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-rose-600 uppercase tracking-wide flex items-center gap-1">
                <Star className="w-4 h-4" /> Premium Features
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {PREMIUM_FEATURES.map((f) => (
                <div key={f} className={`flex items-center gap-2 text-sm ${isPremium ? "text-foreground" : "text-muted-foreground"}`}>
                  <Check className={`w-4 h-4 shrink-0 ${isPremium ? "text-rose-500" : "text-muted-foreground/50"}`} />
                  {f}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
