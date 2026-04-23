import { Link as WouterLink } from "wouter";
import { Heart, HeartOff, Users } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useIsSharing, FEATURE_LABELS, type ShareableFeature } from "@/lib/partner-share";
import { useLocalStorage } from "@/hooks/use-local-storage";

type PartnerLite = { partnerName?: string } | null;

/**
 * Small inline toggle to drop into any feature page.
 * Lets the user decide — per feature — whether this section is visible to their connected partner.
 * If no partner is linked, prompts to connect.
 */
export function PartnerShareToggle({ feature, compact = false }: { feature: ShareableFeature; compact?: boolean }) {
  const [partner] = useLocalStorage<PartnerLite>("rosa_partner", null);
  const [sharing, setSharing] = useIsSharing(feature);
  const meta = FEATURE_LABELS[feature];

  if (!partner) {
    return (
      <WouterLink href="/partner">
        <a className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-rose-600 transition-colors" data-testid={`share-link-${feature}`}>
          <Users className="w-3.5 h-3.5" /> Connect a partner to share {meta.emoji}
        </a>
      </WouterLink>
    );
  }

  if (compact) {
    return (
      <button
        onClick={() => setSharing(!sharing)}
        className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all ${sharing ? "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800/60" : "bg-muted border-border text-muted-foreground hover:border-rose-300"}`}
        data-testid={`share-toggle-${feature}`}
        title={sharing ? `${partner.partnerName || "Your partner"} can see this` : "Private — only you"}
      >
        {sharing ? <Heart className="w-3 h-3 fill-rose-500 text-rose-500" /> : <HeartOff className="w-3 h-3" />}
        {sharing ? `Sharing with ${partner.partnerName || "partner"}` : "Private"}
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-border/60 bg-gradient-to-r from-rose-50/40 to-pink-50/40 dark:from-rose-950/20 dark:to-pink-950/20">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-xl">{meta.emoji}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">Share with {partner.partnerName || "your partner"}?</p>
          <p className="text-xs text-muted-foreground truncate">{sharing ? `${meta.label} is visible to them` : `${meta.label} is private to you`}</p>
        </div>
      </div>
      <Switch checked={sharing} onCheckedChange={setSharing} data-testid={`share-switch-${feature}`} />
    </div>
  );
}
