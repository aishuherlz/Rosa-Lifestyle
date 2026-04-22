import { useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useUser } from "@/lib/user-context";

export default function Intro() {
  const [, setLocation] = useLocation();
  const { setHasSeenIntro, user } = useUser();

  useEffect(() => {
    const timer = setTimeout(() => {
      setHasSeenIntro(true);
      if (user) {
        setLocation("/");
      } else {
        setLocation("/sign-in");
      }
    }, 4500);

    return () => clearTimeout(timer);
  }, [setHasSeenIntro, user, setLocation]);

  return (
    <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-primary text-primary-foreground overflow-hidden px-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.4, ease: "easeOut" }}
        className="text-center"
      >
        <motion.h1
          className="text-7xl md:text-9xl font-serif font-medium tracking-wide mb-5"
          animate={{ opacity: [0, 1], y: [20, 0] }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        >
          ROSA
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.3 }}
          className="text-primary-foreground/90 text-lg md:text-xl font-light tracking-wide italic mb-4"
        >
          An app made for women, by women
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 2.2 }}
          className="text-primary-foreground/65 text-sm md:text-base font-light max-w-xs mx-auto leading-relaxed"
        >
          Built by our founder Aiswarya Saji — a woman who struggled just like you, and made ROSA for you.
        </motion.p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 3.2 }}
        className="absolute bottom-12 flex flex-col items-center gap-2"
      >
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-primary-foreground/40"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
