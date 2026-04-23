import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/lib/user-context";

// Curated to celebrate women across cultures, ethnicities, gender expressions, LGBTQ+ and sisterhood.
const UNSPLASH_IMAGES = [
  "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=1200&q=80", // Black woman portrait
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=1200&q=80", // woman smiling
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1200&q=80", // woman lifestyle
  "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=1200&q=80", // Latina woman
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1200&q=80", // woman portrait
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=1200&q=80", // woman in field
  "https://images.unsplash.com/photo-1554151228-14d9def656e4?w=1200&q=80", // woman of color
  "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=1200&q=80", // diverse woman
  "https://images.unsplash.com/photo-1520975916090-3105956dac38?w=1200&q=80", // women friends sisterhood
  "https://images.unsplash.com/photo-1521119989659-a83eee488004?w=1200&q=80", // women laughing together
];

export default function Intro() {
  const [, setLocation] = useLocation();
  const { setHasSeenIntro, user } = useUser();
  const [phase, setPhase] = useState<"image" | "logo" | "out">("image");
  const [imgUrl] = useState(() => UNSPLASH_IMAGES[Math.floor(Math.random() * UNSPLASH_IMAGES.length)]);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("logo"), 1800);
    const t2 = setTimeout(() => setPhase("out"), 4000);
    const t3 = setTimeout(() => {
      setHasSeenIntro(true);
      setLocation(user ? "/" : "/sign-in");
    }, 4500);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, [setHasSeenIntro, user, setLocation]);

  return (
    <div className="h-[100dvh] w-full relative overflow-hidden bg-[#3d1a24]">
      {/* Background image */}
      <AnimatePresence>
        {phase === "image" && (
          <motion.div
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="absolute inset-0"
          >
            <img
              src={imgUrl}
              alt=""
              className="w-full h-full object-cover"
              style={{ filter: "brightness(0.6) saturate(1.1)" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
            {/* Fallback gradient always behind the image — graceful if image 404s */}
            <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#8b2252] via-[#c14b7c] to-[#e8a4a4]" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rose overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-[#3d1a24]/20 to-[#3d1a24]/85 pointer-events-none" />

      {/* Phase 1 — gentle welcome text on the photo */}
      <AnimatePresence>
        {phase === "image" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
            className="absolute inset-0 flex items-end justify-center pb-24 px-6 pointer-events-none"
          >
            <p className="text-white/90 text-base md:text-lg font-light tracking-[0.3em] uppercase">
              For every woman 🌹
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logo layer */}
      <AnimatePresence>
        {(phase === "logo" || phase === "out") && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === "out" ? 0 : 1 }}
            transition={{ duration: 0.9, ease: "easeInOut" }}
            className="absolute inset-0 bg-[#8b2252] flex flex-col items-center justify-center px-6"
          >
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
              className="text-center"
            >
              <h1 className="text-8xl md:text-[10rem] font-serif font-medium tracking-wide text-white/90 mb-4">
                ROSA
              </h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.8 }}
                className="text-white/75 text-lg md:text-xl font-light tracking-widest italic mb-6"
              >
                An app made for women, by women
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.4, duration: 0.8 }}
                className="text-white/50 text-sm font-light max-w-xs mx-auto leading-relaxed"
              >
                Built by Aiswarya Saji — a woman who struggled just like you
              </motion.p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.8, duration: 0.6 }}
              className="absolute bottom-12 flex gap-1.5"
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-white/40"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }}
                />
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
