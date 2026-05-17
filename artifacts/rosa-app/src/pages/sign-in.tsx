import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/lib/user-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { OnboardingQuiz } from "@/components/onboarding/onboarding-quiz";
import { apiUrl } from "@/lib/api";
import type { StoredSession } from "@/lib/auth-storage";

type Flow = "choice" | "login" | "signup" | "verify" | "gender" | "pronouns" | "onboarding";

export default function SignIn() {
  const [, setLocation] = useLocation();
  const { setUser, signInWith } = useUser();

  const [flow, setFlow] = useState<Flow>("choice");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [customPronouns, setCustomPronouns] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [marketingOptIn, setMarketingOptIn] = useState<"yes" | "later" | "never">("later");
  const [dob, setDob] = useState("");
  const [partnerCode, setPartnerCode] = useState("");
  const [code, setCode] = useState("");
  const [pendingSession, setPendingSession] = useState<StoredSession | null>(null);
  const [pendingAnonymousName, setPendingAnonymousName] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [ageError, setAgeError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  const sendCode = async () => {
    setError(null);
    setSending(true);
    try {
      const res = await fetch(apiUrl("/api/auth/send-code"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: email.trim().toLowerCase(),
          name: name.trim(),
          rememberMe,
          marketingOptIn,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Could not send code. Try again.");
        return false;
      }
      setInfo("Check your email for a 6-digit code 🌹");
      setResendIn(60);
      return true;
    } catch {
      setError("Network error. Please try again.");
      return false;
    } finally {
      setSending(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    const ok = await sendCode();
    if (ok) setFlow("verify");
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !name) return;
    // Age check
    if (dob) {
      const birth = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      if (age < 15) {
        setAgeError("You must be at least 15 years old to join ROSA 🌹");
        return;
      }
    }
    setAgeError(null);
    const ok = await sendCode();
    if (ok) { setIsNewUser(true); setFlow("verify"); }
  };

  const verifyCode = async () => {
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Please enter the 6-digit code from your email.");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch(apiUrl("/api/auth/verify-code"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: email.trim().toLowerCase(),
          code: code.trim(),
          rememberMe,
          marketingOptIn,
          name: name.trim(),
          partnerCode: partnerCode.trim() || undefined,
          dateOfBirth: dob || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data?.error || "Incorrect code. Please try again.");
        return;
      }
      if (typeof data.token === "string" && data.deviceId && data.expiresAt) {
        setPendingSession({
          token: data.token,
          email: email.trim().toLowerCase(),
          deviceId: data.deviceId,
          expiresAt: data.expiresAt,
          rememberMe: !!data.rememberMe,
        });
      }
      if (typeof data.anonymousName === "string") setPendingAnonymousName(data.anonymousName);

      // RETURNING USER — skip gender/pronouns
      if (data.isReturningUser && data.gender) {
        signInWith({
          name: data.name || name.trim(),
          emailOrPhone: email.trim().toLowerCase(),
          gender: data.gender,
          pronouns: data.pronouns || "",
          guestMode: false,
          joinedAt: data.joinedAt || new Date().toISOString(),
          personalityTags: [],
          anonymousName: data.anonymousName || null,
          rosaId: data.rosaId || null,
          nickname: data.nickname || null,
        }, {
          token: data.token,
          email: email.trim().toLowerCase(),
          deviceId: data.deviceId,
          expiresAt: data.expiresAt,
          rememberMe: !!data.rememberMe,
        });
        setLocation("/");
        return;
      }

      // NEW USER — go through gender/pronouns
      setFlow("gender");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleGuest = () => {
    setUser({
      name: "Guest",
      emailOrPhone: "",
      gender: "unspecified",
      pronouns: "she/her",
      guestMode: true,
      joinedAt: new Date().toISOString(),
      personalityTags: [],
    });
    setLocation("/");
  };

  const handleSelectGender = (g: string) => {
    setGender(g);
    const defaultPronoun = g === "female" ? "she/her" : g === "male" ? "he/him" : g === "non-binary" ? "they/them" : "";
    setPronouns(defaultPronoun);
    setFlow("pronouns");
  };

  const handleSavePronouns = async () => {
    const finalPronouns = pronouns === "custom" ? (customPronouns.trim() || "she/her") : (pronouns || "she/her");
    signInWith({
      name,
      emailOrPhone: email,
      gender,
      pronouns: finalPronouns,
      guestMode: false,
      joinedAt: new Date().toISOString(),
      personalityTags: [],
      anonymousName: pendingAnonymousName,
    }, pendingSession);

    // Save gender to backend
    try {
      if (pendingSession?.token) {
        await fetch(apiUrl("/api/auth/profile"), {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${pendingSession.token}`
          },
          body: JSON.stringify({ gender, pronouns: finalPronouns, name }),
        });
      }
    } catch {}

    // Male users must link partner first
    if (gender === "male" || gender === "man") {
      setLocation("/partner");
      return;
    }

    const existingOnboarding = JSON.parse(localStorage.getItem("rosa_onboarding") || "{}");
    if (existingOnboarding?.completed) { setLocation("/"); } else { setFlow("onboarding"); }
  };

  const GENDERS = [
    { id: "female", label: "Female 🌸", desc: "She/Her" },
    { id: "male", label: "Male 💙", desc: "He/Him" },
    { id: "non-binary", label: "Non-binary ✨", desc: "They/Them" },
    { id: "inclusive", label: "LGBTQ+ 🌈", desc: "All are welcome" },
    { id: "prefer-not", label: "Prefer not to say", desc: "" },
  ];

  const PRONOUN_OPTIONS = [
    { id: "she/her", label: "She / Her" },
    { id: "he/him", label: "He / Him" },
    { id: "they/them", label: "They / Them" },
    { id: "she/they", label: "She / They" },
    { id: "he/they", label: "He / They" },
    { id: "any", label: "Any pronouns" },
    { id: "custom", label: "Write my own" },
  ];

  if (flow === "onboarding") {
    return <OnboardingQuiz onComplete={() => setLocation("/")} />;
  }

  return (
    <div className="min-h-[100dvh] w-full flex bg-background items-center justify-center p-4">
      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">

          {/* CHOICE SCREEN */}
          {flow === "choice" && (
            <motion.div key="choice" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
              <div className="text-center space-y-2">
                <h1 className="text-5xl font-serif text-primary">ROSA</h1>
                <p className="text-muted-foreground">Your personal sanctuary awaits 🌹</p>
              </div>
              <div className="space-y-3">
                <Button onClick={() => setFlow("login")} className="w-full h-14 text-base bg-primary text-white rounded-2xl">
                  Sign In 🌹
                </Button>
                <Button onClick={() => setFlow("signup")} variant="outline" className="w-full h-14 text-base border-primary text-primary rounded-2xl">
                  Create Account ✨
                </Button>
                <button onClick={handleGuest} className="w-full text-sm text-muted-foreground text-center py-2 hover:text-primary transition">
                  Continue as Guest
                </button>
              </div>
            </motion.div>
          )}

          {/* LOGIN SCREEN */}
          {flow === "login" && (
            <motion.div key="login" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-serif text-primary">Welcome back 🌹</h1>
                <p className="text-muted-foreground text-sm">Sign in to your ROSA sanctuary</p>
              </div>
              <form onSubmit={handleLogin} className="space-y-4 bg-card p-6 rounded-2xl shadow-sm border border-border/50">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" type="email" placeholder="hello@example.com"
                    value={email} onChange={e => setEmail(e.target.value)}
                    className="bg-background/50" required />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="login-remember" checked={rememberMe} onCheckedChange={v => setRememberMe(v === true)} />
                  <Label htmlFor="login-remember" className="text-sm cursor-pointer">Remember me on this device</Label>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" disabled={sending} className="w-full bg-primary text-white rounded-xl">
                  {sending ? "Sending code..." : "Send verification code"}
                </Button>
              </form>
              <button onClick={() => setFlow("choice")} className="w-full text-sm text-muted-foreground text-center hover:text-primary transition">
                ← Back
              </button>
            </motion.div>
          )}

          {/* SIGNUP SCREEN */}
          {flow === "signup" && (
            <motion.div key="signup" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-serif text-primary">Join ROSA 🌹</h1>
                <p className="text-muted-foreground text-sm">Built by women, for everyone</p>
              </div>
              <form onSubmit={handleSignup} className="space-y-4 bg-card p-6 rounded-2xl shadow-sm border border-border/50">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Your name</Label>
                  <Input id="signup-name" placeholder="Your beautiful name"
                    value={name} onChange={e => setName(e.target.value)}
                    className="bg-background/50" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input id="signup-email" type="email" placeholder="hello@example.com"
                    value={email} onChange={e => setEmail(e.target.value)}
                    className="bg-background/50" required />
                  <p className="text-xs text-muted-foreground">We will send a verification code</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-dob">Date of birth</Label>
                  <Input id="signup-dob" type="date"
                    value={dob} onChange={e => { setDob(e.target.value); setAgeError(null); }}
                    max={new Date().toISOString().split("T")[0]}
                    className="bg-background/50" />
                  {ageError && <p className="text-xs text-red-500">{ageError}</p>}
                  <p className="text-xs text-muted-foreground">Must be 15+ to join (18+ in some regions)</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="partner-code">Partner invite code (optional)</Label>
                  <Input id="partner-code" placeholder="ROSA-XXXXX"
                    value={partnerCode} onChange={e => setPartnerCode(e.target.value)}
                    className="bg-background/50" />
                  <p className="text-xs text-muted-foreground">Have a partner on ROSA? Enter their ROSA ID</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Promotional emails</Label>
                  <div className="space-y-1">
                    {[
                      { value: "yes", label: "Yes please 🌹 — send me offers and updates" },
                      { value: "later", label: "Maybe later" },
                      { value: "never", label: "Never — no promotional emails" },
                    ].map(opt => (
                      <button key={opt.value} type="button"
                        onClick={() => setMarketingOptIn(opt.value as any)}
                        className={`w-full text-left p-2 rounded-xl border text-sm transition ${marketingOptIn === opt.value ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="signup-remember" checked={rememberMe} onCheckedChange={v => setRememberMe(v === true)} />
                  <Label htmlFor="signup-remember" className="text-sm cursor-pointer">Remember me on this device</Label>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" disabled={sending} className="w-full bg-primary text-white rounded-xl">
                  {sending ? "Sending code..." : "Create my ROSA account"}
                </Button>
              </form>
              <button onClick={() => setFlow("choice")} className="w-full text-sm text-muted-foreground text-center hover:text-primary transition">
                ← Back
              </button>
            </motion.div>
          )}

          {/* VERIFY SCREEN */}
          {flow === "verify" && (
            <motion.div key="verify" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-serif text-primary">Check your email 📧</h1>
                <p className="text-muted-foreground text-sm">We sent a 6-digit code to {email}</p>
              </div>
              <div className="space-y-4 bg-card p-6 rounded-2xl shadow-sm border border-border/50">
                <div className="space-y-2">
                  <Label htmlFor="code">Verification code</Label>
                  <Input id="code" placeholder="123456" maxLength={6}
                    value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                    className="bg-background/50 text-center text-2xl tracking-widest" />
                </div>
                {info && <p className="text-sm text-primary text-center">{info}</p>}
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button onClick={verifyCode} disabled={verifying || code.length !== 6} className="w-full bg-primary text-white rounded-xl">
                  {verifying ? "Verifying..." : "Verify code"}
                </Button>
                <button onClick={() => { setFlow(isNewUser ? "signup" : "login"); setCode(""); setError(null); }}
                  className="w-full text-sm text-muted-foreground text-center hover:text-primary transition">
                  ← Back
                </button>
              </div>
            </motion.div>
          )}

          {/* GENDER SCREEN — NEW USERS ONLY */}
          {flow === "gender" && (
            <motion.div key="gender" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-serif text-primary">How do you identify? 🌹</h1>
                <p className="text-muted-foreground text-sm">Help us personalise your experience</p>
              </div>
              <div className="space-y-3">
                {GENDERS.map(g => (
                  <button key={g.id} onClick={() => handleSelectGender(g.id)}
                    className="w-full p-4 rounded-2xl border border-border text-left hover:border-primary hover:bg-primary/5 transition">
                    <p className="font-medium text-foreground">{g.label}</p>
                    {g.desc && <p className="text-sm text-muted-foreground">{g.desc}</p>}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* PRONOUNS SCREEN — NEW USERS ONLY */}
          {flow === "pronouns" && (
            <motion.div key="pronouns" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-serif text-primary">Your pronouns 🌹</h1>
                <p className="text-muted-foreground text-sm">We will use these throughout ROSA</p>
              </div>
              <div className="space-y-3">
                {PRONOUN_OPTIONS.map(p => (
                  <button key={p.id} onClick={() => setPronouns(p.id)}
                    className={`w-full p-4 rounded-2xl border text-left transition ${pronouns === p.id ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary"}`}>
                    {p.label}
                  </button>
                ))}
                {pronouns === "custom" && (
                  <Input placeholder="Enter your pronouns"
                    value={customPronouns} onChange={e => setCustomPronouns(e.target.value)}
                    className="bg-background/50" />
                )}
                <Button onClick={handleSavePronouns} disabled={!pronouns} className="w-full bg-primary text-white rounded-xl">
                  Continue →
                </Button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
