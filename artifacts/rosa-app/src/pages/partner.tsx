import { useState } from "react";
import { motion } from "framer-motion";
import { Users, Link, Heart, Gift, MapPin, Eye, EyeOff, Copy, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useToast } from "@/hooks/use-toast";

type PartnerData = {
  myCode: string;
  partnerCode: string;
  linkedAt: string;
  partnerName: string;
  permissions: {
    seePeriod: boolean;
    seeDetails: boolean;
    periodReminders: boolean;
  };
  surpriseTrip: {
    destination: string;
    date: string;
    message: string;
  } | null;
};

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function PartnerPage() {
  const [partner, setPartner] = useLocalStorage<PartnerData | null>("rosa_partner", null);
  const [myCode] = useLocalStorage<string>("rosa_my_code", generateCode());
  const [inputCode, setInputCode] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [copied, setCopied] = useState(false);
  const [tripForm, setTripForm] = useState({ destination: "", date: "", message: "" });
  const { toast } = useToast();

  const handleConnect = () => {
    if (!inputCode.trim()) return;
    const newPartner: PartnerData = {
      myCode,
      partnerCode: inputCode.toUpperCase(),
      linkedAt: new Date().toISOString(),
      partnerName: partnerName || "Your Partner",
      permissions: { seePeriod: false, seeDetails: false, periodReminders: true },
      surpriseTrip: null,
    };
    setPartner(newPartner);
    toast({ title: "Connected!", description: `You're now linked with ${newPartner.partnerName}.` });
  };

  const handleDisconnect = () => {
    setPartner(null);
    toast({ title: "Disconnected", description: "Partner link removed." });
  };

  const togglePerm = (key: keyof PartnerData["permissions"]) => {
    if (!partner) return;
    setPartner({ ...partner, permissions: { ...partner.permissions, [key]: !partner.permissions[key] } });
  };

  const copyCode = () => {
    navigator.clipboard.writeText(myCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const saveTrip = () => {
    if (!partner || !tripForm.destination) return;
    setPartner({ ...partner, surpriseTrip: { ...tripForm } });
    toast({ title: "Surprise saved!", description: "Outfit suggestions will be weather-based." });
    setTripForm({ destination: "", date: "", message: "" });
  };

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-serif text-foreground">Partner Sharing</h1>
        <p className="text-muted-foreground mt-1">Love made thoughtful.</p>
      </motion.div>

      {/* My Code */}
      <Card className="border-border/50 shadow-sm bg-gradient-to-br from-rose-50 to-pink-50">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-400" /> Your Connection Code
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="font-mono text-3xl font-bold tracking-widest text-primary bg-white px-6 py-3 rounded-xl border border-rose-200 shadow-sm">
              {myCode}
            </div>
            <Button size="icon" variant="outline" onClick={copyCode} data-testid="button-copy-code">
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Share this code with your partner to connect.</p>
        </CardContent>
      </Card>

      {!partner ? (
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="font-serif text-lg flex items-center gap-2">
              <Link className="w-5 h-5 text-primary" /> Connect with Partner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Partner's Name (optional)</Label>
              <Input placeholder="e.g. Alex" value={partnerName} onChange={e => setPartnerName(e.target.value)} data-testid="input-partner-name" />
            </div>
            <div>
              <Label>Partner's Code</Label>
              <Input placeholder="Enter 6-character code" value={inputCode} onChange={e => setInputCode(e.target.value.toUpperCase())} maxLength={6} className="font-mono tracking-widest text-lg" data-testid="input-partner-code" />
            </div>
            <Button onClick={handleConnect} disabled={inputCode.length < 6} className="w-full bg-primary hover:bg-primary/90" data-testid="button-connect-partner">
              <Users className="w-4 h-4 mr-2" /> Connect
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="border-emerald-200 bg-emerald-50 shadow-sm">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-200 flex items-center justify-center">
                    <Heart className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold">{partner.partnerName}</p>
                    <p className="text-xs text-muted-foreground">Code: {partner.partnerCode} · Connected {new Date(partner.linkedAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <Badge className="bg-emerald-500 text-white">Connected</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Privacy Settings */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="font-serif text-lg">Privacy Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: "seePeriod" as const, label: "Can see cycle status", desc: "Partner sees if you're on your period", icon: <Eye className="w-4 h-4" /> },
                { key: "seeDetails" as const, label: "Can see period details", desc: "Partner sees cycle predictions and details", icon: <EyeOff className="w-4 h-4" /> },
                { key: "periodReminders" as const, label: "Send gentle reminders", desc: `${partner.partnerName} gets a gentle nudge on period days`, icon: <Heart className="w-4 h-4" /> },
              ].map(({ key, label, desc, icon }) => (
                <div key={key} className="flex items-center justify-between py-1">
                  <div className="flex items-start gap-3">
                    <span className="text-muted-foreground mt-0.5">{icon}</span>
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                  </div>
                  <Switch checked={partner.permissions[key]} onCheckedChange={() => togglePerm(key)} data-testid={`switch-${key}`} />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Surprise Trip Planner */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="font-serif text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" /> Surprise Trip Planner
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {partner.surpriseTrip ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-semibold">{partner.surpriseTrip.destination}</p>
                      {partner.surpriseTrip.date && <p className="text-xs text-muted-foreground">{new Date(partner.surpriseTrip.date).toLocaleDateString()}</p>}
                      {partner.surpriseTrip.message && <p className="text-sm italic text-muted-foreground mt-1">"{partner.surpriseTrip.message}"</p>}
                    </div>
                  </div>
                  <p className="text-xs text-amber-700 mt-2">Outfit suggestions will be based on the weather at this destination — destination hidden from your partner!</p>
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => setPartner({ ...partner, surpriseTrip: null })}>Remove Trip</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Plan a secret surprise! Your partner will get outfit suggestions based on the destination weather — without knowing where you're going.</p>
                  <div>
                    <Label>Destination</Label>
                    <Input placeholder="e.g. Paris, France" value={tripForm.destination} onChange={e => setTripForm(f => ({ ...f, destination: e.target.value }))} data-testid="input-trip-destination" />
                  </div>
                  <div>
                    <Label>Date</Label>
                    <Input type="date" value={tripForm.date} onChange={e => setTripForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Secret message (optional)</Label>
                    <Input placeholder="Can't wait to take you there!" value={tripForm.message} onChange={e => setTripForm(f => ({ ...f, message: e.target.value }))} />
                  </div>
                  <Button onClick={saveTrip} disabled={!tripForm.destination} className="w-full" data-testid="button-save-trip">Save Surprise Trip</Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Button variant="outline" className="w-full text-destructive border-destructive/30" onClick={handleDisconnect} data-testid="button-disconnect">Disconnect Partner</Button>
        </div>
      )}
    </div>
  );
}
