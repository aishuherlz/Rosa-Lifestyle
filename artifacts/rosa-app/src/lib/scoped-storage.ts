/**
 * Scoped storage utility to ensure user data isolation.
 * Automatically prefixes localStorage keys with the current user's ID.
 */

const PROFILE_KEY = "rosa_user";

/**
 * Get the current user's unique ID from the stored profile.
 * We use this as a bootstrap to scope all other keys.
 */
function getActiveUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROFILE_KEY) || sessionStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw);
    // Use rosaId as primary key, fallback to email/phone
    return user.rosaId || user.emailOrPhone || null;
  } catch {
    return null;
  }
}

/**
 * Scopes a key for the current user.
 * Example: "rosa_goals" -> "u_user123_rosa_goals"
 */
export function scopeKey(key: string): string {
  const userId = getActiveUserId();
  if (!userId) return key; // No user, return original key (e.g. for guest mode or bootstrap keys)
  
  // Don't double-scope
  if (key.startsWith("u_")) return key;
  
  // We don't scope the profile key itself or session keys
  if (key === PROFILE_KEY || key === "rosa_session_v2" || key === "rosa_session_remember" || key === "rosa_device_id") {
    return key;
  }
  
  return `u_${userId}_${key}`;
}

export const scopedStorage = {
  getItem(key: string): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(scopeKey(key));
  },
  
  setItem(key: string, value: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(scopeKey(key), value);
  },
  
  removeItem(key: string): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(scopeKey(key));
  },
  
  /** 
   * Clears ONLY the scoped data for the current user.
   * Useful during logout if we want to purge local cache.
   */
  clearUserCache(): void {
    if (typeof window === "undefined") return;
    const userId = getActiveUserId();
    if (!userId) return;
    const prefix = `u_${userId}_`;
    
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(k => localStorage.removeItem(k));
  }
};
