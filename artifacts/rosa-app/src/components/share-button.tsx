import { useState } from "react";
import { Share2, Check, Copy, MessageCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type Props = {
  title: string;
  text: string;
  url?: string;
  variant?: "default" | "ghost" | "outline";
  size?: "sm" | "default";
  className?: string;
  hashtag?: string;
};

const SOCIALS: { id: string; label: string; bg: string; intent?: (text: string, url: string) => string; copyOnly?: boolean }[] = [
  { id: "whatsapp", label: "WhatsApp", bg: "bg-[#25D366] hover:bg-[#1da851]", intent: (t, u) => `https://wa.me/?text=${encodeURIComponent(`${t}\n${u}`)}` },
  { id: "twitter", label: "X / Twitter", bg: "bg-black hover:bg-zinc-800", intent: (t, u) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}&url=${encodeURIComponent(u)}` },
  { id: "facebook", label: "Facebook", bg: "bg-[#1877F2] hover:bg-[#1561c7]", intent: (_t, u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
  { id: "telegram", label: "Telegram", bg: "bg-[#0088cc] hover:bg-[#006fa3]", intent: (t, u) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}` },
  { id: "instagram", label: "Instagram", bg: "bg-gradient-to-br from-[#f09433] via-[#dc2743] to-[#bc1888] hover:opacity-90", copyOnly: true },
  { id: "tiktok", label: "TikTok", bg: "bg-black hover:bg-zinc-800", copyOnly: true },
  { id: "snapchat", label: "Snapchat", bg: "bg-[#FFFC00] text-black hover:bg-yellow-300", copyOnly: true },
  { id: "email", label: "Email", bg: "bg-rose-500 hover:bg-rose-600", intent: (t, u) => `mailto:?subject=${encodeURIComponent("From ROSA 🌹")}&body=${encodeURIComponent(`${t}\n\n${u}`)}` },
];

export function ShareButton({ title, text, url, variant = "outline", size = "sm", className, hashtag = "#ROSA" }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const shareUrl = url || (typeof window !== "undefined" ? window.location.origin : "https://rosa.app");
  const fullText = `${text} ${hashtag}`;

  const handleClick = async () => {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title, text: fullText, url: shareUrl });
        return;
      } catch (e: any) {
        if (e?.name !== "AbortError") setOpen(true);
        return;
      }
    }
    setOpen(true);
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(`${fullText}\n${shareUrl}`);
      setCopied(true); setTimeout(() => setCopied(false), 1800);
      toast({ title: "Copied 💝", description: "Paste it anywhere — Instagram, TikTok, Snapchat..." });
    } catch {
      toast({ title: "Couldn't copy", description: "Long-press to copy manually." });
    }
  };

  const handleSocial = async (s: typeof SOCIALS[number]) => {
    if (s.copyOnly) {
      await copyAll();
      toast({ title: `Open ${s.label}`, description: `Your message is copied — paste it in your ${s.label} story or post.` });
      return;
    }
    if (s.intent) window.open(s.intent(fullText, shareUrl), "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  return (
    <>
      <Button type="button" variant={variant} size={size} className={className} onClick={handleClick}>
        <Share2 className="w-4 h-4 mr-1.5" /> Share
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">Share your moment 💗</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-xl bg-rose-50 border border-rose-100 p-3">
              <p className="text-sm text-rose-900 line-clamp-3">{fullText}</p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {SOCIALS.map(s => (
                <button key={s.id} onClick={() => handleSocial(s)}
                  className={`${s.bg} rounded-xl py-3 text-white text-[10px] font-medium leading-tight transition-all hover:scale-[1.03] flex flex-col items-center justify-center gap-1`}>
                  <span className="text-base leading-none">
                    {s.id === "whatsapp" ? "💬" : s.id === "twitter" ? "𝕏" : s.id === "facebook" ? "f" : s.id === "telegram" ? "✈" : s.id === "instagram" ? "📷" : s.id === "tiktok" ? "♪" : s.id === "snapchat" ? "👻" : "✉"}
                  </span>
                  {s.label}
                </button>
              ))}
            </div>
            <Button variant="outline" onClick={copyAll} className="w-full">
              {copied ? <><Check className="w-4 h-4 mr-1.5 text-green-600" /> Copied</> : <><Copy className="w-4 h-4 mr-1.5" /> Copy text + link</>}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              Instagram, TikTok & Snapchat: tap their button to copy, then paste in their app 🌹
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
