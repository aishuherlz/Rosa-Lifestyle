import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/lib/user-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignIn() {
  const [, setLocation] = useLocation();
  const { setUser } = useUser();
  const [step, setStep] = useState<"auth" | "gender">("auth");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !name) return;
    setStep("gender");
  };

  const handleGuest = () => {
    setUser({
      name: "Guest",
      emailOrPhone: "",
      gender: "unspecified",
      guestMode: true,
      joinedAt: new Date().toISOString(),
      personalityTags: [],
    });
    setLocation("/");
  };

  const handleSelectGender = (gender: string) => {
    setUser({
      name,
      emailOrPhone: email,
      gender,
      guestMode: false,
      joinedAt: new Date().toISOString(),
      personalityTags: [],
    });
    setLocation("/");
  };

  const GENDERS = [
    { id: "female", label: "Female", desc: "She/Her" },
    { id: "male", label: "Male", desc: "He/Him" },
    { id: "non-binary", label: "Non-binary", desc: "They/Them" },
    { id: "inclusive", label: "Inclusive LGBTQ+", desc: "All are welcome" }
  ];

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
                    <Label htmlFor="email">Email or Phone</Label>
                    <Input 
                      id="email" 
                      type="text" 
                      placeholder="hello@example.com" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-background/50 border-muted focus-visible:ring-primary/30"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white rounded-full py-6 text-lg shadow-sm hover:shadow transition-all">
                    Sign In
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
        </AnimatePresence>
      </div>
    </div>
  );
}
