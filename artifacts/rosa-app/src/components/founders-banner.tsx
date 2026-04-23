import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Crown } from "lucide-react";
import { useUser } from "@/lib/user-context";
import { useLocalStorage } from "@/hooks/use-local-storage";

type FounderClaim = { number: number; tier: "first_100" | "first_500" | "regular" | "lifetime"; freeMonths: number };

export function FoundersBanner() {
  const { user } = useUser();
  const [stored, setStored] = useLocalStorage<FounderClaim | null>("rosa_founder", null);
  const [status, setStatus] = useState<{ total: number; spotsLeftFirst100: number; spotsLeftFirst500: number } | null>(null);

  useEffect(() => {
    fetch("/api/founders/status").then(r => r.json()).then(d => { if (d.ok) setStatus(d); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (stored || !user || user.guestMode || !user.emailOrPhone) return;
    let token: string | null = null;
    try { token = localStorage.getItem("rosa_auth_token"); } catch {}
    if (!token) return; // Without a verified-email token the server will (correctly) reject the claim.
    fetch("/api/founders/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({}),
    }).then(r => r.json()).then(d => {
      if (d.ok && d.tier) setStored({ number: d.number, tier: d.tier, freeMonths: d.freeMonths || 0 });
    }).catch(() => {});
  }, [user, stored, setStored]);

  // Personal welcome banner for claimed founders
  if (stored && stored.tier !== "regular") {
    const isFirst100 = stored.tier === "first_100";
    const isLifetime = stored.tier === "lifetime";
    return (
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-amber-100 via-rose-50 to-pink-100 border border-amber-300 rounded-2xl p-4 shadow-sm"
        data-testid="founders-banner">
        <div className="flex items-start gap-3">
          <Crown className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-serif text-amber-900 text-sm font-semibold">
              You're ROSA Founding Member <span className="font-bold">#{stored.number}</span> 👑
            </p>
            <p className="text-xs text-amber-800 mt-0.5">
              {isLifetime
                ? "You have lifetime free access — thank you for believing in ROSA from day one 💗"
                : `Enjoy ${stored.freeMonths} months of Premium FREE — ${isFirst100 ? "first 100 club" : "first 500 club"} 🌹`}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  // Public scarcity banner — encourages signups
  if (status && status.spotsLeftFirst500 > 0) {
    return (
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-amber-50 to-rose-50 border border-amber-200 rounded-2xl p-3.5 text-center"
        data-testid="founders-scarcity-banner">
        <p className="text-amber-800 text-xs font-medium">
          🌹 <strong>Founding Member Offer</strong> ·
          {status.spotsLeftFirst100 > 0
            ? ` Only ${status.spotsLeftFirst100} spots left for 6 months FREE`
            : ` ${status.spotsLeftFirst500} spots left for 3 months FREE`}
        </p>
      </motion.div>
    );
  }

  return null;
}
