import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, Moon, Sparkles, Users, Map, Shirt, CalendarHeart,
  BookHeart, Target, FlameKindling, ChevronRight, ArrowRight,
} from "lucide-react";

const SOFT = [0.32, 0.72, 0.32, 1] as const;

const FEATURES = [
  { icon: CalendarHeart, label: "Cycle Tracking", desc: "Log periods, symptoms, and phases with care", color: "bg-rose-100 text-rose-600" },
  { icon: Heart, label: "Mood & Wellness", desc: "Daily check-ins, emotional tracking, affirmations", color: "bg-pink-100 text-pink-600" },
  { icon: Users, label: "Partner Sync", desc: "Share health updates and support each other", color: "bg-purple-100 text-purple-600" },
  { icon: Shirt, label: "AI Outfits", desc: "Smart outfit suggestions based on weather & mood", color: "bg-fuchsia-100 text-fuchsia-600" },
  { icon: Map, label: "Travel Planner", desc: "Plan trips with itineraries and packing lists", color: "bg-sky-100 text-sky-600" },
  { icon: Moon, label: "Sanctuary", desc: "Your private space for rest, sleep & reflection", color: "bg-indigo-100 text-indigo-600" },
  { icon: BookHeart, label: "Journal", desc: "Write freely in your personal diary", color: "bg-amber-100 text-amber-600" },
  { icon: Target, label: "Goals", desc: "Set and track personal milestones", color: "bg-emerald-100 text-emerald-600" },
  { icon: Sparkles, label: "Skin & Beauty", desc: "Skincare routines and beauty tracking", color: "bg-violet-100 text-violet-600" },
  { icon: FlameKindling, label: "Challenges", desc: "Daily wellness challenges to keep you going", color: "bg-orange-100 text-orange-600" },
];

const TESTIMONIALS = [
  { name: "Priya S.", text: "ROSA feels like a friend who just gets it. Finally an app made for us.", emoji: "🌸" },
  { name: "Amara K.", text: "The partner sync feature has improved my relationship so much. He actually understands now.", emoji: "💕" },
  { name: "Sofia R.", text: "I've tried every wellness app. ROSA is the first one I've stuck with for more than a week.", emoji: "🌹" },
];

export default function Landing() {
  const [, setLocation] = useLocation();
  const [testimonialIdx, setTestimonialIdx] = useState(0);

  return (
    <div className="min-h-screen bg-[#fbf8f4] overflow-x-hidden">

      {/* Hero */}
      <div className="relative min-h-[100dvh] flex flex-col">
        {/* Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-rose-950 via-[#3d1a24] to-rose-900" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl" />
          {/* Floating petals */}
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-2xl select-none pointer-events-none"
              style={{ left: `${10 + i * 15}%`, top: `${20 + (i % 3) * 20}%` }}
              animate={{ y: [0, -20, 0], rotate: [0, 10, -10, 0], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 4 + i, repeat: Infinity, delay: i * 0.7, ease: "easeInOut" }}
            >
              🌹
            </motion.div>
          ))}
        </div>

        {/* Nav */}
        <nav className="relative z-10 flex items-center justify-between px-6 py-5 md:px-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: SOFT }}
            className="text-white font-serif text-3xl font-medium tracking-wide"
          >
            ROSA
          </motion.div>
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: SOFT }}
            onClick={() => setLocation("/sign-in")}
            className="text-white/80 hover:text-white text-sm font-medium transition-colors"
          >
            Sign in
          </motion.button>
        </nav>

        {/* Hero content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center pb-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: SOFT }}
          >
            <span className="inline-block bg-rose-500/20 border border-rose-400/30 text-rose-200 text-xs font-medium px-4 py-1.5 rounded-full mb-6 tracking-wider uppercase">
              An app made for women, by women
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35, ease: SOFT }}
            className="font-serif text-5xl md:text-7xl text-white font-medium leading-tight mb-6 max-w-3xl"
          >
            Your wellness,{" "}
            <span className="text-rose-300 italic">beautifully</span>{" "}
            yours
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: SOFT }}
            className="text-white/65 text-lg md:text-xl max-w-xl leading-relaxed mb-10"
          >
            ROSA is your all-in-one companion for cycle tracking, mood, partner sync,
            outfits, travel, and everything in between — crafted with care, for every woman.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.65, ease: SOFT }}
            className="flex flex-col sm:flex-row gap-3 w-full max-w-sm"
          >
            <button
              onClick={() => setLocation("/sign-in")}
              className="flex-1 bg-white text-rose-900 font-semibold px-8 py-4 rounded-2xl hover:bg-rose-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-black/20"
            >
              Get started free <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
              className="flex-1 border border-white/25 text-white font-medium px-8 py-4 rounded-2xl hover:bg-white/10 transition-all"
            >
              See what&apos;s inside
            </button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.6 }}
            className="text-white/35 text-xs mt-5"
          >
            Built by Aiswarya Saji — a woman who struggled just like you 🌹
          </motion.p>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="relative z-10 flex justify-center pb-8"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="w-6 h-10 border-2 border-white/25 rounded-full flex items-start justify-center p-1.5">
            <div className="w-1 h-2.5 bg-white/40 rounded-full" />
          </div>
        </motion.div>
      </div>

      {/* What is ROSA section */}
      <section className="py-20 px-6 md:px-12 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: SOFT }}
          >
            <span className="text-rose-500 text-sm font-medium tracking-wider uppercase">What is ROSA?</span>
            <h2 className="font-serif text-4xl md:text-5xl text-rose-950 mt-3 mb-6 leading-tight">
              A sanctuary built just for you
            </h2>
            <p className="text-stone-500 text-lg leading-relaxed max-w-2xl mx-auto mb-12">
              ROSA is more than a wellness app — it's a safe, inclusive space where you can track your cycle,
              understand your body, connect with your partner, plan your life, and grow into the person you want to be.
              No judgment. No complexity. Just you and your journey.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {[
              { emoji: "🌹", title: "Made by a woman", desc: "Built by Aiswarya Saji from real lived experiences. Every feature was designed because someone needed it." },
              { emoji: "🔒", title: "Your data, always yours", desc: "Everything is tied to your account. Private, secure, and never shared without your permission." },
              { emoji: "💕", title: "For every body", desc: "Whether you're tracking your cycle, supporting your partner, or just journaling — ROSA adapts to you." },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.15, ease: SOFT }}
                className="bg-rose-50/60 rounded-3xl p-7 border border-rose-100"
              >
                <div className="text-3xl mb-4">{item.emoji}</div>
                <h3 className="font-semibold text-rose-900 text-lg mb-2">{item.title}</h3>
                <p className="text-stone-500 text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 md:px-12 bg-[#fbf8f4]">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <span className="text-rose-500 text-sm font-medium tracking-wider uppercase">Everything you need</span>
            <h2 className="font-serif text-4xl md:text-5xl text-rose-950 mt-3 leading-tight">
              10+ features, one app
            </h2>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.92 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.07, ease: SOFT }}
                className="bg-white rounded-2xl p-5 border border-stone-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className={`w-10 h-10 rounded-xl ${f.color} flex items-center justify-center mb-3`}>
                  <f.icon className="w-5 h-5" />
                </div>
                <div className="font-semibold text-stone-800 text-sm mb-1">{f.label}</div>
                <div className="text-stone-400 text-xs leading-relaxed">{f.desc}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6 bg-gradient-to-br from-rose-950 to-[#3d1a24]">
        <div className="max-w-2xl mx-auto text-center">
          <span className="text-rose-300 text-sm font-medium tracking-wider uppercase">From the community</span>
          <h2 className="font-serif text-3xl md:text-4xl text-white mt-3 mb-12">Women who found their ROSA</h2>

          <AnimatePresence mode="wait">
            <motion.div
              key={testimonialIdx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: SOFT }}
              className="bg-white/10 border border-white/15 rounded-3xl p-8 mb-8"
            >
              <div className="text-4xl mb-4">{TESTIMONIALS[testimonialIdx].emoji}</div>
              <p className="text-white/85 text-lg italic leading-relaxed mb-4">
                &ldquo;{TESTIMONIALS[testimonialIdx].text}&rdquo;
              </p>
              <p className="text-rose-300 text-sm font-medium">{TESTIMONIALS[testimonialIdx].name}</p>
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-center gap-2">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                onClick={() => setTestimonialIdx(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === testimonialIdx ? "bg-rose-300 w-6" : "bg-white/30"}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-white text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: SOFT }}
        >
          <div className="text-5xl mb-6">🌹</div>
          <h2 className="font-serif text-4xl md:text-5xl text-rose-950 mb-4 leading-tight">
            Ready to bloom?
          </h2>
          <p className="text-stone-400 text-lg mb-10 max-w-md mx-auto">
            Join thousands of women building a healthier, more connected life with ROSA.
          </p>
          <button
            onClick={() => setLocation("/sign-in")}
            className="bg-rose-600 hover:bg-rose-700 text-white font-semibold px-10 py-4 rounded-2xl transition-colors inline-flex items-center gap-2 shadow-lg shadow-rose-200"
          >
            Start your ROSA journey <ChevronRight className="w-5 h-5" />
          </button>
          <p className="text-stone-400 text-sm mt-5">Free to use · No credit card required</p>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="bg-rose-950 text-white/50 text-center py-8 text-sm">
        <p>🌹 ROSA Inclusive Lifestyle · Built with love by Aiswarya Saji</p>
        <p className="mt-1 text-xs">An app made for women, by women</p>
      </footer>
    </div>
  );
}
