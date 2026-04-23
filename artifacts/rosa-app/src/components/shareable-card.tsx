import { useRef, useState } from "react";
import { toPng, toBlob } from "html-to-image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Share2, Loader2, Check, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  subtitle?: string;
  bigText: string;          // headline number/word
  smallText?: string;       // small descriptor under big text
  emoji?: string;
  variant?: "rose" | "amber" | "violet" | "emerald";
  authorName?: string;
};

const VARIANTS = {
  rose:    { from: "#fbe8eb", via: "#f9d0d8", to: "#f1c4cd", accent: "#8b2252", text: "#3d1a24" },
  amber:   { from: "#fef3c7", via: "#fde68a", to: "#fcd34d", accent: "#b45309", text: "#451a03" },
  violet:  { from: "#ede9fe", via: "#ddd6fe", to: "#c4b5fd", accent: "#6d28d9", text: "#2e1065" },
  emerald: { from: "#d1fae5", via: "#a7f3d0", to: "#6ee7b7", accent: "#047857", text: "#022c22" },
};

export function ShareableCard({ open, onOpenChange, title, subtitle, bigText, smallText, emoji = "🌹", variant = "rose", authorName }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<"download" | "share" | "copy" | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const { toast } = useToast();
  const v = VARIANTS[variant];

  async function exportPng(): Promise<{ dataUrl: string; blob: Blob | null }> {
    if (!cardRef.current) throw new Error("Card not ready");
    const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true, backgroundColor: v.from });
    const blob = await toBlob(cardRef.current, { pixelRatio: 2, cacheBust: true, backgroundColor: v.from });
    return { dataUrl, blob };
  }

  async function download() {
    setBusy("download");
    try {
      const { dataUrl } = await exportPng();
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `rosa-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
      a.click();
      setDone("download"); setTimeout(() => setDone(null), 1800);
    } catch (e: any) {
      toast({ title: "Couldn't save image", description: e?.message || "Try again." });
    } finally { setBusy(null); }
  }

  async function shareNative() {
    setBusy("share");
    try {
      const { blob } = await exportPng();
      if (!blob) throw new Error("No image");
      const file = new File([blob], "rosa-share.png", { type: "image/png" });
      const nav = navigator as any;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ title, text: `${title} · made with ROSA 🌹`, files: [file] });
      } else if (nav.share) {
        await nav.share({ title, text: `${title} · made with ROSA 🌹` });
      } else {
        await download();
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") toast({ title: "Couldn't share", description: "Try saving the image instead 💗" });
    } finally { setBusy(null); }
  }

  async function copyImage() {
    setBusy("copy");
    try {
      const { blob } = await exportPng();
      if (!blob) throw new Error("No image");
      await (navigator.clipboard as any).write([new ClipboardItem({ "image/png": blob })]);
      setDone("copy"); setTimeout(() => setDone(null), 1800);
      toast({ title: "Image copied 💝", description: "Paste it in Instagram, TikTok, anywhere!" });
    } catch (e: any) {
      toast({ title: "Couldn't copy image", description: "Use Save instead and upload from your gallery." });
    } finally { setBusy(null); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="font-serif">Your shareable card 🌹</DialogTitle></DialogHeader>
        <div className="overflow-hidden rounded-2xl">
          <div
            ref={cardRef}
            style={{
              background: `linear-gradient(135deg, ${v.from} 0%, ${v.via} 50%, ${v.to} 100%)`,
              color: v.text,
              width: "360px",
              padding: "32px 28px",
              fontFamily: "Georgia, 'Times New Roman', serif",
              position: "relative",
            }}
          >
            <div style={{ position: "absolute", top: "16px", right: "20px", fontSize: "10px", letterSpacing: "3px", color: v.accent, opacity: 0.7, textTransform: "uppercase" }}>
              ROSA
            </div>
            <div style={{ fontSize: "56px", lineHeight: 1, marginBottom: "12px", textAlign: "center" }}>{emoji}</div>
            {subtitle && <div style={{ fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", color: v.accent, textAlign: "center", marginBottom: "8px", fontWeight: 600 }}>{subtitle}</div>}
            <h2 style={{ fontSize: "22px", lineHeight: 1.25, textAlign: "center", margin: "0 0 22px", fontWeight: 500 }}>{title}</h2>
            <div style={{ background: "rgba(255,255,255,0.55)", borderRadius: "20px", padding: "20px 16px", textAlign: "center", border: `1px solid ${v.accent}22`, backdropFilter: "blur(4px)" }}>
              <div style={{ fontSize: "52px", fontWeight: 600, lineHeight: 1, color: v.accent, fontFamily: "Georgia, serif" }}>{bigText}</div>
              {smallText && <div style={{ fontSize: "13px", marginTop: "6px", opacity: 0.8 }}>{smallText}</div>}
            </div>
            <div style={{ marginTop: "26px", textAlign: "center" }}>
              <div style={{ fontSize: "11px", fontStyle: "italic", opacity: 0.65, marginBottom: "4px" }}>An app made for women, by women</div>
              <div style={{ fontSize: "9px", letterSpacing: "2px", textTransform: "uppercase", opacity: 0.5 }}>{authorName ? `${authorName} · ` : ""}rosa.app</div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button onClick={download} disabled={!!busy} variant="outline">
            {busy === "download" ? <Loader2 className="w-4 h-4 animate-spin" /> : done === "download" ? <Check className="w-4 h-4 text-green-600" /> : <><Download className="w-4 h-4 mr-1" /> Save</>}
          </Button>
          <Button onClick={copyImage} disabled={!!busy} variant="outline">
            {busy === "copy" ? <Loader2 className="w-4 h-4 animate-spin" /> : done === "copy" ? <Check className="w-4 h-4 text-green-600" /> : <><Copy className="w-4 h-4 mr-1" /> Copy</>}
          </Button>
          <Button onClick={shareNative} disabled={!!busy} className="bg-rose-500 hover:bg-rose-600 text-white">
            {busy === "share" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Share2 className="w-4 h-4 mr-1" /> Share</>}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground text-center">
          Save the image, then post it to Instagram, TikTok, Snapchat — your story, your way 💗
        </p>
      </DialogContent>
    </Dialog>
  );
}
