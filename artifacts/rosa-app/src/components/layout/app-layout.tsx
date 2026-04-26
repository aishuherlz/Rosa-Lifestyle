import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Home, HeartPulse, CalendarHeart, Users, Gift, Map, Shirt,
  CalendarDays, Dumbbell, Quote, MessageSquareHeart, Settings,
  Crown, Utensils, ClipboardList, Timer, BookHeart, Target,
  FlameKindling, Sparkles, Mail, Moon, Globe, Activity, FileText,
  Sunrise, AlertCircle, Flower2, Menu, X, MessageCircle, User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FloatingChat, ROSA_TOGGLE_CHAT_EVENT } from "@/components/chatbot/floating-chat";
import { useSubscription } from "@/lib/subscription-context";
import { useGarden } from "@/lib/garden-context";
import { useNightMode } from "@/lib/night-mode-context";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// One source of truth for every page that lives behind the auth wall. Both
// the desktop sidebar and the mobile drawer iterate over this list.
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
  { href: "/friends", label: "Friends", icon: Users },
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

const FOOTER_NAV_ITEMS = [
  { href: "/subscription", label: "Premium", icon: Crown, isPremium: true },
  { href: "/support", label: "Support", icon: MessageSquareHeart },
  { href: "/settings", label: "Settings", icon: Settings },
];

// The 5 most-used destinations on mobile. Per the brief: Home, Rose Wall,
// Chat, Profile, Menu. Chat is special — it doesn't navigate, it dispatches
// an event that pops the floating AI chat. Menu opens the drawer.
type MobileTab =
  | { kind: "link"; href: string; label: string; icon: typeof Home }
  | { kind: "action"; action: "chat" | "menu"; label: string; icon: typeof Home };

const MOBILE_NAV: MobileTab[] = [
  { kind: "link", href: "/", label: "Home", icon: Home },
  { kind: "link", href: "/rose-wall", label: "Rose Wall", icon: Flower2 },
  { kind: "action", action: "chat", label: "Chat", icon: MessageCircle },
  { kind: "link", href: "/settings", label: "Profile", icon: User },
  { kind: "action", action: "menu", label: "Menu", icon: Menu },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { plan, daysLeftInTrial } = useSubscription();
  const { garden } = useGarden();
  const { isNight } = useNightMode();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Auto-close the drawer whenever the route changes — without this it stays
  // open after the user picks a destination.
  useEffect(() => { setDrawerOpen(false); }, [location]);

  // Lock background scroll while the drawer is open (Radix Sheet handles
  // focus, but iOS still scrolls under the overlay otherwise).
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [drawerOpen]);

  // Toggle (not just open) so a second tap on the bottom-nav Chat tab closes
  // the panel — the FAB is hidden on mobile, so without this users had no
  // way to dismiss the chat from the nav.
  const triggerChat = () => {
    window.dispatchEvent(new CustomEvent(ROSA_TOGGLE_CHAT_EVENT));
  };

  // ---- Pieces that get reused in both the desktop and drawer sidebars ----
  const NavLink = ({
    item,
    collapsed = false,
  }: {
    item: { href: string; label: string; icon: typeof Home };
    collapsed?: boolean;
  }) => {
    const isActive = location === item.href;
    const inner = (
      <div
        className={cn(
          "flex items-center gap-3 rounded-md transition-all duration-200 cursor-pointer text-sm",
          collapsed ? "justify-center px-2 py-3" : "px-3 py-2.5",
          isActive
            ? "bg-primary/10 text-primary font-medium"
            : "text-foreground/70 hover:bg-secondary hover:text-foreground"
        )}
        data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <item.icon className="w-4 h-4 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
        {!collapsed && <span>{item.label}</span>}
      </div>
    );
    if (collapsed) {
      // Tooltip text isn't a reliable accessible name for screen readers,
      // so we always set aria-label on the anchor itself when collapsed.
      return (
        <Tooltip delayDuration={150}>
          <TooltipTrigger asChild>
            <Link href={item.href} aria-label={item.label}>{inner}</Link>
          </TooltipTrigger>
          <TooltipContent side="right">{item.label}</TooltipContent>
        </Tooltip>
      );
    }
    return <Link href={item.href}>{inner}</Link>;
  };

  const FooterNavLink = ({
    item,
    collapsed = false,
  }: {
    item: typeof FOOTER_NAV_ITEMS[number];
    collapsed?: boolean;
  }) => {
    const isActive = location === item.href;
    const inner = (
      <div
        className={cn(
          "flex items-center gap-3 rounded-md transition-all duration-200 cursor-pointer text-sm",
          collapsed ? "justify-center px-2 py-3" : "px-3 py-2.5",
          isActive
            ? "bg-primary/10 text-primary font-medium"
            : "text-foreground/70 hover:bg-secondary hover:text-foreground"
        )}
      >
        <item.icon className="w-4 h-4 shrink-0" />
        {!collapsed && <span>{item.label}</span>}
        {!collapsed && item.isPremium && plan === "trial" && (
          <Badge className="ml-auto bg-amber-100 text-amber-700 text-xs px-1.5 py-0">
            {daysLeftInTrial}d left
          </Badge>
        )}
      </div>
    );
    if (collapsed) {
      // Mirror the primary NavLink: aria-label is the accessible name; tooltip is visual.
      return (
        <Tooltip delayDuration={150}>
          <TooltipTrigger asChild>
            <Link href={item.href} aria-label={item.label}>{inner}</Link>
          </TooltipTrigger>
          <TooltipContent side="right">{item.label}</TooltipContent>
        </Tooltip>
      );
    }
    return <Link href={item.href}>{inner}</Link>;
  };

  // The big shared sidebar body — `collapsed` flips it to an icons-only rail
  // for the tablet (md→lg) breakpoint per the brief.
  const SidebarBody = ({ collapsed = false }: { collapsed?: boolean }) => (
    <>
      <div className={cn("border-b border-border/50", collapsed ? "p-3 text-center" : "p-6")}>
        {collapsed ? (
          <h1 className="text-2xl font-serif font-semibold text-primary">R</h1>
        ) : (
          <>
            <h1 className="text-3xl font-serif font-semibold text-primary">ROSA</h1>
            <p className="text-xs text-muted-foreground mt-1 tracking-widest uppercase">
              Your Sanctuary
            </p>
            <div className="mt-3 bg-rose-50 dark:bg-rose-950/30 rounded-xl px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">🌹 {garden.roses} roses</span>
              <span className="text-xs text-orange-500 font-medium">🔥 {garden.streak} streak</span>
            </div>
            {isNight && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-violet-500">
                <Moon className="w-3.5 h-3.5" /> Night mode active
              </div>
            )}
          </>
        )}
      </div>

      <nav className={cn("flex-1 overflow-y-auto pb-2 space-y-0.5", collapsed ? "px-2 pt-2" : "px-4 pt-2")}>
        {NAV_ITEMS.map((item) => <NavLink key={item.href} item={item} collapsed={collapsed} />)}

        <div className="pt-3 mt-3 border-t border-border/50 space-y-0.5">
          {FOOTER_NAV_ITEMS.map((item) => (
            <FooterNavLink key={item.href} item={item} collapsed={collapsed} />
          ))}
        </div>
      </nav>
    </>
  );

  return (
    <div className="min-h-[100dvh] flex flex-col lg:flex-row bg-background">
      {/* ---- Desktop sidebar (lg+, full labels) ---- */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-sidebar h-screen sticky top-0">
        <SidebarBody />
      </aside>

      {/* ---- Tablet rail (md to lg, icons only with hover tooltips) ---- */}
      <aside className="hidden md:flex lg:hidden w-16 flex-col border-r border-border bg-sidebar h-screen sticky top-0">
        <SidebarBody collapsed />
      </aside>

      {/* ---- Mobile top header (<md) ---- */}
      <header className="md:hidden sticky top-0 z-40 bg-background/85 backdrop-blur-xl border-b border-border/60 pt-safe">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            className="p-2 -ml-2 rounded-md hover:bg-secondary active:bg-secondary/80 min-h-11 min-w-11 flex items-center justify-center"
            data-testid="mobile-menu-trigger"
          >
            <Menu className="w-5 h-5" strokeWidth={2.2} />
          </button>
          <Link href="/">
            <div className="cursor-pointer flex items-baseline gap-2">
              <span className="text-2xl font-serif font-semibold text-primary leading-none">ROSA</span>
              <span className="text-[10px] text-muted-foreground tracking-widest uppercase hidden sm:inline">
                Your Sanctuary
              </span>
            </div>
          </Link>
          <Link href="/">
            <div className="cursor-pointer flex items-center gap-1 bg-rose-50 dark:bg-rose-950/40 rounded-full px-2.5 py-1 text-xs">
              <span>🌹</span>
              <span className="font-medium text-rose-700 dark:text-rose-300">{garden.roses}</span>
              <span className="text-orange-500 ml-1">🔥{garden.streak}</span>
            </div>
          </Link>
        </div>
      </header>

      {/* ---- Mobile slide-in drawer ---- */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="left"
          className="w-[85vw] max-w-[320px] p-0 flex flex-col bg-sidebar"
          // Default Sheet adds its own close button — that's fine; the
          // overlay also closes on outside click per the brief.
        >
          <SheetTitle className="sr-only">ROSA navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Navigate to any part of your ROSA sanctuary.
          </SheetDescription>
          <SidebarBody />
        </SheetContent>
      </Sheet>

      {/* ---- Main content ---- */}
      <main
        className={cn(
          "flex-1 overflow-y-auto w-full mx-auto",
          // Account for the fixed bottom nav on mobile so content isn't
          // hidden behind it, plus safe-area for iPhones.
          "pb-[calc(72px+env(safe-area-inset-bottom,0px))] md:pb-0",
          "max-w-[1200px]"
        )}
      >
        {children}
      </main>

      {/* Floating AI chat. Mounted once. The FAB itself is hidden on mobile
          via Tailwind classes (hidden md:flex) — on mobile the bottom-nav
          "Chat" tab dispatches `rosa:open-chat` to open the same panel. */}
      <FloatingChat />

      {/* ---- Mobile bottom navigation (<md) ---- */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-xl border-t border-border z-40 px-1 py-1 grid grid-cols-5 items-stretch pb-safe"
        aria-label="Primary"
      >
        {MOBILE_NAV.map((item) => {
          const isActive = item.kind === "link" && location === item.href;
          const Inner = (
            <div
              className={cn(
                "flex flex-col items-center justify-center min-h-12 px-1 cursor-pointer rounded-lg transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon
                className={cn("w-5 h-5 transition-transform", isActive && "scale-110")}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className={cn("text-[10px] mt-0.5 font-medium leading-tight", isActive ? "text-primary" : "text-muted-foreground")}>
                {item.label}
              </span>
            </div>
          );
          if (item.kind === "link") {
            return <Link key={item.label} href={item.href}>{Inner}</Link>;
          }
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                if (item.action === "chat") triggerChat();
                if (item.action === "menu") setDrawerOpen(true);
              }}
              className="contents"
              data-testid={`mobile-nav-${item.action}`}
              aria-label={item.label}
            >
              {Inner}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
