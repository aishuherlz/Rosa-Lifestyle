import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
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

// Buttery-soft cubic-bezier — no abrupt motion anywhere.
const SOFT = [0.32, 0.72, 0.32, 1] as const;

export default function Intro() {
  const [, setLocation] = useLocation();
  const { setHasSeenIntro, user } = useUser();
  const [phase, setPhase] = useState<"image" | "logo" | "out">("image");
  const [imgUrl] = useState(() => UNSPLASH_IMAGES[Math.floor(Math.random() * UNSPLASH_IMAGES.length)]);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("logo"), 2200);
    const t2 = setTimeout(() => setPhase("out"), 4600);
    const t3 = setTimeout(() => {
      setHasSeenIntro(true);
      setLocation(user ? "/" : "/sign-in");
    }, 5600);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, [setHasSeenIntro, user, setLocation]);

  return (
    <motion.div
      className="h-[100dvh] w-full relative overflow-hidden bg-[#3d1a24]"
      initial={{ opacity: 0 }}
      animate={{ opacity: phase === "out" ? 0 : 1 }}
      transition={{ duration: phase === "out" ? 1.0 : 0.6, ease: SOFT }}
    >
      {/* Background image — stays mounted the whole time, just slowly dims under the logo overlay */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0, scale: 1.08 }}
        animate={{ opacity: 1, scale: 1.0 }}
        transition={{ duration: 2.4, ease: SOFT }}
      >
        <img
          src={imgUrl}
          alt=""
          className="w-full h-full object-cover"
          style={{ filter: "brightness(0.55) saturate(1.08)" }}
          draggable={false}
        />
        {/* Always-on rose gradient — depth without abruptness */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-[#3d1a24]/85 pointer-events-none" />
      </motion.div>

      {/* Logo overlay — cross-fades on top of the image (no hard cut to a flat colour) */}
      <motion.div
        className="absolute inset-0 flex flex-col items-center justify-center px-6 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, rgba(139,34,82,0.92) 0%, rgba(61,26,36,0.94) 70%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === "image" ? 0 : 1 }}
        transition={{ duration: 1.4, ease: SOFT }}
      >
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: phase === "image" ? 0 : 1, y: phase === "image" ? 18 : 0 }}
          transition={{ duration: 1.2, delay: phase === "image" ? 0 : 0.3, ease: SOFT }}
        >
          <h1 className="text-8xl md:text-[10rem] font-serif font-medium tracking-wide text-white/90 mb-4">
            ROSA
          </h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === "image" ? 0 : 1 }}
            transition={{ delay: phase === "image" ? 0 : 1.0, duration: 1.0, ease: SOFT }}
            className="text-white/75 text-lg md:text-xl font-light tracking-widest italic mb-6"
          >
            An app made for women, by women
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: phase === "image" ? 0 : 1, y: phase === "image" ? 6 : 0 }}
            transition={{ delay: phase === "image" ? 0 : 1.6, duration: 1.0, ease: SOFT }}
            className="text-white/50 text-sm font-light max-w-xs mx-auto leading-relaxed"
          >
            Built by Aiswarya Saji — a woman who struggled just like you
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === "logo" ? 1 : 0 }}
          transition={{ delay: phase === "logo" ? 2.0 : 0, duration: 0.8, ease: SOFT }}
          className="absolute bottom-12 flex gap-1.5"
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-white/40"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.6, delay: i * 0.25, repeat: Infinity, ease: "easeInOut" }}
            />
          ))}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
