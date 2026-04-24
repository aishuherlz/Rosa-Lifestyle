import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Send, Heart, MessageSquare, Lightbulb, Bug, Sparkles, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiUrl } from "@/lib/api";

const SUPPORT_EMAIL = "rosainclusivelifestyle@gmail.com";

type ContactType = "support" | "feedback" | "bug" | "feature";

const TYPES: { id: ContactType; label: string; icon: any; subject: string; placeholder: string }[] = [
  { id: "support", label: "Get Support", icon: HelpCircle, subject: "ROSA Support", placeholder: "What can we help you with, sister?" },
  { id: "feedback", label: "Feedback", icon: Heart, subject: "ROSA Feedback 💌", placeholder: "How is ROSA making you feel? What do you love? What could bloom better?" },
  { id: "bug", label: "Report Bug", icon: Bug, subject: "ROSA Bug Report 🐞", placeholder: "What page were you on? What did you expect vs what happened?" },
  { id: "feature", label: "Feature Idea", icon: Sparkles, subject: "ROSA Feature Request ✨", placeholder: "Tell us your idea — we read every single one." },
];

export default function SupportPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [type, setType] = useState<ContactType>("support");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = TYPES.find(t => t.id === type)!;

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.message || sending) return;
    setError(null);
    setSending(true);
    try {
      const res = await fetch(apiUrl("/api/support/send"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          name: form.name.trim(),
          email: form.email.trim(),
          message: form.message.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data?.error || "Couldn't send right now. Please try again, or email us directly.");
        return;
      }
      setSent(true);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6 max-w-2xl mx-auto pb-24">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-serif text-foreground">Support & Feedback</h1>
        <p className="text-muted-foreground mt-1">We read every message, sister 🌹</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
        <Card className="border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 shadow-sm">
          <CardContent className="pt-6 text-center">
            <Heart className="w-10 h-10 text-rose-500 mx-auto mb-3" />
            <p className="font-serif text-xl text-foreground mb-2">Made with love, for you</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              ROSA was built by a woman, for women. Every feature was crafted with care.
              Your voice shapes what blooms next.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-rose-600 dark:text-rose-400 font-medium">
              <Mail className="w-4 h-4" />
              <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:underline" data-testid="link-support-email">
                {SUPPORT_EMAIL}
              </a>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {!sent ? (
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="font-serif text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-rose-500" /> What's on your heart?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TYPES.map(t => (
                <button key={t.id} onClick={() => setType(t.id)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-2xl border transition-all ${type === t.id ? "border-rose-400 bg-rose-50 dark:bg-rose-900/30 ring-2 ring-rose-300" : "border-border hover:border-rose-300"}`}
                  data-testid={`type-${t.id}`}>
                  <t.icon className="w-5 h-5 text-rose-500" />
                  <span className="text-xs font-medium">{t.label}</span>
                </button>
              ))}
            </div>
            <div>
              <Label>Your Name</Label>
              <Input placeholder="e.g. Aria" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} data-testid="input-support-name" />
            </div>
            <div>
              <Label>Your Email</Label>
              <Input type="email" placeholder="hello@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} data-testid="input-support-email" />
            </div>
            <div>
              <Label>{active.label === "Feature Idea" ? "Your idea" : active.label === "Report Bug" ? "What happened?" : "Message"}</Label>
              <Textarea placeholder={active.placeholder} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                className="resize-none min-h-[140px]" data-testid="textarea-support-message" />
            </div>
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2" role="alert">{error}</p>
            )}
            <Button onClick={handleSubmit} disabled={!form.name || !form.email || !form.message || sending}
              className="w-full bg-rose-500 hover:bg-rose-600 text-white disabled:opacity-60" data-testid="button-send-support">
              <Send className="w-4 h-4 mr-2" /> {sending ? "Sending…" : "Send to ROSA Team"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">Sent directly to the ROSA team — we read every message.</p>
          </CardContent>
        </Card>
      ) : (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 shadow-sm text-center py-8">
            <CardContent>
              <div className="text-4xl mb-3">💌</div>
              <h3 className="font-serif text-xl mb-2">Sent with love, sister 🌹</h3>
              <p className="text-muted-foreground text-sm">Your message landed safely with the ROSA team. We'll reply to <strong>{form.email}</strong> within 48 hours 🌹</p>
              <Button variant="outline" className="mt-4" onClick={() => { setSent(false); setForm({ name: "", email: "", message: "" }); setError(null); }} data-testid="button-send-another">Send Another</Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Card className="border-border/50 shadow-sm">
        <CardContent className="pt-5">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Lightbulb className="w-4 h-4 text-amber-500" /> Quick Help</h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p><span className="font-medium text-foreground">Founders Garden 175</span> — earn 175 🌹 in your garden to unlock 50% off ROSA Premium forever.</p>
            <p><span className="font-medium text-foreground">3-month free trial</span> — first 500 founders get the full beta free, no card required.</p>
            <p><span className="font-medium text-foreground">Period tracker</span> — log your cycle start date and ROSA predicts the rest.</p>
            <p><span className="font-medium text-foreground">Partner sharing</span> — share your code, enter theirs, stay synced.</p>
            <p><span className="font-medium text-foreground">Notifications</span> — daily ROSA Whisper at sunrise on Quotes page.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
