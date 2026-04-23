import { useEffect, useState } from "react";

const KEY = "rosa_beta_optin";

function read(): boolean {
  if (typeof window === "undefined") return false;
  try { const v = window.localStorage.getItem(KEY); return v ? JSON.parse(v) : false; } catch { return false; }
}

export function useBetaOptIn() {
  const [optedIn, setOptedIn] = useState<boolean>(read);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setOptedIn(read()); };
    const onCustom = () => setOptedIn(read());
    window.addEventListener("storage", onStorage);
    window.addEventListener("rosa-beta-optin-changed", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("rosa-beta-optin-changed", onCustom);
    };
  }, []);
  return optedIn;
}
