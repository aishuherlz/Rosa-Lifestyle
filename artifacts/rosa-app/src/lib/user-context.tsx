import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { loadSession, saveSession, clearSession, getAuthHeader, type StoredSession } from "./auth-storage";
import { apiUrl } from "./api";
import { scopedStorage } from "./scoped-storage";

export type User = {
  name: string;
  emailOrPhone: string;
  gender: string;
  pronouns: string;
  guestMode: boolean;
  joinedAt: string;
  personalityTags: string[];
  // Email-verified signed token from POST /api/auth/verify-code.
  // Null for guests; present once the user has verified their email.
  authToken?: string | null;
  emailVerified?: boolean;
  // Trusted-device id this token is bound to (so settings can show "this device").
  deviceId?: string | null;
  rememberMe?: boolean;
  expiresAt?: string | null;
  // Permanent pen name shown on the Rose Wall when the user posts anonymously.
  // Backfilled by the server on every sign-in so older accounts still get one.
  // Surfaced here so the Settings screen can show "your anonymous name is …".
  anonymousName?: string | null;
  rosaId?: string | null;
  partnerInviteCode?: string | null;
  nickname?: string | null;
  nicknameChanges?: number;
  bio?: string | null;
  profilePhotoUrl?: string | null;
  accountType?: string | null;
};

type UserContextType = {
  user: User | null;
  setUser: (user: User | null) => void;
  isLoading: boolean;
  hasSeenIntro: boolean;
  setHasSeenIntro: (val: boolean) => void;
  // Save a freshly-verified session AND the user profile in one call. This is
  // what sign-in calls after the verify step succeeds, so storage stays in sync
  // with the profile (no chance of token-in-localStorage but profile-not-set).
  signInWith: (user: User, session: StoredSession | null) => void;
  // Bearer header helper so any caller can do `fetch(url, { headers: getAuthHeaders() })`.
  getAuthHeaders: () => Record<string, string>;
  // Hard logout: clears storage AND attempts a server-side device revoke.
  logout: (opts?: { revokeServerSide?: boolean }) => Promise<void>;
};

const UserContext = createContext<UserContextType | undefined>(undefined);
const PROFILE_KEY = "rosa_user";

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSeenIntro, setHasSeenIntroState] = useState(false);

  // On boot: rehydrate the user profile from local/session storage and, if a
  // valid session token exists, validate it with the server.
  useEffect(() => {
    const session = loadSession();
    let storedProfile = localStorage.getItem(PROFILE_KEY) || sessionStorage.getItem(PROFILE_KEY);
    
    if (storedProfile) {
      try {
        const parsed = JSON.parse(storedProfile) as User;
        if (session) {
          parsed.authToken = session.token;
          parsed.deviceId = session.deviceId;
          parsed.rememberMe = session.rememberMe;
          parsed.expiresAt = session.expiresAt;
          parsed.emailVerified = true;
        } else if (!parsed.guestMode && parsed.authToken) {
          parsed.authToken = null;
          parsed.deviceId = null;
          parsed.emailVerified = false;
        }
        setUserState(parsed);
      } catch (e) {
        console.error("[ROSA] Failed to parse stored profile:", e);
      }
    }

    // Use localStorage for intro seen state so returning users skip the splash
    // even after closing the browser (critical for Remember Me flow)
    const introSeen = localStorage.getItem("rosa_intro_seen") || sessionStorage.getItem("rosa_intro_seen");
    if (introSeen === "true") setHasSeenIntroState(true);

    // If we loaded a session, ping /api/auth/me to confirm it's still valid.
    // We also use this round trip to refresh profile fields (gender, pronouns, etc).
    if (session) {
      fetch(apiUrl("/api/auth/me"), { headers: { Authorization: `Bearer ${session.token}` } })
        .then(async (r) => {
          if (r.status === 401) {
            console.info("[ROSA] Stored session was rejected by server — signing out.");
            clearSession();
            try {
              localStorage.removeItem(PROFILE_KEY);
              sessionStorage.removeItem(PROFILE_KEY);
            } catch {}
            setUserState(null);
            return;
          }
          if (!r.ok) return;
          const body = await r.json().catch(() => null);
          const serverUser = body?.user;
          if (!serverUser) return;
          setUserState((prev) => {
            if (!prev) return prev;
            const next = {
              ...prev,
              anonymousName: serverUser.anonymousName ?? prev.anonymousName,
              rosaId: serverUser.rosaId ?? prev.rosaId,
              partnerInviteCode: serverUser.partnerInviteCode ?? prev.partnerInviteCode,
              nickname: serverUser.nickname ?? prev.nickname,
              nicknameChanges: serverUser.nicknameChanges ?? prev.nicknameChanges,
              bio: serverUser.bio ?? prev.bio,
              profilePhotoUrl: serverUser.profilePhotoUrl ?? prev.profilePhotoUrl,
              gender: serverUser.gender ?? prev.gender,
              pronouns: serverUser.pronouns ?? prev.pronouns,
            };
            try {
              const target = next.rememberMe ? localStorage : sessionStorage;
              target.setItem(PROFILE_KEY, JSON.stringify(next));
            } catch {}
            return next;
          });
        })
        .catch(() => { /* network blip — keep current state */ })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  // Monitor gender to apply theme class
  useEffect(() => {
    if (typeof document !== "undefined") {
      const isMale = user?.gender?.toLowerCase() === "male" || user?.gender?.toLowerCase() === "man";
      if (isMale) {
        document.body.classList.add("male");
      } else {
        document.body.classList.remove("male");
      }
    }
  }, [user?.gender]);

  const persistProfile = (newUser: User | null) => {
    if (!newUser) {
      try { localStorage.removeItem(PROFILE_KEY); sessionStorage.removeItem(PROFILE_KEY); } catch {}
      return;
    }
    const target = newUser.rememberMe ? localStorage : sessionStorage;
    const other = newUser.rememberMe ? sessionStorage : localStorage;
    try {
      target.setItem(PROFILE_KEY, JSON.stringify(newUser));
      other.removeItem(PROFILE_KEY);
    } catch (e) {
      console.warn("[ROSA] Could not persist user profile:", e);
    }
  };

  const setUser = (newUser: User | null) => {
    setUserState(newUser);
    persistProfile(newUser);
  };

  const signInWith = (newUser: User, session: StoredSession | null) => {
    if (session) saveSession(session);
    else clearSession();
    const merged: User = {
      ...newUser,
      authToken: session?.token ?? null,
      deviceId: session?.deviceId ?? null,
      rememberMe: session?.rememberMe ?? false,
      expiresAt: session?.expiresAt ?? null,
      emailVerified: !!session,
    };
    setUserState(merged);
    persistProfile(merged);
  };

  const logout = async (opts?: { revokeServerSide?: boolean }) => {
    if (opts?.revokeServerSide !== false) {
      const headers = getAuthHeader();
      if (headers.Authorization) {
        try {
          await fetch(apiUrl("/api/auth/logout"), { method: "POST", headers });
        } catch { /* offline — local clear still happens */ }
      }
    }
    
    scopedStorage.clearUserCache();
    clearSession();
    try { localStorage.removeItem(PROFILE_KEY); sessionStorage.removeItem(PROFILE_KEY); } catch {}
    // Keep intro seen so returning users don't see splash again — only clear on explicit device forget
    sessionStorage.removeItem("rosa_intro_seen");
    setUserState(null);
  };

  const setHasSeenIntro = (val: boolean) => {
    setHasSeenIntroState(val);
    // Persist to localStorage so remembered users skip splash after browser restart
    try {
      localStorage.setItem("rosa_intro_seen", String(val));
      sessionStorage.setItem("rosa_intro_seen", String(val));
    } catch {}
  };

  return (
    <UserContext.Provider value={{
      user,
      setUser,
      isLoading,
      hasSeenIntro,
      setHasSeenIntro,
      signInWith,
      getAuthHeaders: getAuthHeader,
      logout,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
