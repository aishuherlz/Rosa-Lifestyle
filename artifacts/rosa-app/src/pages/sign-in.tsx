import { useState, useEffect } from "react";
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

export default function SignIn() {
  const [, setLocation] = useLocation();
  const { setUser, signInWith } = useUser();
  const [step, setStep] = useState<"auth" | "verify" | "gender" | "pronouns" | "onboarding">("auth");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [customPronouns, setCustomPronouns] = useState("");
  // Persistent-session opt-in. Default true because the most common ROSA use
  // case is the user's own phone/laptop and re-verifying every visit is friction.
  const [rememberMe, setRememberMe] = useState(true);
  // Marketing email consent. Default "later" so we don't auto-opt anyone in
  // (CAN-SPAM/GDPR friendly) and so users who don't notice the choice can be
  // gently re-asked from the Settings page.
  const [marketingOptIn, setMarketingOptIn] = useState<"yes" | "later" | "never">("later");

  // Verification step state
  const [code, setCode] = useState("");
  const [pendingSession, setPendingSession] = useState<StoredSession | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  // Countdown for the resend button so users can't spam send-code.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  function isEmail(s: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
  }

  async function sendCode(): Promise<boolean> {
    setError(null); setInfo(null); setDevCode(null);
    if (!isEmail(email)) {
      setError("Please enter a valid email address.");
      return false;
    }
    setSending(true);
    try {
      const res = await fetch(apiUrl("/api/auth/send-code"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: email.trim().toLowerCase(), name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data?.error || "Couldn't send code. Please try again.");
        return false;
      }
      setInfo(data.message || "Code sent to your email.");
      if (data.devCode) setDevCode(String(data.devCode));
      setResendIn(30);
      return true;
    } catch {
      setError("Network error. Please check your connection and try again.");
      return false;
    } finally {
      setSending(false);
    }
  }

  async function verifyCode(): Promise<void> {
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
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data?.error || "Incorrect code. Please try again.");
        return;
      }
      // Stash the full session so handleSavePronouns can persist it atomically
      // alongside the rest of the profile (name/gender/pronouns).
      if (typeof data.token === "string" && data.deviceId && data.expiresAt) {
        setPendingSession({
          token: data.token,
          email: email.trim().toLowerCase(),
          deviceId: data.deviceId,
          expiresAt: data.expiresAt,
          rememberMe: !!data.rememberMe,
        });
      } else {
        setPendingSession(null);
      }
      setStep("gender");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !name) return;
    const ok = await sendCode();
    if (ok) setStep("verify");
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
    setStep("pronouns");
  };

  const handleSavePronouns = () => {
    const finalPronouns = pronouns === "custom" ? (customPronouns.trim() || "she/her") : (pronouns || "she/her");
    signInWith({
      name,
      emailOrPhone: email,
      gender,
      pronouns: finalPronouns,
      guestMode: false,
      joinedAt: new Date().toISOString(),
      personalityTags: [],
    }, pendingSession);
    setStep("onboarding");
  };

  const GENDERS = [
    { id: "female", label: "Female", desc: "She/Her" },
    { id: "male", label: "Male", desc: "He/Him" },
    { id: "non-binary", label: "Non-binary", desc: "They/Them" },
    { id: "inclusive", label: "Inclusive LGBTQ+", desc: "All are welcome" },
  ];

  const PRONOUN_OPTIONS = [
    { id: "she/her", label: "She / Her" },
    { id: "he/him", label: "He / Him" },
    { id: "they/them", label: "They / Them" },
    { id: "she/they", label: "She / They" },
    { id: "he/they", label: "He / They" },
    { id: "any", label: "Any pronouns are fine" },
    { id: "custom", label: "Let me write my own" },
  ];

  if (step === "onboarding") {
    return <OnboardingQuiz onComplete={() => setLocation("/")} />;
  }

  return (
    <div className="min-h-[100dvh] w-full flex bg-background items-center justify-center p-4">
      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">
          {step === "auth" && (
            <motion.div
              key="auth"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.5 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <h1 className="text-4xl font-serif text-primary">Welcome to ROSA</h1>
                <p className="text-muted-foreground">Your personal sanctuary awaits.</p>
              </div>

              <form onSubmit={handleSignIn} className="space-y-6 bg-card p-8 rounded-2xl shadow-sm border border-border/50">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">How should we call you?</Label>
                    <Input
                      id="name"
                      placeholder="Your beautiful name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-background/50 border-muted focus-visible:ring-primary/30"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="hello@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-background/50 border-muted focus-visible:ring-primary/30"
                      required
                      data-testid="input-signin-email"
                    />
                    <p className="text-xs text-muted-foreground">We'll send a 6-digit code to verify it's you.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2 pt-1">
                  <Checkbox
                    id="remember-me"
                    checked={rememberMe}
                    onCheckedChange={(v) => setRememberMe(v === true)}
                    data-testid="checkbox-remember-me"
                    className="mt-0.5"
                  />
                  <div>
                    <Label htmlFor="remember-me" className="text-sm cursor-pointer">Remember me on this device</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {rememberMe ? "Stay signed in for 30 days." : "Sign me out when I close my browser."}
                    </p>
                  </div>
                </div>

                {/* Marketing email opt-in — three explicit choices so we have
                    real consent (not a pre-checked dark pattern). "Later" is
                    default so the Settings page can re-ask gently. */}
                <div className="rounded-xl border border-primary/15 bg-primary/[0.04] p-4 space-y-2">
                  <Label className="text-sm font-medium text-foreground">
                    Stay in the loop?
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Promotional offers, exclusive deals, and ROSA updates from <span className="font-medium text-foreground">news@rosainclusive.lifestyle</span>. Your verification codes still come from <span className="font-medium text-foreground">noreply@rosainclusive.lifestyle</span> regardless.
                  </p>
                  <div className="grid gap-2 pt-1">
                    {([
                      { v: "yes", label: "Yes, sign me up", hint: "I'd love offers and deals 💝" },
                      { v: "later", label: "Maybe later", hint: "Ask me again from settings" },
                      { v: "never", label: "No thank you", hint: "Don't ever email me promotions" },
                    ] as const).map((opt) => (
                      <label
                        key={opt.v}
                        htmlFor={`marketing-${opt.v}`}
                        className={`flex items-start gap-2 rounded-lg px-3 py-2 cursor-pointer border transition-colors ${
                          marketingOptIn === opt.v
                            ? "border-primary/60 bg-primary/[0.08]"
                            : "border-border/50 hover:border-primary/30 hover:bg-primary/[0.03]"
                        }`}
                      >
                        <input
                          type="radio"
                          id={`marketing-${opt.v}`}
                          name="marketing-opt-in"
                          value={opt.v}
                          checked={marketingOptIn === opt.v}
                          onChange={() => setMarketingOptIn(opt.v)}
                          data-testid={`radio-marketing-${opt.v}`}
                          className="mt-1 accent-primary"
                        />
                        <div className="leading-tight">
                          <div className="text-sm">{opt.label}</div>
                          <div className="text-[11px] text-muted-foreground">{opt.hint}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {error && step === "auth" && (
                  <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2" role="alert">{error}</p>
                )}

                <div className="space-y-3 pt-2">
                  <Button
                    type="submit"
                    disabled={sending || !email || !name}
                    className="w-full bg-primary hover:bg-primary/90 text-white rounded-full py-6 text-lg shadow-sm hover:shadow transition-all disabled:opacity-60"
                    data-testid="button-signin-send-code"
                  >
                    {sending ? "Sending code…" : "Send verification code"}
                  </Button>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Or</span></div>
                  </div>
                  <Button type="button" variant="outline" onClick={handleGuest} className="w-full rounded-full py-6 border-primary/20 text-primary hover:bg-primary/5">
                    Continue as Guest
                  </Button>
                </div>
              </form>
            </motion.div>
          )}

          {step === "verify" && (
            <motion.div
              key="verify"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.5 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-serif text-primary">Check your email 🌹</h2>
                <p className="text-muted-foreground">
                  We sent a 6-digit code to<br />
                  <span className="font-medium text-foreground break-all">{email}</span>
                </p>
              </div>

              <form
                onSubmit={(e) => { e.preventDefault(); verifyCode(); }}
                className="space-y-5 bg-card p-8 rounded-2xl shadow-sm border border-border/50"
              >
                <div className="space-y-2">
                  <Label htmlFor="code">Verification code</Label>
                  <Input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="bg-background/50 border-muted focus-visible:ring-primary/30 text-center text-2xl tracking-[0.5em] font-mono"
                    autoFocus
                    required
                    data-testid="input-verify-code"
                  />
                  <p className="text-xs text-muted-foreground text-center">Code expires in 10 minutes.</p>
                </div>

                {info && (
                  <p className="text-sm text-primary/80 bg-primary/5 rounded-lg px-3 py-2 text-center">{info}</p>
                )}
                {devCode && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 text-center">
                    Dev mode — use code: <span className="font-mono font-bold">{devCode}</span>
                  </p>
                )}
                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2" role="alert">{error}</p>
                )}

                <Button
                  type="submit"
                  disabled={verifying || code.length !== 6}
                  className="w-full bg-primary hover:bg-primary/90 text-white rounded-full py-6 text-lg disabled:opacity-60"
                  data-testid="button-verify-code"
                >
                  {verifying ? "Verifying…" : "Verify & continue 🌸"}
                </Button>

                <div className="flex items-center justify-between text-sm pt-2">
                  <button
                    type="button"
                    onClick={() => { setStep("auth"); setCode(""); setError(null); setInfo(null); setDevCode(null); }}
                    className="text-muted-foreground hover:text-primary transition-colors"
                    data-testid="button-change-email"
                  >
                    ← Change email
                  </button>
                  <button
                    type="button"
                    disabled={resendIn > 0 || sending}
                    onClick={sendCode}
                    className="text-primary hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
                    data-testid="button-resend-code"
                  >
                    {resendIn > 0 ? `Resend in ${resendIn}s` : sending ? "Sending…" : "Resend code"}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {step === "gender" && (
            <motion.div
              key="gender"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.5 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-serif text-primary">How do you identify?</h2>
                <p className="text-muted-foreground">ROSA is built for women, but everyone is welcome.</p>
              </div>

              <div className="grid gap-4">
                {GENDERS.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => handleSelectGender(g.id)}
                    className="flex items-center justify-between p-6 rounded-2xl border border-border/50 bg-card hover:bg-primary/5 hover:border-primary/30 transition-all text-left group"
                    data-testid={`button-gender-${g.id}`}
                  >
                    <div>
                      <h3 className="font-medium text-lg text-foreground group-hover:text-primary transition-colors">{g.label}</h3>
                      <p className="text-sm text-muted-foreground">{g.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === "pronouns" && (
            <motion.div
              key="pronouns"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.5 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-serif text-primary">Your pronouns 🌹</h2>
                <p className="text-muted-foreground">So ROSA addresses you the way you deserve.</p>
              </div>

              <div className="grid gap-2">
                {PRONOUN_OPTIONS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPronouns(p.id)}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${pronouns === p.id ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "border-border/50 bg-card hover:bg-primary/5"}`}
                    data-testid={`button-pronoun-${p.id.replace("/", "-")}`}
                  >
                    <span className="font-medium">{p.label}</span>
                    {pronouns === p.id && <span className="text-primary text-xl">✓</span>}
                  </button>
                ))}
              </div>

              {pronouns === "custom" && (
                <div className="space-y-2">
                  <Label htmlFor="custom-pronouns">Your pronouns</Label>
                  <Input
                    id="custom-pronouns"
                    placeholder="e.g. ze/zir, fae/faer"
                    value={customPronouns}
                    onChange={(e) => setCustomPronouns(e.target.value)}
                    data-testid="input-custom-pronouns"
                  />
                </div>
              )}

              <Button
                onClick={handleSavePronouns}
                disabled={!pronouns || (pronouns === "custom" && !customPronouns.trim())}
                className="w-full bg-primary hover:bg-primary/90 text-white rounded-full py-6 text-lg"
                data-testid="button-save-pronouns"
              >
                Continue 🌸
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
