// Single source of truth for API URLs.
//
// In production (e.g. Vercel/custom domain), the rosa-app frontend and the
// api-server live on different hosts. Set VITE_API_URL to the public api-server
// URL (e.g. "https://rosa-api.up.railway.app") at build time and every call
// will be sent there.
//
// In Replit dev, VITE_API_URL is unset and we fall back to the artifact's
// BASE_URL prefix so the proxy routes /<artifact>/api/... correctly.
const RAW_API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
const API_BASE = RAW_API_URL ? RAW_API_URL.replace(/\/$/, "") : "";
const PATH_PREFIX = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

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
