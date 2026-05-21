import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Heart, Bell, BookOpen, Gift, ChevronRight, Link2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser } from "@/lib/user-context";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api";
import { useLocalStorage } from "@/hooks/use-local-storage";

const PHASE_GUIDE = {
  menstrual: {
    name: "Period Phase 🌑",
    days: "Days 1-5",
    goddesTitle: "Rest & Restore Queen",
    color: "bg-rose-50 border-rose-200",
    titleColor: "text-rose-700",
    mood: "She may feel low energy, crampy, and emotional. This is her body working hard.",
    doList: [
      "Bring her a heating pad or hot water bottle 🔥",
      "Make her favourite warm drink without being asked ☕",
      "Handle extra chores without mentioning it 🏠",
      "Watch her favourite show/movie with her 🎬",
      "Give her space if she needs it — dont take it personally",
      "Order her favourite comfort food 🍕",
      "Gentle back or foot massage if she wants touch 💆",
      "Tell her she is doing amazing just by existing today",
    ],
    dontList: [
      "Dont say 'its just a period' — it can be genuinely painful",
      "Dont plan big social events these days",
      "Dont comment on her food choices",
      "Dont take mood personally — its hormonal",
    ],
    essentials: ["Dark chocolate", "Heating pad", "Her favourite snacks", "Comfortable clothes", "Pain relief medication"],
    affirmation: "You are doing amazingly by simply showing up for her today. She notices. 🌹",
    videoTitle: "Understanding the menstrual phase",
    videoUrl: "https://www.youtube.com/results?search_query=menstrual+phase+understanding+partners",
  },
  follicular: {
    name: "Follicular Phase 🌱",
    days: "Days 6-13",
    goddesTitle: "Fresh Start Energy",
    color: "bg-emerald-50 border-emerald-200",
    titleColor: "text-emerald-700",
    mood: "She is feeling energetic, creative, and optimistic. Great time for adventures!",
    doList: [
      "Plan a date or activity together — she will be up for it! 🎉",
      "Have important conversations now — she is clear-headed",
      "Encourage her new ideas and projects 💡",
      "Be playful and fun — she matches that energy",
      "Try something new together 🌍",
      "Compliment her energy and brightness ✨",
    ],
    dontList: [
      "Dont hold back on plans — she wants to do things",
      "Dont be boring — match her energy",
    ],
    essentials: ["Date night plans", "New experiences", "Fresh flowers 🌸"],
    affirmation: "This is her superpower phase — celebrate her brightness! ✨",
    videoTitle: "Making the most of the follicular phase together",
    videoUrl: "https://www.youtube.com/results?search_query=follicular+phase+relationship+tips",
  },
  ovulation: {
    name: "Ovulation Phase ✨",
    days: "Days 14-16",
    goddesTitle: "In Your Power Era",
    color: "bg-yellow-50 border-yellow-200",
    titleColor: "text-yellow-700",
    mood: "She is at her most confident, social, and magnetic. She glows this week.",
    doList: [
      "Tell her she looks amazing — she really does 😍",
      "Be more romantic and intentional this week 💕",
      "Show extra affection and attention",
      "Plan something special — she will remember it",
      "Engage in deep meaningful conversations",
      "Be her biggest cheerleader 📣",
    ],
    dontList: [
      "Dont ignore her during her peak energy",
      "Dont be distant — she craves connection now",
    ],
    essentials: ["Romance", "Quality time", "Genuine compliments 💫"],
    affirmation: "She is literally glowing right now — make sure she knows you see it. 💛",
    videoTitle: "Connecting during the ovulation phase",
    videoUrl: "https://www.youtube.com/results?search_query=ovulation+phase+relationship+connection",
  },
  luteal: {
    name: "Luteal / PMS Phase 💜",
    days: "Days 17-28",
    goddesTitle: "Warrior Mode",
    color: "bg-purple-50 border-purple-200",
    titleColor: "text-purple-700",
    mood: "She may feel more sensitive, anxious, or irritable. She needs extra patience and gentleness.",
    doList: [
      "Be extra patient — she is fighting her own hormones 💜",
      "Ask how she is feeling without needing to fix it",
      "Reduce her mental load — take things off her plate",
      "Validate her feelings even if they seem intense",
      "Offer comfort without judgment",
      "Make sure she has her favourite snacks 🍫",
      "Gentle check-ins: 'How can I support you today?'",
      "Create a calm and peaceful environment at home",
    ],
    dontList: [
      "Dont say 'are you PMSing?' — ever",
      "Dont dismiss her feelings as hormonal",
      "Dont start arguments during this phase",
      "Dont add to her stress",
    ],
    essentials: ["Patience", "Dark chocolate 🍫", "Her comfort items", "Zero judgment"],
    affirmation: "Your patience this week is one of the most loving things you can do. She sees it. 💜",
    videoTitle: "Supporting your partner through PMS",
    videoUrl: "https://www.youtube.com/results?search_query=supporting+partner+PMS+luteal+phase",
  },
};

const ULTIMATE_GUIDE = [
  { title: "Listen more than you speak", desc: "When she vents, she often just wants to be heard — not for you to solve it. Try: 'That sounds really hard. I am here.'", emoji: "👂" },
  { title: "Learn her cycle", desc: "Knowing her phases is one of the most caring things you can do. It helps you show up for her at the right moments.", emoji: "📅" },
  { title: "Acts of service speak loudly", desc: "Doing chores, cooking, or running errands without being asked shows love without words.", emoji: "🏠" },
  { title: "Consistency over grand gestures", desc: "Showing up every day matters more than one big romantic moment.", emoji: "💪" },
  { title: "Respect her boundaries", desc: "When she says she needs space, give it without making her feel guilty.", emoji: "🛡️" },
  { title: "Celebrate her wins", desc: "Even small ones. Be her loudest cheerleader.", emoji: "🎉" },
  { title: "Physical affection matters", desc: "Ask what kind of touch she needs — sometimes its a hug, sometimes just sitting close.", emoji: "🤗" },
  { title: "Check in, not check up", desc: "'How are you feeling today?' vs 'What did you do today?' — feel the difference.", emoji: "💬" },
];

export default function PartnerPage() {
  const { user, getAuthHeaders } = useUser();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [livePartnerData, setLivePartnerData] = useState<any>(null);
  const [partnerData, setPartnerData] = useLocalStorage<any>("rosa_partner", null);
  const [activePhase, setActivePhase] = useState<keyof typeof PHASE_GUIDE>("menstrual");
  const [tab, setTab] = useState("guide");
  const isMale = user?.gender?.toLowerCase() === "male" || user?.gender?.toLowerCase() === "man";
  const isPartnerUser = isMale || user?.gender?.toLowerCase() === "non-binary" || user?.gender?.toLowerCase() === "inclusive";
  const [sharePrefs, setSharePrefs] = useLocalStorage<Record<string, boolean>>("rosa_share_prefs_v2", {
    cycle: false, mood: false, wishlist: false, milestones: false,
    fitness: false, travel: false, food: false, skin: false, sleep: false, journal: false, goals: false
  });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [linkCode, setLinkCode] = useState("");
  const [linking, setLinking] = useState(false);

  const linkPartner = async () => {
    if (!linkCode.trim()) return;
    setLinking(true);
    try {
      const res = await fetch(apiUrl("/api/partner/link"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ partnerInviteCode: linkCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not link");
      toast({ title: `Linked with ${data.partnerName}! 🌹`, description: "You are now connected on ROSA." });
      setLinkCode("");
      fetchPartnerData();
    } catch (err: any) {
      toast({ title: "Linking failed", description: err.message, variant: "destructive" });
    }
    setLinking(false);
  };

  const fetchPartnerData = async () => {
    try {
      const res = await fetch(apiUrl("/api/partner/shared-data"), { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.linked) {
        setLivePartnerData(data);
        // Sync to local storage for other components
        setPartnerData({
          partnerName: data.partner?.name,
          partnerNickname: data.partner?.nickname,
          linked: true
        });
      } else {
        setPartnerData(null);
      }
    } catch {}
  };

  const saveSharePrefs = async () => {
    setSavingPrefs(true);
    try {
      if (livePartnerData?.partner) {
        const res = await fetch(apiUrl("/api/partner/share-prefs"), {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({
            shareCycle: sharePrefs.cycle, shareMood: sharePrefs.mood,
            shareWishlist: sharePrefs.wishlist, shareMilestones: sharePrefs.milestones,
            shareFitness: sharePrefs.fitness, shareSleep: sharePrefs.sleep,
            shareSkin: sharePrefs.skin, shareTravel: sharePrefs.travel,
            shareFood: sharePrefs.food, shareJournal: sharePrefs.journal,
            shareGoals: sharePrefs.goals,
          }),
        });
        if (!res.ok) throw new Error("Could not save preferences");
      }
      toast({ title: "Sharing preferences saved! 🌹", description: "Your partner will see your selected data." });
    } catch {
      toast({ title: "Error", description: "Could not save preferences", variant: "destructive" });
    }
    setSavingPrefs(false);
  };

  useEffect(() => {
    if (user?.authToken) {
      fetchNotifications();
      fetchPartnerData();
      
      // Polling for real-time updates (e.g. if partner accepts link while we are on the page)
      const interval = setInterval(() => {
        fetchPartnerData();
        fetchNotifications();
      }, 10000); // 10 seconds
      
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch(apiUrl("/api/partner/notifications"), { headers: getAuthHeaders() });
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch {}
  };

  const markRead = async (id: string) => {
    try {
      await fetch(apiUrl(`/api/partner/notifications/${id}/read`), { method: "PUT", headers: getAuthHeaders() });
      setNotifications(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
    } catch {}
  };

  const phase = PHASE_GUIDE[activePhase];
  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-playfair text-[#8B4F6E] font-bold">
            {isPartnerUser ? "Partner Dashboard 💑" : "Partner & Sharing 🌹"}
          </h1>
          <p className="text-sm text-[#9E7B8A]">
            {isPartnerUser ? "Supporting her journey" : "Connect and share with your partner"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Badge className="bg-[#B06B8B] text-white">{unreadCount} new</Badge>
        )}
      </div>

      {/* My Partner Code */}
      {user?.partnerInviteCode && (
        <Card className="border-[#B06B8B] bg-gradient-to-r from-[#FBEAF0] to-[#FDF6F0]">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-[#9E7B8A] font-medium uppercase tracking-wider mb-1">Your Partner Code</p>
              <p className="text-xl font-mono font-bold text-[#6B3050] tracking-[0.2em]">{user.partnerInviteCode}</p>
            </div>
            <Button
              variant="outline" size="sm"
              className="border-[#B06B8B] text-[#B06B8B] hover:bg-[#B06B8B] hover:text-white"
              onClick={() => {
                navigator.clipboard.writeText(user.partnerInviteCode || "");
                toast({ title: "Copied!", description: "Partner code copied to clipboard 🌹" });
              }}
            >Copy</Button>
          </CardContent>
        </Card>
      )}

      {/* Universal Linking Input — shown to ALL users not yet linked */}
      {!livePartnerData?.linked && (
        <Card className="border-[#D4A574] bg-gradient-to-r from-[#FDF6F0] to-[#FBEAF0]">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[#B06B8B]" />
              <p className="text-sm font-semibold text-[#6B3050]">Connect with your partner</p>
            </div>
            <p className="text-xs text-[#9E7B8A]">Enter your partner's invite code to link your accounts and share selected data.</p>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. ABC-123456"
                value={linkCode}
                onChange={e => setLinkCode(e.target.value)}
                className="border-[#E8C4B8] font-mono text-sm"
              />
              <Button
                onClick={linkPartner} disabled={linking || !linkCode.trim()}
                className="bg-[#B06B8B] text-white shrink-0"
              >
                {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Linked partner banner */}
      {livePartnerData?.linked && (
        <Card className="border-emerald-300 bg-emerald-50">
          <CardContent className="p-3 flex items-center gap-3">
            <span className="text-2xl">💑</span>
            <div>
              <p className="text-sm font-semibold text-emerald-800">Linked with {livePartnerData.partner?.name}</p>
              <p className="text-xs text-emerald-600">You're connected on ROSA 🌹</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full bg-[#FDF6F0] border border-[#E8C4B8]">
          <TabsTrigger value="guide" className="flex-1 text-xs">Partner Guide</TabsTrigger>
          <TabsTrigger value="phases" className="flex-1 text-xs">Phase Tips</TabsTrigger>
          <TabsTrigger value="notifications" className="flex-1 text-xs">
            Notifications {unreadCount > 0 && `(${unreadCount})`}
          </TabsTrigger>
          <TabsTrigger value="partner-shared" className="flex-1 text-xs">Their Data</TabsTrigger>
          <TabsTrigger value="sharing" className="flex-1 text-xs">Sharing</TabsTrigger>
        </TabsList>

        <TabsContent value="guide" className="space-y-3 mt-4">
          <Card className="border-[#E8C4B8] bg-gradient-to-br from-[#FDF6F0] to-[#FBEAF0]">
            <CardContent className="pt-4">
              <p className="text-[#8B4F6E] font-playfair text-lg font-bold mb-1">The Ultimate Partner Guide 🌹</p>
              <p className="text-sm text-[#9E7B8A] mb-4">Small things done consistently make all the difference.</p>
              <div className="space-y-3">
                {ULTIMATE_GUIDE.map((item, i) => (
                  <div key={i} className="flex gap-3 p-3 bg-white rounded-xl border border-[#E8C4B8]">
                    <span className="text-2xl">{item.emoji}</span>
                    <div>
                      <p className="font-medium text-[#6B3050] text-sm">{item.title}</p>
                      <p className="text-xs text-[#9E7B8A] mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="phases" className="space-y-3 mt-4">
          <p className="text-sm text-[#9E7B8A]">Select her current phase to see how to support her today:</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(PHASE_GUIDE) as Array<keyof typeof PHASE_GUIDE>).map(p => (
              <button key={p} onClick={() => setActivePhase(p)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  activePhase === p ? "border-[#B06B8B] bg-[#FBEAF0]" : "border-[#E8C4B8] bg-white"
                }`}>
                <p className="font-medium text-[#6B3050] text-sm">{PHASE_GUIDE[p].name}</p>
                <p className="text-xs text-[#9E7B8A]">{PHASE_GUIDE[p].days}</p>
              </button>
            ))}
          </div>

          <Card className={`border ${phase.color}`}>
            <CardHeader className="pb-2">
              <CardTitle className={`${phase.titleColor} text-lg`}>{phase.name}</CardTitle>
              <Badge className="w-fit bg-[#D4A574] text-[#6B3050]">{phase.goddesTitle}</Badge>
              <p className="text-sm text-[#9E7B8A] mt-1">{phase.mood}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-medium text-[#6B3050] text-sm mb-2">✅ Do this:</p>
                <ul className="space-y-1">
                  {phase.doList.map((item, i) => (
                    <li key={i} className="text-sm text-[#9E7B8A] flex gap-2">
                      <span>•</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-medium text-rose-600 text-sm mb-2">❌ Avoid this:</p>
                <ul className="space-y-1">
                  {phase.dontList.map((item, i) => (
                    <li key={i} className="text-sm text-[#9E7B8A] flex gap-2">
                      <span>•</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-medium text-[#6B3050] text-sm mb-2">🛒 Essentials to have ready:</p>
                <div className="flex flex-wrap gap-2">
                  {phase.essentials.map((item, i) => (
                    <Badge key={i} className="bg-[#F5E6D3] text-[#6B3050] border border-[#E8C4B8]">{item}</Badge>
                  ))}
                </div>
              </div>
              <div className="p-3 bg-[#FDF6F0] rounded-xl border border-[#E8C4B8]">
                <p className="text-sm text-[#8B4F6E] italic">{phase.affirmation}</p>
              </div>
              <a href={phase.videoUrl} target="_blank" rel="noopener noreferrer">
                <Button className="w-full bg-[#B06B8B] text-white">
                  📺 Watch: {phase.videoTitle}
                </Button>
              </a>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-3 mt-4">
          {notifications.length === 0 && (
            <Card className="border-[#E8C4B8]">
              <CardContent className="pt-6 text-center">
                <Bell className="w-8 h-8 text-[#E8C4B8] mx-auto mb-2" />
                <p className="text-[#9E7B8A]">No notifications yet</p>
                <p className="text-xs text-[#9E7B8A]">Partner updates will appear here</p>
              </CardContent>
            </Card>
          )}
          {notifications.map(n => (
            <Card key={n.id} className={`border cursor-pointer transition-all ${n.is_read ? "border-[#E8C4B8] opacity-70" : "border-[#B06B8B] bg-[#FBEAF0]"}`}
              onClick={() => markRead(n.id)}>
              <CardContent className="pt-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-[#6B3050] text-sm">{n.title}</p>
                    <p className="text-xs text-[#9E7B8A] mt-1">{n.message}</p>
                    <p className="text-xs text-[#9E7B8A] mt-1">From: {n.from_name || n.from_email}</p>
                  </div>
                  {!n.is_read && <Badge className="bg-[#B06B8B] text-white text-xs">New</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="partner-shared" className="space-y-3 mt-4">
          <Card className="border-[#E8C4B8]">
            <CardHeader>
              <CardTitle className="text-[#8B4F6E] text-base">What Your Partner Shared 💑</CardTitle>
              <p className="text-xs text-[#9E7B8A]">Data your partner has chosen to share with you</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {livePartnerData?.partnerData ? (() => {
                const pd = livePartnerData.partnerData;
                const sections = [
                  { key: "cycle", label: "🌸 Cycle", color: "rose" },
                  { key: "mood", label: "💗 Mood", color: "pink" },
                  { key: "wishlist", label: "🎁 Wishlist", color: "amber" },
                  { key: "milestones", label: "🏆 Milestones", color: "purple" },
                  { key: "goals", label: "🎯 Goals", color: "blue" },
                  { key: "sleep", label: "😴 Sleep", color: "indigo" },
                  { key: "skin", label: "🌿 Skin", color: "green" },
                  { key: "travel", label: "✈️ Travel", color: "sky" },
                  { key: "food", label: "🍽️ Food", color: "orange" },
                  { key: "journal", label: "📖 Journal", color: "violet" },
                  { key: "fitness", label: "💪 Fitness", color: "teal" },
                ];
                const shared = sections.filter(s => pd[s.key] !== null && pd[s.key] !== undefined);
                if (!shared.length) return (
                  <div className="text-center py-6">
                    <p className="text-[#9E7B8A] text-sm">Your partner hasn't shared anything yet</p>
                    <p className="text-xs text-[#9E7B8A] mt-1">Ask them to enable sharing in their Partner settings 🌹</p>
                  </div>
                );
                return (
                  <div className="space-y-3">
                    {shared.map(s => (
                      <div key={s.key} className={`p-3 bg-${s.color}-50 rounded-xl border border-${s.color}-200`}>
                        <p className={`font-medium text-${s.color}-700 text-sm mb-1`}>{s.label}</p>
                        {s.key === "cycle" && pd[s.key] && typeof pd[s.key] === "object" ? (
                          <div className="text-xs text-[#9E7B8A] space-y-1">
                            {pd[s.key].currentPhase && <p>📍 Phase: <span className="font-medium">{pd[s.key].currentPhase}</span></p>}
                            {pd[s.key].nextPeriod && <p>📅 Next period: <span className="font-medium">{pd[s.key].nextPeriod}</span></p>}
                            {pd[s.key].cycleDay && <p>🔢 Cycle day: <span className="font-medium">{pd[s.key].cycleDay}</span></p>}
                            {pd[s.key].mood && <p>💗 Mood: <span className="font-medium">{pd[s.key].mood}</span></p>}
                          </div>
                        ) : s.key === "mood" && pd[s.key] && typeof pd[s.key] === "object" ? (
                          <div className="text-xs text-[#9E7B8A] space-y-1">
                            {pd[s.key].mood && <p>Today: <span className="font-medium">{pd[s.key].mood}</span></p>}
                            {pd[s.key].note && <p>Note: <span className="font-medium">{pd[s.key].note}</span></p>}
                          </div>
                        ) : Array.isArray(pd[s.key]) ? (
                          pd[s.key].slice(0, 5).map((item: any, i: number) => (
                            <p key={i} className="text-xs text-[#9E7B8A]">• {item.name || item.title || item.text || item.label || JSON.stringify(item)}</p>
                          ))
                        ) : typeof pd[s.key] === "object" && pd[s.key] !== null ? (
                          <p className="text-xs text-[#9E7B8A]">{JSON.stringify(pd[s.key]).slice(0, 100)}</p>
                        ) : (
                          <p className="text-xs text-[#9E7B8A]">{String(pd[s.key])}</p>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })() : (
                <div className="text-center py-6">
                  <p className="text-[#9E7B8A] text-sm">No shared data yet</p>
                  <p className="text-xs text-[#9E7B8A] mt-1">Link with your partner to see their shared ROSA data 🌹</p>
                </div>
              )}
            </CardContent>
          </Card>

          {isPartnerUser && (
            <Card className="border-[#E8C4B8] bg-gradient-to-br from-[#FDF6F0] to-[#FBEAF0]">
              <CardHeader>
                <CardTitle className="text-[#8B4F6E] text-base">Wellness Guide for You {isMale ? "💙" : "🌹"}</CardTitle>
                <p className="text-xs text-[#9E7B8A]">Resources to help you show up as your best self</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { title: "How to communicate feelings", url: "https://www.youtube.com/results?search_query=men+emotional+communication+relationships", emoji: "💬" },
                  { title: "Being a supportive partner", url: "https://www.youtube.com/results?search_query=how+to+be+supportive+partner", emoji: "🤝" },
                  { title: "Understanding her emotions", url: "https://www.youtube.com/results?search_query=understanding+women+emotions+men+guide", emoji: "💡" },
                  { title: "Mental health for men", url: "https://www.youtube.com/results?search_query=mens+mental+health+guide", emoji: "🧠" },
                  { title: "How to express love better", url: "https://www.youtube.com/results?search_query=love+languages+men+guide", emoji: "❤️" },
                ].map((video, i) => (
                  <a key={i} href={video.url} target="_blank" rel="noopener noreferrer">
                    <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-[#E8C4B8] hover:border-[#B06B8B] transition">
                      <span className="text-2xl">{video.emoji}</span>
                      <p className="text-sm text-[#6B3050] font-medium">{video.title}</p>
                      <ChevronRight className="w-4 h-4 text-[#9E7B8A] ml-auto" />
                    </div>
                  </a>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sharing" className="space-y-3 mt-4">
          <Card className="border-[#E8C4B8]">
            <CardHeader>
              <CardTitle className="text-[#8B4F6E] text-base">Share with Partner</CardTitle>
              <p className="text-xs text-[#9E7B8A]">Choose what your partner can see. Your privacy is always protected.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: "cycle", label: "Cycle & Period 🌸", desc: "Phase, predictions, period days" },
                { key: "mood", label: "Mood 💗", desc: "Daily mood and trends" },
                { key: "wishlist", label: "Wishlist 🎁", desc: "So they can plan gifts" },
                { key: "milestones", label: "Milestones 🏆", desc: "Anniversaries and special dates" },
                { key: "goals", label: "Goals 🎯", desc: "Personal and relationship goals" },
                { key: "fitness", label: "Fitness 💪", desc: "Workouts and activity" },
                { key: "sleep", label: "Sleep 😴", desc: "Sleep patterns and quality" },
                { key: "travel", label: "Travel ✈️", desc: "Trip plans and bucket list" },
                { key: "food", label: "Food & Nutrition 🍽️", desc: "Diet and nutrition goals" },
                { key: "skin", label: "Skin & Wellness 🌿", desc: "Self care routine updates" },
                { key: "journal", label: "Journal 📖", desc: "Selected journal entries" },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between p-3 bg-[#FDF6F0] rounded-xl border border-[#E8C4B8]">
                  <div>
                    <p className="text-sm font-medium text-[#6B3050]">{item.label}</p>
                    <p className="text-xs text-[#9E7B8A]">{item.desc}</p>
                  </div>
                  <input type="checkbox" className="w-4 h-4 accent-[#B06B8B]" checked={!!sharePrefs[item.key]} onChange={e => setSharePrefs(p => ({ ...p, [item.key]: e.target.checked }))} />
                </div>
              ))}
              <Button onClick={saveSharePrefs} disabled={savingPrefs} className="w-full bg-[#B06B8B] text-white mt-2">
                {savingPrefs ? "Saving..." : "Save sharing preferences 🌹"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
