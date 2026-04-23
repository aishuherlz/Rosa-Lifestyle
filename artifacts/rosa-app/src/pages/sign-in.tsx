import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/lib/user-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OnboardingQuiz } from "@/components/onboarding/onboarding-quiz";
import { useToast } from "@/hooks/use-toast";
import { Mail, Phone, Loader2, ShieldCheck } from "lucide-react";

const COUNTRY_CODES: { code: string; name: string; dial: string; flag: string }[] = [
  { code: "US", name: "United States", dial: "+1", flag: "🇺🇸" },
  { code: "CA", name: "Canada", dial: "+1", flag: "🇨🇦" },
  { code: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧" },
  { code: "IN", name: "India", dial: "+91", flag: "🇮🇳" },
  { code: "AU", name: "Australia", dial: "+61", flag: "🇦🇺" },
  { code: "DE", name: "Germany", dial: "+49", flag: "🇩🇪" },
  { code: "FR", name: "France", dial: "+33", flag: "🇫🇷" },
  { code: "IT", name: "Italy", dial: "+39", flag: "🇮🇹" },
  { code: "ES", name: "Spain", dial: "+34", flag: "🇪🇸" },
  { code: "JP", name: "Japan", dial: "+81", flag: "🇯🇵" },
  { code: "CN", name: "China", dial: "+86", flag: "🇨🇳" },
  { code: "KR", name: "South Korea", dial: "+82", flag: "🇰🇷" },
  { code: "AE", name: "UAE", dial: "+971", flag: "🇦🇪" },
  { code: "SA", name: "Saudi Arabia", dial: "+966", flag: "🇸🇦" },
  { code: "ZA", name: "South Africa", dial: "+27", flag: "🇿🇦" },
  { code: "NG", name: "Nigeria", dial: "+234", flag: "🇳🇬" },
  { code: "KE", name: "Kenya", dial: "+254", flag: "🇰🇪" },
  { code: "BR", name: "Brazil", dial: "+55", flag: "🇧🇷" },
  { code: "MX", name: "Mexico", dial: "+52", flag: "🇲🇽" },
  { code: "SG", name: "Singapore", dial: "+65", flag: "🇸🇬" },
  { code: "ID", name: "Indonesia", dial: "+62", flag: "🇮🇩" },
  { code: "PH", name: "Philippines", dial: "+63", flag: "🇵🇭" },
  { code: "TH", name: "Thailand", dial: "+66", flag: "🇹🇭" },
  { code: "PK", name: "Pakistan", dial: "+92", flag: "🇵🇰" },
];

type Step = "auth" | "verify" | "gender" | "onboarding";
type Mode = "email" | "phone";

export default function SignIn() {
  const [, setLocation] = useLocation();
  const { setUser, locale } = useUser();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("auth");
  const [mode, setMode] = useState<Mode>("email");
  const [email, setEmail] = useState("");
  const [dialCode, setDialCode] = useState(() => COUNTRY_CODES.find(c => c.code === locale.countryCode)?.dial || "+1");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);

  const destination = mode === "email" ? email.trim() : `${dialCode}${phoneLocal.replace(/\D/g, "")}`;

  const sendCode = async () => {
    if (!name.trim()) { toast({ title: "Name needed", description: "Tell us what to call you 💝" }); return; }
    if (mode === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)) { toast({ title: "Email looks off", description: "Please enter a valid email." }); return; }
    if (mode === "phone" && phoneLocal.replace(/\D/g, "").length < 6) { toast({ title: "Phone looks short", description: "Please enter your full mobile number." }); return; }
    setBusy(true); setDevCode(null);
    try {
      const r = await fetch("/api/auth/send-code", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination, name }),
      });
      const d = await r.json();
      if (!d.ok) { toast({ title: "Couldn't send code", description: d.error || "Please try again." }); return; }
      if (d.devCode) setDevCode(d.devCode);
      toast({ title: d.sent ? "Code sent ✨" : "Verification code ready", description: d.message || (mode === "email" ? `Check your inbox at ${destination}` : "Enter the 6-digit code below") });
      setStep("verify");
    } catch (e: any) {
      toast({ title: "Network error", description: "Please check your connection." });
    } finally { setBusy(false); }
  };

  const verifyCode = async () => {
    if (code.replace(/\D/g, "").length !== 6) { toast({ title: "Enter the 6-digit code" }); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/auth/verify-code", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination, code: code.replace(/\D/g, "") }),
      });
      const d = await r.json();
      if (!d.ok) { toast({ title: "Verification failed", description: d.error || "Try again." }); return; }
      toast({ title: "Verified 💗", description: "Welcome to ROSA" });
      setStep("gender");
    } catch {
      toast({ title: "Network error" });
    } finally { setBusy(false); }
  };

  const handleGuest = () => {
    setUser({ name: "Guest", emailOrPhone: "", gender: "unspecified", guestMode: true, joinedAt: new Date().toISOString(), personalityTags: [] });
    setLocation("/");
  };

  const handleSelectGender = (gender: string) => {
    setUser({ name, emailOrPhone: destination, gender, guestMode: false, joinedAt: new Date().toISOString(), personalityTags: [] });
    setStep("onboarding");
  };

  const GENDERS = [
    { id: "female", label: "Female", desc: "She/Her" },
    { id: "male", label: "Male", desc: "He/Him" },
    { id: "non-binary", label: "Non-binary", desc: "They/Them" },
    { id: "inclusive", label: "Inclusive LGBTQ+", desc: "All are welcome" },
  ];

  if (step === "onboarding") return <OnboardingQuiz onComplete={() => setLocation("/")} />;

  return (
    <div className="min-h-[100dvh] w-full flex bg-background items-center justify-center p-4">
      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">
          {step === "auth" && (
            <motion.div key="auth" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.4 }} className="space-y-6">
              <div className="text-center space-y-2">
                <h1 className="text-4xl font-serif text-primary">Welcome to ROSA</h1>
                <p className="text-muted-foreground">Your personal sanctuary awaits 🌹</p>
              </div>
              <div className="space-y-5 bg-card p-7 rounded-2xl shadow-sm border border-border/50">
                <div className="space-y-2">
                  <Label htmlFor="name">How should we call you?</Label>
                  <Input id="name" placeholder="Your beautiful name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setMode("email")}
                    className={`py-2 rounded-xl text-sm font-medium border-2 transition-all flex items-center justify-center gap-2 ${mode === "email" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                    <Mail className="w-4 h-4" /> Email
                  </button>
                  <button type="button" onClick={() => setMode("phone")}
                    className={`py-2 rounded-xl text-sm font-medium border-2 transition-all flex items-center justify-center gap-2 ${mode === "phone" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                    <Phone className="w-4 h-4" /> Phone
                  </button>
                </div>

                {mode === "email" ? (
                  <div className="space-y-2">
                    <Label htmlFor="email">Email address</Label>
                    <Input id="email" type="email" placeholder="hello@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone number</Label>
                    <div className="flex gap-2">
                      <select value={dialCode} onChange={(e) => setDialCode(e.target.value)}
                        className="rounded-md border border-input bg-background px-2 text-sm h-10 max-w-[110px]">
                        {COUNTRY_CODES.map(c => (
                          <option key={c.code} value={c.dial}>{c.flag} {c.dial}</option>
                        ))}
                      </select>
                      <Input id="phone" inputMode="tel" placeholder="555 1234" value={phoneLocal} onChange={(e) => setPhoneLocal(e.target.value)} className="flex-1" />
                    </div>
                    <p className="text-[11px] text-muted-foreground">SMS coming soon — for instant access, use email.</p>
                  </div>
                )}

                <Button onClick={sendCode} disabled={busy} className="w-full bg-primary hover:bg-primary/90 text-white rounded-full py-6 text-lg">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send verification code"}
                </Button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Or</span></div>
                </div>
                <Button type="button" variant="outline" onClick={handleGuest} className="w-full rounded-full py-5 border-primary/20 text-primary hover:bg-primary/5">
                  Continue as Guest
                </Button>
              </div>
            </motion.div>
          )}

          {step === "verify" && (
            <motion.div key="verify" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.4 }} className="space-y-6">
              <div className="text-center space-y-2">
                <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <ShieldCheck className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-3xl font-serif text-primary">Check your {mode === "email" ? "inbox" : "messages"}</h2>
                <p className="text-muted-foreground text-sm">We sent a 6-digit code to<br /><span className="font-medium text-foreground">{destination}</span></p>
              </div>

              <div className="space-y-5 bg-card p-7 rounded-2xl shadow-sm border border-border/50">
                {devCode && (
                  <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-center">
                    <p className="font-semibold mb-1">⚠️ Development mode</p>
                    <p>Email service unavailable — your code is <span className="font-mono text-base text-amber-900">{devCode}</span></p>
                  </div>
                )}
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="• • • • • •"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="text-center text-3xl font-mono tracking-[0.6em] h-14"
                />
                <Button onClick={verifyCode} disabled={busy || code.length !== 6} className="w-full bg-primary hover:bg-primary/90 text-white rounded-full py-6 text-lg">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & continue"}
                </Button>
                <div className="flex justify-between text-xs">
                  <button onClick={() => { setStep("auth"); setCode(""); setDevCode(null); }} className="text-muted-foreground hover:text-foreground">← Change details</button>
                  <button onClick={sendCode} disabled={busy} className="text-primary hover:underline">Resend code</button>
                </div>
              </div>
            </motion.div>
          )}

          {step === "gender" && (
            <motion.div key="gender" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.4 }} className="space-y-8">
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-serif text-primary">How do you identify?</h2>
                <p className="text-muted-foreground">ROSA is built for women, but everyone is welcome.</p>
              </div>
              <div className="grid gap-4">
                {GENDERS.map((g) => (
                  <button key={g.id} onClick={() => handleSelectGender(g.id)}
                    className="flex items-center justify-between p-6 rounded-2xl border border-border/50 bg-card hover:bg-primary/5 hover:border-primary/30 transition-all text-left group">
                    <div>
                      <h3 className="font-medium text-lg text-foreground group-hover:text-primary transition-colors">{g.label}</h3>
                      <p className="text-sm text-muted-foreground">{g.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
