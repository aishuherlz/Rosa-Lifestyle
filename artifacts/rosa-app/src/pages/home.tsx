import { useEffect, useState } from "react";
import { useUser } from "@/lib/user-context";
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
  CalendarDays
} from "lucide-react";

export default function Home() {
  const { user } = useUser();
  const [weather, setWeather] = useState<{ temp: number; code: number } | null>(null);

  useEffect(() => {
    // Simple weather fetch using geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode`);
            const data = await res.json();
            if (data.current) {
              setWeather({
                temp: Math.round(data.current.temperature_2m),
                code: data.current.weathercode
              });
            }
          } catch (e) {
            console.error("Failed to fetch weather", e);
          }
        },
        () => console.log("Geolocation denied")
      );
    }
  }, []);

  const getWeatherIcon = (code: number) => {
    if (code <= 3) return <Sun className="w-8 h-8 text-amber-500" />;
    if (code <= 48) return <Cloud className="w-8 h-8 text-slate-400" />;
    if (code <= 67) return <CloudRain className="w-8 h-8 text-blue-400" />;
    return <Wind className="w-8 h-8 text-slate-500" />;
  };

  const today = new Date();
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 md:p-10 space-y-8 max-w-4xl mx-auto"
    >
      {/* Header Section */}
      <header className="flex justify-between items-end">
        <div className="space-y-1">
          <p className="text-muted-foreground uppercase tracking-widest text-xs font-medium">
            {format(today, "EEEE, MMMM do")}
          </p>
          <h1 className="text-4xl md:text-5xl font-serif text-foreground">
            Good morning,<br/>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/mood">
          <div className="bg-card hover:bg-primary/5 transition-colors p-6 rounded-3xl border border-border/50 shadow-sm flex flex-col items-center justify-center gap-3 cursor-pointer group">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
              <HeartPulse className="w-6 h-6" />
            </div>
            <span className="font-medium text-sm">Log Mood</span>
          </div>
        </Link>
        <Link href="/period">
          <div className="bg-card hover:bg-primary/5 transition-colors p-6 rounded-3xl border border-border/50 shadow-sm flex flex-col items-center justify-center gap-3 cursor-pointer group">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
              <Droplets className="w-6 h-6" />
            </div>
            <span className="font-medium text-sm">Cycle Day 14</span>
          </div>
        </Link>
        <Link href="/reminders">
          <div className="bg-card hover:bg-primary/5 transition-colors p-6 rounded-3xl border border-border/50 shadow-sm flex flex-col items-center justify-center gap-3 cursor-pointer group">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
              <CalendarDays className="w-6 h-6" />
            </div>
            <span className="font-medium text-sm">3 Reminders</span>
          </div>
        </Link>
        <Link href="/partner">
          <div className="bg-card hover:bg-primary/5 transition-colors p-6 rounded-3xl border border-border/50 shadow-sm flex flex-col items-center justify-center gap-3 cursor-pointer group">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
              <CalendarHeart className="w-6 h-6" />
            </div>
            <span className="font-medium text-sm">Partner Sync</span>
          </div>
        </Link>
      </div>
      
    </motion.div>
  );
}
