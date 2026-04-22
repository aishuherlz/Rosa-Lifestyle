import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type SubscriptionPlan = "trial" | "monthly" | "yearly" | "expired";

type SubscriptionState = {
  plan: SubscriptionPlan;
  trialEndsAt: string | null;
  subscribedAt: string | null;
  renewsAt: string | null;
  isPremium: boolean;
  daysLeftInTrial: number;
  trialExpired: boolean;
};

type SubscriptionContextType = SubscriptionState & {
  subscribe: (plan: "monthly" | "yearly") => void;
  cancelSubscription: () => void;
};

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

const STORAGE_KEY = "rosa_subscription";

function computeState(raw: Partial<SubscriptionState> & { joinedAt?: string }): SubscriptionState {
  const now = new Date();
  const joinedAt = raw.joinedAt ? new Date(raw.joinedAt) : now;
  const trialEndsAt = new Date(joinedAt.getTime() + 31 * 24 * 60 * 60 * 1000).toISOString();
  const daysLeft = Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
  const trialExpired = daysLeft === 0;

  if (raw.plan === "monthly" || raw.plan === "yearly") {
    const renewsAt = raw.renewsAt ?? null;
    return {
      plan: raw.plan,
      trialEndsAt,
      subscribedAt: raw.subscribedAt ?? now.toISOString(),
      renewsAt,
      isPremium: true,
      daysLeftInTrial: 0,
      trialExpired: false,
    };
  }

  if (trialExpired) {
    return {
      plan: "expired",
      trialEndsAt,
      subscribedAt: null,
      renewsAt: null,
      isPremium: false,
      daysLeftInTrial: 0,
      trialExpired: true,
    };
  }

  return {
    plan: "trial",
    trialEndsAt,
    subscribedAt: null,
    renewsAt: null,
    isPremium: true,
    daysLeftInTrial: daysLeft,
    trialExpired: false,
  };
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SubscriptionState>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      const userRaw = JSON.parse(localStorage.getItem("rosa_user") || "{}");
      return computeState({ ...stored, joinedAt: userRaw.joinedAt });
    } catch {
      return computeState({});
    }
  });

  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        const userRaw = JSON.parse(localStorage.getItem("rosa_user") || "{}");
        setState(computeState({ ...stored, joinedAt: userRaw.joinedAt }));
      } catch {}
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const subscribe = (plan: "monthly" | "yearly") => {
    const now = new Date();
    const renewsAt = plan === "monthly"
      ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const newData = { plan, subscribedAt: now.toISOString(), renewsAt };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    const userRaw = JSON.parse(localStorage.getItem("rosa_user") || "{}");
    setState(computeState({ ...newData, joinedAt: userRaw.joinedAt }));
  };

  const cancelSubscription = () => {
    localStorage.removeItem(STORAGE_KEY);
    const userRaw = JSON.parse(localStorage.getItem("rosa_user") || "{}");
    setState(computeState({ joinedAt: userRaw.joinedAt }));
  };

  return (
    <SubscriptionContext.Provider value={{ ...state, subscribe, cancelSubscription }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used within SubscriptionProvider");
  return ctx;
}
