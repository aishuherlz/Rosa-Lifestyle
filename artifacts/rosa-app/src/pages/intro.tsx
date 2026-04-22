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
    }, 3000);

    return () => clearTimeout(timer);
  }, [setHasSeenIntro, user, setLocation]);

  return (
    <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-primary text-primary-foreground overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="text-center"
      >
        <h1 className="text-6xl md:text-8xl font-serif font-medium tracking-wide mb-6">
          ROSA
        </h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.2 }}
          className="text-primary-foreground/80 text-lg md:text-xl font-light tracking-wide italic"
        >
          Ever wondered having all this together?
        </motion.p>
      </motion.div>
    </div>
  );
}
