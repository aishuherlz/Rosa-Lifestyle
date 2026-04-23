import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Moon, Play, Pause, Mic, MicOff, BedDouble, Clock, AudioLines, Sparkles, Info, AlertCircle, Trash2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useToast } from "@/hooks/use-toast";

type SoundId = "rain" | "ocean" | "white" | "pink" | "brown" | "fire" | "forest";
const SOUNDS: { id: SoundId; label: string; emoji: string; type: "noise" | "synth"; tint: string }[] = [
  { id: "white", label: "White Noise", emoji: "🌫️", type: "noise", tint: "from-slate-200 to-slate-300" },
  { id: "pink", label: "Pink Noise", emoji: "🌸", type: "noise", tint: "from-rose-200 to-pink-300" },
  { id: "brown", label: "Brown Noise", emoji: "🟫", type: "noise", tint: "from-amber-200 to-amber-400" },
  { id: "rain", label: "Gentle Rain", emoji: "🌧️", type: "synth", tint: "from-sky-200 to-blue-300" },
  { id: "ocean", label: "Ocean Waves", emoji: "🌊", type: "synth", tint: "from-cyan-200 to-blue-300" },
  { id: "forest", label: "Forest Night", emoji: "🌲", type: "synth", tint: "from-emerald-200 to-green-300" },
  { id: "fire", label: "Crackling Fire", emoji: "🔥", type: "synth", tint: "from-orange-200 to-red-300" },
];

type SleepLog = { id: string; date: string; bedtime: string; waketime: string; quality: number; notes?: string; events?: { t: number; db: number; kind: string }[] };

const SLEEP_VIDEOS = [
  { id: "g0jfhRcXtL4", title: "Guided Sleep Meditation for Anxiety & Overthinking", channel: "The Honest Guys", duration: "30 min", thumb: "https://i.ytimg.com/vi/g0jfhRcXtL4/hqdefault.jpg" },
  { id: "1ZYbU82GVz4", title: "10 Hours of Rain Sounds for Sleep", channel: "Calming Vibrations", duration: "10 hr", thumb: "https://i.ytimg.com/vi/1ZYbU82GVz4/hqdefault.jpg" },
  { id: "aXItOY0sLRY", title: "Body Scan for Deep Sleep", channel: "Goodful", duration: "20 min", thumb: "https://i.ytimg.com/vi/aXItOY0sLRY/hqdefault.jpg" },
  { id: "rkZl2gsLUp4", title: "Yoga Nidra for Sleep — Total Relaxation", channel: "Yoga With Adriene", duration: "23 min", thumb: "https://i.ytimg.com/vi/rkZl2gsLUp4/hqdefault.jpg" },
  { id: "F28MGLlpP90", title: "Why Sleep Matters (Science of Rest)", channel: "TED-Ed", duration: "5 min", thumb: "https://i.ytimg.com/vi/F28MGLlpP90/hqdefault.jpg" },
  { id: "4pLUleLdwY4", title: "Matthew Walker: Sleep is Your Superpower", channel: "TED", duration: "19 min", thumb: "https://i.ytimg.com/vi/4pLUleLdwY4/hqdefault.jpg" },
  { id: "n61ULEU7CO0", title: "Sleep Story: A Walk Through the Lavender Fields", channel: "Calm", duration: "25 min", thumb: "https://i.ytimg.com/vi/n61ULEU7CO0/hqdefault.jpg" },
  { id: "DWOHcGF1Tmc", title: "4-7-8 Breathing for Falling Asleep Fast", channel: "Dr Andrew Weil", duration: "4 min", thumb: "https://i.ytimg.com/vi/DWOHcGF1Tmc/hqdefault.jpg" },
];

const SLEEP_TIPS = [
  { emoji: "🌙", title: "Honour your wind-down hour", text: "Dim the lights one hour before bed — your melatonin is shy and waits for darkness." },
  { emoji: "📵", title: "Park your phone outside the bedroom", text: "Even on Do Not Disturb, the urge to check it activates a stress response. Use a real alarm clock." },
  { emoji: "☕", title: "No caffeine after 2pm", text: "Caffeine has a 6-hour half-life — that 4pm latte is still half-active when you're trying to sleep." },
  { emoji: "🛁", title: "Warm shower 90 minutes before bed", text: "The drop in body temperature afterward signals your brain that it's sleep time." },
  { emoji: "🌡️", title: "Keep your room cool (16–19°C / 60–67°F)", text: "Your core temperature drops as you fall asleep — a cool room helps it happen faster." },
  { emoji: "📓", title: "Brain dump before bed", text: "Write tomorrow's worries on paper. Tell your mind: 'we'll deal with this tomorrow.'" },
  { emoji: "🌿", title: "Magnesium glycinate, not melatonin", text: "Magnesium calms the nervous system without grogginess. Talk to your doctor about dosing." },
  { emoji: "👯", title: "Track your cycle's effect", text: "You sleep worst in the late luteal phase (days before period). Be extra gentle then." },
];

export default function SleepPage() {
  const { toast } = useToast();
  const [logs, setLogs] = useLocalStorage<SleepLog[]>("rosa_sleep_logs", []);
  const [recordPref, setRecordPref] = useLocalStorage<"ask" | "yes" | "no">("rosa_sleep_record_pref", "ask");
  const [showRecordAsk, setShowRecordAsk] = useState(false);

  // ---------- soothing sounds (Web Audio API — always works, no downloads) ----------
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeNodesRef = useRef<{ id: SoundId; stop: () => void } | null>(null);
  const [playing, setPlaying] = useState<SoundId | null>(null);
  const [volume, setVolume] = useState(50);
  const [timer, setTimer] = useState(0); // minutes; 0 = no timer
  const timerRef = useRef<number | null>(null);

  function getCtx(): AudioContext {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
    return audioCtxRef.current;
  }

  function makeNoise(ctx: AudioContext, kind: "white" | "pink" | "brown"): AudioBufferSourceNode {
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    if (kind === "white") {
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    } else if (kind === "pink") {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    } else {
      let last = 0;
      for (let i = 0; i < bufferSize; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        data[i] = last * 3.5;
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    return src;
  }

  function startSound(id: SoundId) {
    stopSound();
    const ctx = getCtx();
    const gain = ctx.createGain();
    gain.gain.value = volume / 100 * 0.4;
    gain.connect(ctx.destination);

    const stoppers: (() => void)[] = [];

    if (id === "white" || id === "pink" || id === "brown") {
      const src = makeNoise(ctx, id);
      src.connect(gain);
      src.start();
      stoppers.push(() => { try { src.stop(); } catch {} });
    } else if (id === "rain") {
      const src = makeNoise(ctx, "white");
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass"; filter.frequency.value = 4000;
      const filter2 = ctx.createBiquadFilter();
      filter2.type = "highpass"; filter2.frequency.value = 400;
      src.connect(filter); filter.connect(filter2); filter2.connect(gain);
      src.start();
      stoppers.push(() => { try { src.stop(); } catch {} });
    } else if (id === "ocean") {
      const src = makeNoise(ctx, "brown");
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass"; filter.frequency.value = 800;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.12;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = volume / 100 * 0.35;
      lfo.connect(lfoGain); lfoGain.connect(gain.gain);
      src.connect(filter); filter.connect(gain);
      src.start(); lfo.start();
      stoppers.push(() => { try { src.stop(); lfo.stop(); } catch {} });
    } else if (id === "forest") {
      const src = makeNoise(ctx, "pink");
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass"; filter.frequency.value = 1500; filter.Q.value = 0.8;
      src.connect(filter); filter.connect(gain);
      src.start();
      // occasional cricket chirps
      const chirp = window.setInterval(() => {
        const osc = ctx.createOscillator();
        const og = ctx.createGain();
        osc.type = "sine"; osc.frequency.value = 4200 + Math.random() * 400;
        og.gain.value = 0;
        og.gain.linearRampToValueAtTime(0.05 * volume / 100, ctx.currentTime + 0.05);
        og.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
        osc.connect(og); og.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.25);
      }, 1800 + Math.random() * 1500);
      stoppers.push(() => { try { src.stop(); window.clearInterval(chirp); } catch {} });
    } else if (id === "fire") {
      const src = makeNoise(ctx, "brown");
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass"; filter.frequency.value = 1200;
      src.connect(filter); filter.connect(gain);
      src.start();
      // crackle pops
      const crackle = window.setInterval(() => {
        const popSrc = makeNoise(ctx, "white");
        const popGain = ctx.createGain();
        popGain.gain.value = 0;
        popGain.gain.linearRampToValueAtTime(0.15 * volume / 100, ctx.currentTime + 0.01);
        popGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.08);
        popSrc.connect(popGain); popGain.connect(ctx.destination);
        popSrc.start(); popSrc.stop(ctx.currentTime + 0.1);
      }, 200 + Math.random() * 400);
      stoppers.push(() => { try { src.stop(); window.clearInterval(crackle); } catch {} });
    }

    activeNodesRef.current = { id, stop: () => stoppers.forEach(s => s()) };
    setPlaying(id);

    if (timer > 0) {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => { stopSound(); toast({ title: "Sleep timer ended 🌙", description: "Sweet dreams, sister." }); }, timer * 60 * 1000);
    }
  }

  function stopSound() {
    if (activeNodesRef.current) { activeNodesRef.current.stop(); activeNodesRef.current = null; }
    if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    setPlaying(null);
  }

  useEffect(() => () => stopSound(), []);

  // live-update gain when volume slider moves (only affects new sources we make on next play)
  useEffect(() => {
    if (audioCtxRef.current && activeNodesRef.current) {
      // simplest: don't restart, the current gain is fixed; volume changes apply on next start
    }
  }, [volume]);

  // ---------- sleep recording (mic monitor) ----------
  const [recording, setRecording] = useState(false);
  const [events, setEvents] = useState<{ t: number; db: number; kind: string }[]>([]);
  const [meterLevel, setMeterLevel] = useState(0);
  const recCtxRef = useRef<{ ctx: AudioContext; stream: MediaStream; analyser: AnalyserNode; raf: number } | null>(null);
  const recordStartRef = useRef<number>(0);
  const lastEventAtRef = useRef<number>(0);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      recordStartRef.current = Date.now();
      lastEventAtRef.current = 0;
      setEvents([]);

      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / data.length);
        const db = 20 * Math.log10(rms || 1e-6); // negative dBFS
        setMeterLevel(Math.max(0, Math.min(1, (db + 60) / 60)));
        // Detect sleep events: anything above -28 dBFS, with a 2-second cooldown
        const now = Date.now();
        if (db > -28 && now - lastEventAtRef.current > 2000) {
          lastEventAtRef.current = now;
          // crude classification
          const kind = db > -12 ? "loud (talk?)" : db > -20 ? "snore-ish" : "stir";
          setEvents(prev => [...prev, { t: Math.floor((now - recordStartRef.current) / 1000), db: Math.round(db), kind }]);
        }
        recCtxRef.current!.raf = requestAnimationFrame(tick);
      };
      recCtxRef.current = { ctx, stream, analyser, raf: 0 };
      recCtxRef.current.raf = requestAnimationFrame(tick);
      setRecording(true);
      toast({ title: "Sleep monitor on 🎙️", description: "Place your phone face-down nearby. We only listen for loud events — no audio is saved." });
    } catch (e: any) {
      toast({ title: "Couldn't access microphone", description: e?.message || "Please allow microphone access in your browser." });
    }
  }

  function stopRecording() {
    if (recCtxRef.current) {
      cancelAnimationFrame(recCtxRef.current.raf);
      recCtxRef.current.stream.getTracks().forEach(t => t.stop());
      try { recCtxRef.current.ctx.close(); } catch {}
      recCtxRef.current = null;
    }
    setRecording(false);
    setMeterLevel(0);
    if (events.length > 0) {
      toast({ title: `Logged ${events.length} sleep event${events.length === 1 ? "" : "s"} 🌙`, description: "Save tonight's sleep below to keep them in your pattern." });
    }
  }

  useEffect(() => () => { if (recording) stopRecording(); }, []);

  // ---------- sleep log entry ----------
  const [bedtime, setBedtime] = useState("");
  const [waketime, setWaketime] = useState("");
  const [quality, setQuality] = useState(3);
  const [notes, setNotes] = useState("");

  function saveLog() {
    if (!bedtime || !waketime) { toast({ title: "Add bedtime and wake time", description: "We need both to track your patterns." }); return; }
    const log: SleepLog = {
      id: Date.now().toString(),
      date: new Date().toISOString().slice(0, 10),
      bedtime, waketime, quality, notes: notes.trim() || undefined,
      events: events.length > 0 ? events.slice() : undefined,
    };
    setLogs([log, ...logs].slice(0, 60));
    setBedtime(""); setWaketime(""); setNotes(""); setQuality(3); setEvents([]);
    toast({ title: "Sleep saved 🌙", description: "Your pattern is building — keep going." });
  }

  function durationHours(b: string, w: string): number {
    if (!b || !w) return 0;
    const [bh, bm] = b.split(":").map(Number);
    const [wh, wm] = w.split(":").map(Number);
    let mins = (wh * 60 + wm) - (bh * 60 + bm);
    if (mins < 0) mins += 24 * 60;
    return Math.round((mins / 60) * 10) / 10;
  }

  const stats = useMemo(() => {
    if (logs.length === 0) return { avg: 0, avgQ: 0, best: 0 };
    const durs = logs.map(l => durationHours(l.bedtime, l.waketime));
    const avg = durs.reduce((a, b) => a + b, 0) / durs.length;
    const avgQ = logs.reduce((s, l) => s + l.quality, 0) / logs.length;
    return { avg: Math.round(avg * 10) / 10, avgQ: Math.round(avgQ * 10) / 10, best: Math.max(...durs) };
  }, [logs]);

  // first-visit recording prompt
  useEffect(() => { if (recordPref === "ask") setShowRecordAsk(true); }, [recordPref]);

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6 max-w-6xl mx-auto pb-24">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-serif text-foreground flex items-center gap-2">
          <Moon className="w-7 h-7 text-violet-500" /> Sleep Sanctuary
        </h1>
        <p className="text-muted-foreground mt-1">Soothing sounds, sleep monitoring, and the science of rest 🌙</p>
      </motion.div>

      <Tabs defaultValue="sounds" className="w-full">
        <TabsList className="w-full grid grid-cols-2 md:grid-cols-5 h-auto">
          <TabsTrigger value="sounds" className="py-2.5"><AudioLines className="w-4 h-4 mr-1" /> Sounds</TabsTrigger>
          <TabsTrigger value="monitor" className="py-2.5"><Mic className="w-4 h-4 mr-1" /> Monitor</TabsTrigger>
          <TabsTrigger value="track" className="py-2.5"><BedDouble className="w-4 h-4 mr-1" /> Track</TabsTrigger>
          <TabsTrigger value="videos" className="py-2.5"><Sparkles className="w-4 h-4 mr-1" /> Videos</TabsTrigger>
          <TabsTrigger value="tips" className="py-2.5"><Info className="w-4 h-4 mr-1" /> Tips</TabsTrigger>
        </TabsList>

        {/* SOUNDS */}
        <TabsContent value="sounds" className="mt-6 space-y-4">
          <Card className="border-violet-200/60 bg-gradient-to-br from-violet-50/40 to-indigo-50/40 dark:from-violet-950/20 dark:to-indigo-950/20">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <Volume2 className="w-4 h-4 text-violet-600" />
                <Slider value={[volume]} onValueChange={(v) => setVolume(v[0])} max={100} step={1} className="flex-1" data-testid="slider-volume" />
                <span className="text-sm w-10 text-right text-muted-foreground">{volume}%</span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <Clock className="w-4 h-4 text-violet-600" />
                <span className="text-sm text-muted-foreground">Sleep timer:</span>
                {[0, 15, 30, 60, 120].map(m => (
                  <button key={m} onClick={() => setTimer(m)} data-testid={`timer-${m}`}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${timer === m ? "bg-violet-600 text-white border-violet-600" : "bg-background border-border hover:border-violet-400"}`}>
                    {m === 0 ? "Off" : `${m}m`}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SOUNDS.map(s => (
              <button key={s.id} onClick={() => playing === s.id ? stopSound() : startSound(s.id)} data-testid={`sound-${s.id}`}
                className={`relative overflow-hidden rounded-2xl p-5 text-left bg-gradient-to-br ${s.tint} border border-white/40 shadow-sm hover:shadow-md transition-all ${playing === s.id ? "ring-2 ring-violet-500" : ""}`}>
                <div className="text-3xl mb-2">{s.emoji}</div>
                <div className="font-medium text-sm text-slate-800">{s.label}</div>
                <div className="absolute top-3 right-3">
                  {playing === s.id ? <Pause className="w-5 h-5 text-violet-700" /> : <Play className="w-5 h-5 text-slate-700" />}
                </div>
              </button>
            ))}
          </div>
          {playing && (
            <p className="text-xs text-muted-foreground text-center">
              Now playing · Adjust volume above. Volume changes apply when you restart the sound. {timer > 0 && `Auto-stop in ${timer} min.`}
            </p>
          )}
        </TabsContent>

        {/* MONITOR */}
        <TabsContent value="monitor" className="mt-6 space-y-4">
          <Card className="border-amber-200/60 bg-amber-50/40 dark:bg-amber-950/20">
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900 dark:text-amber-100">
                  <p className="font-medium mb-1">Your privacy is sacred 🌹</p>
                  <p className="text-xs">We only watch the volume level — nothing is recorded, uploaded, or saved. We mark moments when sound spikes (snores, talking, stirring) so you can spot patterns. Place your phone face-down on the nightstand and plug it in.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="font-serif flex items-center gap-2"><Mic className="w-5 h-5 text-rose-500" /> Sleep monitor</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Button onClick={recording ? stopRecording : startRecording} className={recording ? "bg-rose-500 hover:bg-rose-600 text-white" : "bg-violet-600 hover:bg-violet-700 text-white"} data-testid="button-monitor">
                  {recording ? <><MicOff className="w-4 h-4 mr-1.5" /> Stop monitor</> : <><Mic className="w-4 h-4 mr-1.5" /> Start sleep monitor</>}
                </Button>
                {recording && <Badge variant="secondary" className="bg-rose-100 text-rose-700">Listening · {events.length} events</Badge>}
              </div>
              {recording && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Live sound level (the louder your room, the higher this jumps)</p>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-violet-400 to-rose-400 transition-all duration-75" style={{ width: `${Math.round(meterLevel * 100)}%` }} />
                  </div>
                </div>
              )}
              {events.length > 0 && (
                <div className="space-y-1 max-h-64 overflow-y-auto rounded-xl border border-border/50 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Tonight's events</p>
                  {events.slice().reverse().map((e, i) => {
                    const mins = Math.floor(e.t / 60), secs = e.t % 60;
                    return (
                      <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border/30 last:border-0">
                        <span>{mins}:{String(secs).padStart(2, "0")}</span>
                        <span className="font-medium">{e.kind}</span>
                        <span className="text-muted-foreground">{e.db} dB</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TRACK */}
        <TabsContent value="track" className="mt-6 space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="font-serif flex items-center gap-2"><BedDouble className="w-5 h-5 text-violet-500" /> Log tonight's sleep</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Bedtime</label>
                  <input type="time" value={bedtime} onChange={(e) => setBedtime(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background" data-testid="input-bedtime" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Wake time</label>
                  <input type="time" value={waketime} onChange={(e) => setWaketime(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background" data-testid="input-waketime" />
                </div>
              </div>
              {bedtime && waketime && (
                <p className="text-sm text-muted-foreground">≈ {durationHours(bedtime, waketime)} hours of sleep</p>
              )}
              <div>
                <label className="text-xs text-muted-foreground">How rested do you feel? ({quality}/5)</label>
                <div className="flex gap-2 mt-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setQuality(n)} className={`flex-1 py-2 rounded-lg border-2 transition-all ${quality === n ? "border-violet-500 bg-violet-50 dark:bg-violet-950/40" : "border-border"}`} data-testid={`quality-${n}`}>
                      {["😩", "😕", "😐", "🙂", "✨"][n - 1]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Notes (optional)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Dreams, what helped, what didn't…" rows={2} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
              </div>
              <Button onClick={saveLog} className="w-full bg-violet-600 hover:bg-violet-700 text-white" data-testid="button-save-sleep">Save sleep</Button>
            </CardContent>
          </Card>

          {logs.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Card><CardContent className="pt-5 text-center"><p className="text-2xl font-bold text-violet-600">{stats.avg}h</p><p className="text-xs text-muted-foreground">avg sleep</p></CardContent></Card>
                <Card><CardContent className="pt-5 text-center"><p className="text-2xl font-bold text-rose-500">{stats.avgQ}/5</p><p className="text-xs text-muted-foreground">avg quality</p></CardContent></Card>
                <Card><CardContent className="pt-5 text-center"><p className="text-2xl font-bold text-amber-500">{stats.best}h</p><p className="text-xs text-muted-foreground">your best</p></CardContent></Card>
              </div>
              <Card>
                <CardHeader className="pb-3"><CardTitle className="font-serif text-base">Recent nights</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {logs.slice(0, 10).map(l => (
                    <div key={l.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                      <div>
                        <p className="text-sm font-medium">{l.date}</p>
                        <p className="text-xs text-muted-foreground">{l.bedtime} → {l.waketime} · {durationHours(l.bedtime, l.waketime)}h · {["😩", "😕", "😐", "🙂", "✨"][l.quality - 1]}{l.events && l.events.length > 0 ? ` · ${l.events.length} events` : ""}</p>
                        {l.notes && <p className="text-xs italic text-muted-foreground mt-0.5">"{l.notes}"</p>}
                      </div>
                      <button onClick={() => setLogs(logs.filter(x => x.id !== l.id))} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* VIDEOS */}
        <TabsContent value="videos" className="mt-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SLEEP_VIDEOS.map(v => (
              <Card key={v.id} className="overflow-hidden hover:shadow-lg transition-shadow border-border/50">
                <div className="aspect-video bg-black">
                  <iframe src={`https://www.youtube.com/embed/${v.id}`} title={v.title} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                </div>
                <CardContent className="pt-4 pb-4">
                  <p className="font-medium text-sm leading-snug">{v.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{v.channel} · {v.duration}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* TIPS */}
        <TabsContent value="tips" className="mt-6">
          <div className="grid sm:grid-cols-2 gap-3">
            {SLEEP_TIPS.map((t, i) => (
              <Card key={i} className="border-border/50">
                <CardContent className="pt-5">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">{t.emoji}</span>
                    <div>
                      <p className="font-medium text-sm">{t.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t.text}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="mt-4 border-violet-200/60 bg-violet-50/40 dark:bg-violet-950/20">
            <CardContent className="pt-5">
              <p className="text-sm font-medium text-violet-900 dark:text-violet-100 mb-2">Sleep monitoring preference</p>
              <p className="text-xs text-muted-foreground mb-3">Should ROSA offer to monitor your sleep with the microphone each night?</p>
              <div className="flex items-center justify-between">
                <span className="text-sm">Auto-prompt me at bedtime</span>
                <Switch checked={recordPref === "yes"} onCheckedChange={(v) => setRecordPref(v ? "yes" : "no")} data-testid="switch-record-pref" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* First-visit ask */}
      <Dialog open={showRecordAsk} onOpenChange={setShowRecordAsk}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">Want ROSA to listen at night? 🌙</DialogTitle>
            <DialogDescription className="pt-2 text-sm">
              We can use your phone's microphone to gently track snoring, talking, or restless moments — so you can see patterns over time.
              <br /><br />
              <strong>Your privacy stays sacred:</strong> nothing is ever recorded or sent anywhere. We only count loud moments locally on your phone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { setRecordPref("no"); setShowRecordAsk(false); }} data-testid="button-record-no">No thanks</Button>
            <Button onClick={() => { setRecordPref("yes"); setShowRecordAsk(false); toast({ title: "Got it 🌹", description: "You can start the monitor anytime from the Monitor tab." }); }} className="bg-violet-600 hover:bg-violet-700 text-white" data-testid="button-record-yes">
              Yes, help me sleep better
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
