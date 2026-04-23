import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/lib/user-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OnboardingQuiz } from "@/components/onboarding/onboarding-quiz";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck, Mail } from "lucide-react";

type Step = "auth" | "verify" | "gender" | "onboarding";

export default function SignIn() {
  const [, setLocation] = useLocation();
  const { setUser } = useUser();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("auth");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);

  const sendCode = async () => {
    if (!name.trim()) { toast({ title: "Name needed", description: "Tell us what to call you 💝" }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { toast({ title: "Email looks off", description: "Please enter a valid email." }); return; }
    setBusy(true); setDevCode(null);
    try {
      const r = await fetch("/api/auth/send-code", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: email.trim(), name }),
      });
      const d = await r.json();
      if (!d.ok) { toast({ title: "Couldn't send code", description: d.error || "Please try again." }); return; }
      if (d.devCode) setDevCode(d.devCode);
      toast({ title: d.sent ? "Code sent ✨" : "Verification code ready", description: d.message || `Check your inbox at ${email}` });
      setStep("verify");
    } catch {
      toast({ title: "Network error", description: "Please check your connection." });
    } finally { setBusy(false); }
  };

  const verifyCode = async () => {
    if (code.replace(/\D/g, "").length !== 6) { toast({ title: "Enter the 6-digit code" }); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/auth/verify-code", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: email.trim().toLowerCase(), code: code.replace(/\D/g, "") }),
      });
      const d = await r.json();
      if (!d.ok) { toast({ title: "Verification failed", description: d.error || "Try again." }); return; }
      if (d.token) { try { localStorage.setItem("rosa_auth_token", d.token); } catch {} }
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
    setUser({ name, emailOrPhone: email.trim().toLowerCase(), gender, guestMode: false, joinedAt: new Date().toISOString(), personalityTags: [] });
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
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email address</Label>
                  <Input id="email" type="email" placeholder="hello@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <p className="text-[11px] text-muted-foreground">We'll send a 6-digit code. Phone sign-in coming soon 💗</p>
                </div>
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
                <h2 className="text-3xl font-serif text-primary">Check your inbox</h2>
                <p className="text-muted-foreground text-sm">We sent a 6-digit code to<br /><span className="font-medium text-foreground">{email}</span></p>
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
                  <button onClick={() => { setStep("auth"); setCode(""); setDevCode(null); }} className="text-muted-foreground hover:text-foreground">← Change email</button>
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
