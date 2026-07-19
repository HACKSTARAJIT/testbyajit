import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain, BarChart3, FileText, BookOpen, BookMarked, Target, TrendingUp,
  Sparkles, CalendarDays, Loader2, ArrowRight, Trophy, Flame,
} from "lucide-react";
import { toast } from "sonner";
import AIMockAnalyzer from "./AIMockAnalyzer";
import PerformanceIntelligence from "./PerformanceIntelligence";
import AICoach from "./AICoach";
import Preparation360 from "@/components/prep360/Preparation360";
import AIMemory from "./AIMemory";
import AcademicIntelligence from "./AcademicIntelligence";

type Report = {
  id: string; title: string; status: string; created_at: string; report: any;
  accuracy: number | null; readiness_score: number | null; overall_score: number | null;
  report_type: string | null; detected_subject: string | null;
  detected_chapter: string | null; detected_topic: string | null;
};

type Task = {
  id: string; title: string; description: string | null; chapter: string | null;
  topic: string | null; task_date: string | null; scope: string; priority: string;
  status: string; estimated_minutes: number; practice_questions: number; revision_minutes: number;
  report_id: string | null;
};

export default function AIPerformanceCenter() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [wrongs, setWrongs] = useState<any[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  const load = async () => {
    if (!user) return;
    const [r, a, w, t] = await Promise.all([
      supabase.from("ai_mock_reports").select("id,title,status,created_at,report,accuracy,readiness_score,overall_score,report_type,detected_subject,detected_chapter,detected_topic")
        .eq("user_id", user.id).eq("analysis_status", "verified").order("created_at", { ascending: false }),
      supabase.from("test_attempts").select("accuracy, marks_obtained, created_at")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("wrong_questions").select("status, priority, chapter_id, subject_id, topic, wrong_count").eq("user_id", user.id),
      (supabase as any).from("study_plan_tasks").select("*").eq("user_id", user.id).order("task_date"),
    ]);
    setReports((r.data as any) ?? []);
    setAttempts(a.data ?? []);
    setWrongs(w.data ?? []);
    setTasks((t.data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const completed = reports.filter(r => r.status === "completed");
  const stats = useMemo(() => {
    const avg = (xs: number[]) => xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0;
    const mockAcc = completed.map(r => r.accuracy ?? 0).filter(x => x > 0);
    const attemptAcc = attempts.map((a: any) => a.accuracy ?? 0).filter(x => x > 0);
    const readys = completed.map(r => r.readiness_score ?? 0).filter(x => x > 0);
    return {
      mocks: completed.length,
      totalReports: reports.length,
      avgAcc: avg([...mockAcc, ...attemptAcc]),
      avgReadiness: avg(readys),
      practiceTests: attempts.length,
      pendingRevision: wrongs.filter(w => w.status === "pending").length,
      mastered: wrongs.filter(w => w.status === "mastered").length,
    };
  }, [reports, completed, attempts, wrongs]);

  const fullMocks = completed.filter(r => (r.report_type ?? "full_mock") === "full_mock");
  const subjectReports = completed.filter(r => r.report_type === "subject");
  const chapterReports = completed.filter(r => r.report_type === "chapter");
  const topicReports = completed.filter(r => r.report_type === "topic");

  async function generatePlan() {
    setGeneratingPlan(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-study-plan", { body: {} });
      if (error) throw new Error(error.message);
      toast.success(`Study plan generated — ${data?.tasks ?? 0} tasks`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Plan generation failed");
    } finally {
      setGeneratingPlan(false);
    }
  }

  async function toggleTask(t: Task) {
    const next = t.status === "done" ? "pending" : "done";
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, status: next } : x));
    await (supabase as any).from("study_plan_tasks").update({
      status: next, completed_at: next === "done" ? new Date().toISOString() : null,
    }).eq("id", t.id);
  }

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-primary to-secondary p-2 text-primary-foreground shadow-lg shadow-primary/20">
            <Brain className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">🧠 AI Performance Center</h1>
            <p className="text-xs text-muted-foreground">
              Unified intelligence — mocks, practice, revision & AI coaching in one dashboard.
            </p>
          </div>
        </div>
      </header>

      <Tabs defaultValue="prep360" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto justify-start bg-card/60 backdrop-blur">
          <TabsTrigger value="prep360"><Brain className="mr-1 h-3.5 w-3.5" />🧠 Preparation 360°</TabsTrigger>
          <TabsTrigger value="memory"><Brain className="mr-1 h-3.5 w-3.5" />🧠 AI Memory</TabsTrigger>
          <TabsTrigger value="academic"><Brain className="mr-1 h-3.5 w-3.5" />🎓 Academic Intelligence</TabsTrigger>
          <TabsTrigger value="overview"><BarChart3 className="mr-1 h-3.5 w-3.5" />📊 Overview</TabsTrigger>
          <TabsTrigger value="mock"><FileText className="mr-1 h-3.5 w-3.5" />📝 Full Mock</TabsTrigger>
          <TabsTrigger value="subject"><BookOpen className="mr-1 h-3.5 w-3.5" />📚 Subject</TabsTrigger>
          <TabsTrigger value="chapter"><BookMarked className="mr-1 h-3.5 w-3.5" />📖 Chapter</TabsTrigger>
          <TabsTrigger value="topic"><Target className="mr-1 h-3.5 w-3.5" />🎯 Topic</TabsTrigger>
          <TabsTrigger value="performance"><TrendingUp className="mr-1 h-3.5 w-3.5" />📈 Performance</TabsTrigger>
          <TabsTrigger value="coach"><Sparkles className="mr-1 h-3.5 w-3.5" />🤖 AI Coach</TabsTrigger>
          <TabsTrigger value="planner"><CalendarDays className="mr-1 h-3.5 w-3.5" />📅 Planner</TabsTrigger>
        </TabsList>

        {/* -------- PREPARATION 360° -------- */}
        <TabsContent value="prep360"><Preparation360 /></TabsContent>

        {/* -------- AI MEMORY -------- */}
        <TabsContent value="memory"><AIMemory /></TabsContent>

        {/* -------- ACADEMIC INTELLIGENCE -------- */}
        <TabsContent value="academic"><AcademicIntelligence /></TabsContent>





        {/* -------- OVERVIEW -------- */}
        <TabsContent value="overview" className="space-y-4">
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <OverviewStat icon={<FileText />} label="AI Reports" value={completed.length} tint="from-primary/20 to-primary/5" />
            <OverviewStat icon={<Target />} label="Overall Accuracy" value={`${stats.avgAcc}%`} tint="from-emerald-500/20 to-emerald-500/5" />
            <OverviewStat icon={<TrendingUp />} label="Avg Readiness" value={`${stats.avgReadiness}%`} tint="from-sky-500/20 to-sky-500/5" />
            <OverviewStat icon={<Flame />} label="Practice Tests" value={stats.practiceTests} tint="from-orange-500/20 to-orange-500/5" />
            <OverviewStat icon={<BookMarked />} label="Pending Revision" value={stats.pendingRevision} tint="from-red-500/20 to-red-500/5" />
            <OverviewStat icon={<Trophy />} label="Mastered" value={stats.mastered} tint="from-yellow-500/20 to-yellow-500/5" />
            <OverviewStat icon={<BookOpen />} label="Subject Reports" value={subjectReports.length} tint="from-indigo-500/20 to-indigo-500/5" />
            <OverviewStat icon={<BarChart3 />} label="Chapter Reports" value={chapterReports.length} tint="from-violet-500/20 to-violet-500/5" />
          </section>

          <div className="grid gap-3 md:grid-cols-2">
            <Card className="bg-card/60 backdrop-blur">
              <CardHeader className="pb-2"><CardTitle className="text-sm">🚀 Quick Actions</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                <Button asChild size="sm" variant="outline"><Link to="/tests">Practice Tests</Link></Button>
                <Button asChild size="sm" variant="outline"><Link to="/smart-revision">Smart Revision</Link></Button>
                <Button asChild size="sm" variant="outline"><Link to="/ai-coach/chat">Chat with Coach</Link></Button>
                <Button asChild size="sm" variant="outline"><Link to="/dashboard">Dashboard</Link></Button>
              </CardContent>
            </Card>
            <Card className="bg-card/60 backdrop-blur">
              <CardHeader className="pb-2"><CardTitle className="text-sm">🧾 Recent AI Reports</CardTitle></CardHeader>
              <CardContent className="space-y-1.5">
                {completed.slice(0, 5).map(r => (
                  <div key={r.id} className="flex items-center justify-between rounded-md border bg-muted/30 px-2 py-1.5 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {reportTypeLabel(r.report_type)} · {new Date(r.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{r.accuracy ?? 0}%</Badge>
                  </div>
                ))}
                {completed.length === 0 && <p className="text-xs text-muted-foreground">No AI reports yet — upload a mock to start.</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* -------- FULL MOCK -------- */}
        <TabsContent value="mock">
          <AIMockAnalyzer />
        </TabsContent>

        {/* -------- SUBJECT / CHAPTER / TOPIC filtered report lists -------- */}
        <TabsContent value="subject">
          <FilteredReportList
            reports={subjectReports}
            emptyLabel="Upload a subject-only paper (e.g. only Maths) — AI will auto-detect and analyze."
            typeIcon="📚"
            typeName="Subject"
            groupKey="detected_subject"
          />
        </TabsContent>
        <TabsContent value="chapter">
          <FilteredReportList
            reports={chapterReports}
            emptyLabel="Upload a chapter-only paper — AI will auto-detect and analyze."
            typeIcon="📖"
            typeName="Chapter"
            groupKey="detected_chapter"
          />
        </TabsContent>
        <TabsContent value="topic">
          <FilteredReportList
            reports={topicReports}
            emptyLabel="Upload a topic-only paper — AI will auto-detect and analyze."
            typeIcon="🎯"
            typeName="Topic"
            groupKey="detected_topic"
          />
        </TabsContent>

        {/* -------- PERFORMANCE -------- */}
        <TabsContent value="performance">
          <PerformanceIntelligence />
        </TabsContent>

        {/* -------- AI COACH -------- */}
        <TabsContent value="coach">
          <AICoach />
        </TabsContent>

        {/* -------- STUDY PLANNER -------- */}
        <TabsContent value="planner" className="space-y-3">
          <Card className="bg-card/60 backdrop-blur border-primary/20">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">📅 AI Study Planner</p>
                <p className="text-xs text-muted-foreground">
                  Personalised 7-day plan built from your weak chapters, revision backlog & latest mock.
                </p>
              </div>
              <Button onClick={generatePlan} disabled={generatingPlan}>
                {generatingPlan
                  ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Generating…</>
                  : <><Sparkles className="mr-1 h-4 w-4" />Generate 7-Day Plan</>}
              </Button>
            </CardContent>
          </Card>
          <PlannerView tasks={tasks} onToggle={toggleTask} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function reportTypeLabel(t: string | null | undefined) {
  switch (t) {
    case "subject": return "📚 Subject";
    case "chapter": return "📖 Chapter";
    case "topic": return "🎯 Topic";
    case "revision_test": return "🔁 Revision Test";
    case "previous_year": return "📜 Previous Year";
    default: return "📝 Full Mock";
  }
}

function OverviewStat({ icon, label, value, tint }: { icon: React.ReactNode; label: string; value: any; tint: string }) {
  return (
    <div className={`rounded-xl border bg-gradient-to-br ${tint} p-3 backdrop-blur`}>
      <div className="mb-1 flex h-7 w-7 items-center justify-center rounded-lg bg-background/60 text-primary [&_svg]:h-4 [&_svg]:w-4">{icon}</div>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function FilteredReportList({ reports, emptyLabel, typeIcon, typeName, groupKey }: {
  reports: Report[]; emptyLabel: string; typeIcon: string; typeName: string;
  groupKey: "detected_subject" | "detected_chapter" | "detected_topic";
}) {
  const groups = useMemo(() => {
    const m = new Map<string, Report[]>();
    reports.forEach(r => {
      const k = ((r as any)[groupKey] ?? "General") as string;
      const arr = m.get(k) ?? [];
      arr.push(r); m.set(k, arr);
    });
    return [...m.entries()];
  }, [reports, groupKey]);

  if (reports.length === 0) {
    return (
      <Card className="border-dashed bg-card/40 backdrop-blur">
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <div className="text-4xl">{typeIcon}</div>
          <p className="text-sm font-semibold">No {typeName} reports yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">{emptyLabel}</p>
          <Button asChild size="sm" className="mt-2"><Link to="/ai-performance-center">Upload in Full Mock tab <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      {groups.map(([name, rs]) => (
        <div key={name} className="space-y-2">
          <p className="text-sm font-semibold">{typeIcon} {name} <span className="text-xs text-muted-foreground">({rs.length})</span></p>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {rs.map(r => (
              <Card key={r.id} className="bg-card/60 backdrop-blur">
                <CardContent className="space-y-2 p-3">
                  <p className="truncate text-sm font-semibold">{r.title}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                  <div className="grid grid-cols-3 gap-1 text-center">
                    <MiniStat label="Acc" value={r.accuracy ? `${r.accuracy}%` : "—"} />
                    <MiniStat label="Score" value={r.overall_score ?? "—"} />
                    <MiniStat label="Ready" value={r.readiness_score ? `${r.readiness_score}%` : "—"} />
                  </div>
                  {r.report?.coach_feedback && (
                    <p className="line-clamp-3 text-xs text-muted-foreground">{r.report.coach_feedback}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-md bg-muted/50 p-1.5">
      <p className="text-sm font-semibold">{value}</p>
      <p className="text-[9px] uppercase text-muted-foreground">{label}</p>
    </div>
  );
}

function PlannerView({ tasks, onToggle }: { tasks: Task[]; onToggle: (t: Task) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const byDate = useMemo(() => {
    const m = new Map<string, Task[]>();
    tasks.forEach(t => {
      const k = t.task_date ?? "later";
      const arr = m.get(k) ?? [];
      arr.push(t); m.set(k, arr);
    });
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <Card className="border-dashed bg-card/40 backdrop-blur">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No planner tasks yet — click <span className="font-semibold text-foreground">Generate 7-Day Plan</span>.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {byDate.map(([date, list]) => {
        const done = list.filter(t => t.status === "done").length;
        const isToday = date === today;
        return (
          <Card key={date} className={`bg-card/60 backdrop-blur ${isToday ? "border-primary/40" : ""}`}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm">
                <span>{isToday ? "🔥 Today" : date} <span className="text-xs text-muted-foreground">({done}/{list.length})</span></span>
                <div className="w-32"><Progress value={(done / list.length) * 100} className="h-1.5" /></div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {list.map(t => (
                <button
                  key={t.id}
                  onClick={() => onToggle(t)}
                  className={`flex w-full items-start gap-2 rounded-md border p-2 text-left text-xs transition hover:bg-muted/40 ${t.status === "done" ? "opacity-60 line-through" : ""}`}
                >
                  <div className={`mt-0.5 h-4 w-4 shrink-0 rounded border ${t.status === "done" ? "border-emerald-500 bg-emerald-500" : "border-muted-foreground/40"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{t.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {[t.chapter, t.topic].filter(Boolean).join(" · ")}
                      {t.estimated_minutes ? ` · ${t.estimated_minutes} min` : ""}
                      {t.practice_questions ? ` · ${t.practice_questions} Q` : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[9px]">{t.priority}</Badge>
                </button>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
