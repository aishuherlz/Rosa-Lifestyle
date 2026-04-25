import { useState } from "react";
import { Copy, Check, Share2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/lib/user-context";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api";

export function RosaProfileCard() {
  const { user, setUser, getAuthHeaders } = useUser();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [editingNickname, setEditingNickname] = useState(false);
  const [nickname, setNickname] = useState(user?.nickname || "");
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [bio, setBio] = useState(user?.bio || "");

  const copyRosaId = () => {
    if (!user?.rosaId) return;
    navigator.clipboard.writeText(user.rosaId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied!", description: "Your ROSA ID has been copied" });
  };

  const checkNickname = async (val: string) => {
    setNickname(val);
    if (val.length < 3) { setAvailable(null); return; }
    setChecking(true);
    try {
      const res = await fetch(apiUrl(`/api/auth/check-nickname?nickname=${val}`));
      const data = await res.json();
      setAvailable(data.available);
    } catch { setAvailable(null); }
    setChecking(false);
  };

  const saveNickname = async () => {
    setSaving(true);
    try {
      const res = await fetch(apiUrl("/api/auth/set-nickname"), {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      });
      const data = await res.json();
      if (data.success) {
        setUser({ ...user!, nickname: data.nickname });
        setEditingNickname(false);
        toast({ title: "Nickname saved! 🌹", description: `You are now @${data.nickname}` });
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not save nickname", variant: "destructive" });
    }
    setSaving(false);
  };

  const saveBio = async () => {
    try {
      await fetch(apiUrl("/api/auth/profile"), {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ bio }),
      });
      setUser({ ...user!, bio });
      setEditingBio(false);
      toast({ title: "Bio saved! 🌹" });
    } catch {
      toast({ title: "Error", description: "Could not save bio", variant: "destructive" });
    }
  };

  if (!user) return null;

  return (
    <Card className="border border-[#E8C4B8] bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-[#8B4F6E] font-playfair flex items-center gap-2">
          🌹 Your ROSA Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-[#FDF6F0] rounded-xl border border-[#E8C4B8]">
          <div>
            <p className="text-xs text-[#9E7B8A] font-medium">Your ROSA ID</p>
            <p className="text-lg font-bold text-[#6B3050]">{user.rosaId || "Generating..."}</p>
            <p className="text-xs text-[#9E7B8A]">Never changes — share this to connect</p>
          </div>
          <Button variant="outline" size="sm" onClick={copyRosaId} className="border-[#B06B8B] text-[#B06B8B]">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[#6B3050]">Nickname</p>
            {!editingNickname && (
              <Button variant="ghost" size="sm" onClick={() => setEditingNickname(true)} className="text-[#B06B8B]">
                <Edit2 className="w-3 h-3 mr-1" /> Edit
              </Button>
            )}
          </div>
          {editingNickname ? (
            <div className="space-y-2">
              <Input
                value={nickname}
                onChange={e => checkNickname(e.target.value)}
                placeholder="Choose your nickname"
                className="border-[#E8C4B8]"
                maxLength={20}
              />
              {checking && <p className="text-xs text-[#9E7B8A]">Checking availability...</p>}
              {available === true && <p className="text-xs text-green-600">✓ Available!</p>}
              {available === false && <p className="text-xs text-red-500">✗ Already taken</p>}
              <p className="text-xs text-[#9E7B8A]">{3 - (user.nicknameChanges || 0)} changes remaining</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveNickname} disabled={saving || !available} className="bg-[#B06B8B] text-white">
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingNickname(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <p className="text-[#6B3050] font-medium">{user.nickname ? `@${user.nickname}` : "Not set yet — add one!"}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[#6B3050]">Bio</p>
            {!editingBio && (
              <Button variant="ghost" size="sm" onClick={() => setEditingBio(true)} className="text-[#B06B8B]">
                <Edit2 className="w-3 h-3 mr-1" /> Edit
              </Button>
            )}
          </div>
          {editingBio ? (
            <div className="space-y-2">
              <Input value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell us about yourself (max 150 chars)" maxLength={150} className="border-[#E8C4B8]" />
              <p className="text-xs text-[#9E7B8A]">{150 - bio.length} characters remaining</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveBio} className="bg-[#B06B8B] text-white">Save</Button>
                <Button size="sm" variant="outline" onClick={() => setEditingBio(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <p className="text-[#9E7B8A] text-sm">{user.bio || "No bio yet — tell your ROSA story!"}</p>
          )}
        </div>

        {user.anonymousName && (
          <div className="p-3 bg-[#F5E6D3] rounded-xl border border-[#E8C4B8]">
            <p className="text-xs text-[#9E7B8A] font-medium">Your anonymous pen name</p>
            <p className="text-[#6B3050] font-medium">{user.anonymousName}</p>
            <p className="text-xs text-[#9E7B8A]">Only you can see this</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
