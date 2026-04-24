// Lightweight at-rest obfuscation for the session token in browser storage.
//
// IMPORTANT — this is NOT real cryptography. Real security comes from:
//   1. The token itself: HMAC-signed on the server with SESSION_SECRET, with
//      embedded expiry and tokenVersion (see api-server/src/routes/auth.ts).
//      A stolen token can't be forged or extended client-side.
//   2. The "Log out of all devices" action, which bumps tokenVersion server-side
//      and instantly invalidates every issued token.
//
// What this DOES give us is defense-in-depth: a casual look at DevTools or a
// drive-by browser extension scraping localStorage won't see a Bearer token in
// plaintext. We XOR with a per-origin derived key so the obfuscated value is
// origin-bound and self-evidently not a real credential string.
const STORAGE_KEY = "rosa_session_v2";
const REMEMBER_KEY = "rosa_session_remember";

function deriveKey(): Uint8Array {
  const seed = `${typeof window !== "undefined" ? window.location.origin : "ssr"}|rosa-session|v2`;
  // Cheap deterministic 32-byte expansion of the seed (FNV-1a per byte position).
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    let h = 2166136261 ^ (i * 16777619);
    for (let j = 0; j < seed.length; j++) {
      h = ((h ^ seed.charCodeAt(j)) * 16777619) >>> 0;
    }
    out[i] = h & 0xff;
  }
  return out;
}

function obfuscate(plain: string): string {
  const key = deriveKey();
  const bytes = new TextEncoder().encode(plain);
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ key[i % key.length];
  let bin = "";
  for (let i = 0; i < out.length; i++) bin += String.fromCharCode(out[i]);
  return "obf1." + btoa(bin);
}

function deobfuscate(stored: string): string | null {
  if (!stored.startsWith("obf1.")) return null;
  try {
    const key = deriveKey();
    const bin = atob(stored.slice(5));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) ^ key[i % key.length];
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export type StoredSession = {
  token: string;
  email: string;
  deviceId: string;
  expiresAt: string; // ISO
  rememberMe: boolean;
};

// Persistent (localStorage, survives browser close) for "Remember me",
// session (sessionStorage, cleared when last tab closes) otherwise.
export function saveSession(session: StoredSession): void {
  const target = session.rememberMe ? localStorage : sessionStorage;
  const other = session.rememberMe ? sessionStorage : localStorage;
  try {
    target.setItem(STORAGE_KEY, obfuscate(JSON.stringify(session)));
    target.setItem(REMEMBER_KEY, session.rememberMe ? "1" : "0");
    // Don't leave a stale token in the other storage.
    other.removeItem(STORAGE_KEY);
    other.removeItem(REMEMBER_KEY);
  } catch (e) {
    console.warn("[ROSA auth] Could not persist session:", e);
  }
}

export function loadSession(): StoredSession | null {
  const tryStorage = (s: Storage): StoredSession | null => {
    const raw = s.getItem(STORAGE_KEY);
    if (!raw) return null;
    const json = deobfuscate(raw);
    if (!json) return null;
    try {
      const parsed = JSON.parse(json) as StoredSession;
      if (!parsed.token || !parsed.expiresAt) return null;
      if (Date.parse(parsed.expiresAt) < Date.now()) return null;
      return parsed;
    } catch { return null; }
  };
  // Persistent first (most common), then per-tab session.
  return tryStorage(localStorage) || tryStorage(sessionStorage);
}

export function clearSession(): void {
  try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(REMEMBER_KEY); } catch {}
  try { sessionStorage.removeItem(STORAGE_KEY); sessionStorage.removeItem(REMEMBER_KEY); } catch {}
}

export function getAuthHeader(): Record<string, string> {
  const s = loadSession();
  return s ? { Authorization: `Bearer ${s.token}` } : {};
}
