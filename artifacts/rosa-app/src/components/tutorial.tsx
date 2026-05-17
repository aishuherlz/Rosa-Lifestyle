import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, CalendarHeart, Heart, Users, Shirt, Map, Moon, LayoutDashboard } from "lucide-react";
import { scopedStorage } from "@/lib/scoped-storage";

const SOFT = [0.32, 0.72, 0.32, 1] as const;

const STEPS = [
  {
    id: "welcome",
    emoji: "🌹",
    title: "Welcome to ROSA",
    subtitle: "Your personal wellness companion",
    desc: "ROSA is built for you — track your cycle, your mood, connect with your partner, and build the life you deserve. Let us show you around.",
    visual: null,
    tip: null,
  },
  {
    id: "dashboard",
    emoji: "🏠",
    title: "Your Home Dashboard",
    subtitle: "Everything at a glance",
    desc: "Your home screen shows today's date, weather, your mood, streak, and quick links to every feature. Tap the 🌹 to see your garden of progress.",
    visual: "dashboard",
    tip: "💡 Tap the check-in button every day to grow your rose garden and build your streak!",
  },
  {
    id: "navigation",
    emoji: "🗺️",
    title: "Getting Around",
    subtitle: "Tabs, sidebar & navigation",
    desc: "On mobile, use the bottom bar to quickly switch between Home, Mood, Cycle, Partner and more. On tablet/desktop, a full sidebar appears on the left.",
    visual: "nav",
    tip: "💡 Swipe left and right on the bottom nav to see all your features.",
  },
  {
    id: "period",
    emoji: "🩸",
    title: "Cycle & Period Tracking",
    subtitle: "Understand your body",
    desc: "Log your period start, symptoms, flow, and mood each day. ROSA learns your cycle over time and shows your phases — follicular, ovulation, luteal, and menstrual.",
    visual: "period",
    tip: "💡 The more you log, the smarter ROSA gets at predicting your next cycle.",
  },
  {
    id: "partner",
    emoji: "💑",
    title: "Partner Link",
    subtitle: "Connect and support each other",
    desc: "Share a unique code with your partner to link accounts. Once connected, you can share mood updates, health insights, and support each other through every phase.",
    visual: "partner",
    tip: "💡 Go to Partner → tap 'Generate Link Code' → share it with your partner.",
  },
  {
    id: "features",
    emoji: "✨",
    title: "Explore All Features",
    subtitle: "So much more inside",
    desc: "Journal your thoughts, plan outfits with AI, build travel itineraries, set goals, track skincare, write letters to your future self, and find your sanctuary.",
    visual: "features",
    tip: null,
  },
  {
    id: "ready",
    emoji: "🌸",
    title: "You're all set!",
    subtitle: "Your ROSA journey begins now",
    desc: "Everything is ready for you. Remember — ROSA is your safe space. Take it at your own pace, explore what feels right, and come back whenever you need.",
    visual: null,
    tip: "💡 You can always replay this tutorial from Settings → Help & Tutorial.",
  },
];

const FEATURE_PILLS = [
  { icon: CalendarHeart, label: "Cycle", color: "bg-pink-100 text-pink-600" },
  { icon: Heart, label: "Mood", color: "bg-rose-100 text-rose-600" },
  { icon: Users, label: "Partner", color: "bg-purple-100 text-purple-600" },
  { icon: Shirt, label: "Outfits", color: "bg-fuchsia-100 text-fuchsia-600" },
  { icon: Map, label: "Travel", color: "bg-sky-100 text-sky-600" },
  { icon: Moon, label: "Sanctuary", color: "bg-indigo-100 text-indigo-600" },
];

function Visual({ type }: { type: string | null }) {
  if (!type) return null;

  if (type === "dashboard") return (
    <div className="bg-rose-50 rounded-2xl p-4 border border-rose-100 text-left">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs text-stone-400">Good morning</div>
          <div className="font-semibold text-rose-900 text-sm">How are you today?</div>
        </div>
        <div className="flex items-center gap-1 bg-rose-100 rounded-full px-2.5 py-1 text-xs text-rose-600 font-medium">
          🌹 24 <span className="text-orange-500">🔥 7</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {["Mood", "Cycle", "Partner"].map(l => (
          <div key={l} className="bg-white rounded-xl p-2 text-center border border-rose-100">
            <div className="text-xs text-stone-400">{l}</div>
            <div className="text-rose-600 font-medium text-xs mt-0.5">Tap →</div>
          </div>
        ))}
      </div>
      <div className="bg-rose-600 text-white text-center text-xs rounded-xl py-2.5 font-medium">
        ✓ Check in today
      </div>
    </div>
  );

  if (type === "nav") return (
    <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden shadow-sm">
      <div className="bg-rose-950 text-white text-xs text-center py-2 px-3 font-medium">ROSA App — Mobile Nav</div>
      <div className="flex justify-around items-center py-3 px-2 border-t border-stone-100">
        {[
          { icon: LayoutDashboard, label: "Home", active: true },
          { icon: Heart, label: "Mood", active: false },
          { icon: CalendarHeart, label: "Cycle", active: false },
          { icon: Users, label: "Partner", active: false },
          { icon: Moon, label: "More", active: false },
        ].map(({ icon: Icon, label, active }) => (
          <div key={label} className={`flex flex-col items-center gap-1 ${active ? "text-rose-600" : "text-stone-400"}`}>
            <Icon className="w-4 h-4" />
            <span className="text-[10px] font-medium">{label}</span>
            {active && <div className="w-1 h-1 rounded-full bg-rose-600" />}
          </div>
        ))}
      </div>
    </div>
  );

  if (type === "period") return (
    <div className="bg-pink-50 rounded-2xl p-4 border border-pink-100 text-left">
      <div className="text-xs font-medium text-pink-700 mb-2">May 2025</div>
      <div className="grid grid-cols-7 gap-1 mb-3">
        {["M","T","W","T","F","S","S"].map((d, i) => (
          <div key={i} className="text-center text-[10px] text-stone-400 font-medium">{d}</div>
        ))}
        {[...Array(31)].map((_, i) => (
          <div key={i} className={`text-center text-[10px] rounded-full w-6 h-6 flex items-center justify-center mx-auto font-medium
            ${i >= 2 && i <= 6 ? "bg-pink-500 text-white" : ""}
            ${i === 14 ? "ring-2 ring-rose-400 text-rose-600" : "text-stone-500"}
          `}>
            {i + 1}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <span className="text-xs bg-pink-200 text-pink-700 rounded-full px-2.5 py-1">🩸 Period</span>
        <span className="text-xs bg-rose-100 text-rose-600 rounded-full px-2.5 py-1">🥚 Ovulation</span>
      </div>
    </div>
  );

  if (type === "partner") return (
    <div className="bg-purple-50 rounded-2xl p-4 border border-purple-100 text-left">
      <div className="text-sm font-semibold text-purple-900 mb-3">Partner Link</div>
      <div className="bg-white rounded-xl p-3 border border-purple-100 mb-3">
        <div className="text-xs text-stone-400 mb-1">Your link code</div>
        <div className="font-mono font-bold text-purple-700 text-lg tracking-widest">ROSA-4829</div>
        <div className="text-xs text-stone-400 mt-1">Share this with your partner</div>
      </div>
      <div className="text-xs text-purple-600 bg-purple-100 rounded-xl px-3 py-2">
        💑 Once linked, you&apos;ll both see shared updates
      </div>
    </div>
  );

  if (type === "features") return (
    <div className="grid grid-cols-3 gap-2">
      {FEATURE_PILLS.map(({ icon: Icon, label, color }) => (
        <div key={label} className={`rounded-xl p-3 border border-stone-100 bg-white flex flex-col items-center gap-1.5`}>
          <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}>
            <Icon className="w-4 h-4" />
          </div>
          <span className="text-xs font-medium text-stone-600">{label}</span>
        </div>
      ))}
    </div>
  );

  return null;
}

interface TutorialProps {
  onComplete: () => void;
}

export function Tutorial({ onComplete }: TutorialProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  const finish = () => {
    scopedStorage.setItem("rosa_tutorial_done", "true");
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={finish}
      />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 60, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 60, scale: 0.95 }}
        transition={{ duration: 0.4, ease: SOFT }}
        className="relative bg-white rounded-3xl w-full max-w-md max-h-[90dvh] overflow-y-auto shadow-2xl"
      >
        {/* Skip button */}
        <button
          onClick={finish}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center transition-colors"
          aria-label="Skip tutorial"
        >
          <X className="w-4 h-4 text-stone-500" />
        </button>

        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-stone-100 rounded-t-3xl overflow-hidden">
          <motion.div
            className="h-full bg-rose-500"
            initial={{ width: 0 }}
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.4, ease: SOFT }}
          />
        </div>

        <div className="p-7 pt-8">
          {/* Step indicator */}
          <div className="flex gap-1.5 mb-6">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? "bg-rose-500 flex-[2]" : i < step ? "bg-rose-300 flex-1" : "bg-stone-200 flex-1"
                }`}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: SOFT }}
            >
              <div className="text-4xl mb-4">{current.emoji}</div>
              <div className="text-xs font-medium text-rose-500 uppercase tracking-wider mb-1">{current.subtitle}</div>
              <h2 className="font-serif text-2xl text-rose-950 font-medium mb-3">{current.title}</h2>
              <p className="text-stone-500 text-sm leading-relaxed mb-5">{current.desc}</p>

              {current.visual && (
                <div className="mb-5">
                  <Visual type={current.visual} />
                </div>
              )}

              {current.tip && (
                <div className="bg-rose-50 border border-rose-100 rounded-2xl px-4 py-3 text-sm text-rose-700 leading-relaxed">
                  {current.tip}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-7">
            <button
              onClick={() => setStep(s => s - 1)}
              disabled={isFirst}
              className="flex items-center gap-1.5 text-stone-400 hover:text-stone-600 disabled:opacity-0 transition-colors text-sm font-medium"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>

            <span className="text-xs text-stone-400">{step + 1} of {STEPS.length}</span>

            {isLast ? (
              <button
                onClick={finish}
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 text-sm"
              >
                Let&apos;s go! 🌹
              </button>
            ) : (
              <button
                onClick={() => setStep(s => s + 1)}
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 text-sm"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Skip link */}
          {!isLast && (
            <button
              onClick={finish}
              className="w-full text-center text-xs text-stone-400 hover:text-stone-500 mt-4 transition-colors"
            >
              Skip tutorial
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
