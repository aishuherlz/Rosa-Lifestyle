import { motion } from "framer-motion";
import { Crown, Star, Check, Sparkles, Shield, Gift, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSubscription } from "@/lib/subscription-context";
import { useState, useEffect } from "react";

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
  "Photo milestones & skin tracker",
  "Travel planning & bucket list",
  "Advanced partner sharing",
  "Wishlist with shop links",
  "ROSA Garden rewards & badges",
  "Letters to Future Self",
  "Disability & health condition adaptations",
  "Timezone-aware scheduling",
];

type PriceInfo = {
  monthly: { id: string; amount: number; currency: string };
  yearly: { id: string; amount: number; currency: string };
};

function formatPrice(amount: number, currency: string): string {
  const symbol = currency === "cad" ? "CAD $" : currency === "inr" ? "₹" : "$";
  return `${symbol}${(amount / 100).toFixed(0)}`;
}

export default function Subscription() {
  const { plan, isPremium, daysLeftInTrial, trialEndsAt, subscribedAt, renewsAt, subscribe, cancelSubscription } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("yearly");
  const [prices, setPrices] = useState<PriceInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [showPortalBtn, setShowPortalBtn] = useState(false);

  useEffect(() => {
    fetch("/api/stripe/prices")
      .then(r => r.json())
      .then(setPrices)
      .catch(() => setPrices({
        monthly: { id: "price_monthly", amount: 500, currency: "cad" },
        yearly: { id: "price_yearly", amount: 5000, currency: "cad" },
      }));
  }, []);

  const handleStripeCheckout = async () => {
    setLoading(true);
    setCheckoutError("");
    try {
      const name = localStorage.getItem("rosa_name") || "ROSA User";
      const token = localStorage.getItem("rosa_auth_token");
      if (!token) {
        setCheckoutError("Please sign in with your verified email first to subscribe.");
        setLoading(false);
        return;
      }
      const resp = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ name, planType: selectedPlan }),
      });

      if (!resp.ok) throw new Error("Could not create checkout session");
      const { url, isFoundingMember, foundingMemberType } = await resp.json();

      if (url) {
        window.location.href = url;
      } else {
        // Fallback to local simulation if Stripe not connected
        subscribe(selectedPlan);
        setShowPortalBtn(true);
      }
    } catch {
      // Stripe not connected — use local simulation
      subscribe(selectedPlan);
      setShowPortalBtn(true);
    } finally {
      setLoading(false);
    }
  };

  const handlePortal = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("rosa_auth_token");
      if (!token) { setCheckoutError("Sign in first to manage billing."); setLoading(false); return; }
      const resp = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const { url } = await resp.json();
      if (url) window.open(url, "_blank");
    } catch {
      setCheckoutError("Billing portal unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const monthlyPrice = prices ? formatPrice(prices.monthly.amount, prices.monthly.currency) : "CAD $5";
  const yearlyPrice = prices ? formatPrice(prices.yearly.amount, prices.yearly.currency) : "CAD $50";

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-background to-muted/30">
      <div className="px-4 py-8 max-w-lg mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <Crown className="w-10 h-10 mx-auto mb-3 text-amber-500" />
          <h1 className="font-serif text-3xl font-medium text-foreground mb-2">ROSA Premium</h1>
          <p className="text-muted-foreground text-sm">
            Unlock the full ROSA experience — everything you need, in one place.
          </p>
        </motion.div>

        {/* Founding member banner */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-3 p-3 rounded-2xl bg-gradient-to-r from-amber-50 to-rose-50 border border-amber-200 text-center">
          <p className="text-amber-800 text-xs font-medium flex items-center justify-center gap-1">
            <Gift className="w-3.5 h-3.5" />
            First 100 users get <strong>6 months free</strong> · First 500 get <strong>3 months free</strong>
          </p>
        </motion.div>

        {/* Partner pricing — invite a partner */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-5 p-3.5 rounded-2xl bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200">
          <div className="flex items-start gap-2.5">
            <span className="text-xl">💝</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-rose-800">Bring your partner along</p>
              <p className="text-xs text-rose-700/80 mt-0.5">
                Invite your partner from the <span className="font-medium">Partner</span> page — they get <strong>3 months free</strong>, then <strong>50% off forever</strong> while your account stays active.
              </p>
            </div>
          </div>
        </motion.div>

        {plan === "trial" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-center">
            <p className="text-amber-800 font-medium text-sm">
              You have <span className="font-bold text-amber-900">{daysLeftInTrial} days</span> left in your free trial
            </p>
            <p className="text-amber-700 text-xs mt-1">
              Trial ends {trialEndsAt ? new Date(trialEndsAt).toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" }) : ""}
            </p>
          </motion.div>
        )}

        {(plan === "monthly" || plan === "yearly") && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-center">
            <Badge className="bg-rose-500 text-white mb-2">Active</Badge>
            <p className="text-rose-800 font-medium text-sm capitalize">{plan} plan</p>
            <p className="text-rose-600 text-xs mt-1">
              Subscribed {subscribedAt ? new Date(subscribedAt).toLocaleDateString() : ""} · Renews {renewsAt ? new Date(renewsAt).toLocaleDateString() : ""}
            </p>
            <div className="flex gap-2 mt-3 justify-center">
              <Button variant="outline" size="sm" className="text-xs border-rose-300" onClick={handlePortal} disabled={loading}>
                <ExternalLink className="w-3 h-3 mr-1" /> Manage Billing
              </Button>
              <Button variant="ghost" size="sm" className="text-rose-500 text-xs" onClick={cancelSubscription}>
                Cancel
              </Button>
            </div>
          </motion.div>
        )}

        {plan === "expired" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6 p-4 rounded-2xl bg-gray-50 border border-gray-200 text-center">
            <p className="text-gray-700 font-medium text-sm">Your free trial has ended</p>
            <p className="text-gray-500 text-xs mt-1">Subscribe to continue your premium journey</p>
          </motion.div>
        )}

        {(plan === "trial" || plan === "expired") && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <motion.div whileTap={{ scale: 0.97 }} onClick={() => setSelectedPlan("monthly")}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${selectedPlan === "monthly" ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Monthly</p>
                <p className="font-serif text-2xl font-medium text-foreground">{monthlyPrice}</p>
                <p className="text-xs text-muted-foreground">per month</p>
              </motion.div>

              <motion.div whileTap={{ scale: 0.97 }} onClick={() => setSelectedPlan("yearly")}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all relative ${selectedPlan === "yearly" ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
                <Badge className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs px-2">Save 17%</Badge>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Yearly</p>
                <p className="font-serif text-2xl font-medium text-foreground">{yearlyPrice}</p>
                <p className="text-xs text-muted-foreground">per year</p>
              </motion.div>
            </div>

            {checkoutError && (
              <p className="text-xs text-red-500 text-center mb-3">{checkoutError}</p>
            )}

            <Button
              onClick={handleStripeCheckout}
              disabled={loading}
              className="w-full bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-2xl h-12 font-medium text-base shadow-lg"
            >
              <Crown className="w-4 h-4 mr-2" />
              {loading ? "Loading..." : `Start ${selectedPlan === "monthly" ? "Monthly" : "Yearly"} Plan`}
            </Button>

            <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Secure checkout</span>
              <span>·</span>
              <span>Cancel anytime</span>
              <span>·</span>
              <span>3-month free trial</span>
            </div>
          </>
        )}

        {showPortalBtn && (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-6 p-6 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white text-center">
            <Sparkles className="w-8 h-8 mx-auto mb-2" />
            <p className="font-serif text-lg font-medium">Welcome to Premium!</p>
            <p className="text-white/80 text-sm mt-1">Your ROSA journey just got fuller.</p>
          </motion.div>
        )}

        <div className="mt-8 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Always Free</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {FREE_FEATURES.map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="w-4 h-4 text-green-500 shrink-0" />{f}
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
                  <Check className={`w-4 h-4 shrink-0 ${isPremium ? "text-rose-500" : "text-muted-foreground/50"}`} />{f}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
