import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Loader2, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSubscription } from "@/lib/subscription-context";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
};

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export function FloatingChat() {
  const { isPremium } = useSubscription();
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && !conversationId) {
      initConversation();
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  async function initConversation() {
    setInitializing(true);
    try {
      const stored = localStorage.getItem("rosa_chatbot_conversation");
      if (stored) {
        const { id } = JSON.parse(stored);
        const res = await fetch(`${BASE_URL}/api/openai/conversations/${id}`);
        if (res.ok) {
          const data = await res.json();
          setConversationId(id);
          setMessages(
            (data.messages || []).map((m: any) => ({
              id: String(m.id),
              role: m.role,
              content: m.content,
            }))
          );
          setInitializing(false);
          return;
        }
      }
      const res = await fetch(`${BASE_URL}/api/openai/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "ROSA Chat" }),
      });
      const conv = await res.json();
      setConversationId(conv.id);
      localStorage.setItem("rosa_chatbot_conversation", JSON.stringify({ id: conv.id }));
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: "Hi, I'm ROSA. I'm here for you — whether you need to talk, get advice, or just feel less alone. What's on your mind today?",
        },
      ]);
    } catch {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: "Hi, I'm ROSA. I'm here for you. What's on your mind today?",
        },
      ]);
    }
    setInitializing(false);
  }

  async function sendMessage() {
    if (!input.trim() || loading || !conversationId) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input.trim() };
    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", content: "", streaming: true }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${BASE_URL}/api/openai/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMsg.content }),
      });
      if (!res.body) throw new Error("No stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.done) break;
              if (parsed.content) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: m.content + parsed.content } : m
                  )
                );
              }
            } catch {}
          }
        }
      }
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m))
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "I'm having a moment. Please try again.", streaming: false }
            : m
        )
      );
    }
    setLoading(false);
  }

  async function clearChat() {
    if (conversationId) {
      try {
        await fetch(`${BASE_URL}/api/openai/conversations/${conversationId}`, { method: "DELETE" });
      } catch {}
    }
    localStorage.removeItem("rosa_chatbot_conversation");
    setConversationId(null);
    setMessages([]);
    setOpen(false);
    setTimeout(() => setOpen(true), 100);
  }

  if (!isPremium) {
    return (
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => window.location.href = "#/subscription"}
        className="fixed bottom-24 right-4 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-rose-400 to-pink-600 shadow-lg flex items-center justify-center text-white"
      >
        <MessageCircle className="w-6 h-6" />
      </motion.button>
    );
  }

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        className="fixed bottom-24 right-4 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 shadow-xl flex items-center justify-center text-white"
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X className="w-6 h-6" />
            </motion.div>
          ) : (
            <motion.div key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <MessageCircle className="w-6 h-6" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-44 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm bg-card border border-border rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            style={{ height: "min(520px, calc(100dvh - 14rem))" }}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-rose-500 to-pink-600 text-white">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span className="font-serif text-base font-medium">ROSA</span>
                <span className="text-white/70 text-xs">your companion</span>
              </div>
              <button onClick={clearChat} className="text-white/70 hover:text-white">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {initializing && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-gradient-to-br from-rose-500 to-pink-600 text-white rounded-tr-sm"
                        : "bg-muted text-foreground rounded-tl-sm"
                    }`}
                  >
                    {m.content}
                    {m.streaming && (
                      <span className="inline-block w-1 h-3 bg-current ml-0.5 animate-pulse rounded" />
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="px-3 pb-3 pt-2 border-t border-border">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder="Talk to ROSA..."
                  className="rounded-2xl border-border text-sm"
                  disabled={loading}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  size="icon"
                  className="rounded-2xl bg-rose-500 hover:bg-rose-600 text-white shrink-0"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
