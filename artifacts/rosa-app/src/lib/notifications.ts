// Local notification helpers + service-worker registration

export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return reg;
  } catch (e) {
    console.warn("SW registration failed", e);
    return null;
  }
}

export function notifPermission(): NotificationPermission {
  if (typeof Notification === "undefined") return "denied";
  return Notification.permission;
}

export async function requestNotifPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission === "granted" || Notification.permission === "denied") return Notification.permission;
  return await Notification.requestPermission();
}

export async function showLocalNotification(title: string, body: string, url = "/") {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      reg.showNotification(title, { body, icon: "/favicon.svg", badge: "/favicon.svg", data: { url } });
    } else {
      new Notification(title, { body, icon: "/favicon.svg" });
    }
  } catch {}
}

// Run an "on app open" check and surface notifications for time-sensitive sync events.
// We track which events we've already notified about in localStorage.
type SyncEvent = { id: string; title: string; body: string; url: string };
export async function fireDueSyncNotifications(events: SyncEvent[]) {
  if (notifPermission() !== "granted") return;
  const sentRaw = localStorage.getItem("rosa_notif_sent") || "{}";
  let sent: Record<string, number> = {};
  try { sent = JSON.parse(sentRaw); } catch {}
  const today = new Date().toISOString().split("T")[0];
  // prune old keys (>30d)
  const cutoff = Date.now() - 30 * 86400000;
  for (const k of Object.keys(sent)) if (sent[k] < cutoff) delete sent[k];

  for (const ev of events) {
    const key = `${today}::${ev.id}`;
    if (sent[key]) continue;
    await showLocalNotification(ev.title, ev.body, ev.url);
    sent[key] = Date.now();
  }
  localStorage.setItem("rosa_notif_sent", JSON.stringify(sent));
}
