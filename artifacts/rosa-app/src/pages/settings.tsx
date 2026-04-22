import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, LogOut, User, Bell, Palette, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUser } from "@/lib/user-context";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

const PERSONALITY_TAGS = ["feminist", "spiritual", "adventurous", "gentle", "bold", "self-love", "strength", "growth"];

const GENDER_OPTIONS = [
  "Woman", "Man", "Non-binary", "Gender fluid", "Gender queer",
  "Transgender woman", "Transgender man", "Two-spirit", "Prefer not to say",
];

export default function SettingsPage() {
  const { user, setUser } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: user?.name || "",
    gender: user?.gender || "",
    personalityTags: user?.personalityTags || [] as string[],
  });

  const toggleTag = (tag: string) => {
    setForm(f => ({
      ...f,
      personalityTags: f.personalityTags.includes(tag)
        ? f.personalityTags.filter(t => t !== tag)
        : [...f.personalityTags, tag],
    }));
  };

  const handleSave = () => {
    if (!user) return;
    const updated = { ...user, name: form.name, gender: form.gender, personalityTags: form.personalityTags };
    setUser(updated);
    toast({ title: "Saved!", description: "Your profile has been updated." });
  };

  const handleLogout = () => {
    setUser(null);
    sessionStorage.removeItem("rosa_intro_seen");
    setLocation("/sign-in");
  };

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6 max-w-2xl">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-serif text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Make ROSA your own.</p>
      </motion.div>

      {/* Profile */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <User className="w-5 h-5 text-primary" /> Your Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Your name" data-testid="input-settings-name" />
          </div>
          <div>
            <Label>Gender Identity</Label>
            <Select value={form.gender} onValueChange={v => setForm(f => ({ ...f, gender: v }))}>
              <SelectTrigger data-testid="select-settings-gender">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                {GENDER_OPTIONS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Account Type</Label>
            <p className="text-sm text-muted-foreground mt-1">{user?.guestMode ? "Guest Mode" : `Signed in as ${user?.emailOrPhone}`}</p>
          </div>
        </CardContent>
      </Card>

      {/* Personality */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <Tag className="w-5 h-5 text-primary" /> Quote Preferences
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">Choose what resonates with you — your daily quotes will match your style.</p>
          <div className="flex flex-wrap gap-2">
            {PERSONALITY_TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                data-testid={`settings-tag-${tag}`}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all capitalize ${
                  form.personalityTags.includes(tag)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary hover:text-primary"
                }`}
              >
                {tag.replace("-", " ")}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} className="w-full bg-primary hover:bg-primary/90" data-testid="button-save-settings">
        Save Changes
      </Button>

      {/* Sign out */}
      <Card className="border-destructive/20 shadow-sm">
        <CardContent className="pt-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Sign Out</p>
              <p className="text-xs text-muted-foreground mt-0.5">You'll need to sign in again on your next visit.</p>
            </div>
            <Button variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/5" onClick={handleLogout} data-testid="button-logout">
              <LogOut className="w-4 h-4 mr-1" /> Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
