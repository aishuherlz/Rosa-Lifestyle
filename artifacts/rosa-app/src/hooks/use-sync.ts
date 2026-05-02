import { useCallback } from "react";
import { useUser } from "@/lib/user-context";
import { apiUrl } from "@/lib/api";

export type SyncType =
  | "wishlist"
  | "milestones"
  | "goals"
  | "sleep"
  | "skin"
  | "travel"
  | "food"
  | "journal"
  | "mood"
  | "cycle"
  | "fitness";

/**
 * Returns a `syncData` function that pushes a module's local data to the
 * backend so it can be shared with a linked partner.
 *
 * Usage:
 *   const { syncData } = useSync();
 *   // call after every local write, e.g. after saving wishlist items
 *   await syncData("wishlist", items);
 */
export function useSync() {
  const { getAuthHeaders } = useUser();

  const syncData = useCallback(
    async (type: SyncType, data: unknown) => {
      try {
        await fetch(apiUrl("/api/sync/push"), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ type, data }),
        });
      } catch {
        // Non-blocking — local data is the source of truth; sync is best-effort.
      }
    },
    [getAuthHeaders]
  );

  return { syncData };
}
