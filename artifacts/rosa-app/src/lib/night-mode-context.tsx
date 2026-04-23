import { createContext, useContext, useEffect, useState } from "react";

type NightModeCtx = {
  isNight: boolean;
  override: boolean;
  setOverride: (v: boolean) => void;
};

const NightModeContext = createContext<NightModeCtx>({
  isNight: false,
  override: false,
  setOverride: () => {},
});

export function NightModeProvider({ children }: { children: React.ReactNode }) {
  const [isNight, setIsNight] = useState(false);
  const [override, setOverride] = useState(false);

  useEffect(() => {
    const check = () => {
      const hour = new Date().getHours();
      setIsNight(hour >= 22 || hour < 6);
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const active = override || isNight;
    document.documentElement.classList.toggle("dark", active);
  }, [isNight, override]);

  return (
    <NightModeContext.Provider value={{ isNight, override, setOverride }}>
      {children}
    </NightModeContext.Provider>
  );
}

export function useNightMode() {
  return useContext(NightModeContext);
}
