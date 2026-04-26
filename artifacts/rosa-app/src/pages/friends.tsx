import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@/lib/user-context";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api";
import { Search, UserPlus, Check, X, Users } from "lucide-react";

type Friend = { rosaId: string; name: string; nickname: string | null; profilePhotoUrl: string | null };
type Request = { id: string; name: string; nickname: string | null; rosaId: string; fromEmail: string };

export default function FriendsPage() {
  const { user, getAuthHeaders } = useUser();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Friend[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"friends" | "search" | "requests">("friends");

  useEffect(() => {
    if (!user?.authToken) return;
    fetchFriends();
    fetchRequests();
  }, [user]);

  const fetchFriends = async () => {
    try {
      const res = await fetch(apiUrl("/api/friends"), { headers: getAuthHeaders() });
      const data = await res.json();
      setFriends(data.friends || []);
    } catch {}
  };

  const fetchRequests = async () => {
    try {
      const res = await fetch(apiUrl("/api/friends/requests"), { headers: getAuthHeaders() });
      const data = await res.json();
      setRequests(data.requests || []);
    } catch {}
  };

  const searchUsers = async (q: string) => {
    setSearch(q);
    if (q.length < 3) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/friends/search?q=${encodeURIComponent(q)}`), { headers: getAuthHeaders() });
      const data = await res.json();
      setResults(data.users || []);
    } catch {}
    setLoading(false);
  };

  const sendRequest = async (rosaId: string) => {
    try {
      const res = await fetch(apiUrl("/api/friends/request"), {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ toRosaId: rosaId }),
      });
      const data = await res.json();
      if (data.ok) toast({ title: "Friend request sent! 🌹" });
      else toast({ title: "Error", description: data.error, variant: "destructive" });
    } catch {
      toast({ title: "Error", description: "Could not send request", variant: "destructive" });
    }
  };

  const acceptRequest = async (id: string) => {
    try {
      await fetch(apiUrl(`/api/friends/accept/${id}`), { method: "POST", headers: getAuthHeaders() });
      toast({ title: "Friend added! 🌹" });
      fetchFriends();
      fetchRequests();
    } catch {}
  };

  const declineRequest = async (id: string) => {
    try {
      await fetch(apiUrl(`/api/friends/decline/${id}`), { method: "POST", headers: getAuthHeaders() });
      fetchRequests();
    } catch {}
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-playfair text-[#8B4F6E] font-bold">Friends 🌹</h1>

      <div className="flex gap-2">
        {(["friends", "search", "requests"] as const).map(t => (
          <Button key={t} size="sm" variant={tab === t ? "default" : "outline"}
            onClick={() => setTab(t)}
            className={tab === t ? "bg-[#B06B8B] text-white" : "border-[#E8C4B8] text-[#8B4F6E]"}>
            {t === "friends" && <><Users className="w-3 h-3 mr-1" />Friends ({friends.length})</>}
            {t === "search" && <><Search className="w-3 h-3 mr-1" />Find</>}
            {t === "requests" && <><UserPlus className="w-3 h-3 mr-1" />Requests {requests.length > 0 && `(${requests.length})`}</>}
          </Button>
        ))}
      </div>

      {tab === "search" && (
        <Card className="border-[#E8C4B8]">
          <CardContent className="pt-4 space-y-3">
            <Input placeholder="Search by ROSA ID or @nickname..."
              value={search} onChange={e => searchUsers(e.target.value)}
              className="border-[#E8C4B8]" />
            {loading && <p className="text-sm text-[#9E7B8A]">Searching...</p>}
            {results.map(u => (
              <div key={u.rosaId} className="flex items-center justify-between p-3 bg-[#FDF6F0] rounded-xl">
                <div>
                  <p className="font-medium text-[#6B3050]">{u.name}</p>
                  <p className="text-sm text-[#9E7B8A]">{u.nickname ? `@${u.nickname}` : u.rosaId}</p>
                </div>
                <Button size="sm" onClick={() => sendRequest(u.rosaId)}
                  className="bg-[#B06B8B] text-white">
                  <UserPlus className="w-3 h-3 mr-1" /> Add
                </Button>
              </div>
            ))}
            {search.length >= 3 && results.length === 0 && !loading && (
              <p className="text-sm text-[#9E7B8A] text-center">No users found</p>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "requests" && (
        <Card className="border-[#E8C4B8]">
          <CardHeader><CardTitle className="text-[#8B4F6E]">Friend Requests</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {requests.length === 0 && <p className="text-sm text-[#9E7B8A] text-center">No pending requests</p>}
            {requests.map(r => (
              <div key={r.id} className="flex items-center justify-between p-3 bg-[#FDF6F0] rounded-xl">
                <div>
                  <p className="font-medium text-[#6B3050]">{r.name}</p>
                  <p className="text-sm text-[#9E7B8A]">{r.nickname ? `@${r.nickname}` : r.rosaId}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => acceptRequest(r.id)} className="bg-[#B06B8B] text-white">
                    <Check className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => declineRequest(r.id)} className="border-[#E8C4B8]">
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {tab === "friends" && (
        <Card className="border-[#E8C4B8]">
          <CardHeader><CardTitle className="text-[#8B4F6E]">Your Friends</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {friends.length === 0 && (
              <div className="text-center py-6">
                <p className="text-[#9E7B8A]">No friends yet 🌹</p>
                <p className="text-sm text-[#9E7B8A]">Search by ROSA ID to find friends</p>
                <Button size="sm" onClick={() => setTab("search")} className="mt-3 bg-[#B06B8B] text-white">
                  Find Friends
                </Button>
              </div>
            )}
            {friends.map(f => (
              <div key={f.rosaId} className="flex items-center gap-3 p-3 bg-[#FDF6F0] rounded-xl">
                <div className="w-10 h-10 rounded-full bg-[#E8C4B8] flex items-center justify-center text-[#8B4F6E] font-bold">
                  {f.name[0]}
                </div>
                <div>
                  <p className="font-medium text-[#6B3050]">{f.name}</p>
                  <p className="text-sm text-[#9E7B8A]">{f.nickname ? `@${f.nickname}` : f.rosaId}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
