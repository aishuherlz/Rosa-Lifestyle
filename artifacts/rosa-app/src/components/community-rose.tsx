import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useGarden } from "@/lib/garden-context";

type Stats = { totalCheckIns: number; activeToday: number; goalToday: number; petalsFilled: number };

export function CommunityRose() {
  const [stats, setStats] = useState<Stats | null>(null);
  const { garden } = useGarden();

  async function load() {
    try {
      const r = await fetch("/api/community/stats");
      if (r.ok) setStats(await r.json());
    } catch {}
  }

  async function ping() {
    try {
      await fetch("/api/community/checkin", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      await load();
    } catch {}
  }

  useEffect(() => {
    load();
    const todayKey = `rosa_community_pinged_${new Date().toISOString().split("T")[0]}`;
    if (garden.lastCheckIn === new Date().toISOString().split("T")[0] && !localStorage.getItem(todayKey)) {
      localStorage.setItem(todayKey, "1");
      ping();
    }
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [garden.lastCheckIn]);

  if (!stats) return null;

  const PETAL_COUNT = 48;
  const RINGS = 4;
  const perRing = PETAL_COUNT / RINGS;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50 via-pink-50 to-amber-50 p-5 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">The Community Rose 🌹</p>
          <p className="text-xs text-muted-foreground mt-0.5">Every woman who checks in today blooms a petal</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Active today</p>
          <p className="text-lg font-bold text-rose-600">{stats.activeToday.toLocaleString()}</p>
        </div>
      </div>

      <div className="relative h-44 flex items-center justify-center">
        {/* Center bud */}
        <motion.div
          className="absolute w-12 h-12 rounded-full bg-gradient-to-br from-rose-400 to-pink-600 z-10 shadow-lg shadow-rose-300/50"
          animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 4, repeat: Infinity }}
        />
        <div className="absolute w-14 h-14 rounded-full bg-rose-300/40 blur-xl" />
        {/* Petal rings */}
        {Array.from({ length: RINGS }).map((_, ringIdx) => {
          const radius = 40 + ringIdx * 18;
          const ringStart = ringIdx * perRing;
          const offsetAngle = ringIdx * (180 / perRing);
          return Array.from({ length: perRing }).map((_, i) => {
            const idx = ringStart + i;
            const filled = idx < stats.petalsFilled;
            const angle = (i / perRing) * 360 + offsetAngle;
            const rad = (angle * Math.PI) / 180;
            const x = Math.cos(rad) * radius;
            const y = Math.sin(rad) * radius;
            return (
              <motion.div
                key={`${ringIdx}-${i}`}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: filled ? 1 : 0.18, scale: filled ? 1 : 0.7 }}
                transition={{ delay: idx * 0.01, duration: 0.4 }}
                className="absolute"
                style={{
                  transform: `translate(${x}px, ${y}px) rotate(${angle + 90}deg)`,
                }}
              >
                <div
                  className={`w-3.5 h-5 rounded-full ${
                    filled
                      ? ringIdx < 2
                        ? "bg-gradient-to-b from-rose-500 to-pink-600"
                        : "bg-gradient-to-b from-rose-300 to-pink-400"
                      : "bg-rose-200"
                  }`}
                  style={{ borderRadius: "60% 60% 60% 60% / 90% 90% 30% 30%" }}
                />
              </motion.div>
            );
          });
        })}
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{stats.activeToday} of {stats.goalToday} bloomed today</span>
          <span className="text-rose-600 font-medium">{Math.round((stats.activeToday / stats.goalToday) * 100)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-rose-100 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-rose-400 to-pink-600"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, (stats.activeToday / stats.goalToday) * 100)}%` }}
            transition={{ duration: 0.8 }}
          />
        </div>
        <p className="text-[11px] text-center text-muted-foreground pt-1">
          🌍 <strong className="text-rose-700">{stats.totalCheckIns.toLocaleString()}</strong> women have bloomed with ROSA worldwide
        </p>
      </div>
    </motion.div>
  );
}
