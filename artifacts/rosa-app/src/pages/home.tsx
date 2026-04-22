import { useEffect, useState } from "react";
import { useUser } from "@/lib/user-context";
import { useSubscription } from "@/lib/subscription-context";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  CloudRain,
  Sun,
  Cloud,
  Wind,
  HeartPulse,
  CalendarHeart,
  Droplets,
  CalendarDays,
  Utensils,
  Dumbbell,
  ClipboardList,
  Crown,
  Shirt,
  Map,
  Timer,
  Gift,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  const { user } = useUser();
  const { plan, daysLeftInTrial, isPremium } = useSubscription();
  const [weather, setWeather] = useState<{ temp: number; code: number; city?: string } | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const res = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode`
            );
            const data = await res.json();
            if (data.current) {
              setWeather({ temp: Math.round(data.current.temperature_2m), code: data.current.weathercode });
            }
          } catch {}
        },
        () => {}
      );
    }
  }, []);

  const getWeatherIcon = (code: number) => {
    if (code <= 3) return <Sun className="w-8 h-8 text-amber-500" />;
    if (code <= 48) return <Cloud className="w-8 h-8 text-slate-400" />;
    if (code <= 67) return <CloudRain className="w-8 h-8 text-blue-400" />;
    return <Wind className="w-8 h-8 text-slate-500" />;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const today = new Date();

  const QUICK_LINKS = [
    { href: "/mood", label: "Log Mood", icon: HeartPulse, color: "text-rose-500 bg-rose-50" },
    { href: "/period", label: "Cycle", icon: Droplets, color: "text-pink-500 bg-pink-50" },
    { href: "/reminders", label: "Reminders", icon: CalendarDays, color: "text-violet-500 bg-violet-50" },
    { href: "/partner", label: "Partner", icon: CalendarHeart, color: "text-rose-400 bg-rose-50" },
    { href: "/food", label: "Food", icon: Utensils, color: "text-amber-500 bg-amber-50", premium: true },
    { href: "/health", label: "Health", icon: Dumbbell, color: "text-emerald-500 bg-emerald-50" },
    { href: "/outfit", label: "Outfits", icon: Shirt, color: "text-fuchsia-500 bg-fuchsia-50", premium: true },
    { href: "/travel", label: "Travel", icon: Map, color: "text-sky-500 bg-sky-50", premium: true },
    { href: "/milestones", label: "Milestones", icon: Timer, color: "text-indigo-500 bg-indigo-50" },
    { href: "/wishlist", label: "Wishlist", icon: Gift, color: "text-orange-500 bg-orange-50" },
    { href: "/surveys", label: "Surveys", icon: ClipboardList, color: "text-teal-500 bg-teal-50" },
    { href: "/subscription", label: "Premium", icon: Crown, color: "text-amber-600 bg-amber-50" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 md:p-10 space-y-8 max-w-4xl mx-auto"
    >
      {/* Header */}
      <header className="flex justify-between items-end">
        <div className="space-y-1">
          <p className="text-muted-foreground uppercase tracking-widest text-xs font-medium">
            {format(today, "EEEE, MMMM do")}
          </p>
          <h1 className="text-4xl md:text-5xl font-serif text-foreground">
            {getGreeting()},<br />
            <span className="text-primary italic">{user?.name || "Beautiful"}</span>
          </h1>
        </div>

        {weather && (
          <div className="flex items-center gap-3 bg-card p-3 rounded-2xl border border-border/50 shadow-sm">
            {getWeatherIcon(weather.code)}
            <span className="text-xl font-light">{weather.temp}°</span>
          </div>
        )}
      </header>

      {/* Trial / Subscription Banner */}
      {plan === "trial" && daysLeftInTrial <= 7 && (
        <Link href="/subscription">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl px-5 py-3 cursor-pointer hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3">
              <Crown className="w-5 h-5 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-900">{daysLeftInTrial} days left in your free trial</p>
                <p className="text-xs text-amber-700">Subscribe for $5/mo or $50/yr to keep full access</p>
              </div>
            </div>
            <span className="text-xs text-amber-700 font-medium">View →</span>
          </motion.div>
        </Link>
      )}
      {plan === "expired" && (
        <Link href="/subscription">
          <motion.div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-2xl px-5 py-3 cursor-pointer hover:shadow-md transition-all">
            <div className="flex items-center gap-3">
              <Crown className="w-5 h-5 text-muted-foreground" />
              <p className="text-sm text-gray-700">Your free trial has ended — subscribe to continue</p>
            </div>
            <span className="text-xs text-gray-600 font-medium">Subscribe →</span>
          </motion.div>
        </Link>
      )}

      {/* Daily Quote Card */}
      <section className="relative overflow-hidden rounded-3xl bg-secondary/30 p-8 border border-primary/10">
        <div className="absolute top-0 right-0 p-8 opacity-5 text-primary">
          <svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
          </svg>
        </div>
        <div className="relative z-10 max-w-2xl">
          <h3 className="text-2xl md:text-3xl font-serif leading-snug text-foreground/90">
            "A woman is the full circle. Within her is the power to create, nurture and transform."
          </h3>
          <p className="mt-4 text-sm tracking-widest uppercase text-muted-foreground">Diane Mariechild</p>
        </div>
      </section>

      {/* Quick Actions Grid */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3 font-medium">Quick Access</p>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {QUICK_LINKS.map((item) => (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileTap={{ scale: 0.94 }}
                className="bg-card hover:bg-muted/40 transition-colors p-4 rounded-2xl border border-border/50 shadow-sm flex flex-col items-center justify-center gap-2 cursor-pointer group relative"
              >
                {item.premium && !isPremium && (
                  <span className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full bg-amber-400" />
                )}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform ${item.color}`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <span className="font-medium text-xs text-center leading-tight">{item.label}</span>
              </motion.div>
            </Link>
          ))}
        </div>
      </div>

      {/* Founder Note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="rounded-2xl border border-border/40 bg-card px-6 py-5 text-center"
      >
        <p className="text-sm text-muted-foreground italic leading-relaxed">
          ROSA was built by our founder Aiswarya Saji — a woman who struggled just like you, and created this space so you never have to feel alone.
        </p>
      </motion.div>
    </motion.div>
  );
}
