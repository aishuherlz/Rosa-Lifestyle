import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { 
  Home, 
  HeartPulse, 
  CalendarHeart, 
  Users, 
  Gift, 
  Map, 
  Shirt, 
  CalendarDays,
  Dumbbell,
  Quote,
  MessageSquareHeart,
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/mood", label: "Mood", icon: HeartPulse },
  { href: "/period", label: "Cycle", icon: CalendarHeart },
  { href: "/partner", label: "Partner", icon: Users },
  { href: "/wishlist", label: "Wishlist", icon: Gift },
  { href: "/travel", label: "Travel", icon: Map },
  { href: "/outfit", label: "Outfits", icon: Shirt },
  { href: "/reminders", label: "Reminders", icon: CalendarDays },
  { href: "/milestones", label: "Milestones", icon: CalendarHeart },
  { href: "/health", label: "Health", icon: Dumbbell },
  { href: "/quotes", label: "Quotes", icon: Quote },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  // Mobile Bottom Nav items (just a few key ones)
  const MOBILE_NAV = [
    { href: "/", label: "Home", icon: Home },
    { href: "/mood", label: "Mood", icon: HeartPulse },
    { href: "/period", label: "Cycle", icon: CalendarHeart },
    { href: "/reminders", label: "Reminders", icon: CalendarDays },
    { href: "/health", label: "Health", icon: Dumbbell },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-sidebar h-screen sticky top-0">
        <div className="p-6">
          <h1 className="text-3xl font-serif font-semibold text-primary">ROSA</h1>
          <p className="text-xs text-muted-foreground mt-1 tracking-widest uppercase">Your Sanctuary</p>
        </div>
        
        <nav className="flex-1 overflow-y-auto px-4 pb-6 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-300 cursor-pointer",
                  isActive 
                    ? "bg-primary/10 text-primary font-medium" 
                    : "text-foreground/70 hover:bg-secondary hover:text-foreground"
                )}>
                  <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}
          
          <div className="pt-6 mt-6 border-t border-border/50">
            <Link href="/support">
              <div className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-300 cursor-pointer",
                location === "/support" ? "bg-primary/10 text-primary font-medium" : "text-foreground/70 hover:bg-secondary hover:text-foreground"
              )}>
                <MessageSquareHeart className="w-5 h-5" />
                <span>Support</span>
              </div>
            </Link>
            <Link href="/settings">
              <div className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-300 cursor-pointer",
                location === "/settings" ? "bg-primary/10 text-primary font-medium" : "text-foreground/70 hover:bg-secondary hover:text-foreground"
              )}>
                <Settings className="w-5 h-5" />
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

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-xl border-t border-border z-50 px-2 py-2 flex justify-around items-center safe-area-pb">
        {MOBILE_NAV.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div className="flex flex-col items-center p-2 cursor-pointer">
                <item.icon 
                  className={cn(
                    "w-6 h-6 transition-all duration-300", 
                    isActive ? "text-primary scale-110" : "text-muted-foreground"
                  )} 
                  strokeWidth={isActive ? 2.5 : 2} 
                />
                <span className={cn(
                  "text-[10px] mt-1 transition-all duration-300",
                  isActive ? "text-primary font-medium" : "text-muted-foreground"
                )}>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
