import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Loader2, Trash2, Sparkles, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiUrl } from "@/lib/api";
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
};

// Other parts of the app (the mobile bottom nav, for example) drive the
// chat through these DOM events. `open` opens it; `toggle` flips state so a
// second tap closes it. Keeps FloatingChat self-contained — no context
// refactor needed.
export const ROSA_OPEN_CHAT_EVENT = "rosa:open-chat";
export const ROSA_TOGGLE_CHAT_EVENT = "rosa:toggle-chat";

export function FloatingChat() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const openHandler = () => setOpen(true);
    const toggleHandler = () => setOpen((o) => !o);
    window.addEventListener(ROSA_OPEN_CHAT_EVENT, openHandler);
    window.addEventListener(ROSA_TOGGLE_CHAT_EVENT, toggleHandler);
    return () => {
      window.removeEventListener(ROSA_OPEN_CHAT_EVENT, openHandler);
      window.removeEventListener(ROSA_TOGGLE_CHAT_EVENT, toggleHandler);
    };
  }, []);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const speechSupported = typeof window !== "undefined" && (("SpeechRecognition" in window) || ("webkitSpeechRecognition" in window));
  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  // Tracks lifetime so async callbacks (fetch streams, deferred reopens, speech
  // events) don't call setState after the component is gone. Strict-mode and
  // route changes both unmount this component, so without this guard React
  // warns and we risk leaking the SSE reader.
  const mountedRef = useRef(true);
  const reopenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (reopenTimerRef.current) clearTimeout(reopenTimerRef.current);
      abortRef.current?.abort();
      // Stop any in-flight speech recognition so callbacks don't fire after unmount.
      try { recognitionRef.current?.stop(); } catch {}
      // Cancel any TTS in progress.
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try { window.speechSynthesis.cancel(); } catch {}
      }
    };
  }, []);

  const toggleListen = () => {
    if (!speechSupported) return;
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "en-US"; rec.interimResults = true; rec.continuous = false;
    rec.onresult = (e: any) => {
      if (!mountedRef.current) return;
      const transcript = Array.from(e.results).map((r: any) => r[0].transcript).join("");
      setInput(transcript);
      if (e.results[e.results.length - 1].isFinal) { try { rec.stop(); } catch {} }
    };
    rec.onerror = () => { if (mountedRef.current) setListening(false); };
    rec.onend = () => { if (mountedRef.current) setListening(false); };
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  const speak = (text: string) => {
    if (!ttsSupported || !speakReplies) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1; u.pitch = 1.05; u.volume = 0.9;
    const voices = window.speechSynthesis.getVoices();
    const female = voices.find(v => /female|samantha|victoria|karen|tessa|moira|fiona|zira/i.test(v.name));
    if (female) u.voice = female;
    window.speechSynthesis.speak(u);
  };

  useEffect(() => {
    if (open && !conversationId) {
      initConversation();
    }
    // When the user closes the panel, abort any in-flight stream so the
    // SSE reader doesn't keep running in the background.
    if (!open) {
      abortRef.current?.abort();
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, [open]);

  async function initConversation() {
    setInitializing(true);
    // Dedicated abort controller for the init lifecycle so unmount tears
    // down any in-flight resume/create fetch and we never call setState after.
    const ac = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ac;
    const safeSet = <T,>(setter: (v: T) => void, v: T) => {
      if (mountedRef.current && !ac.signal.aborted) setter(v);
    };
    try {
      // Try to resume an existing conversation, but only if the stored id is a real positive number.
      // (Old/corrupt entries with id === undefined / null / NaN used to produce
      //  /api/openai/conversations/undefined and 404. Validate before using.)
      const stored = localStorage.getItem("rosa_chatbot_conversation");
      let storedId: number | null = null;
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const n = Number(parsed?.id);
          if (Number.isFinite(n) && n > 0) storedId = n;
        } catch {}
        // Wipe corrupt entries so we never try them again.
        if (storedId === null) localStorage.removeItem("rosa_chatbot_conversation");
      }
      if (storedId !== null) {
        const res = await fetch(apiUrl(`/api/openai/conversations/${storedId}`), { signal: ac.signal });
        if (res.ok) {
          const data = await res.json();
          safeSet(setConversationId, storedId);
          safeSet(setMessages,
            (data.messages || []).map((m: any) => ({
              id: String(m.id),
              role: m.role,
              content: m.content,
            }))
          );
          return;
        }
        // Conversation no longer exists on the server — drop the stale id and create a fresh one.
        localStorage.removeItem("rosa_chatbot_conversation");
      }
      // Create a brand-new conversation. Validate the response before storing the id.
      const res = await fetch(apiUrl(`/api/openai/conversations`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "ROSA Chat" }),
        signal: ac.signal,
      });
      if (!res.ok) throw new Error(`Failed to create conversation (${res.status})`);
      const conv = await res.json();
      const newId = Number(conv?.id);
      if (!Number.isFinite(newId) || newId <= 0) {
        throw new Error("Server returned invalid conversation id");
      }
      safeSet(setConversationId, newId);
      localStorage.setItem("rosa_chatbot_conversation", JSON.stringify({ id: newId }));
      safeSet(setMessages, [
        {
          id: "welcome",
          role: "assistant",
          content: "Hi, I'm ROSA. I'm here for you — whether you need to talk, get advice, or just feel less alone. What's on your mind today?",
        },
      ]);
    } catch (err: any) {
      // Aborted init (panel closed or unmount) is a no-op, not an error.
      const aborted = ac.signal.aborted || err?.name === "AbortError";
      if (aborted) return;
      safeSet(setMessages, [
        {
          id: "welcome",
          role: "assistant",
          content: "Hi, I'm ROSA. I'm here for you. What's on your mind today?",
        },
      ]);
    } finally {
      if (mountedRef.current && !ac.signal.aborted) setInitializing(false);
    }
  }

  async function sendMessage() {
    if (!input.trim() || loading || !conversationId) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input.trim() };
    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", content: "", streaming: true }]);
    setInput("");
    setLoading(true);

    // Cancel any prior in-flight stream and arm a fresh AbortController so
    // unmount (or a rapid second send) tears down the SSE reader cleanly.
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch(apiUrl(`/api/openai/conversations/${conversationId}/messages`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMsg.content }),
        signal: ac.signal,
      });
      if (!res.body) throw new Error("No stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!mountedRef.current || ac.signal.aborted) {
          try { await reader.cancel(); } catch {}
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.done) break;
              if (parsed.content && mountedRef.current) {
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
      if (!mountedRef.current) return;
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m));
        const finished = next.find(m => m.id === assistantId);
        if (finished) speak(finished.content);
        return next;
      });
    } catch (err: any) {
      // Aborted streams (user closed the panel, navigated away, or sent a new
      // message that superseded this one) are NOT failures — silently bail
      // without surfacing the "I'm having a moment" error to the user.
      const aborted = ac.signal.aborted || err?.name === "AbortError";
      if (aborted || !mountedRef.current) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "I'm having a moment. Please try again.", streaming: false }
            : m
        )
      );
    } finally {
      // Guard the loading reset too — without this, an unmount-driven abort
      // could call setState on a dead component.
      if (mountedRef.current) setLoading(false);
    }
  }

  async function clearChat() {
    if (conversationId) {
      try {
        await fetch(apiUrl(`/api/openai/conversations/${conversationId}`), { method: "DELETE" });
      } catch {}
    }
    localStorage.removeItem("rosa_chatbot_conversation");
    if (!mountedRef.current) return;
    setConversationId(null);
    setMessages([]);
    setOpen(false);
    if (reopenTimerRef.current) clearTimeout(reopenTimerRef.current);
    reopenTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setOpen(true);
    }, 100);
  }

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        // The `floating-chat-fab` class lets the layout hide just the button
        // on mobile (where the bottom-nav Chat tab opens the same chat).
        className="floating-chat-fab hidden md:flex fixed bottom-6 right-4 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 shadow-xl items-center justify-center text-white"
        aria-label="Open ROSA chat"
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
              {/* Two icon buttons. The X is critical on mobile where the FAB
                  toggle is hidden — without it the chat had no close affordance. */}
              <div className="flex items-center gap-1">
                <button
                  onClick={clearChat}
                  className="text-white/70 hover:text-white p-1.5 rounded-lg"
                  aria-label="Clear conversation"
                  title="Clear conversation"
                  data-testid="chat-clear"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="text-white/70 hover:text-white p-1.5 rounded-lg"
                  aria-label="Close chat"
                  title="Close chat"
                  data-testid="chat-close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
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
                {speechSupported && (
                  <Button onClick={toggleListen} size="icon" variant={listening ? "default" : "outline"}
                    className={`rounded-2xl shrink-0 ${listening ? "bg-rose-500 hover:bg-rose-600 text-white animate-pulse" : ""}`}
                    title={listening ? "Stop listening" : "Voice input"}
                    aria-label={listening ? "Stop listening" : "Voice input"}
                    data-testid="button-mic">
                    {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </Button>
                )}
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder={listening ? "Listening…" : "Talk to ROSA…"}
                  className="rounded-2xl border-border text-sm"
                  disabled={loading}
                />
                {ttsSupported && (
                  <Button onClick={() => { setSpeakReplies(s => !s); if (speakReplies) window.speechSynthesis.cancel(); }}
                    size="icon" variant={speakReplies ? "default" : "outline"}
                    className={`rounded-2xl shrink-0 ${speakReplies ? "bg-violet-500 hover:bg-violet-600 text-white" : ""}`}
                    title={speakReplies ? "Mute voice replies" : "Hear ROSA's voice"}
                    aria-label={speakReplies ? "Mute voice replies" : "Hear ROSA's voice"}
                    data-testid="button-tts">
                    {speakReplies ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </Button>
                )}
                <Button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  size="icon"
                  className="rounded-2xl bg-rose-500 hover:bg-rose-600 text-white shrink-0"
                  aria-label={loading ? "Sending message" : "Send message"}
                  title="Send message"
                  data-testid="button-send"
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
