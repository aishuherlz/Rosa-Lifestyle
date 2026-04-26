import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Heart,
  MessageCircle,
  Sparkles,
  MoreHorizontal,
  Trash2,
  Flag,
  Send,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { apiUrl } from "@/lib/api";
import { getAuthHeader } from "@/lib/auth-storage";
import { useUser } from "@/lib/user-context";

// Mood vocabulary must match the server's ALLOWED_MOODS in routes/rose-wall.ts.
const MOODS: { value: string; label: string; emoji: string }[] = [
  { value: "happy", label: "Happy", emoji: "🌸" },
  { value: "loved", label: "Loved", emoji: "💗" },
  { value: "calm", label: "Calm", emoji: "🕊️" },
  { value: "grateful", label: "Grateful", emoji: "🙏" },
  { value: "hopeful", label: "Hopeful", emoji: "🌱" },
  { value: "proud", label: "Proud", emoji: "✨" },
  { value: "tired", label: "Tired", emoji: "🌙" },
  { value: "sad", label: "Sad", emoji: "💧" },
  { value: "anxious", label: "Anxious", emoji: "🫧" },
  { value: "angry", label: "Angry", emoji: "🔥" },
];

type Post = {
  id: number;
  text: string;
  mood: string | null;
  isAnonymous: boolean;
  displayName: string;
  roseCount: number;
  commentCount: number;
  createdAt: string;
  viewerHasRosed: boolean;
  isOwn: boolean;
  mediaUrl?: string | null;
  mediaType?: "image" | "video" | null;
};

type Comment = {
  id: number;
  text: string;
  isAnonymous: boolean;
  displayName: string;
  createdAt: string;
  isOwn: boolean;
};

function authHeaders(): Record<string, string> {
  return { "Content-Type": "application/json", ...getAuthHeader() };
}

function moodMeta(mood: string | null) {
  if (!mood) return null;
  return MOODS.find((m) => m.value === mood) || null;
}

export default function RoseWallPage() {
  const { user } = useUser();
  const { toast } = useToast();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [draftMood, setDraftMood] = useState<string>("");
  const [draftAnon, setDraftAnon] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
  const [comments, setComments] = useState<Record<number, Comment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [commentAnon, setCommentAnon] = useState<Record<number, boolean>>({});
  const [commentSubmitting, setCommentSubmitting] = useState<Record<number, boolean>>({});

  const isSignedIn = !!user?.authToken;

  const loadFeed = useCallback(async () => {
    if (!isSignedIn) {
      setLoading(false);
      return;
    }
    try {
      const r = await fetch(apiUrl("/api/rose-wall"), { headers: authHeaders() });
      if (r.status === 401) {
        setPosts([]);
        return;
      }
      const d = await r.json();
      setPosts(Array.isArray(d.posts) ? d.posts : []);
    } catch {
      // Silent — feed will just be empty; user can pull-to-refresh by posting.
    } finally {
      setLoading(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    loadFeed();
    if (!isSignedIn) return;
    const i = setInterval(loadFeed, 30000);
    return () => clearInterval(i);
  }, [loadFeed, isSignedIn]);

  async function createPost() {
    const text = draft.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      const r = await fetch(apiUrl("/api/rose-wall"), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          text,
          mood: draftMood || undefined,
          isAnonymous: draftAnon,
          mediaUrl: mediaPreview || undefined,
          mediaType: mediaType || undefined,
        }),
      });
      const d = await r.json();
      if (r.status === 422 && d.blocked) {
        // Step 3 spec: exact wording for blocked content.
        // Long duration so the user (and our e2e tests) can actually read it.
        toast({
          title: "Post blocked 🌹",
          description: d.error,
          variant: "destructive",
          duration: 12000,
        });
        return;
      }
      if (!r.ok) {
        toast({ title: "Hold on 🌹", description: d.error || "Could not post." });
        return;
      }
      setPosts((p) => [d.post, ...p]);
      setDraft("");
      setDraftMood("");
      setDraftAnon(false);
      setMediaPreview(null);
      setMediaType(null);
      toast({
        title: "Posted to the wall 🌹",
        description: "Your light just reached every sister.",
      });
    } catch {
      toast({ title: "Something went wrong", description: "Try again in a moment 🌹" });
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleRose(post: Post) {
    // Optimistic flip
    setPosts((ps) =>
      ps.map((p) =>
        p.id === post.id
          ? {
              ...p,
              viewerHasRosed: !p.viewerHasRosed,
              roseCount: p.roseCount + (p.viewerHasRosed ? -1 : 1),
            }
          : p,
      ),
    );
    try {
      const r = await fetch(apiUrl(`/api/rose-wall/${post.id}/rose`), {
        method: "POST",
        headers: authHeaders(),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "rose failed");
      // Reconcile with the server's count.
      setPosts((ps) =>
        ps.map((p) =>
          p.id === post.id
            ? { ...p, viewerHasRosed: !!d.rosed, roseCount: d.roseCount ?? p.roseCount }
            : p,
        ),
      );
    } catch {
      // Rollback on failure
      setPosts((ps) =>
        ps.map((p) =>
          p.id === post.id
            ? {
                ...p,
                viewerHasRosed: post.viewerHasRosed,
                roseCount: post.roseCount,
              }
            : p,
        ),
      );
    }
  }

  async function deletePost(post: Post) {
    if (!confirm("Delete this post? This can't be undone.")) return;
    try {
      const r = await fetch(apiUrl(`/api/rose-wall/${post.id}`), {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        toast({ title: "Could not delete", description: d.error || "Try again." });
        return;
      }
      setPosts((p) => p.filter((x) => x.id !== post.id));
      toast({ title: "Deleted", description: "Your post has been removed." });
    } catch {
      toast({ title: "Could not delete", description: "Try again in a moment." });
    }
  }

  async function reportPost(post: Post) {
    try {
      const r = await fetch(apiUrl(`/api/rose-wall/${post.id}/report`), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ reason: "user_reported" }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({ title: "Could not file report", description: d.error || "Try again." });
        return;
      }
      toast({
        title: d.alreadyReported ? "Already reported" : "Thank you for reporting 🌹",
        description: "Our team will take a look.",
      });
    } catch {
      toast({ title: "Could not file report", description: "Try again in a moment." });
    }
  }

  async function loadComments(postId: number) {
    try {
      const r = await fetch(apiUrl(`/api/rose-wall/${postId}/comments`), {
        headers: authHeaders(),
      });
      const d = await r.json();
      setComments((c) => ({ ...c, [postId]: Array.isArray(d.comments) ? d.comments : [] }));
    } catch {
      setComments((c) => ({ ...c, [postId]: [] }));
    }
  }

  function toggleComments(postId: number) {
    setOpenComments((o) => {
      const next = { ...o, [postId]: !o[postId] };
      if (next[postId] && !comments[postId]) loadComments(postId);
      return next;
    });
  }

  async function submitComment(post: Post) {
    const text = (commentDrafts[post.id] || "").trim();
    if (!text || commentSubmitting[post.id]) return;
    setCommentSubmitting((s) => ({ ...s, [post.id]: true }));
    try {
      const r = await fetch(apiUrl(`/api/rose-wall/${post.id}/comments`), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          text,
          isAnonymous: !!commentAnon[post.id],
        }),
      });
      const d = await r.json();
      if (r.status === 422 && d.blocked) {
        toast({
          title: "Comment blocked 🌹",
          description: d.error,
          variant: "destructive",
          duration: 12000,
        });
        return;
      }
      if (!r.ok) {
        toast({ title: "Hold on 🌹", description: d.error || "Could not comment." });
        return;
      }
      setComments((c) => ({ ...c, [post.id]: [d.comment, ...(c[post.id] || [])] }));
      setCommentDrafts((cd) => ({ ...cd, [post.id]: "" }));
      // Bump post's comment count locally
      setPosts((ps) =>
        ps.map((p) =>
          p.id === post.id ? { ...p, commentCount: p.commentCount + 1 } : p,
        ),
      );
    } catch {
      toast({ title: "Something went wrong", description: "Try again in a moment 🌹" });
    } finally {
      setCommentSubmitting((s) => ({ ...s, [post.id]: false }));
    }
  }

  async function deleteComment(post: Post, comment: Comment) {
    if (!confirm("Delete this comment?")) return;
    try {
      const r = await fetch(apiUrl(`/api/rose-wall/${post.id}/comments/${comment.id}`), {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!r.ok) {
        toast({ title: "Could not delete", description: "Try again." });
        return;
      }
      setComments((c) => ({
        ...c,
        [post.id]: (c[post.id] || []).filter((x) => x.id !== comment.id),
      }));
      setPosts((ps) =>
        ps.map((p) =>
          p.id === post.id ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p,
        ),
      );
    } catch {
      toast({ title: "Could not delete", description: "Try again in a moment." });
    }
  }

  // ---- Render ----------------------------------------------------------------

  if (!isSignedIn) {
    return (
      <div className="min-h-full p-4 md:p-8 max-w-3xl mx-auto pb-24">
        <h1 className="text-3xl font-serif text-foreground flex items-center gap-2 mb-4">
          <Sparkles className="w-7 h-7 text-rose-500" /> Rose Wall
        </h1>
        <Card className="border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50">
          <CardContent className="pt-6">
            <p className="text-foreground">
              The Rose Wall is a private space for the ROSA community 🌹
            </p>
            <p className="text-muted-foreground mt-2 text-sm">
              Please sign in or create your free account to read and post.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const remaining = 600 - draft.length;

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6 max-w-3xl mx-auto pb-24">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-serif text-foreground flex items-center gap-2">
          <Sparkles className="w-7 h-7 text-rose-500" /> Rose Wall
        </h1>
        <p className="text-muted-foreground mt-1">
          A safe space · sisters lifting sisters 🌹
        </p>
      </motion.div>

      {/* Composer */}
      <Card className="border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50">
        <CardContent className="pt-5 space-y-3">
          <Textarea
            data-testid="rose-wall-composer"
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 600))}
            placeholder="Share something kind, ask for support, or send love..."
            className="min-h-[96px] bg-white/80 border-rose-200"
          />
          {/* Media upload */}
          <div className="flex items-center gap-2">
            <label className="cursor-pointer flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 border border-rose-200 rounded-lg px-3 py-1.5 bg-white/70 hover:bg-rose-50 transition">
              <span>📷</span> Add Photo/Video
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 10 * 1024 * 1024) {
                    toast({ title: "File too large", description: "Max 10MB allowed", variant: "destructive" });
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => {
                    setMediaPreview(reader.result as string);
                    setMediaType(file.type.startsWith("video") ? "video" : "image");
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </label>
            {mediaPreview && (
              <button onClick={() => { setMediaPreview(null); setMediaType(null); }}
                className="text-xs text-red-500 hover:text-red-700">
                ✕ Remove
              </button>
            )}
          </div>
          {mediaPreview && (
            <div className="rounded-xl overflow-hidden border border-rose-200">
              {mediaType === "video" ? (
                <video src={mediaPreview} controls className="w-full max-h-48 object-cover" />
              ) : (
                <img src={mediaPreview} alt="Preview" className="w-full max-h-48 object-cover" />
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground mr-1">Mood (optional):</span>
            {MOODS.slice(0, 6).map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setDraftMood(draftMood === m.value ? "" : m.value)}
                className={`text-xs px-2 py-1 rounded-full border transition ${
                  draftMood === m.value
                    ? "bg-rose-500 text-white border-rose-500"
                    : "bg-white/70 border-rose-200 text-rose-700 hover:bg-rose-100"
                }`}
              >
                {m.emoji} {m.label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Switch
                id="anon"
                checked={draftAnon}
                onCheckedChange={setDraftAnon}
                data-testid="rose-wall-anon-toggle"
              />
              <Label htmlFor="anon" className="text-sm text-foreground cursor-pointer">
                Post as Anonymous Rose
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`text-xs ${
                  remaining < 50 ? "text-rose-600" : "text-muted-foreground"
                }`}
              >
                {remaining}
              </span>
              <Button
                onClick={createPost}
                disabled={!draft.trim() || submitting}
                className="bg-rose-500 hover:bg-rose-600 text-white"
                data-testid="rose-wall-submit"
              >
                <Send className="w-4 h-4 mr-1" />
                {submitting ? "Posting..." : "Post"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feed */}
      {loading ? (
        <p className="text-center text-muted-foreground">Loading the wall...</p>
      ) : posts.length === 0 ? (
        <Card className="border-dashed border-rose-200">
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">
              The wall is quiet right now. Be the first to share something 🌹
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {posts.map((post) => {
              const mood = moodMeta(post.mood);
              const isOpen = !!openComments[post.id];
              const cs = comments[post.id] || [];
              return (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  layout
                >
                  <Card className="border-rose-100 hover:border-rose-200 transition">
                    <CardContent className="pt-5 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center text-white text-sm font-medium">
                            {post.isAnonymous
                              ? "🌹"
                              : (post.displayName?.[0] || "R").toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {post.displayName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(post.createdAt), {
                                addSuffix: true,
                              })}
                              {mood && (
                                <span className="ml-2 text-xs">
                                  · {mood.emoji} {mood.label}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {post.isOwn ? (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => deletePost(post)}
                                data-testid={`rose-wall-delete-${post.id}`}
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => reportPost(post)}>
                                <Flag className="w-4 h-4 mr-2" /> Report
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <p className="text-foreground whitespace-pre-wrap">{post.text}</p>
                      {post.mediaUrl && post.mediaType === "video" && (
                        <video src={post.mediaUrl} controls className="w-full max-h-64 rounded-xl object-cover border border-rose-100 mt-2" />
                      )}
                      {post.mediaUrl && post.mediaType === "image" && (
                        <img src={post.mediaUrl} alt="Post media" className="w-full max-h-64 rounded-xl object-cover border border-rose-100 mt-2" />
                      )}

                      <div className="flex items-center gap-4 pt-1 text-sm">
                        <button
                          onClick={() => toggleRose(post)}
                          className={`flex items-center gap-1 transition ${
                            post.viewerHasRosed
                              ? "text-rose-600"
                              : "text-muted-foreground hover:text-rose-500"
                          }`}
                          data-testid={`rose-wall-rose-${post.id}`}
                        >
                          <Heart
                            className={`w-4 h-4 ${post.viewerHasRosed ? "fill-current" : ""}`}
                          />
                          <span>{post.roseCount}</span>
                        </button>
                        <button
                          onClick={() => toggleComments(post.id)}
                          className="flex items-center gap-1 text-muted-foreground hover:text-rose-500 transition"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>{post.commentCount}</span>
                        </button>
                      </div>

                      {isOpen && (
                        <div className="border-t border-rose-100 pt-3 space-y-3">
                          {cs.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              No comments yet. Be the first to send love.
                            </p>
                          ) : (
                            <ul className="space-y-2">
                              {cs.map((c) => (
                                <li
                                  key={c.id}
                                  className="text-sm flex items-start justify-between gap-2"
                                >
                                  <div>
                                    <span className="font-medium text-foreground">
                                      {c.displayName}
                                    </span>{" "}
                                    <span className="text-foreground">{c.text}</span>
                                    <p className="text-[10px] text-muted-foreground">
                                      {formatDistanceToNow(new Date(c.createdAt), {
                                        addSuffix: true,
                                      })}
                                    </p>
                                  </div>
                                  {c.isOwn && (
                                    <button
                                      onClick={() => deleteComment(post, c)}
                                      className="text-xs text-muted-foreground hover:text-destructive"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={commentDrafts[post.id] || ""}
                              onChange={(e) =>
                                setCommentDrafts((cd) => ({
                                  ...cd,
                                  [post.id]: e.target.value.slice(0, 400),
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  submitComment(post);
                                }
                              }}
                              placeholder="Add a comment..."
                              className="flex-1 text-sm px-3 py-2 rounded-lg border border-rose-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-300"
                              data-testid={`rose-wall-comment-input-${post.id}`}
                            />
                            <button
                              onClick={() =>
                                setCommentAnon((a) => ({
                                  ...a,
                                  [post.id]: !a[post.id],
                                }))
                              }
                              className={`text-xs px-2 py-1 rounded-full border ${
                                commentAnon[post.id]
                                  ? "bg-rose-500 text-white border-rose-500"
                                  : "bg-white border-rose-200 text-rose-600"
                              }`}
                              title="Comment anonymously"
                            >
                              🌹
                            </button>
                            <Button
                              size="sm"
                              onClick={() => submitComment(post)}
                              disabled={
                                !(commentDrafts[post.id] || "").trim() ||
                                commentSubmitting[post.id]
                              }
                              className="bg-rose-500 hover:bg-rose-600 text-white"
                            >
                              <Send className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
