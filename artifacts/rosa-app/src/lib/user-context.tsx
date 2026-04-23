import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type User = {
  name: string;
  emailOrPhone: string;
  gender: string;
  guestMode: boolean;
  joinedAt: string;
  personalityTags: string[];
};

export type Locale = {
  timezone: string;
  countryCode: string;
  currency: string;
  currencySymbol: string;
  language: string;
};

type UserContextType = {
  user: User | null;
  setUser: (user: User | null) => void;
  isLoading: boolean;
  hasSeenIntro: boolean;
  setHasSeenIntro: (val: boolean) => void;
  locale: Locale;
};

const COUNTRY_TO_CURRENCY: Record<string, { currency: string; symbol: string }> = {
  US: { currency: "USD", symbol: "$" },
  CA: { currency: "CAD", symbol: "CA$" },
  GB: { currency: "GBP", symbol: "£" },
  IN: { currency: "INR", symbol: "₹" },
  AU: { currency: "AUD", symbol: "A$" },
  EU: { currency: "EUR", symbol: "€" },
  DE: { currency: "EUR", symbol: "€" },
  FR: { currency: "EUR", symbol: "€" },
  IT: { currency: "EUR", symbol: "€" },
  ES: { currency: "EUR", symbol: "€" },
  JP: { currency: "JPY", symbol: "¥" },
  CN: { currency: "CNY", symbol: "¥" },
  KR: { currency: "KRW", symbol: "₩" },
  AE: { currency: "AED", symbol: "د.إ" },
  SA: { currency: "SAR", symbol: "ر.س" },
  ZA: { currency: "ZAR", symbol: "R" },
  NG: { currency: "NGN", symbol: "₦" },
  KE: { currency: "KES", symbol: "KSh" },
  BR: { currency: "BRL", symbol: "R$" },
  MX: { currency: "MXN", symbol: "Mex$" },
  SG: { currency: "SGD", symbol: "S$" },
  HK: { currency: "HKD", symbol: "HK$" },
  ID: { currency: "IDR", symbol: "Rp" },
  PH: { currency: "PHP", symbol: "₱" },
  TH: { currency: "THB", symbol: "฿" },
  PK: { currency: "PKR", symbol: "₨" },
};

function detectLocale(): Locale {
  let timezone = "UTC";
  let countryCode = "US";
  let language = "en";
  try {
    const intl = Intl.DateTimeFormat().resolvedOptions();
    timezone = intl.timeZone || "UTC";
    if (intl.locale) {
      const parts = intl.locale.split("-");
      language = parts[0] || "en";
      if (parts[1]) countryCode = parts[1].toUpperCase();
    }
    if (typeof navigator !== "undefined" && navigator.language) {
      const parts = navigator.language.split("-");
      language = parts[0] || language;
      if (parts[1]) countryCode = parts[1].toUpperCase();
    }
  } catch {}
  const c = COUNTRY_TO_CURRENCY[countryCode] || { currency: "USD", symbol: "$" };
  return { timezone, countryCode, currency: c.currency, currencySymbol: c.symbol, language };
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSeenIntro, setHasSeenIntroState] = useState(false);
  const [locale, setLocale] = useState<Locale>({
    timezone: "UTC", countryCode: "US", currency: "USD", currencySymbol: "$", language: "en",
  });

  useEffect(() => {
    const storedUser = localStorage.getItem("rosa_user");
    if (storedUser) {
      try { setUserState(JSON.parse(storedUser)); } catch (e) { console.error("Failed to parse user", e); }
    }
    const introSeen = sessionStorage.getItem("rosa_intro_seen");
    if (introSeen === "true") setHasSeenIntroState(true);

    const stored = localStorage.getItem("rosa_locale");
    if (stored) {
      try { setLocale(JSON.parse(stored)); } catch {}
    } else {
      const detected = detectLocale();
      setLocale(detected);
      localStorage.setItem("rosa_locale", JSON.stringify(detected));
    }

    setIsLoading(false);
  }, []);

  const setUser = (newUser: User | null) => {
    setUserState(newUser);
    if (newUser) localStorage.setItem("rosa_user", JSON.stringify(newUser));
    else localStorage.removeItem("rosa_user");
  };

  const setHasSeenIntro = (val: boolean) => {
    setHasSeenIntroState(val);
    sessionStorage.setItem("rosa_intro_seen", String(val));
  };

  return (
    <UserContext.Provider value={{ user, setUser, isLoading, hasSeenIntro, setHasSeenIntro, locale }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) throw new Error("useUser must be used within a UserProvider");
  return context;
}
