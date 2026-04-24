// Single source of truth for API URLs.
//
// Production: set VITE_API_URL on the rosa-app (frontend) deployment to the
// public URL of the api-server (e.g. "https://rosa-api.up.railway.app").
// Vite bakes env vars at BUILD time — you must redeploy the frontend after
// adding/changing this variable, a server restart is not enough.
//
// Replit dev: VITE_API_URL is unset and we fall back to the artifact's
// BASE_URL prefix so the proxy routes /<artifact>/api/... correctly.
const RAW_API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
const API_BASE = RAW_API_URL ? RAW_API_URL.replace(/\/$/, "") : "";
const PATH_PREFIX = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

// Loud diagnostic so a missing VITE_API_URL in production is impossible to miss.
// Appears once on app load, in the browser console.
if (typeof window !== "undefined") {
  const host = window.location.hostname;
  const isReplitDev = /\.replit\.(dev|app|co)$|localhost|127\.0\.0\.1/.test(host);
  if (!API_BASE && !isReplitDev) {
    // eslint-disable-next-line no-console
    console.error(
      "[ROSA] VITE_API_URL is not set on this build. API calls will hit the frontend host (" +
      host + ") and 404. Set VITE_API_URL on the rosa-app deployment to the api-server URL, then REDEPLOY (Vite vars are baked at build time)."
    );
  } else {
    // eslint-disable-next-line no-console
    console.info("[ROSA] API base:", API_BASE || `(same-origin via ${PATH_PREFIX || "/"})`);
  }
}

export function apiUrl(path: string): string {
  if (!path.startsWith("/")) path = "/" + path;
  if (API_BASE) return `${API_BASE}${path}`;
  return `${PATH_PREFIX}${path}`;
}

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), {
    credentials: "include",
    ...init,
  });
}

// Exported so other modules / debugging in DevTools can read it.
export const API_URL_BASE = API_BASE;
