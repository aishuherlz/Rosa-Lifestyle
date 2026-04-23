import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, LogOut, User, Bell, Tag, Shield, Crown, Globe, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/lib/user-context";
import { useSubscription } from "@/lib/subscription-context";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from "@/hooks/use-local-storage";

const PERSONALITY_TAGS = ["feminist", "spiritual", "adventurous", "gentle", "bold", "self-love", "strength", "growth"];

const GENDER_OPTIONS = [
  "Woman", "Man", "Non-binary", "Gender fluid", "Gender queer",
  "Transgender woman", "Transgender man", "Two-spirit", "Prefer not to say",
];

type PrivacySettings = {
  shareMoodWithPartner: boolean;
  sharePeriodWithPartner: boolean;
  shareRemindersWithPartner: boolean;
  shareWishlistWithPartner: boolean;
  shareMilestonesWithPartner: boolean;
  shareWeightWithPartner: boolean;
  allowPartnerViewFood: boolean;
};

type TimezoneSettings = {
  timezone: string;
  use24h: boolean;
};

export default function SettingsPage() {
  const { user, setUser } = useUser();
  const { plan, daysLeftInTrial } = useSubscription();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: user?.name || "",
    gender: user?.gender || "",
    pronouns: user?.pronouns || "she/her",
    personalityTags: user?.personalityTags || [] as string[],
  });
  const [privacy, setPrivacy] = useLocalStorage<PrivacySettings>("rosa_privacy", {
    shareMoodWithPartner: true,
    sharePeriodWithPartner: false,
    shareRemindersWithPartner: true,
    shareWishlistWithPartner: true,
    shareMilestonesWithPartner: true,
    shareWeightWithPartner: false,
    allowPartnerViewFood: false,
  });
  const [tz, setTz] = useLocalStorage<TimezoneSettings>("rosa_timezone", {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    use24h: false,
  });
  const [betaOptIn, setBetaOptIn] = useLocalStorage<boolean>("rosa_beta_optin", false);
  const [betaUpdates, setBetaUpdates] = useLocalStorage<boolean>("rosa_beta_updates", false);
  const [betaSurveys, setBetaSurveys] = useLocalStorage<boolean>("rosa_beta_surveys", false);

  const toggleTag = (tag: string) => {
    setForm((f) => ({
      ...f,
      personalityTags: f.personalityTags.includes(tag)
        ? f.personalityTags.filter((t) => t !== tag)
        : [...f.personalityTags, tag],
    }));
  };

  const handleSave = () => {
    if (!user) return;
    const updated = { ...user, name: form.name, gender: form.gender, pronouns: form.pronouns, personalityTags: form.personalityTags };
    setUser(updated);
    toast({ title: "Saved!", description: "Your profile has been updated." });
  };

  const handleLogout = () => {
    setUser(null);
    sessionStorage.removeItem("rosa_intro_seen");
    setLocation("/sign-in");
  };

  const privacyItems: { key: keyof PrivacySettings; label: string; desc: string }[] = [
    { key: "shareMoodWithPartner", label: "Mood check-ins", desc: "Let your partner see your daily mood" },
    { key: "sharePeriodWithPartner", label: "Period & cycle", desc: "Share cycle dates and symptoms" },
    { key: "shareRemindersWithPartner", label: "Reminders", desc: "Shared reminders visible to partner" },
    { key: "shareWishlistWithPartner", label: "Wishlist", desc: "Partner can view your wishlist" },
    { key: "shareMilestonesWithPartner", label: "Milestones", desc: "Share countdowns and memories" },
    { key: "shareWeightWithPartner", label: "Weight journey", desc: "Share weight progress with partner" },
    { key: "allowPartnerViewFood", label: "Food log", desc: "Partner can see your daily food log" },
  ];

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6 max-w-2xl pb-24">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-serif text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Make ROSA your own.</p>
      </motion.div>

      {/* Subscription Status */}
      <Card
        className={`cursor-pointer hover:shadow-md transition-all ${plan === "trial" ? "border-amber-200 bg-amber-50/50" : plan === "monthly" || plan === "yearly" ? "border-rose-200 bg-rose-50/40" : "border-gray-200"}`}
        onClick={() => setLocation("/subscription")}
      >
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Crown className={`w-5 h-5 ${plan === "trial" ? "text-amber-500" : plan === "expired" ? "text-muted-foreground" : "text-rose-500"}`} />
              <div>
                <p className="font-medium text-sm capitalize">
                  {plan === "trial" ? "Free Trial" : plan === "expired" ? "Trial Expired" : `${plan} plan`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {plan === "trial" ? `${daysLeftInTrial} days remaining` : plan === "expired" ? "Subscribe to unlock premium" : "Premium active"}
                </p>
              </div>
            </div>
            <Badge className={`text-xs ${plan === "trial" ? "bg-amber-100 text-amber-800" : plan === "expired" ? "bg-gray-100 text-gray-600" : "bg-rose-100 text-rose-700"}`}>
              {plan === "trial" ? "Trial" : plan === "expired" ? "Expired" : "Premium"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Profile */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <User className="w-5 h-5 text-primary" /> Your Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Your name" />
          </div>
          <div>
            <Label>Gender Identity</Label>
            <Select value={form.gender} onValueChange={(v) => setForm((f) => ({ ...f, gender: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                {GENDER_OPTIONS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Pronouns 🌹</Label>
            <Select value={form.pronouns} onValueChange={(v) => setForm((f) => ({ ...f, pronouns: v }))}>
              <SelectTrigger data-testid="select-pronouns"><SelectValue placeholder="Select pronouns" /></SelectTrigger>
              <SelectContent>
                {["she/her", "he/him", "they/them", "she/they", "he/they", "any"].map((p) => (
                  <SelectItem key={p} value={p}>{p === "any" ? "Any pronouns are fine" : p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Or type your own:</p>
            <Input
              className="mt-1"
              placeholder="e.g. ze/zir, fae/faer"
              value={form.pronouns}
              onChange={(e) => setForm((f) => ({ ...f, pronouns: e.target.value }))}
              data-testid="input-pronouns-custom"
            />
          </div>
          <div>
            <Label>Account</Label>
            <p className="text-sm text-muted-foreground mt-1">{user?.guestMode ? "Guest Mode" : `Signed in as ${user?.emailOrPhone}`}</p>
          </div>
        </CardContent>
      </Card>

      {/* Quote Personality */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <Tag className="w-5 h-5 text-primary" /> Quote Preferences
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">Your daily quotes will match your style.</p>
          <div className="flex flex-wrap gap-2">
            {PERSONALITY_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all capitalize ${
                  form.personalityTags.includes(tag)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary hover:text-primary"
                }`}
              >
                {tag.replace("-", " ")}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Privacy Controls */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" /> Partner Privacy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Choose what your partner can see in shared mode.</p>
          {privacyItems.map((item) => (
            <div key={item.key} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch
                checked={privacy[item.key]}
                onCheckedChange={(val) => setPrivacy({ ...privacy, [item.key]: val })}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Beta / Founders Program */}
      <Card className="border-rose-200/60 bg-gradient-to-br from-rose-50/40 to-pink-50/40 dark:from-rose-950/20 dark:to-pink-950/20 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-rose-600" /> Beta & Founders Program
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            ROSA is in our 3-month beta with our founding sisters. You can opt out anytime.
          </p>
          <div className="flex items-center justify-between py-2 border-b border-border/30">
            <div>
              <p className="text-sm font-medium">Join the beta program</p>
              <p className="text-xs text-muted-foreground">Be one of our founding sisters & enter the Lucky 10 raffle</p>
            </div>
            <Switch
              checked={betaOptIn}
              onCheckedChange={(v) => {
                setBetaOptIn(v);
                if (!v) { setBetaUpdates(false); setBetaSurveys(false); }
                else { setBetaUpdates(true); setBetaSurveys(true); }
                try { window.dispatchEvent(new Event("rosa-beta-optin-changed")); } catch {}
                toast({ title: v ? "Welcome to the beta 🌹" : "You've opted out", description: v ? "You're entered into the Lucky 10 raffle and will see beta features." : "Beta banners and surveys are hidden. You can re-join anytime." });
              }}
              data-testid="switch-beta-optin"
            />
          </div>
          <div className={`flex items-center justify-between py-2 border-b border-border/30 ${!betaOptIn ? "opacity-50 pointer-events-none" : ""}`}>
            <div>
              <p className="text-sm font-medium">Beta updates by email</p>
              <p className="text-xs text-muted-foreground">Get monthly behind-the-scenes notes from Aiswarya</p>
            </div>
            <Switch checked={betaUpdates && betaOptIn} onCheckedChange={setBetaUpdates} disabled={!betaOptIn} />
          </div>
          <div className={`flex items-center justify-between py-2 ${!betaOptIn ? "opacity-50 pointer-events-none" : ""}`}>
            <div>
              <p className="text-sm font-medium">Feedback surveys</p>
              <p className="text-xs text-muted-foreground">Occasional 1-minute surveys to shape the app</p>
            </div>
            <Switch checked={betaSurveys && betaOptIn} onCheckedChange={setBetaSurveys} disabled={!betaOptIn} />
          </div>
          {!betaOptIn && (
            <p className="text-xs text-muted-foreground italic pt-1">
              You'll still have full access to ROSA — you just won't receive beta-specific perks or be in the Lucky 10 raffle.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Timezone */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" /> Time & Location
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Your Timezone</Label>
            <p className="text-sm text-muted-foreground mt-1 bg-muted px-3 py-2 rounded-lg">
              <Globe className="w-3.5 h-3.5 inline mr-1.5" />
              {tz.timezone}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Auto-detected from your device. Used for timezone-aware reminders.</p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">24-hour time</p>
              <p className="text-xs text-muted-foreground">Use 14:00 instead of 2:00 PM</p>
            </div>
            <Switch checked={tz.use24h} onCheckedChange={(v) => setTz({ ...tz, use24h: v })} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} className="w-full bg-primary hover:bg-primary/90">
        Save Changes
      </Button>

      {/* Sign out */}
      <Card className="border-destructive/20 shadow-sm">
        <CardContent className="pt-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Sign Out</p>
              <p className="text-xs text-muted-foreground mt-0.5">You'll need to sign in again on your next visit.</p>
            </div>
            <Button variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/5" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-1" /> Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
