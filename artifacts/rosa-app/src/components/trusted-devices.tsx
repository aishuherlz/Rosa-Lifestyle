import { useEffect, useState } from "react";
import { Smartphone, Laptop, Monitor, Trash2, ShieldAlert, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useUser } from "@/lib/user-context";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api";
import { useLocation } from "wouter";

type Device = {
  deviceId: string;
  deviceName: string | null;
  rememberMe: boolean;
  lastSeenAt: string | null;
  createdAt: string | null;
  expiresAt: string;
  isCurrent: boolean;
};

function deviceIcon(name: string | null) {
  const n = (name || "").toLowerCase();
  if (n.includes("iphone") || n.includes("android") || n.includes("ipad")) return Smartphone;
  if (n.includes("mac") || n.includes("windows") || n.includes("linux")) return Laptop;
  return Monitor;
}

function relTime(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - Date.parse(iso);
  if (isNaN(ms)) return "";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

export function TrustedDevices() {
  const { user, getAuthHeaders, logout } = useUser();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [endingAll, setEndingAll] = useState(false);

  const isVerified = !!user && !user.guestMode && !!user.authToken;

  const load = async () => {
    if (!isVerified) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/auth/devices"), { headers: getAuthHeaders() });
      if (res.status === 401) {
        // Token rejected — bail to sign-in. user-context's boot validation also
        // catches this, but we may be on a long-lived settings page.
        await logout({ revokeServerSide: false });
        setLocation("/sign-in");
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error || "Couldn't load your devices.");
        return;
      }
      setDevices(data.devices || []);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [isVerified]);

  const removeDevice = async (deviceId: string, isCurrent: boolean) => {
    setRemovingId(deviceId);
    try {
      const res = await fetch(apiUrl(`/api/auth/devices/${encodeURIComponent(deviceId)}`), {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        toast({ title: "Couldn't remove device", description: data?.error || "Please try again.", variant: "destructive" });
        return;
      }
      toast({ title: "Device removed", description: "That device will need to sign in again." });
      if (isCurrent) {
        // We just removed our own session — log out locally and go to sign-in.
        await logout({ revokeServerSide: false });
        setLocation("/sign-in");
      } else {
        await load();
      }
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    } finally {
      setRemovingId(null);
    }
  };

  const endAllSessions = async () => {
    setEndingAll(true);
    try {
      const res = await fetch(apiUrl("/api/auth/logout-all"), {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        toast({ title: "Couldn't sign out everywhere", description: data?.error || "Please try again.", variant: "destructive" });
        return;
      }
      toast({ title: "Signed out of all devices", description: "You'll need to sign in again." });
      await logout({ revokeServerSide: false });
      setLocation("/sign-in");
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    } finally {
      setEndingAll(false);
    }
  };

  if (!isVerified) {
    return (
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-primary" /> Trusted Devices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Sign in with your email to see and manage devices that stay logged in to your ROSA account.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 shadow-sm" data-testid="card-trusted-devices">
      <CardHeader className="pb-2">
        <CardTitle className="font-serif text-lg flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-primary" /> Trusted Devices
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Devices currently signed in to <strong>{user?.emailOrPhone}</strong>. Remove any you don't recognise.
        </p>

        {loading && (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading devices…
          </div>
        )}

        {error && !loading && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
        )}

        {!loading && !error && devices && devices.length === 0 && (
          <p className="text-sm text-muted-foreground italic">No active devices yet.</p>
        )}

        {!loading && !error && devices && devices.length > 0 && (
          <ul className="divide-y divide-border/40 -mx-1">
            {devices.map((d) => {
              const Icon = deviceIcon(d.deviceName);
              return (
                <li key={d.deviceId} className="flex items-start justify-between py-3 px-1 gap-3" data-testid={`device-${d.deviceId}`}>
                  <div className="flex items-start gap-3 min-w-0">
                    <Icon className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground flex items-center gap-2 flex-wrap">
                        <span className="truncate">{d.deviceName || "Unknown device"}</span>
                        {d.isCurrent && <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 text-[10px]">This device</Badge>}
                        {d.rememberMe && <Badge variant="outline" className="text-[10px]">30 days</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Last active {relTime(d.lastSeenAt)} · Expires {new Date(d.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 shrink-0" disabled={removingId === d.deviceId} data-testid={`button-remove-device-${d.deviceId}`}>
                        {removingId === d.deviceId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove this device?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {d.isCurrent
                            ? "This is the device you're using right now. You'll be signed out and need to verify your email again."
                            : `"${d.deviceName || "This device"}" will need to sign in again the next time it opens ROSA.`}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => removeDevice(d.deviceId, d.isCurrent)} className="bg-destructive hover:bg-destructive/90">
                          Remove device
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </li>
              );
            })}
          </ul>
        )}

        <div className="pt-3 border-t border-border/40">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full border-destructive/30 text-destructive hover:bg-destructive/5" disabled={endingAll || !devices || devices.length === 0} data-testid="button-logout-all">
                {endingAll ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldAlert className="w-4 h-4 mr-2" />}
                Sign out of all devices
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sign out of all devices?</AlertDialogTitle>
                <AlertDialogDescription>
                  Every device — including this one — will be signed out immediately. Use this if you think someone has access to your account, or if you forgot to sign out somewhere public.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={endAllSessions} className="bg-destructive hover:bg-destructive/90">
                  Yes, sign out everywhere
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
