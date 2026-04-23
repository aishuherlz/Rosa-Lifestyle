import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  Home, HeartPulse, CalendarHeart, Users, Gift, Map, Shirt,
  CalendarDays, Dumbbell, Quote, MessageSquareHeart, Settings,
  Crown, Utensils, ClipboardList, Timer, BookHeart, Target,
  FlameKindling, Sparkles, Mail, Moon, Globe, Activity, FileText,
  Sunrise, AlertCircle, Flower2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FloatingChat } from "@/components/chatbot/floating-chat";
import { useSubscription } from "@/lib/subscription-context";
import { useGarden } from "@/lib/garden-context";
import { useNightMode } from "@/lib/night-mode-context";
import { Badge } from "@/components/ui/badge";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/mood", label: "Mood", icon: HeartPulse },
  { href: "/period", label: "Cycle", icon: CalendarHeart },
  { href: "/partner", label: "Partner", icon: Users },
  { href: "/wishlist", label: "Wishlist", icon: Gift },
  { href: "/travel", label: "Travel", icon: Map },
  { href: "/outfit", label: "Outfits", icon: Shirt },
  { href: "/food", label: "Food", icon: Utensils },
  { href: "/health", label: "Health", icon: Dumbbell },
  { href: "/reminders", label: "Reminders", icon: CalendarDays },
  { href: "/milestones", label: "Milestones", icon: Timer },
  { href: "/journal", label: "Journal", icon: BookHeart },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/challenges", label: "Challenges", icon: FlameKindling },
  { href: "/skin", label: "Skin", icon: Sparkles },
  { href: "/letters", label: "Letters", icon: Mail },
  { href: "/surveys", label: "Surveys", icon: ClipboardList },
  { href: "/quotes", label: "Quotes", icon: Quote },
  { href: "/circles", label: "Circles", icon: Globe },
  { href: "/health-sync", label: "Health Sync", icon: Activity },
  { href: "/report", label: "ROSA Report", icon: FileText },
  { href: "/sanctuary", label: "Sanctuary", icon: Moon },
  { href: "/wisdom", label: "Wisdom", icon: BookHeart },
  { href: "/affirmation", label: "Affirmation", icon: Sunrise },
  { href: "/rose-wall", label: "Rose Wall", icon: Flower2 },
  { href: "/rose-quiz", label: "Rose Quiz", icon: Sparkles },
  { href: "/sos", label: "Period SOS", icon: AlertCircle },
  { href: "/sleep", label: "Sleep", icon: Moon },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { plan, daysLeftInTrial } = useSubscription();
  const { garden } = useGarden();
  const { isNight } = useNightMode();

  const MOBILE_NAV = [
    { href: "/", label: "Home", icon: Home },
    { href: "/mood", label: "Mood", icon: HeartPulse },
    { href: "/period", label: "Cycle", icon: CalendarHeart },
    { href: "/health", label: "Health", icon: Dumbbell },
    { href: "/journal", label: "Journal", icon: BookHeart },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-sidebar h-screen sticky top-0">
        <div className="p-6">
          <h1 className="text-3xl font-serif font-semibold text-primary">ROSA</h1>
          <p className="text-xs text-muted-foreground mt-1 tracking-widest uppercase">Your Sanctuary</p>

          {/* Garden Summary */}
          <div className="mt-3 bg-rose-50 rounded-xl px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">🌹 {garden.roses} roses</span>
            <span className="text-xs text-orange-500 font-medium">🔥 {garden.streak} streak</span>
          </div>

          {isNight && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-violet-500">
              <Moon className="w-3.5 h-3.5" /> Night mode active
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-4 pb-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 cursor-pointer text-sm",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground/70 hover:bg-secondary hover:text-foreground"
                )}>
                  <item.icon className="w-4 h-4 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}

          <div className="pt-3 mt-3 border-t border-border/50 space-y-0.5">
            <Link href="/subscription">
              <div className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 cursor-pointer text-sm",
                location === "/subscription" ? "bg-primary/10 text-primary font-medium" : "text-foreground/70 hover:bg-secondary hover:text-foreground"
              )}>
                <Crown className="w-4 h-4 shrink-0" />
                <span>Premium</span>
                {plan === "trial" && (
                  <Badge className="ml-auto bg-amber-100 text-amber-700 text-xs px-1.5 py-0">{daysLeftInTrial}d left</Badge>
                )}
              </div>
            </Link>
            <Link href="/support">
              <div className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 cursor-pointer text-sm",
                location === "/support" ? "bg-primary/10 text-primary font-medium" : "text-foreground/70 hover:bg-secondary hover:text-foreground"
              )}>
                <MessageSquareHeart className="w-4 h-4 shrink-0" />
                <span>Support</span>
              </div>
            </Link>
            <Link href="/settings">
              <div className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 cursor-pointer text-sm",
                location === "/settings" ? "bg-primary/10 text-primary font-medium" : "text-foreground/70 hover:bg-secondary hover:text-foreground"
              )}>
                <Settings className="w-4 h-4 shrink-0" />
                <span>Settings</span>
              </div>
            </Link>
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 pb-20 md:pb-0 overflow-y-auto max-w-[1200px] mx-auto w-full">
        {children}
      </main>

      {/* Floating AI Chat */}
      <FloatingChat />

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-xl border-t border-border z-40 px-2 py-2 flex justify-around items-center safe-area-pb">
        {MOBILE_NAV.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div className="flex flex-col items-center p-2 cursor-pointer">
                <item.icon
                  className={cn("w-6 h-6 transition-all duration-300", isActive ? "text-primary scale-110" : "text-muted-foreground")}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span className={cn("text-[10px] mt-1 transition-all duration-300", isActive ? "text-primary font-medium" : "text-muted-foreground")}>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
