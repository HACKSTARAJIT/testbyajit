import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sparkles, Target, Flame, BookOpen, CalendarDays, CheckCircle2,
  ArrowLeft, TrendingUp, AlertTriangle, ListChecks, Trophy,
  Brain, Clock, Bell, Lightbulb, MessageSquare, Activity, ShieldCheck,
} from "lucide-react";
import {
  greeting, memoryEngine, learningStyle, coachAlerts, personalInsights, currentStreak,
  type CoachWrong, type CoachAttempt, type ChapterRef, type SubjectRef,
} from "@/lib/aiCoachInsights";


type Snapshot = {
  id: string;
  report_id: string;
  focus: string | null;
  biggest_mistake: string | null;
  target_score: string | null;
  motivation: string | null;
  revision_goal: string | null;
  recommendations: any;
  sync_summary: any;
  created_at: string;
};

type Task = {
  id: string;
  report_id: string | null;
  scope: string;
  task_date: string | null;
  day_index: number | null;
  week_index: number | null;
  title: string;
  description: string | null;
  chapter: string | null;
  topic: string | null;
  estimated_minutes: number;
  practice_questions: number;
  revision_minutes: number;
  priority: string;
  status: string;
};

type Goal = {
  id: string;
  title: string;
  description: string | null;
  target_value: number | null;
  current_value: number;
  unit: string | null;
  deadline: string | null;
  status: string;
};

const priorityColor = (p: string) =>
  p === "critical" ? "bg-red-500/20 text-red-300 border-red-500/40"
  : p === "high" ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
  : p === "medium" ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/40"
  : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";

const priorityDot = (p: string) =>
  p === "critical" ? "🔴" : p === "high" ? "🟠" : p === "medium" ? "🟡" : "🟢";

export default function AICoach() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [wrongs, setWrongs] = useState<CoachWrong[]>([]);
  const [attempts, setAttempts] = useState<CoachAttempt[]>([]);
  const [chapters, setChapters] = useState<ChapterRef[]>([]);
  const [subjects, setSubjects] = useState<SubjectRef[]>([]);
  const [latestReport, setLatestReport] = useState<any>(null);
  const [firstName, setFirstName] = useState("Student");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [snapRes, taskRes, goalRes, wrongRes, attemptRes, chapRes, subRes, reportRes, profRes] = await Promise.all([
        (supabase as any).from("ai_coach_snapshots").select("*")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(1),
        (supabase as any).from("study_plan_tasks").select("*").eq("user_id", user.id).order("task_date"),
        (supabase as any).from("smart_goals").select("*")
          .eq("user_id", user.id).eq("status", "active").order("deadline"),
        supabase.from("wrong_questions")
          .select("id, chapter_id, subject_id, priority, status, wrong_count, correct_revision_count, consecutive_correct, last_attempt_at, mastered_at, topic")
          .eq("user_id", user.id),
        supabase.from("test_attempts").select("accuracy, marks_obtained, created_at")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
        supabase.from("chapters").select("id, name, subject_id"),
        supabase.from("subjects").select("id, name"),
        supabase.from("ai_mock_reports").select("*")
          .eq("user_id", user.id).eq("status", "completed").eq("analysis_status", "verified").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
      ]);
      const snap = snapRes.data?.[0] ?? null;
      setSnapshot(snap);
      const reportFilter = snap?.report_id;
      setTasks((taskRes.data ?? []).filter((t: any) => !reportFilter || t.report_id === reportFilter || !t.report_id));
      setGoals(goalRes.data ?? []);
      setWrongs((wrongRes.data as any) ?? []);
      setAttempts((attemptRes.data as any) ?? []);
      setChapters((chapRes.data as any) ?? []);
      setSubjects((subRes.data as any) ?? []);
      setLatestReport(reportRes.data ?? null);
      const dn = (profRes.data?.display_name ?? "").trim();
      if (dn) setFirstName(dn.split(/\s+/)[0]);
      setLoading(false);
    })();
  }, [user]);


  const todayStr = new Date().toISOString().slice(0, 10);
  const grouped = useMemo(() => ({
    today: tasks.filter((t) => t.task_date === todayStr || t.scope === "today"),
    tomorrow: tasks.filter((t) => {
      const d = new Date(todayStr); d.setDate(d.getDate() + 1);
      return t.task_date === d.toISOString().slice(0, 10) || t.scope === "tomorrow";
    }),
    week: tasks.filter((t) => t.scope === "week" || t.scope === "today" || t.scope === "tomorrow"),
    month: tasks.filter((t) => t.scope === "month"),
  }), [tasks, todayStr]);

  const completed = tasks.filter((t) => t.status === "done").length;
  const totalToday = grouped.today.length;
  const doneToday = grouped.today.filter((t) => t.status === "done").length;

  async function toggleTask(t: Task) {
    const next = t.status === "done" ? "pending" : "done";
    setTasks((prev) => prev.map((x) => x.id === t.id ? { ...x, status: next } : x));
    await (supabase as any).from("study_plan_tasks").update({
      status: next, completed_at: next === "done" ? new Date().toISOString() : null,
    }).eq("id", t.id);
  }

  // ---- Insights / Memory / Alerts (derived) ----
  const tasksByDate = useMemo(() => {
    const m = new Map<string, { done: number; total: number }>();
    tasks.forEach((t) => {
      if (!t.task_date) return;
      const cur = m.get(t.task_date) ?? { done: 0, total: 0 };
      cur.total++; if (t.status === "done") cur.done++;
      m.set(t.task_date, cur);
    });
    return m;
  }, [tasks]);

  const memory = useMemo(() => memoryEngine(wrongs, chapters), [wrongs, chapters]);
  const style = useMemo(() => learningStyle(attempts), [attempts]);
  const insights = useMemo(() => personalInsights({ wrongs, chapters, subjects, attempts }), [wrongs, chapters, subjects, attempts]);
  const streak = useMemo(() => currentStreak(attempts, tasksByDate), [attempts, tasksByDate]);
  const alerts = useMemo(() => coachAlerts({
    wrongs, attempts, memory,
    lastReportAt: latestReport?.created_at ?? null,
    todayTasksDone: doneToday, todayTasksTotal: totalToday,
  }), [wrongs, attempts, memory, latestReport, doneToday, totalToday]);

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading AI Coach…</div>;
  }

  const hasAnyData = snapshot || wrongs.length > 0 || attempts.length > 0;
  if (!hasAnyData) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <Button variant="ghost" onClick={() => navigate("/ai-mock-analyzer")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Card className="border-white/10 bg-white/5 backdrop-blur">
          <CardContent className="p-10 text-center space-y-3">
            <Brain className="w-10 h-10 mx-auto text-primary" />
            <h2 className="text-xl font-semibold">Your AI Coach is warming up</h2>
            <p className="text-muted-foreground">Attempt a Practice Test या Upload a Mock Test — फिर AI Coach आपकी personalised journey बनाना शुरू करेगा।</p>
            <div className="flex gap-2 justify-center pt-2">
              <Button asChild><Link to="/tests">Start Practice</Link></Button>
              <Button asChild variant="outline"><Link to="/ai-mock-analyzer">Upload Mock</Link></Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const rec = snapshot?.recommendations ?? {};
  const sync = snapshot?.sync_summary ?? {};
  const readinessPct = Math.round(Number(latestReport?.readiness_score ?? snapshot ? (latestReport?.readiness_score ?? 0) : 0)) || 0;
  const accPct = Math.round(Number(latestReport?.accuracy ?? 0)) || 0;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Greeting / hero */}
      <Card className="border-white/10 bg-gradient-to-br from-primary/15 via-white/5 to-transparent backdrop-blur">
        <CardContent className="p-5 md:p-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-widest text-primary/80">AI Coach</div>
              <h1 className="text-2xl md:text-3xl font-bold mt-1">{greeting(firstName)} 👋</h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                {snapshot?.motivation ?? `${firstName}, आज एक छोटा target set करें और Smart Revision से शुरुआत करें।`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="secondary"><Link to="/ai-coach/chat"><MessageSquare className="w-4 h-4 mr-1" /> Chat with Coach</Link></Button>
              <Button asChild size="sm" variant="outline"><Link to="/smart-revision">Smart Revision</Link></Button>
              <Button asChild size="sm" variant="ghost"><Link to="/ai-mock-analyzer"><ArrowLeft className="w-4 h-4 mr-1" /> Mock Analyzer</Link></Button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5">
            <Stat icon={<Target className="w-4 h-4" />} label="Today's Target" value={`${doneToday}/${totalToday || 0}`} />
            <Stat icon={<Flame className="w-4 h-4" />} label="Current Streak" value={`${streak}🔥`} />
            <Stat icon={<Brain className="w-4 h-4" />} label="Memory Strength" value={`${memory.strength}%`} />
            <Stat icon={<ShieldCheck className="w-4 h-4" />} label="Readiness" value={`${readinessPct}%`} />
            <Stat icon={<TrendingUp className="w-4 h-4" />} label="Latest Accuracy" value={`${accPct}%`} />
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card className="border-white/10 bg-white/5 backdrop-blur">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Bell className="w-4 h-4 text-primary" /> AI Alerts</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((a, i) => (
              <div key={i} className={`text-sm px-3 py-2 rounded-lg border ${
                a.level === "danger" ? "bg-red-500/10 border-red-500/30 text-red-200"
                : a.level === "warn" ? "bg-orange-500/10 border-orange-500/30 text-orange-200"
                : "bg-blue-500/10 border-blue-500/30 text-blue-200"
              }`}>{a.text}</div>
            ))}
          </CardContent>
        </Card>
      )}



      {/* Coach dashboard (from latest mock) */}
      {snapshot && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <CoachCard icon={<Target className="w-5 h-5" />} title="Today's Focus" tone="primary" text={snapshot.focus} />
          <CoachCard icon={<AlertTriangle className="w-5 h-5" />} title="Today's Biggest Mistake" tone="orange" text={snapshot.biggest_mistake} />
          <CoachCard icon={<TrendingUp className="w-5 h-5" />} title="Path to Target Score" tone="emerald" text={snapshot.target_score} />
          <CoachCard icon={<BookOpen className="w-5 h-5" />} title="Today's Revision Goal" tone="blue" text={snapshot.revision_goal} />
          <CoachCard icon={<Flame className="w-5 h-5" />} title="Today's Motivation" tone="pink" text={snapshot.motivation} />
          <Card className="border-white/10 bg-white/5 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" /> Today's Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{doneToday}<span className="text-base text-muted-foreground">/{totalToday || 0}</span></div>
              <Progress className="mt-2" value={totalToday ? (doneToday / totalToday) * 100 : 0} />
              <p className="text-xs text-muted-foreground mt-2">
                Smart Revision Sync — matched {sync.matched ?? 0}, priority bumped {sync.priority_bumped ?? 0}, added {sync.added ?? 0}.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Exam Readiness */}
      {latestReport && (
        <Card className="border-white/10 bg-white/5 backdrop-blur">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="w-5 h-5 text-primary" /> Exam Readiness</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Current Readiness</div>
              <div className="text-3xl font-bold">{readinessPct}%</div>
              <Progress value={readinessPct} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-2">{latestReport.report?.readiness_reason ?? "Latest Mock के आधार पर calculated."}</p>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Strength Areas</div>
              <div className="flex flex-wrap gap-1.5">
                {((latestReport.report?.strong_subjects ?? []) as string[]).slice(0, 6).map((s, i) => (
                  <Badge key={i} className="bg-emerald-500/15 border-emerald-500/30 text-emerald-200" variant="outline">{s}</Badge>
                ))}
                {(!latestReport.report?.strong_subjects || latestReport.report.strong_subjects.length === 0) && <p className="text-xs text-muted-foreground">—</p>}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Risk Areas</div>
              <div className="flex flex-wrap gap-1.5">
                {((latestReport.report?.priority_chapters ?? latestReport.report?.weak_chapters ?? []) as string[]).slice(0, 6).map((s, i) => (
                  <Badge key={i} className="bg-red-500/15 border-red-500/30 text-red-200" variant="outline">{s}</Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {latestReport.report?.readiness_to_90 ?? "90% तक पहुँचने के लिए weak chapters की consistent Revision करें।"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Memory Engine + Forgetting Curve */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-white/10 bg-white/5 backdrop-blur">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Brain className="w-5 h-5 text-primary" /> AI Memory Engine</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground">Overall Memory Strength</div>
              <div className="text-2xl font-bold">{memory.strength}%</div>
              <Progress value={memory.strength} className="mt-2" />
            </div>
            <MemoryList title="🔴 Urgent Revision" items={memory.urgent} tone="red" empty="Nothing critical right now." />
            <MemoryList title="🟠 Likely to Forget Soon" items={memory.forgetSoon} tone="orange" empty="Memory holding up well." />
            {memory.recentlyMastered.length > 0 && (
              <div>
                <div className="text-xs font-semibold mb-1">✅ Recently Mastered</div>
                <div className="flex flex-wrap gap-1.5">
                  {memory.recentlyMastered.map((m) => (
                    <Badge key={m.id} variant="outline" className="text-[10px] bg-emerald-500/10 border-emerald-500/30 text-emerald-200">
                      {m.label} · {m.daysAgo}d ago
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5 backdrop-blur">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Clock className="w-5 h-5 text-primary" /> Forgetting Curve</CardTitle></CardHeader>
          <CardContent>
            {memory.all.length === 0 ? (
              <p className="text-sm text-muted-foreground">जब आप Practice शुरू करेंगे, यहाँ Chapters की memory decay दिखेगी।</p>
            ) : (
              <div className="space-y-2">
                {memory.all.slice(0, 8).map((m) => (
                  <div key={m.id} className="p-2.5 rounded-lg border border-white/10 bg-white/5">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-sm font-medium truncate">{m.label}</span>
                      <Badge variant="outline" className={`text-[10px] ${
                        m.risk === "critical" ? "bg-red-500/15 border-red-500/40 text-red-200"
                        : m.risk === "high" ? "bg-orange-500/15 border-orange-500/40 text-orange-200"
                        : m.risk === "medium" ? "bg-yellow-500/15 border-yellow-500/40 text-yellow-200"
                        : "bg-emerald-500/15 border-emerald-500/40 text-emerald-200"
                      }`}>{m.risk}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Progress value={m.retention} className="flex-1 h-1.5" />
                      <span className="text-[11px] text-muted-foreground w-16 text-right">{m.retention}% · {m.daysSince}d</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">{m.action}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Learning Style + Personal Insights */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-white/10 bg-white/5 backdrop-blur">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Activity className="w-5 h-5 text-primary" /> Learning Style Detection</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {style.length === 0 ? (
              <p className="text-sm text-muted-foreground">कम से कम 3 Practice attempts के बाद study pattern detect होगा।</p>
            ) : style.map((s, i) => (
              <div key={i} className="text-sm px-3 py-2 rounded-lg bg-white/5 border border-white/10">{s.text}</div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5 backdrop-blur">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Lightbulb className="w-5 h-5 text-primary" /> Personal Insights</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {insights.length === 0 ? (
              <p className="text-sm text-muted-foreground">Practice के साथ personalised insights यहाँ बनेंगे।</p>
            ) : insights.map((s, i) => (
              <div key={i} className="text-sm px-3 py-2 rounded-lg bg-white/5 border border-white/10">{s.text}</div>
            ))}
          </CardContent>
        </Card>
      </div>



      {/* Planner */}
      <Card className="border-white/10 bg-white/5 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarDays className="w-5 h-5 text-primary" /> AI Study Planner</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="today">
            <TabsList className="bg-white/5">
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="tomorrow">Tomorrow</TabsTrigger>
              <TabsTrigger value="week">This Week</TabsTrigger>
              <TabsTrigger value="month">This Month</TabsTrigger>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
            </TabsList>
            <TabsContent value="today"><TaskList tasks={grouped.today} onToggle={toggleTask} empty="No tasks for today." /></TabsContent>
            <TabsContent value="tomorrow"><TaskList tasks={grouped.tomorrow} onToggle={toggleTask} empty="Tomorrow's plan will appear after next mock." /></TabsContent>
            <TabsContent value="week"><TaskList tasks={grouped.week} onToggle={toggleTask} empty="No weekly tasks yet." /></TabsContent>
            <TabsContent value="month"><TaskList tasks={grouped.month} onToggle={toggleTask} empty="No monthly plan yet." /></TabsContent>
            <TabsContent value="calendar"><CalendarView tasks={tasks} onToggle={toggleTask} /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Goals */}
      <Card className="border-white/10 bg-white/5 backdrop-blur">
        <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="w-5 h-5 text-primary" /> Smart Goals</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3">
          {goals.length === 0 && <p className="text-sm text-muted-foreground">No active goals yet.</p>}
          {goals.map((g) => {
            const pct = g.target_value ? Math.min(100, (g.current_value / g.target_value) * 100) : 0;
            return (
              <div key={g.id} className="p-4 rounded-xl border border-white/10 bg-white/5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{g.title}</div>
                    {g.description && <div className="text-xs text-muted-foreground mt-0.5">{g.description}</div>}
                  </div>
                  {g.deadline && <Badge variant="outline" className="text-xs">by {g.deadline}</Badge>}
                </div>
                <Progress value={pct} className="mt-3" />
                <div className="text-xs text-muted-foreground mt-1">{g.current_value}/{g.target_value ?? "—"} {g.unit ?? ""}</div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card className="border-white/10 bg-white/5 backdrop-blur">
        <CardHeader><CardTitle className="flex items-center gap-2"><ListChecks className="w-5 h-5 text-primary" /> Recommended for You</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <RecList title="Practice Tests" items={(rec.tests ?? []).map((t: any) => ({ label: t.title, href: `/test/${t.id}` }))} empty="No practice test suggestions." />
          <RecList title="PDF Notes" items={(rec.pdfs ?? []).map((p: any) => ({ label: p.title, href: `/subjects` }))} empty="No PDF suggestions." />
          <RecList title="Priority Chapters" items={(rec.chapters ?? []).map((c: string) => ({ label: c }))} empty="No chapter list." />
          <RecList title="Priority Topics" items={(rec.topics ?? []).map((c: string) => ({ label: c }))} empty="No topic list." />
        </CardContent>
      </Card>
    </div>
  );
}

function CoachCard({ icon, title, text, tone }: { icon: React.ReactNode; title: string; text: string | null; tone: string }) {
  const bg =
    tone === "orange" ? "from-orange-500/10 to-transparent"
    : tone === "emerald" ? "from-emerald-500/10 to-transparent"
    : tone === "blue" ? "from-blue-500/10 to-transparent"
    : tone === "pink" ? "from-pink-500/10 to-transparent"
    : "from-primary/10 to-transparent";
  return (
    <Card className={`border-white/10 bg-gradient-to-br ${bg} backdrop-blur`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">{icon}{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed text-foreground/90">{text || "—"}</p>
      </CardContent>
    </Card>
  );
}

function TaskList({ tasks, onToggle, empty }: { tasks: Task[]; onToggle: (t: Task) => void; empty: string }) {
  if (tasks.length === 0) return <p className="text-sm text-muted-foreground py-6 text-center">{empty}</p>;
  return (
    <div className="space-y-2 mt-3">
      {tasks.map((t) => (
        <div key={t.id} className={`p-3 rounded-lg border border-white/10 bg-white/5 flex items-start gap-3 ${t.status === "done" ? "opacity-60" : ""}`}>
          <Checkbox checked={t.status === "done"} onCheckedChange={() => onToggle(t)} className="mt-1" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs">{priorityDot(t.priority)}</span>
              <Badge variant="outline" className={`text-[10px] ${priorityColor(t.priority)}`}>{t.priority}</Badge>
              {t.chapter && <Badge variant="outline" className="text-[10px]">{t.chapter}</Badge>}
              {t.topic && <Badge variant="outline" className="text-[10px]">{t.topic}</Badge>}
              {t.task_date && <span className="text-[10px] text-muted-foreground">{t.task_date}</span>}
            </div>
            <p className={`text-sm mt-1 ${t.status === "done" ? "line-through" : ""}`}>{t.title}</p>
            <div className="text-[11px] text-muted-foreground mt-1 flex gap-3 flex-wrap">
              <span>⏱ {t.estimated_minutes}m</span>
              {t.practice_questions > 0 && <span>📝 {t.practice_questions} Practice Qs</span>}
              {t.revision_minutes > 0 && <span>🔁 {t.revision_minutes}m Revision</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CalendarView({ tasks, onToggle }: { tasks: Task[]; onToggle: (t: Task) => void }) {
  const byDate = new Map<string, Task[]>();
  tasks.forEach((t) => {
    if (!t.task_date) return;
    const arr = byDate.get(t.task_date) ?? [];
    arr.push(t); byDate.set(t.task_date, arr);
  });
  const dates = [...byDate.keys()].sort();
  const today = new Date().toISOString().slice(0, 10);
  if (dates.length === 0) return <p className="text-sm text-muted-foreground py-6 text-center">No dated tasks yet.</p>;
  return (
    <div className="space-y-4 mt-3">
      {dates.map((d) => {
        const items = byDate.get(d) ?? [];
        const done = items.filter((t) => t.status === "done").length;
        const label = d === today ? "Today" : d < today ? "Past" : "Upcoming";
        return (
          <div key={d}>
            <div className="flex items-center gap-2 mb-2">
              <div className="text-sm font-semibold">{d}</div>
              <Badge variant="outline" className="text-[10px]">{label}</Badge>
              <span className="text-xs text-muted-foreground">{done}/{items.length} done</span>
            </div>
            <TaskList tasks={items} onToggle={onToggle} empty="" />
          </div>
        );
      })}
    </div>
  );
}

function RecList({ title, items, empty }: { title: string; items: { label: string; href?: string }[]; empty: string }) {
  return (
    <div>
      <div className="text-sm font-semibold mb-2">{title}</div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((it, i) => it.href ? (
            <Link key={i} to={it.href}><Badge variant="outline" className="hover:bg-white/10">{it.label}</Badge></Link>
          ) : (
            <Badge key={i} variant="outline">{it.label}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">{icon}{label}</div>
      <div className="text-lg font-bold mt-0.5">{value}</div>
    </div>
  );
}

function MemoryList({ title, items, tone, empty }: {
  title: string;
  items: { id: string; label: string; retention: number; daysSince: number; action: string }[];
  tone: "red" | "orange";
  empty: string;
}) {
  return (
    <div>
      <div className="text-xs font-semibold mb-1.5">{title}</div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((m) => (
            <div key={m.id} className={`px-2.5 py-1.5 rounded-md border ${tone === "red" ? "border-red-500/30 bg-red-500/5" : "border-orange-500/30 bg-orange-500/5"}`}>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium truncate">{m.label}</span>
                <span className="text-[10px] text-muted-foreground">Last: {m.daysSince}d ago</span>
              </div>
              <div className="text-[11px] text-muted-foreground">{m.action}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
