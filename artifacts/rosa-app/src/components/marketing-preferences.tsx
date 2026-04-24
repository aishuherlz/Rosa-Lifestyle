import { useEffect, useState } from "react";
import { Mail, Loader2, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useUser } from "@/lib/user-context";
import { apiUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type Pref = "yes" | "later" | "never";

const OPTIONS: { v: Pref; label: string; hint: string }[] = [
  { v: "yes", label: "Yes, send me updates", hint: "Promotional offers, exclusive deals, and ROSA news 💝" },
  { v: "later", label: "Maybe later", hint: "I'll think about it — keep this question for me" },
  { v: "never", label: "No thank you", hint: "Don't email me promotions" },
];

// Simple panel for managing marketing-email opt-in. Lives on the Settings
// page so anyone who picked "Maybe later" at sign-up can change their mind
// without re-verifying. Hidden for guest users (no server-side row to update).
export function MarketingPreferences() {
  const { user, getAuthHeaders } = useUser();
  const { toast } = useToast();
  const [pref, setPref] = useState<Pref>("later");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Pref | null>(null);
  const [savedAt, setSavedAt] = useState<number>(0);

  // Hide for guest users — they have no rosa_users row to attach a pref to.
  const isGuest = !user || user.guestMode || !user.emailOrPhone;

  useEffect(() => {
    if (isGuest) { setLoading(false); return; }
    let alive = true;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/auth/me"), { headers: getAuthHeaders() });
        const data = await res.json().catch(() => ({}));
        if (alive && data?.user?.marketingOptIn) {
          setPref(data.user.marketingOptIn as Pref);
        }
      } catch {
        // Network error — leave default; user can still pick a value.
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [isGuest]);

  async function choose(next: Pref) {
    if (next === pref) return;
    setSaving(next);
    try {
      const res = await fetch(apiUrl("/api/auth/marketing-pref"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ marketingOptIn: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data?.error || "Could not save preference");
      setPref(next);
      setSavedAt(Date.now());
      toast({
        title: "Saved 🌹",
        description:
          next === "yes" ? "You're on the list, sister." :
          next === "never" ? "We'll never email you promotions." :
          "We'll ask you again later.",
      });
    } catch (e: any) {
      toast({ title: "Couldn't save", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  }

  if (isGuest) return null;

  return (
    <Card className="border-primary/20 shadow-sm" data-testid="card-marketing-preferences">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-serif">
          <Mail className="w-5 h-5 text-primary" /> Email Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Choose what you want from us. Verification codes always come from{" "}
          <span className="font-medium text-foreground">noreply@rosainclusive.lifestyle</span>{" "}
          — promotional emails (when we send them) come from{" "}
          <span className="font-medium text-foreground">news@rosainclusive.lifestyle</span>.
        </p>

        <div className="grid gap-2 pt-1">
          {OPTIONS.map((opt) => {
            const active = pref === opt.v;
            const isSaving = saving === opt.v;
            return (
              <button
                key={opt.v}
                type="button"
                onClick={() => choose(opt.v)}
                disabled={loading || saving !== null}
                data-testid={`button-marketing-${opt.v}`}
                className={`flex items-start gap-3 rounded-lg px-3 py-2.5 text-left border transition-colors disabled:opacity-60 ${
                  active
                    ? "border-primary/60 bg-primary/[0.08]"
                    : "border-border/60 hover:border-primary/30 hover:bg-primary/[0.03]"
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${active ? "border-primary" : "border-muted-foreground/40"}`}>
                  {active && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-[11px] text-muted-foreground">{opt.hint}</div>
                </div>
                {isSaving && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                {!isSaving && active && Date.now() - savedAt < 2000 && (
                  <Check className="w-4 h-4 text-emerald-500" />
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
