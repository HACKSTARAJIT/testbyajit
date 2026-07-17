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
import { toast } from "@/hooks/use-toast";
import {
  Sparkles, Target, Flame, BookOpen, CalendarDays, CheckCircle2,
  ArrowLeft, TrendingUp, AlertTriangle, ListChecks, Trophy,
} from "lucide-react";

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

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      // Latest snapshot
      const { data: snaps } = await (supabase as any)
        .from("ai_coach_snapshots").select("*")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(1);
      const snap = snaps?.[0] ?? null;
      setSnapshot(snap);

      // Tasks for latest report (or all if none)
      const reportFilter = snap?.report_id;
      const q = (supabase as any).from("study_plan_tasks").select("*").eq("user_id", user.id);
      const { data: t } = reportFilter ? await q.eq("report_id", reportFilter).order("task_date") : await q.order("task_date");
      setTasks(t ?? []);

      const { data: g } = await (supabase as any)
        .from("smart_goals").select("*")
        .eq("user_id", user.id).eq("status", "active").order("deadline");
      setGoals(g ?? []);
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

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading AI Coach…</div>;
  }

  if (!snapshot) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <Button variant="ghost" onClick={() => navigate("/ai-mock-analyzer")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Card className="border-white/10 bg-white/5 backdrop-blur">
          <CardContent className="p-10 text-center space-y-3">
            <Sparkles className="w-10 h-10 mx-auto text-primary" />
            <h2 className="text-xl font-semibold">AI Coach is waiting for your first Mock</h2>
            <p className="text-muted-foreground">Upload a Mock Test to unlock your personalised Study Planner, Coach Dashboard and Smart Goals.</p>
            <Button asChild><Link to="/ai-mock-analyzer">Upload Mock Test</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const rec = snapshot.recommendations ?? {};
  const sync = snapshot.sync_summary ?? {};

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/ai-mock-analyzer")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Mock Analyzer
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" /> Personal AI Coach
            </h1>
            <p className="text-sm text-muted-foreground">Your daily study actions, generated from your latest Mock.</p>
          </div>
        </div>
        <Button asChild variant="outline"><Link to="/smart-revision">Open Smart Revision</Link></Button>
      </div>

      {/* Coach dashboard */}
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
