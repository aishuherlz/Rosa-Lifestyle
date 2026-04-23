import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/lib/user-context";

const UNSPLASH_IMAGES = [
  "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=1200&q=80",
  "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=1200&q=80",
  "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=1200&q=80",
  "https://images.unsplash.com/photo-1604004215854-e1e85f5398a7?w=1200&q=80",
  "https://images.unsplash.com/photo-1581824283135-0666cf353f35?w=1200&q=80",
  "https://images.unsplash.com/photo-1573496800248-9af9051836a4?w=1200&q=80",
  "https://images.unsplash.com/photo-1601412436009-d964bd02edbc?w=1200&q=80",
  "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=1200&q=80",
  "https://images.unsplash.com/photo-1611042553484-d61f84d22784?w=1200&q=80",
  "https://images.unsplash.com/photo-1591084728795-1149f32d9866?w=1200&q=80",
  "https://images.unsplash.com/photo-1488716820095-cbe80883c496?w=1200&q=80",
  "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1200&q=80",
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
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rose overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-[#3d1a24]/80 pointer-events-none" />

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
