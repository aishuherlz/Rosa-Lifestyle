import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Crown } from "lucide-react";
import { useUser } from "@/lib/user-context";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useBetaOptIn } from "@/lib/use-beta-optin";

type FounderClaim = { number: number; tier: "first_100" | "first_500" | "regular" | "lifetime"; freeMonths: number; beta?: boolean; raffleWinner?: boolean };

export function FoundersBanner() {
  const { user } = useUser();
  const betaOptIn = useBetaOptIn();
  const [stored, setStored] = useLocalStorage<FounderClaim | null>("rosa_founder", null);
  const [status, setStatus] = useState<{ total: number; spotsLeftFirst100: number; spotsLeftFirst500: number; betaActive?: boolean; betaDaysLeft?: number } | null>(null);

  useEffect(() => {
    fetch("/api/founders/status").then(r => r.json()).then(d => { if (d.ok) setStatus(d); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (stored || !user || user.guestMode || !user.emailOrPhone || !betaOptIn) return;
    let token: string | null = null;
    try { token = localStorage.getItem("rosa_auth_token"); } catch {}
    if (!token) return; // Without a verified-email token the server will (correctly) reject the claim.
    fetch("/api/founders/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({}),
    }).then(r => r.json()).then(d => {
      if (d.ok && d.tier) setStored({ number: d.number, tier: d.tier, freeMonths: d.freeMonths || 0, beta: d.beta, raffleWinner: d.raffleWinner });
    }).catch(() => {});
  }, [user, stored, setStored, betaOptIn]);

  if (!betaOptIn) return null;

  // Personal welcome banner for claimed founders / beta members
  if (stored) {
    const isFirst100 = stored.tier === "first_100";
    const isFirst500 = stored.tier === "first_500";
    const isLifetime = stored.tier === "lifetime";
    const isBetaOnly = !isFirst100 && !isFirst500 && !isLifetime && stored.beta;
    if (!isFirst100 && !isFirst500 && !isLifetime && !isBetaOnly) return null;
    return (
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-amber-100 via-rose-50 to-pink-100 border border-amber-300 rounded-2xl p-4 shadow-sm"
        data-testid="founders-banner">
        <div className="flex items-start gap-3">
          <Crown className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-serif text-amber-900 text-sm font-semibold">
              You're ROSA {isBetaOnly ? "Beta" : "Founding"} Member <span className="font-bold">#{stored.number}</span> 👑
              {stored.raffleWinner && <span className="ml-2 text-rose-600">· Lucky 10 winner 🎁</span>}
            </p>
            <p className="text-xs text-amber-800 mt-0.5">
              {isLifetime
                ? "Lifetime free access — thank you for believing in ROSA from day one 💗"
                : isFirst100
                ? `Enjoy 6 months of Premium FREE — first 100 club 🌹${stored.beta ? " · entered into the Lucky 10 draw 🎁" : ""}`
                : isFirst500
                ? `Enjoy 3 months of Premium FREE — first 500 club 🌹${stored.beta ? " · entered into the Lucky 10 draw 🎁" : ""}`
                : `Enjoy 1 month of Premium FREE as a Beta Member 🌹 · entered into the Lucky 10 draw for a surprise 🎁`}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  // Public scarcity banner — encourages signups
  if (status && (status.spotsLeftFirst500 > 0 || status.betaActive)) {
    return (
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-amber-50 to-rose-50 border border-amber-200 rounded-2xl p-3.5 text-center"
        data-testid="founders-scarcity-banner">
        <p className="text-amber-800 text-xs font-medium">
          🌹 <strong>Founding Member Offer</strong> ·{" "}
          {status.spotsLeftFirst100 > 0
            ? `Only ${status.spotsLeftFirst100} spots left for 6 months FREE`
            : status.spotsLeftFirst500 > 0
            ? `${status.spotsLeftFirst500} spots left for 3 months FREE`
            : `Beta program closes in ${status.betaDaysLeft || 0} days`}
          {status.betaActive && <span className="block mt-1 text-rose-700">✨ All beta sisters entered to win — 10 picked at random for a surprise gift 🎁</span>}
        </p>
      </motion.div>
    );
  }

  return null;
}
