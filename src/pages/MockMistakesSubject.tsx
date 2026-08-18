import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, Brain, ChevronRight, FileText, FolderTree, History as HistoryIcon, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  loadAIChapters, loadTopicStats, topicRouteKey, topicSourceKey, STATUS_META,
  type ChapterNode, type OrganizeStatus, type TopicTestStats,
} from "@/lib/aiChapters";

type MockRow = {
  id: string;
  name: string;
  created_at: string;
  organize_status: OrganizeStatus;
  organize_progress: number;
  organize_total: number;
  organize_message: string | null;
  organize_error: string | null;
};

export default function MockMistakesSubject() {
  const { subject = "" } = useParams();
  const subjectName = decodeURIComponent(subject);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mocks, setMocks] = useState<MockRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [pending, setPending] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [chapters, setChapters] = useState<ChapterNode[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [topicStats, setTopicStats] = useState<Record<string, TopicTestStats>>({});
  const pollRef = useRef<number | null>(null);

  const load = async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("mock_mistake_mocks")
      .select("id, name, created_at, organize_status, organize_progress, organize_total, organize_message, organize_error")
      .eq("user_id", user.id)
      .eq("subject", subjectName)
      .order("created_at", { ascending: false });
    const rows = (data as MockRow[]) ?? [];
    setMocks(rows);
    if (rows.length) {
      const { data: qs } = await supabase
        .from("mock_mistake_questions")
        .select("mock_id, classification_id")
        .in("mock_id", rows.map((r) => r.id));
      const acc: Record<string, number> = {};
      const pend: Record<string, number> = {};
      (qs ?? []).forEach((q: any) => {
        acc[q.mock_id] = (acc[q.mock_id] ?? 0) + 1;
        if (!q.classification_id) pend[q.mock_id] = (pend[q.mock_id] ?? 0) + 1;
      });
      setCounts(acc);
      setPending(pend);
    }
    setLoading(false);
  };

  const loadChapters = async () => {
    if (!user) return;
    setChaptersLoading(true);
    const [{ chapters }, stats] = await Promise.all([
      loadAIChapters(user.id, subjectName),
      loadTopicStats(user.id, subjectName),
    ]);
    setChapters(chapters);
    setTopicStats(stats);
    setChaptersLoading(false);
  };

  useEffect(() => { load(); loadChapters(); /* eslint-disable-next-line */ }, [user, subjectName]);

  // Poll while any mock is being organized in the background.
  useEffect(() => {
    const busy = mocks.some((m) => m.organize_status === "processing");
    if (!busy) {
      if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    if (pollRef.current) return;
    pollRef.current = window.setInterval(async () => {
      await load();
    }, 3000);
    return () => {
      if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [mocks]); // eslint-disable-line react-hooks/exhaustive-deps

  const wasBusy = useRef(false);
  useEffect(() => {
    const busy = mocks.some((m) => m.organize_status === "processing");
    if (wasBusy.current && !busy) loadChapters();
    wasBusy.current = busy;
  }, [mocks]); // eslint-disable-line react-hooks/exhaustive-deps

  const createMock = async () => {
    if (!user || !name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("mock_mistake_mocks")
      .insert({ user_id: user.id, subject: subjectName, name: name.trim() })
      .select("id")
      .single();
    setSaving(false);
    if (error) { toast({ title: "Could not create mock", description: error.message, variant: "destructive" }); return; }
    setOpen(false);
    setName("");
    navigate(`/mock-mistakes/${encodeURIComponent(subjectName)}/${data.id}`);
  };

  const removeMock = async (id: string) => {
    const { error } = await supabase.from("mock_mistake_mocks").delete().eq("id", id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    setMocks((m) => m.filter((x) => x.id !== id));
  };

  const organize = async (m: MockRow) => {
    if ((counts[m.id] ?? 0) === 0) {
      toast({ title: "No questions to organize", description: "Import questions into this mock first.", variant: "destructive" });
      return;
    }
    setMocks((prev) => prev.map((x) => x.id === m.id
      ? { ...x, organize_status: "processing", organize_message: "Preparing...", organize_progress: 0, organize_total: pending[m.id] ?? 0 }
      : x));
    const { error } = await supabase.functions.invoke("ai-organize-mock", { body: { mockId: m.id } });
    if (error) {
      toast({ title: "AI Organize failed", description: error.message, variant: "destructive" });
      load();
      return;
    }
    toast({ title: "🧠 AI Organize started", description: "Chal raha hai background me — aap app use karte rahiye." });
    load();
  };

  const busy = mocks.some((m) => m.organize_status === "processing");
  const busyMock = mocks.find((m) => m.organize_status === "processing");

  const normalize = async () => {
    if (!user || busy) return;
    setMocks((prev) => prev.map((x) => ({
      ...x, organize_status: "processing", organize_message: "Preparing...", organize_progress: 0,
    })));
    const { error } = await supabase.functions.invoke("ai-organize-mock", {
      body: { mode: "normalize", subject: subjectName },
    });
    if (error) {
      toast({ title: "Normalize failed", description: error.message, variant: "destructive" });
      load();
      return;
    }
    toast({ title: "🧠 Normalize & Reorganize started", description: "Background me chal raha hai — questions safe hain, sirf classification update hogi." });
    load();
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate("/mock-mistakes")}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Mock Mistakes
      </Button>

      <div className="rounded-3xl bg-gradient-royal p-6 text-white shadow-lg">
        <h1 className="font-display text-2xl font-bold">{subjectName}</h1>
        <p className="text-sm text-white/85">Your mocks in this subject</p>
      </div>

      <Tabs defaultValue="mocks" className="w-full">
        <TabsList className="grid w-full grid-cols-2 rounded-2xl">
          <TabsTrigger value="mocks" className="rounded-xl">📄 Mock Tests</TabsTrigger>
          <TabsTrigger value="chapters" className="rounded-xl">🧠 AI Chapters</TabsTrigger>
        </TabsList>

        <TabsContent value="mocks" className="mt-4 space-y-4">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="w-full rounded-2xl"><Plus className="mr-1 h-4 w-4" /> Create New Mock</Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl">
              <DialogHeader><DialogTitle>Create New Mock</DialogTitle></DialogHeader>
              <Input
                placeholder="Mock Name (e.g. SSC CGL Mock 01)"
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
              />
              <DialogFooter>
                <Button onClick={createMock} disabled={saving || !name.trim()} className="w-full rounded-xl">
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
          ) : mocks.length === 0 ? (
            <div className="glass-card rounded-3xl p-10 text-center text-muted-foreground">
              <FileText className="mx-auto h-10 w-10" />
              <p className="mt-3 font-semibold">No mocks yet</p>
              <p className="mt-1 text-sm">Create your first mock to start saving mistakes.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {mocks.map((m) => {
                const status: OrganizeStatus =
                  m.organize_status === "organized" && (pending[m.id] ?? 0) > 0
                    ? "updated"
                    : (m.organize_status ?? "not_organized");
                const meta = STATUS_META[status] ?? STATUS_META.not_organized;
                const total = m.organize_total || 1;
                return (
                  <div key={m.id} className="glass-card space-y-3 rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                      <button
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        onClick={() => navigate(`/mock-mistakes/${encodeURIComponent(subjectName)}/${m.id}`)}
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{m.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {counts[m.id] ?? 0} questions · {meta.dot} {meta.label}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </button>
                      <Button variant="ghost" size="icon" onClick={() => removeMock(m.id)} aria-label="Delete mock">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    {status === "processing" ? (
                      <div className="space-y-1.5">
                        <Progress value={Math.round(((m.organize_progress ?? 0) / total) * 100)} className="h-2" />
                        <p className="text-xs text-muted-foreground">
                          {m.organize_message ?? "Analyzing..."}
                        </p>
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        className="w-full rounded-xl"
                        onClick={() => organize(m)}
                        disabled={(counts[m.id] ?? 0) === 0}
                      >
                        <Brain className="mr-1 h-4 w-4" /> AI Organize
                        {(pending[m.id] ?? 0) > 0 && status !== "not_organized" ? ` (${pending[m.id]} new)` : ""}
                      </Button>
                    )}
                    {m.organize_error && (
                      <p className="text-xs text-destructive">{m.organize_error}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="chapters" className="mt-4 space-y-4">
          {chapters.length > 0 && (
            <div className="glass-card space-y-2 rounded-2xl p-4">
              <p className="text-sm font-semibold">🧠 Rebuild AI Hierarchy</p>
              <p className="text-xs text-muted-foreground">
                सभी वास्तविक Mock Mistake questions को दोबारा समझकर Subject → Chapter → Topic → Sub-topic hierarchy में व्यवस्थित करें। प्रश्न, अभ्यास इतिहास और Mastery data सुरक्षित रहेंगे।
              </p>
              {busy ? (
                <div className="space-y-1.5 pt-1">
                  <Progress
                    value={Math.round(((busyMock?.organize_progress ?? 0) / (busyMock?.organize_total || 1)) * 100)}
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground">{busyMock?.organize_message ?? "Analyzing questions..."}</p>
                </div>
              ) : (
                <Button variant="secondary" className="w-full rounded-xl" onClick={normalize}>
                  <Brain className="mr-1 h-4 w-4" /> Rebuild AI Hierarchy
                </Button>
              )}
            </div>
          )}
          {chaptersLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
          ) : chapters.length === 0 ? (
            <div className="glass-card rounded-3xl p-10 text-center text-muted-foreground">
              <FolderTree className="mx-auto h-10 w-10" />
              <p className="mt-3 font-semibold">No AI Chapters yet</p>
              <p className="mt-1 text-sm">Open a mock and press 🧠 AI Organize to classify your imported questions.</p>
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-3">
              {chapters.map((c) => (
                <AccordionItem key={c.chapter} value={c.chapter} className="glass-card rounded-2xl border-0 px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="min-w-0 text-left">
                      <p className="truncate font-semibold">{c.chapter}</p>
                      <p className="text-xs text-muted-foreground">{c.topics.length} topic tests · {c.total} questions</p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pb-4">
                    {c.topics.map((t) => {
                      const key = topicSourceKey(subjectName, c.chapter, t.topic);
                      const s = topicStats[key];
                      const route = `/mock-mistakes/${encodeURIComponent(subjectName)}/topic/${topicRouteKey(c.chapter, t.topic)}`;
                      return (
                        <div key={t.topic} className="rounded-2xl bg-muted/40 p-4">
                          <p className="font-semibold">{t.topic}</p>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                            <span>📄 Questions: <b className="text-foreground">{t.questions.length}</b></span>
                            <span>🔁 Practices: <b className="text-foreground">{s?.attempts ?? 0}</b></span>
                            <span>🎯 Best Accuracy: <b className="text-foreground">{s ? `${s.bestAccuracy}%` : "—"}</b></span>
                            <span>🕒 Last: <b className="text-foreground">{s?.lastAt ? new Date(s.lastAt).toLocaleDateString() : "—"}</b></span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              className="flex-1 rounded-xl"
                              onClick={() => navigate(route, { state: { autostart: true } })}
                            >
                              <Play className="mr-1 h-3.5 w-3.5" />
                              {s?.attempts ? "Retake" : "Start Practice"}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="flex-1 rounded-xl"
                              onClick={() => navigate(route)}
                            >
                              <HistoryIcon className="mr-1 h-3.5 w-3.5" /> View History
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
}
