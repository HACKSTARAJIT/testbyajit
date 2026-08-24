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
import { ArrowLeft, Brain, CheckCircle2, ChevronRight, FileText, FolderTree, History as HistoryIcon, Pause, Play, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
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

type ClassificationJob = {
  id: string;
  scope_type: "mock" | "subject";
  scope_key: string;
  mock_id: string | null;
  subject: string;
  total_questions: number;
  completed_questions: number;
  failed_questions: number;
  skipped_questions: number;
  current_question: number;
  status: string;
  error_message: string | null;
};

export default function MockMistakesSubject() {
  const { subject = "" } = useParams();
  const subjectName = decodeURIComponent(subject);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mocks, setMocks] = useState<MockRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [classified, setClassified] = useState<Record<string, number>>({});
  const [pending, setPending] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [chapters, setChapters] = useState<ChapterNode[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [topicStats, setTopicStats] = useState<Record<string, TopicTestStats>>({});
  const [jobs, setJobs] = useState<ClassificationJob[]>([]);
  const [jobAction, setJobAction] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const loadJobs = async () => {
    if (!user) return;
    const { data, error } = await supabase.functions.invoke("ai-organize-mock", { body: { action: "status" } });
    if (!error) setJobs(((data as { jobs?: ClassificationJob[] } | null)?.jobs ?? []).filter((job) => job.subject === subjectName));
  };

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
        .select("mock_id, classification_id, ai_subject, ai_chapter, ai_topic")
        .in("mock_id", rows.map((r) => r.id));
      const acc: Record<string, number> = {};
      const pend: Record<string, number> = {};
      (qs ?? []).forEach((q: any) => {
        acc[q.mock_id] = (acc[q.mock_id] ?? 0) + 1;
        const valid = Boolean(q.classification_id && q.ai_subject?.trim() && q.ai_chapter?.trim() && q.ai_topic?.trim());
        if (valid) classified[q.mock_id] = (classified[q.mock_id] ?? 0) + 1;
        else pend[q.mock_id] = (pend[q.mock_id] ?? 0) + 1;
      });
      setCounts(acc);
      setPending(pend);
      setClassified({ ...classified });
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

  useEffect(() => { load(); loadChapters(); loadJobs(); /* eslint-disable-next-line */ }, [user, subjectName]);

  const activeStatuses = ["pending", "processing"];
  const activeJobs = jobs.filter((job) => activeStatuses.includes(job.status));
  const hasActiveJob = activeJobs.length > 0;

  // Poll durable backend jobs rather than relying on legacy card state.
  useEffect(() => {
    if (!hasActiveJob) {
      if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    if (pollRef.current) return;
    pollRef.current = window.setInterval(async () => {
      await Promise.all([load(), loadJobs()]);
    }, 3000);
    return () => {
      if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [hasActiveJob]); // eslint-disable-line react-hooks/exhaustive-deps

  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !hasActiveJob) loadChapters();
    wasBusy.current = hasActiveJob;
  }, [hasActiveJob]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const { error } = await supabase.functions.invoke("ai-organize-mock", { body: { action: "start", mockId: m.id } });
    if (error) {
      toast({ title: "AI Organize failed", description: error.message, variant: "destructive" });
      load();
      return;
    }
    toast({ title: "🧠 AI Organize started", description: "Chal raha hai background me — aap app use karte rahiye." });
    await Promise.all([load(), loadJobs()]);
  };

  const latestJob = (scopeType: "mock" | "subject", scopeKey: string) =>
    jobs.find((job) => job.scope_type === scopeType && job.scope_key === scopeKey);

  const updateJob = async (job: ClassificationJob, action: "resume" | "cancel") => {
    setJobAction(`${action}:${job.id}`);
    const { error } = await supabase.functions.invoke("ai-organize-mock", { body: { action, jobId: job.id } });
    setJobAction(null);
    if (error) {
      toast({ title: action === "resume" ? "Resume failed" : "Cancel failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: action === "resume" ? "Classification resumed" : "Classification cancelled" });
    await Promise.all([load(), loadJobs()]);
  };

  const normalize = async () => {
    if (!user) return;
    await loadChapters();
    toast({ title: "Hierarchy refreshed", description: "Existing saved classifications se chapters dobara calculate kiye gaye. Koi AI request nahi bheji gayi." });
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
                const job = latestJob("mock", m.id);
                const jobIsActive = job && activeStatuses.includes(job.status);
                const jobNeedsResume = job && ["stalled", "paused", "partial", "failed"].includes(job.status);
                const totalQuestions = counts[m.id] ?? 0;
                const classifiedQuestions = classified[m.id] ?? 0;
                const unresolvedQuestions = pending[m.id] ?? 0;
                const status: OrganizeStatus = jobIsActive ? "processing" : unresolvedQuestions === 0 && totalQuestions > 0 ? "organized" : classifiedQuestions > 0 ? "updated" : "not_organized";
                const meta = STATUS_META[status] ?? STATUS_META.not_organized;
                const processed = job ? job.completed_questions + job.failed_questions + job.skipped_questions : m.organize_progress;
                const total = job?.total_questions || m.organize_total || 1;
                const statusText = jobIsActive
                  ? `Processing ${processed}/${total}`
                  : jobNeedsResume
                    ? `${classifiedQuestions > 0 ? "Partially Organized" : "Paused"} — ${classifiedQuestions}/${totalQuestions}`
                    : unresolvedQuestions === 0 && totalQuestions > 0
                      ? `Organized — ${classifiedQuestions}/${totalQuestions}`
                      : classifiedQuestions > 0
                        ? `Partially Organized — ${classifiedQuestions}/${totalQuestions}`
                        : "Not Organized";
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
                            {totalQuestions} questions · {meta.dot} {statusText}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </button>
                      <Button variant="ghost" size="icon" onClick={() => removeMock(m.id)} aria-label="Delete mock">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    {jobIsActive ? (
                      <div className="space-y-2">
                        <Progress value={Math.round(((processed ?? 0) / total) * 100)} className="h-2" />
                        <p className="text-xs text-muted-foreground">
                          Classifying {processed ?? 0} / {total}
                          {job.failed_questions > 0 ? ` · ${job.failed_questions} failed` : ""}
                        </p>
                        <Button variant="outline" size="sm" className="w-full rounded-xl" onClick={() => updateJob(job, "cancel")} disabled={jobAction === `cancel:${job.id}`}>
                          <Pause className="mr-1 h-3.5 w-3.5" /> Cancel
                        </Button>
                      </div>
                    ) : jobNeedsResume ? (
                      <div className="space-y-2">
                        <Progress value={Math.round(((processed ?? 0) / total) * 100)} className="h-2" />
                        <p className="text-xs text-destructive">{job.error_message ?? "Classification paused. Resume to continue."}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="secondary" size="sm" className="rounded-xl" onClick={() => updateJob(job, "resume")} disabled={jobAction === `resume:${job.id}`}>
                            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Resume
                          </Button>
                          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => updateJob(job, "cancel")} disabled={jobAction === `cancel:${job.id}`}>
                            <Pause className="mr-1 h-3.5 w-3.5" /> Cancel
                          </Button>
                        </div>
                      </div>
                    ) : unresolvedQuestions === 0 && totalQuestions > 0 ? (
                      <Button variant="secondary" className="w-full rounded-xl" disabled>
                        <CheckCircle2 className="mr-1 h-4 w-4" /> Organized ✓
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        className="w-full rounded-xl"
                        onClick={() => organize(m)}
                        disabled={(counts[m.id] ?? 0) === 0}
                      >
                        <Brain className="mr-1 h-4 w-4" /> {classifiedQuestions > 0 ? `Resume — ${classifiedQuestions}/${totalQuestions}` : "AI Organize"}
                      </Button>
                    )}
                    {m.organize_error && (
                      <p className="text-xs text-destructive">{job ? m.organize_error : null}</p>
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
                Existing saved classifications से Subject → Chapter → Topic → Sub-topic hierarchy को दोबारा calculate करें। यह AI reclassification नहीं चलाता।
              </p>
              <Button variant="secondary" className="w-full rounded-xl" onClick={normalize} disabled={chaptersLoading}>
                <RefreshCw className="mr-1 h-4 w-4" /> Rebuild AI Hierarchy
              </Button>
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
                      <p className="text-xs text-muted-foreground">{c.topics.length} topics · {c.total} questions</p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pb-4">
                    <Accordion type="multiple" className="space-y-3">
                      {c.topics.map((t) => {
                        const key = topicSourceKey(subjectName, c.chapter, t.topic);
                        const s = topicStats[key];
                        const route = `/mock-mistakes/${encodeURIComponent(subjectName)}/topic/${topicRouteKey(c.chapter, t.topic)}`;
                        return (
                          <AccordionItem
                            key={t.topic}
                            value={`${c.chapter}|||${t.topic}`}
                            className="rounded-2xl border-0 bg-muted/40 px-4"
                          >
                            <AccordionTrigger className="hover:no-underline">
                              <div className="min-w-0 text-left">
                                <p className="truncate font-semibold">{t.topic}</p>
                                <p className="text-xs text-muted-foreground">
                                  {t.subtopics.length > 0 ? `${t.subtopics.length} sub-topics · ` : ""}
                                  {t.questions.length} questions
                                </p>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-3 pb-4">
                              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                <span>📄 Questions: <b className="text-foreground">{t.questions.length}</b></span>
                                <span>🔁 Practices: <b className="text-foreground">{s?.attempts ?? 0}</b></span>
                                <span>🎯 Best Accuracy: <b className="text-foreground">{s ? `${s.bestAccuracy}%` : "—"}</b></span>
                                <span>🕒 Last: <b className="text-foreground">{s?.lastAt ? new Date(s.lastAt).toLocaleDateString() : "—"}</b></span>
                              </div>

                              {t.subtopics.length > 0 && (
                                <div className="space-y-1.5 rounded-xl bg-background/40 p-3">
                                  {t.subtopics.map((st) => (
                                    <div key={st.subtopic} className="flex items-center justify-between gap-3 text-xs">
                                      <span className="min-w-0 truncate">↳ {st.subtopic}</span>
                                      <b className="shrink-0 text-foreground">{st.questions.length}</b>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="flex flex-wrap gap-2">
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
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
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
