import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type User = {
  name: string;
  emailOrPhone: string;
  gender: string;
  pronouns: string;
  guestMode: boolean;
  joinedAt: string;
  personalityTags: string[];
};

type UserContextType = {
  user: User | null;
  setUser: (user: User | null) => void;
  isLoading: boolean;
  hasSeenIntro: boolean;
  setHasSeenIntro: (val: boolean) => void;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSeenIntro, setHasSeenIntroState] = useState(false);

  useEffect(() => {
    // Load from local storage on mount
    const storedUser = localStorage.getItem("rosa_user");
    if (storedUser) {
      try {
        setUserState(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse user from local storage", e);
      }
    }
    
    const introSeen = sessionStorage.getItem("rosa_intro_seen");
    if (introSeen === "true") {
      setHasSeenIntroState(true);
    }
    
    setIsLoading(false);
  }, []);

  const setUser = (newUser: User | null) => {
    setUserState(newUser);
    if (newUser) {
      localStorage.setItem("rosa_user", JSON.stringify(newUser));
    } else {
      localStorage.removeItem("rosa_user");
    }
  };

  const setHasSeenIntro = (val: boolean) => {
    setHasSeenIntroState(val);
    sessionStorage.setItem("rosa_intro_seen", String(val));
  };

  return (
    <UserContext.Provider value={{ user, setUser, isLoading, hasSeenIntro, setHasSeenIntro }}>
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
