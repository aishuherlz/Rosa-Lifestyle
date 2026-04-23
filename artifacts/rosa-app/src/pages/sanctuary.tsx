import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Volume2, Play, Pause, Timer, Wind, Sparkles } from "lucide-react";
import { readCyclePhase } from "@/lib/sync";

type SoundKey = "rain" | "ocean" | "forest" | "white" | "pink" | "brown" | "fire" | "focus" | "sleep" | "meditation";

const SOUNDS: { key: SoundKey; name: string; emoji: string; desc: string; type: "noise" | "binaural"; params: any }[] = [
  { key: "rain", name: "Soft Rain", emoji: "🌧️", desc: "Gentle rainfall", type: "noise", params: { color: "pink", lowpass: 800 } },
  { key: "ocean", name: "Ocean Waves", emoji: "🌊", desc: "Calming waves", type: "noise", params: { color: "brown", lowpass: 400, lfo: 0.15 } },
  { key: "forest", name: "Forest Breeze", emoji: "🌲", desc: "Wind through trees", type: "noise", params: { color: "pink", lowpass: 1200, lfo: 0.3 } },
  { key: "fire", name: "Fireplace", emoji: "🔥", desc: "Crackling fire", type: "noise", params: { color: "brown", lowpass: 600, crackle: true } },
  { key: "white", name: "White Noise", emoji: "⚪", desc: "Pure focus", type: "noise", params: { color: "white" } },
  { key: "pink", name: "Pink Noise", emoji: "🌸", desc: "Balanced sleep", type: "noise", params: { color: "pink" } },
  { key: "brown", name: "Brown Noise", emoji: "🟫", desc: "Deep grounding", type: "noise", params: { color: "brown" } },
  { key: "focus", name: "Focus Beats", emoji: "🎯", desc: "14 Hz beta · concentration", type: "binaural", params: { base: 200, beat: 14 } },
  { key: "sleep", name: "Sleep Beats", emoji: "🌙", desc: "4 Hz delta · deep rest", type: "binaural", params: { base: 150, beat: 4 } },
  { key: "meditation", name: "Meditation Beats", emoji: "🕉️", desc: "8 Hz alpha · calm flow", type: "binaural", params: { base: 180, beat: 8 } },
];

const PHASE_RECS: Record<string, SoundKey[]> = {
  menstrual: ["fire", "rain", "sleep"],
  follicular: ["forest", "focus", "ocean"],
  ovulation: ["meditation", "ocean", "pink"],
  luteal: ["rain", "fire", "sleep"],
};

function makeNoiseBuffer(ctx: AudioContext, color: "white" | "pink" | "brown") {
  const seconds = 4;
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let lastOut = 0;
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < data.length; i++) {
    const w = Math.random() * 2 - 1;
    if (color === "white") data[i] = w;
    else if (color === "pink") {
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    } else {
      lastOut = (lastOut + 0.02 * w) / 1.02;
      data[i] = lastOut * 3.5;
    }
  }
  return buf;
}

type ActiveNode = { stop: () => void; setVolume: (v: number) => void };

function startNoise(ctx: AudioContext, dest: AudioNode, p: any, vol: number): ActiveNode {
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx, p.color);
  src.loop = true;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  let chain: AudioNode = src;
  if (p.lowpass) {
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = p.lowpass;
    src.connect(lp); chain = lp;
  }
  if (p.lfo) {
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = p.lfo;
    lfoGain.gain.value = vol * 0.6;
    lfo.connect(lfoGain.gain);
    chain.connect(lfoGain);
    lfoGain.connect(gain);
    lfo.start();
  } else {
    chain.connect(gain);
  }
  gain.connect(dest);
  src.start();
  return {
    stop: () => { try { src.stop(); } catch {} },
    setVolume: (v: number) => { gain.gain.setTargetAtTime(v, ctx.currentTime, 0.05); },
  };
}

function startBinaural(ctx: AudioContext, dest: AudioNode, p: any, vol: number): ActiveNode {
  const merger = ctx.createChannelMerger(2);
  const oscL = ctx.createOscillator();
  const oscR = ctx.createOscillator();
  oscL.frequency.value = p.base;
  oscR.frequency.value = p.base + p.beat;
  oscL.type = "sine"; oscR.type = "sine";
  const gL = ctx.createGain();
  const gR = ctx.createGain();
  gL.gain.value = vol * 0.3;
  gR.gain.value = vol * 0.3;
  oscL.connect(gL).connect(merger, 0, 0);
  oscR.connect(gR).connect(merger, 0, 1);
  merger.connect(dest);
  oscL.start(); oscR.start();
  return {
    stop: () => { try { oscL.stop(); oscR.stop(); } catch {} },
    setVolume: (v: number) => {
      gL.gain.setTargetAtTime(v * 0.3, ctx.currentTime, 0.05);
      gR.gain.setTargetAtTime(v * 0.3, ctx.currentTime, 0.05);
    },
  };
}

export default function SanctuaryPage() {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const activeRef = useRef<Record<string, ActiveNode>>({});
  const [active, setActive] = useState<Record<SoundKey, number>>({} as any);
  const [master, setMaster] = useState(0.7);
  const [timer, setTimer] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [breathing, setBreathing] = useState(false);
  const [breathPhase, setBreathPhase] = useState<"in" | "hold" | "out">("in");
  const cyc = readCyclePhase();
  const recs = cyc.phase !== "unknown" ? PHASE_RECS[cyc.phase] : [];

  useEffect(() => {
    return () => {
      Object.values(activeRef.current).forEach((n) => n.stop());
      ctxRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (!timer) return;
    const start = Date.now();
    const id = setInterval(() => {
      const left = timer - Math.floor((Date.now() - start) / 1000);
      setTimeLeft(left);
      if (left <= 0) {
        Object.keys(activeRef.current).forEach(stopSound);
        setActive({} as any);
        setTimer(null);
        clearInterval(id);
      }
    }, 250);
    return () => clearInterval(id);
  }, [timer]);

  useEffect(() => {
    if (!breathing) return;
    const cycle = [
      { p: "in" as const, ms: 4000 },
      { p: "hold" as const, ms: 7000 },
      { p: "out" as const, ms: 8000 },
    ];
    let i = 0;
    setBreathPhase(cycle[0].p);
    const tick = () => {
      i = (i + 1) % cycle.length;
      setBreathPhase(cycle[i].p);
    };
    let timeout: any;
    const schedule = () => {
      timeout = setTimeout(() => { tick(); schedule(); }, cycle[i].ms);
    };
    schedule();
    return () => clearTimeout(timeout);
  }, [breathing]);

  function ensureCtx() {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      masterRef.current = ctxRef.current.createGain();
      masterRef.current.gain.value = master;
      masterRef.current.connect(ctxRef.current.destination);
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return { ctx: ctxRef.current, dest: masterRef.current! };
  }

  function toggleSound(s: typeof SOUNDS[0]) {
    if (activeRef.current[s.key]) {
      stopSound(s.key);
      setActive((a) => { const n = { ...a }; delete (n as any)[s.key]; return n; });
    } else {
      const { ctx, dest } = ensureCtx();
      const node = s.type === "noise" ? startNoise(ctx, dest, s.params, 0.5) : startBinaural(ctx, dest, s.params, 0.5);
      activeRef.current[s.key] = node;
      setActive((a) => ({ ...a, [s.key]: 0.5 }));
    }
  }

  function stopSound(key: string) {
    activeRef.current[key]?.stop();
    delete activeRef.current[key];
  }

  function setSoundVol(key: SoundKey, v: number) {
    activeRef.current[key]?.setVolume(v);
    setActive((a) => ({ ...a, [key]: v }));
  }

  function setMasterVol(v: number) {
    setMaster(v);
    if (masterRef.current && ctxRef.current) masterRef.current.gain.setTargetAtTime(v, ctxRef.current.currentTime, 0.05);
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  const breathLabel = breathPhase === "in" ? "Breathe in" : breathPhase === "hold" ? "Hold" : "Breathe out";
  const breathScale = breathPhase === "in" ? 1.5 : breathPhase === "hold" ? 1.5 : 1;
  const breathDur = breathPhase === "in" ? 4 : breathPhase === "hold" ? 7 : 8;

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6 max-w-4xl mx-auto pb-24">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-serif text-foreground flex items-center gap-2">
          <Sparkles className="w-7 h-7 text-rose-400" /> Sanctuary
        </h1>
        <p className="text-muted-foreground mt-1">Soothing sounds, guided breath, sleep timer 🌙</p>
      </motion.div>

      {recs.length > 0 && (
        <Card className="border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50">
          <CardContent className="pt-4">
            <p className="text-xs uppercase tracking-widest text-rose-600">Day {cyc.day} · {cyc.phase} phase</p>
            <p className="text-sm text-rose-900 mt-1">Try these tonight: {recs.map((k) => SOUNDS.find((s) => s.key === k)?.name).join(" · ")}</p>
          </CardContent>
        </Card>
      )}

      <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <Wind className="w-5 h-5 text-violet-500" /> 4-7-8 Guided Breathing
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-6">
          <motion.div
            animate={{ scale: breathing ? breathScale : 1 }}
            transition={{ duration: breathing ? breathDur : 0.5, ease: "easeInOut" }}
            className="w-32 h-32 rounded-full bg-gradient-to-br from-violet-300 to-rose-300 shadow-lg flex items-center justify-center text-white font-serif text-lg"
            data-testid="breath-circle"
          >
            {breathing ? breathLabel : "Tap start"}
          </motion.div>
          <Button
            onClick={() => setBreathing((b) => !b)}
            variant={breathing ? "outline" : "default"}
            className={breathing ? "" : "bg-violet-500 hover:bg-violet-600 text-white"}
            data-testid="button-toggle-breath"
          >
            {breathing ? "Stop" : "Start breathing"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-lg flex items-center justify-between">
            <span className="flex items-center gap-2"><Volume2 className="w-5 h-5 text-rose-400" /> Sound Mixer</span>
            {timer && <Badge className="bg-rose-100 text-rose-700">{fmt(timeLeft)}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Master volume</p>
            <Slider value={[master * 100]} onValueChange={([v]) => setMasterVol(v / 100)} max={100} step={1} data-testid="slider-master" />
          </div>

          <div className="flex flex-wrap gap-2">
            <p className="text-xs text-muted-foreground w-full mb-1">Sleep timer</p>
            {[5, 10, 30, 60].map((m) => (
              <Button key={m} size="sm" variant={timer === m * 60 ? "default" : "outline"}
                onClick={() => { setTimer(m * 60); setTimeLeft(m * 60); }} data-testid={`button-timer-${m}`}>
                <Timer className="w-3 h-3 mr-1" /> {m} min
              </Button>
            ))}
            {timer && (
              <Button size="sm" variant="ghost" onClick={() => { setTimer(null); setTimeLeft(0); }}>Cancel</Button>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3 pt-2">
            {SOUNDS.map((s) => {
              const isOn = s.key in active;
              const isRec = recs.includes(s.key);
              return (
                <motion.div key={s.key} layout
                  className={`p-3 rounded-2xl border transition-all ${isOn ? "border-rose-400 bg-rose-50/60" : isRec ? "border-rose-200 bg-rose-50/30" : "border-border bg-card"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <button onClick={() => toggleSound(s)} className="flex items-center gap-3 flex-1 text-left" data-testid={`button-sound-${s.key}`}>
                      <span className="text-2xl">{s.emoji}</span>
                      <div>
                        <p className="text-sm font-medium flex items-center gap-1">{s.name} {isRec && <span className="text-rose-400 text-xs">🌹</span>}</p>
                        <p className="text-xs text-muted-foreground">{s.desc}</p>
                      </div>
                    </button>
                    <Button size="icon" variant="ghost" onClick={() => toggleSound(s)} className="shrink-0">
                      {isOn ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                  </div>
                  <AnimatePresence>
                    {isOn && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-2">
                        <Slider value={[active[s.key] * 100]} onValueChange={([v]) => setSoundVol(s.key, v / 100)} max={100} step={1} data-testid={`slider-${s.key}`} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground text-center pt-2">
            🎧 Use headphones for binaural beats. Mix multiple sounds — set your perfect blend.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
