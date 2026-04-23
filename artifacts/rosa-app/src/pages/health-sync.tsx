import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useToast } from "@/hooks/use-toast";
import { Activity, Upload, Heart, Footprints, Moon, Scale, Trash2 } from "lucide-react";
import { format } from "date-fns";

type HealthSample = { date: string; steps?: number; sleepMin?: number; weightKg?: number; hrAvg?: number; source: "apple" | "google" | "manual" };
type HealthData = { samples: HealthSample[]; lastImport?: string; source?: string };

export default function HealthSyncPage() {
  const [data, setData] = useLocalStorage<HealthData>("rosa_health_sync", { samples: [] });
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  function mergeSamples(incoming: HealthSample[]) {
    const byDate = new Map<string, HealthSample>();
    for (const s of data.samples) byDate.set(`${s.date}::${s.source}`, s);
    for (const s of incoming) {
      const key = `${s.date}::${s.source}`;
      const prev = byDate.get(key) || { date: s.date, source: s.source } as HealthSample;
      byDate.set(key, {
        ...prev,
        steps: (prev.steps || 0) + (s.steps || 0) || prev.steps,
        sleepMin: s.sleepMin ?? prev.sleepMin,
        weightKg: s.weightKg ?? prev.weightKg,
        hrAvg: s.hrAvg ?? prev.hrAvg,
      });
    }
    const merged = Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));
    setData({ samples: merged.slice(0, 365), lastImport: new Date().toISOString(), source: incoming[0]?.source });
  }

  async function handleFile(f: File) {
    setBusy(true);
    try {
      const text = await f.text();
      let parsed: HealthSample[] = [];
      if (f.name.toLowerCase().endsWith(".xml") || text.includes("<HealthData")) {
        parsed = parseAppleHealth(text);
        toast({ title: `Imported ${parsed.length} days from Apple Health` });
      } else if (text.trim().startsWith("{") || text.trim().startsWith("[")) {
        parsed = parseGoogleFit(text);
        toast({ title: `Imported ${parsed.length} days from Google Fit` });
      } else {
        toast({ title: "Unsupported file", description: "Please export as Apple Health XML or Google Fit JSON." });
        return;
      }
      if (parsed.length) mergeSamples(parsed);
    } catch (e: any) {
      toast({ title: "Import failed", description: e?.message || "Could not parse file" });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function clearAll() {
    if (!confirm("Delete all imported health data?")) return;
    setData({ samples: [] });
  }

  const last7 = data.samples.slice(0, 7);
  const totals = last7.reduce((a, s) => ({
    steps: a.steps + (s.steps || 0),
    sleep: a.sleep + (s.sleepMin || 0),
    weight: s.weightKg && !a.weight ? s.weightKg : a.weight,
    hr: a.hr + (s.hrAvg || 0),
    hrCount: a.hrCount + (s.hrAvg ? 1 : 0),
  }), { steps: 0, sleep: 0, weight: 0, hr: 0, hrCount: 0 });

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6 max-w-3xl mx-auto pb-24">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-serif text-foreground flex items-center gap-2">
          <Activity className="w-7 h-7 text-emerald-500" /> Health Sync
        </h1>
        <p className="text-muted-foreground mt-1">Bring your Apple Health or Google Fit data into ROSA so it can monitor and personalize for you.</p>
      </motion.div>

      <Card>
        <CardHeader><CardTitle className="font-serif text-lg">Import your data</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-border p-3">
              <p className="font-semibold text-sm mb-1">📱 Apple Health</p>
              <p className="text-xs text-muted-foreground mb-2">iPhone Health app → Profile → Export All Health Data → unzip → upload <code className="bg-muted px-1 rounded">export.xml</code></p>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="font-semibold text-sm mb-1">🤖 Google Fit</p>
              <p className="text-xs text-muted-foreground mb-2">takeout.google.com → Fit → Export → unzip → upload daily JSON files</p>
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".xml,.json,application/xml,application/json" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <div className="flex gap-2">
            <Button onClick={() => fileRef.current?.click()} disabled={busy} className="bg-emerald-500 hover:bg-emerald-600 text-white">
              <Upload className="w-4 h-4 mr-1" /> {busy ? "Importing..." : "Choose file"}
            </Button>
            {data.samples.length > 0 && (
              <Button onClick={clearAll} variant="outline" className="text-destructive"><Trash2 className="w-3.5 h-3.5 mr-1" /> Clear</Button>
            )}
          </div>
          {data.lastImport && <p className="text-xs text-muted-foreground">Last import: {format(new Date(data.lastImport), "MMM d, yyyy h:mm a")} · {data.samples.length} days saved</p>}
        </CardContent>
      </Card>

      {data.samples.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="font-serif text-lg">Last 7 days</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <Stat icon={<Footprints className="w-4 h-4 text-emerald-500" />} label="Steps" value={totals.steps.toLocaleString()} sub={`${Math.round(totals.steps / 7).toLocaleString()}/day avg`} />
              <Stat icon={<Moon className="w-4 h-4 text-violet-500" />} label="Sleep" value={`${(totals.sleep / 60).toFixed(0)}h`} sub={`${(totals.sleep / 7 / 60).toFixed(1)}h/night avg`} />
              <Stat icon={<Heart className="w-4 h-4 text-rose-500" />} label="Avg HR" value={totals.hrCount ? `${Math.round(totals.hr / totals.hrCount)} bpm` : "—"} sub="resting estimate" />
              <Stat icon={<Scale className="w-4 h-4 text-amber-500" />} label="Weight" value={totals.weight ? `${totals.weight.toFixed(1)} kg` : "—"} sub="latest entry" />
            </div>
            <div className="space-y-1.5 text-xs">
              {last7.map(s => (
                <div key={`${s.date}-${s.source}`} className="flex items-center gap-2 py-1 border-b border-border/30 last:border-0">
                  <Badge variant="outline" className="text-[10px]">{s.source}</Badge>
                  <span className="font-medium w-20">{format(new Date(s.date), "EEE MMM d")}</span>
                  {s.steps ? <span>👣 {s.steps.toLocaleString()}</span> : null}
                  {s.sleepMin ? <span>🌙 {(s.sleepMin / 60).toFixed(1)}h</span> : null}
                  {s.hrAvg ? <span>💓 {s.hrAvg}</span> : null}
                  {s.weightKg ? <span>⚖️ {s.weightKg.toFixed(1)}kg</span> : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">{icon} {label}</div>
      <p className="font-bold text-lg">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// Apple Health export.xml — extract <Record type="..." startDate="..." value="..." />
function parseAppleHealth(xml: string): HealthSample[] {
  const byDate = new Map<string, HealthSample>();
  const recordRegex = /<Record\s+([^>]*?)\/?>/g;
  let m: RegExpExecArray | null;
  let count = 0;
  while ((m = recordRegex.exec(xml)) !== null) {
    if (++count > 50000) break; // safety
    const attrs = m[1];
    const type = /type="([^"]+)"/.exec(attrs)?.[1] || "";
    const startDate = /startDate="([^"]+)"/.exec(attrs)?.[1] || "";
    const endDate = /endDate="([^"]+)"/.exec(attrs)?.[1] || startDate;
    const valueRaw = /value="([^"]+)"/.exec(attrs)?.[1] || "0";
    const value = parseFloat(valueRaw);
    if (!startDate || isNaN(value)) continue;
    const day = startDate.slice(0, 10);
    const cur = byDate.get(day) || { date: day, source: "apple" as const };
    if (type === "HKQuantityTypeIdentifierStepCount") cur.steps = (cur.steps || 0) + value;
    else if (type === "HKCategoryTypeIdentifierSleepAnalysis") {
      const min = (new Date(endDate).getTime() - new Date(startDate).getTime()) / 60000;
      if (min > 0 && min < 24 * 60) cur.sleepMin = (cur.sleepMin || 0) + min;
    }
    else if (type === "HKQuantityTypeIdentifierBodyMass") cur.weightKg = value;
    else if (type === "HKQuantityTypeIdentifierHeartRate") cur.hrAvg = cur.hrAvg ? Math.round((cur.hrAvg + value) / 2) : Math.round(value);
    byDate.set(day, cur);
  }
  return Array.from(byDate.values());
}

// Google Fit Takeout JSON — best-effort: handles "Daily Aggregations" CSV-derived JSON or "All Sessions" exports
function parseGoogleFit(text: string): HealthSample[] {
  const out: HealthSample[] = [];
  try {
    const json = JSON.parse(text);
    const arr = Array.isArray(json) ? json : (json.bucket || json.dataset || json.data || []);
    for (const item of arr) {
      const date = item.date || item.startDate || (item.startTimeMillis ? new Date(Number(item.startTimeMillis)).toISOString().slice(0, 10) : null);
      if (!date) continue;
      out.push({
        date,
        source: "google",
        steps: Number(item.steps || item.stepCount || item["Step count"] || 0) || undefined,
        sleepMin: Number(item.sleepMinutes || item.sleep || 0) || undefined,
        weightKg: Number(item.weight || item.weightKg || 0) || undefined,
        hrAvg: Number(item.heartRate || item.avgHeartRate || 0) || undefined,
      });
    }
  } catch {}
  return out;
}
