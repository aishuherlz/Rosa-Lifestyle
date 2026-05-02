import { useEffect, useState } from "react";
import { scopedStorage } from "./scoped-storage";

const KEY = "rosa_beta_optin";

function read(): boolean {
  if (typeof window === "undefined") return false;
  try { 
    const v = scopedStorage.getItem(KEY); 
    return v ? JSON.parse(v) : false; 
  } catch { return false; }
}

export function useBetaOptIn() {
  const [optedIn, setOptedIn] = useState<boolean>(read);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { 
      // Note: storage event might not match scoped key directly but we can re-read
      setOptedIn(read()); 
    };
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
