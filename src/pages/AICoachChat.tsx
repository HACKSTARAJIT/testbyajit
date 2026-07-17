import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, MessageSquare, Send, Loader2, Brain } from "lucide-react";

type Thread = { id: string; title: string; last_message_at: string };
type Msg = { id: string; role: "user" | "assistant" | "system"; content: string; created_at: string };

const SUGGESTIONS = [
  "What should I study today?",
  "Why am I losing marks?",
  "Which chapter should I revise first?",
  "Am I improving compared to my last mock?",
];

export default function AICoachChat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { threadId } = useParams<{ threadId: string }>();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeThread = useMemo(() => threads.find((t) => t.id === threadId) ?? null, [threads, threadId]);

  // Load threads (and pick/create one)
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoadingThreads(true);
      const { data } = await (supabase as any).from("ai_chat_threads")
        .select("id, title, last_message_at").eq("user_id", user.id).order("last_message_at", { ascending: false });
      const list = (data as Thread[]) ?? [];
      setThreads(list);
      setLoadingThreads(false);
      if (!threadId) {
        if (list[0]) navigate(`/ai-coach/chat/${list[0].id}`, { replace: true });
        else {
          const t = await createThread();
          if (t) navigate(`/ai-coach/chat/${t.id}`, { replace: true });
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Load messages for active thread
  useEffect(() => {
    if (!threadId || !user) { setMessages([]); return; }
    (async () => {
      const { data } = await (supabase as any).from("ai_chat_messages")
        .select("id, role, content, created_at")
        .eq("thread_id", threadId).order("created_at");
      setMessages((data as Msg[]) ?? []);
      setTimeout(() => inputRef.current?.focus(), 50);
    })();
  }, [threadId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function createThread(): Promise<Thread | null> {
    if (!user) return null;
    const { data, error } = await (supabase as any).from("ai_chat_threads")
      .insert({ user_id: user.id, title: "New chat" }).select("id, title, last_message_at").single();
    if (error) { toast.error("Could not create chat"); return null; }
    setThreads((prev) => [data as Thread, ...prev]);
    return data as Thread;
  }

  async function newChat() {
    const t = await createThread();
    if (t) navigate(`/ai-coach/chat/${t.id}`);
  }

  async function deleteThread(id: string) {
    if (!confirm("Delete this conversation?")) return;
    await (supabase as any).from("ai_chat_threads").delete().eq("id", id);
    setThreads((prev) => prev.filter((t) => t.id !== id));
    if (id === threadId) {
      const rest = threads.filter((t) => t.id !== id);
      if (rest[0]) navigate(`/ai-coach/chat/${rest[0].id}`, { replace: true });
      else navigate(`/ai-coach/chat`, { replace: true });
    }
  }

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || sending || !threadId) return;
    setInput("");
    setSending(true);
    // Optimistic user bubble
    const optimistic: Msg = { id: crypto.randomUUID(), role: "user", content: message, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const { data, error } = await supabase.functions.invoke("ai-coach-chat", {
        body: { threadId, message },
      });
      if (error) throw error;
      const reply = (data as any)?.reply ?? "";
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: reply, created_at: new Date().toISOString() }]);
      // refresh thread meta
      setThreads((prev) => prev.map((t) => t.id === threadId
        ? { ...t, last_message_at: new Date().toISOString(), title: t.title === "New chat" ? message.slice(0, 60) : t.title }
        : t));
    } catch (e: any) {
      const detail = e?.context ? await e.context.text?.().catch(() => "") : "";
      toast.error(detail || e?.message || "AI Coach couldn't respond. Try again.");
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col md:flex-row max-w-6xl mx-auto">
      {/* Sidebar */}
      <aside className="md:w-72 shrink-0 md:border-r border-white/10 md:h-full flex flex-col">
        <div className="p-3 flex items-center gap-2 border-b border-white/10">
          <Button variant="ghost" size="icon" onClick={() => navigate("/ai-coach")} aria-label="Back to AI Coach"><ArrowLeft className="w-4 h-4" /></Button>
          <div className="font-semibold text-sm flex-1">Chats</div>
          <Button size="sm" onClick={newChat}><Plus className="w-4 h-4 mr-1" />New</Button>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1">
          {loadingThreads && <p className="text-xs text-muted-foreground p-2">Loading…</p>}
          {!loadingThreads && threads.length === 0 && (
            <p className="text-xs text-muted-foreground p-2">No chats yet.</p>
          )}
          {threads.map((t) => (
            <div key={t.id}
              className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 cursor-pointer border ${
                t.id === threadId ? "bg-white/10 border-white/20" : "border-transparent hover:bg-white/5"
              }`}
              onClick={() => navigate(`/ai-coach/chat/${t.id}`)}
            >
              <MessageSquare className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm truncate flex-1">{t.title || "New chat"}</span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteThread(t.id); }}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400"
                aria-label="Delete chat"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Chat area */}
      <section className="flex-1 flex flex-col min-h-0">
        <div className="p-3 border-b border-white/10 flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <div>
            <div className="font-semibold text-sm">{activeThread?.title || "AI Coach"}</div>
            <div className="text-[11px] text-muted-foreground">Grounded on your AJIT 360 data — no generic advice.</div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {messages.length === 0 && !sending && (
            <div className="max-w-lg mx-auto text-center pt-10 space-y-4">
              <Brain className="w-12 h-12 mx-auto text-primary/60" />
              <h2 className="text-lg font-semibold">Ask me anything about your prep</h2>
              <p className="text-sm text-muted-foreground">
                मैं आपकी Practice Tests, Smart Revision, Wrong Questions और Mock Reports देखकर ही जवाब देता हूँ।
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-sm text-left rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2"
                  >{s}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "user" ? (
                <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bg-primary text-primary-foreground text-sm whitespace-pre-wrap">
                  {m.content}
                </div>
              ) : (
                <div className="max-w-[85%] text-sm leading-relaxed">
                  <div className="text-[11px] text-primary/80 mb-1 flex items-center gap-1"><Brain className="w-3 h-3" /> AI Coach</div>
                  <div className="prose prose-invert prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-strong:text-foreground">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Coach सोच रहा है…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Composer */}
        <div className="border-t border-white/10 p-3">
          <div className="flex gap-2 items-end">
            <Textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder="Ask your Coach…"
              className="min-h-[44px] max-h-40 resize-none bg-white/5 border-white/10"
              disabled={sending || !threadId}
            />
            <Button onClick={() => send()} disabled={sending || !input.trim() || !threadId} size="icon" className="h-11 w-11 shrink-0" aria-label="Send message">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            AI Coach केवल आपकी AJIT 360 data पर आधारित है — Selection guarantee नहीं देता।
          </p>
        </div>
      </section>
    </div>
  );
}
