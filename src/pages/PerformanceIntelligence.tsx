import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  TrendingUp, TrendingDown, Target, Award, Sparkles, Trophy, Flame,
  Download, FileImage, Brain, ArrowLeft, ChevronRight, Zap, CheckCircle2,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart, Legend,
} from "recharts";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

type Report = {
  id: string; title: string; exam_name: string | null; status: string;
  created_at: string; report: any;
  accuracy: number | null; readiness_score: number | null; overall_score: number | null;
};
type Goals = { target_accuracy: number | null; target_score: number | null; target_readiness: number | null };

const LEVEL_COLOR: Record<string, string> = {
  strong: "bg-emerald-500", average: "bg-yellow-500", weak: "bg-orange-500", critical: "bg-red-500",
};
const LEVEL_TINT: Record<string, string> = {
  strong: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  average: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  weak: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  critical: "bg-red-500/15 text-red-500 border-red-500/30",
};

export default function PerformanceIntelligence() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [goals, setGoals] = useState<Goals>({ target_accuracy: null, target_score: null, target_readiness: null });
  const [achievements, setAchievements] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [compareA, setCompareA] = useState<string>("");
  const [compareB, setCompareB] = useState<string>("");
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: r }, { data: g }, { data: ach }] = await Promise.all([
        supabase.from("ai_mock_reports").select("*").eq("user_id", user.id).eq("status", "completed").eq("analysis_status", "verified").order("created_at"),
        supabase.from("user_goals").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("user_achievements").select("code").eq("user_id", user.id),
      ]);
      setReports((r as any) ?? []);
      if (g) setGoals({ target_accuracy: g.target_accuracy, target_score: g.target_score, target_readiness: g.target_readiness });
      setAchievements((ach ?? []).map((a: any) => a.code));
      setLoading(false);
    })();
  }, [user]);

  // ================= DERIVED METRICS =================
  const metrics = useMemo(() => derive(reports), [reports]);

  // ================= AUTO ACHIEVEMENTS =================
  useEffect(() => {
    if (!user || !reports.length) return;
    const toGrant: string[] = [];
    const has = (c: string) => achievements.includes(c);
    if (!has("first_mock") && reports.length >= 1) toGrant.push("first_mock");
    if (!has("10_mocks") && reports.length >= 10) toGrant.push("10_mocks");
    if (!has("90_accuracy") && reports.some(r => (r.accuracy ?? 0) >= 90)) toGrant.push("90_accuracy");
    if (!has("1000_questions") && metrics.totalQuestions >= 1000) toGrant.push("1000_questions");
    if (!has("7_day_streak") && metrics.streakDays >= 7) toGrant.push("7_day_streak");
    if (!has("30_day_streak") && metrics.streakDays >= 30) toGrant.push("30_day_streak");
    if (toGrant.length) {
      supabase.from("user_achievements").insert(toGrant.map(code => ({ user_id: user.id, code })))
        .then(() => setAchievements(a => [...a, ...toGrant]));
    }
  }, [user, reports, metrics.totalQuestions, metrics.streakDays, achievements]);

  const saveGoals = async (g: Goals) => {
    if (!user) return;
    setGoals(g);
    await supabase.from("user_goals").upsert({ user_id: user.id, ...g });
    toast.success("Goals saved");
  };

  const exportPDF = async () => {
    if (!exportRef.current) return;
    toast.info("Generating PDF...");
    try {
      const canvas = await html2canvas(exportRef.current, { scale: 2, backgroundColor: "#0a0a0a" });
      const img = canvas.toDataURL("image/jpeg", 0.85);
      const pdf = new jsPDF("p", "mm", "a4");
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * w) / canvas.width;
      pdf.addImage(img, "JPEG", 0, 0, w, h);
      pdf.save(`performance-${Date.now()}.pdf`);
    } catch (e: any) { toast.error("Export failed"); }
  };

  const exportImage = async () => {
    if (!exportRef.current) return;
    try {
      const canvas = await html2canvas(exportRef.current, { scale: 2, backgroundColor: "#0a0a0a" });
      const link = document.createElement("a");
      link.download = `performance-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch { toast.error("Export failed"); }
  };

  if (loading) {
    return <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;
  }

  if (!reports.length) {
    return (
      <Card className="border-dashed"><CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-primary-foreground">
          <Brain className="h-8 w-8" />
        </div>
        <p className="text-lg font-semibold">No completed mocks yet</p>
        <p className="text-sm text-muted-foreground">Analyze mocks to unlock Performance Intelligence.</p>
        <Button asChild><Link to="/ai-mock-analyzer">Go to AI Mock Analyzer</Link></Button>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6" ref={exportRef}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild size="icon" variant="ghost" aria-label="Back"><Link to="/ai-mock-analyzer" aria-label="Back to AI Mock Analyzer"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div className="rounded-xl bg-gradient-to-br from-primary to-secondary p-2 text-primary-foreground shadow-lg shadow-primary/20">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Performance Intelligence</h1>
            <p className="text-xs text-muted-foreground">Long-term insights across {reports.length} analyzed mock{reports.length>1?"s":""}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportImage}><FileImage className="mr-1 h-4 w-4" />PNG</Button>
          <Button size="sm" variant="outline" onClick={exportPDF}><Download className="mr-1 h-4 w-4" />PDF</Button>
        </div>
      </header>

      {/* Overview stats */}
      <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Overall Accuracy" value={`${metrics.avgAccuracy}%`} tint="from-emerald-500/20 to-emerald-500/5" />
        <Stat label="Average Score" value={metrics.avgScore || "—"} tint="from-amber-500/20 to-amber-500/5" />
        <Stat label="Average Readiness" value={`${metrics.avgReadiness}%`} tint="from-sky-500/20 to-sky-500/5" />
        <Stat label="Total Mocks" value={reports.length} tint="from-primary/20 to-primary/5" />
        <Stat label="Total Questions" value={metrics.totalQuestions} tint="from-violet-500/20 to-violet-500/5" />
        <Stat label="Total Correct" value={metrics.totalCorrect} tint="from-emerald-500/20 to-emerald-500/5" />
        <Stat label="Total Wrong" value={metrics.totalWrong} tint="from-red-500/20 to-red-500/5" />
        <Stat label="Total Skipped" value={metrics.totalSkipped} tint="from-orange-500/20 to-orange-500/5" />
        <Stat label="Improvement" value={`${metrics.improvementPct > 0 ? "+" : ""}${metrics.improvementPct}%`} tint="from-fuchsia-500/20 to-fuchsia-500/5"
          icon={metrics.improvementPct >= 0 ? <TrendingUp className="h-4 w-4"/> : <TrendingDown className="h-4 w-4"/>} />
        <Stat label="Strongest Subject" value={metrics.strongestSubject ?? "—"} small tint="from-emerald-500/20 to-emerald-500/5" />
        <Stat label="Weakest Subject" value={metrics.weakestSubject ?? "—"} small tint="from-red-500/20 to-red-500/5" />
        <Stat label="Best Mock" value={metrics.best?.title ?? "—"} sub={metrics.best ? `${metrics.best.overall_score ?? "-"} pts` : ""} small tint="from-yellow-500/20 to-yellow-500/5" />
        <Stat label="Worst Mock" value={metrics.worst?.title ?? "—"} sub={metrics.worst ? `${metrics.worst.overall_score ?? "-"} pts` : ""} small tint="from-red-500/20 to-red-500/5" />
      </section>

      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="chapters">Chapters</TabsTrigger>
          <TabsTrigger value="topics">Topics</TabsTrigger>
          <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
          <TabsTrigger value="compare">Compare</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
        </TabsList>

        {/* ---------- TIMELINE ---------- */}
        <TabsContent value="timeline" className="space-y-3">
          <ChartCard title="Accuracy Trend" data={metrics.timeline} dataKey="accuracy" color="hsl(var(--primary))" />
          <ChartCard title="Score Trend" data={metrics.timeline} dataKey="score" color="#f59e0b" />
          <ChartCard title="Readiness Trend" data={metrics.timeline} dataKey="readiness" color="#0ea5e9" />
          <ChartCard title="Wrong Answers Trend" data={metrics.timeline} dataKey="wrong" color="#ef4444" />
          <ChartCard title="Skipped Questions Trend" data={metrics.timeline} dataKey="skipped" color="#f97316" />
          <ChartCard title="Average Speed (min/question)" data={metrics.timeline} dataKey="speed" color="#a855f7" />
        </TabsContent>

        {/* ---------- SUBJECTS ---------- */}
        <TabsContent value="subjects" className="space-y-2">
          {metrics.subjectProgress.length === 0 && <Empty label="Not enough subject-level data yet." />}
          {metrics.subjectProgress.map(s => (
            <Card key={s.subject}><CardContent className="p-3">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{s.subject}</p>
                <div className="flex gap-1">
                  <Badge variant="outline">Accuracy {s.latestAccuracy}%</Badge>
                  <Badge variant="outline" className={s.improvement >= 0 ? "text-emerald-500 border-emerald-500/30" : "text-red-500 border-red-500/30"}>
                    {s.improvement >= 0 ? "+" : ""}{s.improvement}% growth
                  </Badge>
                  <Badge variant="outline" className={LEVEL_TINT[s.confidence]}>Confidence: {s.confidence}</Badge>
                </div>
              </div>
              <div className="h-16">
                <ResponsiveContainer><LineChart data={s.trend}><Line dataKey="v" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
              </div>
            </CardContent></Card>
          ))}
        </TabsContent>

        {/* ---------- CHAPTERS ---------- */}
        <TabsContent value="chapters" className="space-y-3">
          <ChapterList title="Mastered Chapters" items={metrics.chapters.mastered} tone="strong" />
          <ChapterList title="Improving Chapters" items={metrics.chapters.improving} tone="average" />
          <ChapterList title="Declining Chapters" items={metrics.chapters.declining} tone="weak" />
          <ChapterList title="Weak Chapter Alerts" items={metrics.chapters.weak} tone="critical" />
        </TabsContent>

        {/* ---------- TOPICS ---------- */}
        <TabsContent value="topics" className="grid gap-3 md:grid-cols-2">
          <TopicBox title="🌱 Most Improved Topics" items={metrics.topics.improved} tone="green" />
          <TopicBox title="📉 Declining Topics" items={metrics.topics.declining} tone="red" />
          <TopicBox title="🔥 Frequently Wrong Topics" items={metrics.topics.frequent} tone="red" />
          <TopicBox title="💤 Forgotten Topics" items={metrics.topics.forgotten} />
        </TabsContent>

        {/* ---------- HEATMAP ---------- */}
        <TabsContent value="heatmap" className="space-y-3">
          <HeatmapBlock title="Subjects" items={metrics.heatmap.subjects} />
          <HeatmapBlock title="Chapters" items={metrics.heatmap.chapters} />
          <HeatmapBlock title="Topics" items={metrics.heatmap.topics} />
        </TabsContent>

        {/* ---------- COMPARE ---------- */}
        <TabsContent value="compare" className="space-y-3">
          <Card><CardContent className="p-3 grid gap-2 sm:grid-cols-2">
            <Select value={compareA} onValueChange={setCompareA}>
              <SelectTrigger><SelectValue placeholder="Select Mock A" /></SelectTrigger>
              <SelectContent>{reports.map(r => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={compareB} onValueChange={setCompareB}>
              <SelectTrigger><SelectValue placeholder="Select Mock B" /></SelectTrigger>
              <SelectContent>{reports.map(r => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}</SelectContent>
            </Select>
          </CardContent></Card>
          {compareA && compareB && <CompareView a={reports.find(r=>r.id===compareA)!} b={reports.find(r=>r.id===compareB)!} />}
          {metrics.best && metrics.worst && metrics.best.id !== metrics.worst.id && (
            <div>
              <p className="mb-2 text-sm font-semibold">🏆 Best vs 😞 Worst</p>
              <CompareView a={metrics.best} b={metrics.worst} bestVsWorst />
            </div>
          )}
        </TabsContent>

        {/* ---------- INSIGHTS ---------- */}
        <TabsContent value="insights" className="space-y-2">
          {metrics.insights.length === 0 && <Empty label="Analyze more mocks to unlock pattern insights." />}
          {metrics.insights.map((i, idx) => (
            <Card key={idx}><CardContent className="flex items-start gap-2 p-3">
              <div className={`mt-0.5 rounded-md p-1.5 ${i.tone === "up" ? "bg-emerald-500/15 text-emerald-500" : i.tone === "down" ? "bg-red-500/15 text-red-500" : "bg-primary/15 text-primary"}`}>
                {i.tone === "up" ? <TrendingUp className="h-4 w-4"/> : i.tone === "down" ? <TrendingDown className="h-4 w-4"/> : <Sparkles className="h-4 w-4"/>}
              </div>
              <p className="text-sm">{i.text}</p>
            </CardContent></Card>
          ))}
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">📊 Consistency</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-3 gap-2 pt-0">
              <Mini label="Consistency" value={`${metrics.consistencyScore}%`} />
              <Mini label="Improvement" value={`${metrics.improvementScore}%`} />
              <Mini label="Study Stability" value={`${metrics.stability}%`} />
              <Mini label="Daily active" value={`${metrics.dailyActive}d`} />
              <Mini label="Weekly active" value={`${metrics.weeklyActive}w`} />
              <Mini label="Monthly active" value={`${metrics.monthlyActive}mo`} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- GOALS ---------- */}
        <TabsContent value="goals">
          <Card><CardHeader><CardTitle className="text-base">Set Your Targets</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <GoalInput label="Target Accuracy %" value={goals.target_accuracy} current={metrics.avgAccuracy}
                onSave={v => saveGoals({ ...goals, target_accuracy: v })} />
              <GoalInput label="Target Score" value={goals.target_score} current={metrics.avgScore}
                onSave={v => saveGoals({ ...goals, target_score: v })} />
              <GoalInput label="Target Readiness %" value={goals.target_readiness} current={metrics.avgReadiness}
                onSave={v => saveGoals({ ...goals, target_readiness: v })} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- ACHIEVEMENTS ---------- */}
        <TabsContent value="achievements" className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
          {ALL_ACHIEVEMENTS.map(a => {
            const unlocked = achievements.includes(a.code);
            return (
              <Card key={a.code} className={unlocked ? "border-primary/40" : "opacity-60"}>
                <CardContent className="flex items-center gap-3 p-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${unlocked ? "bg-gradient-to-br from-primary to-secondary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {unlocked ? <Trophy className="h-5 w-5"/> : <a.icon className="h-5 w-5"/>}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.desc}</p>
                  </div>
                  {unlocked && <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-500" />}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ======================= HELPERS ======================= */

const ALL_ACHIEVEMENTS = [
  { code: "first_mock", title: "First Mock", desc: "Upload & analyze your first mock", icon: Sparkles },
  { code: "10_mocks", title: "10 Mocks Completed", desc: "Analyze 10 mock tests", icon: Award },
  { code: "90_accuracy", title: "90% Accuracy", desc: "Score 90%+ accuracy in any mock", icon: Target },
  { code: "1000_questions", title: "1000 Questions", desc: "Solve 1000 questions overall", icon: Zap },
  { code: "7_day_streak", title: "7-Day Consistency", desc: "Analyze mocks 7 different days", icon: Flame },
  { code: "30_day_streak", title: "30-Day Consistency", desc: "Analyze mocks 30 different days", icon: Trophy },
];

function derive(reports: Report[]) {
  const timeline = reports.map(r => {
    const t = r.report?.totals ?? {};
    const total = t.questions ?? 0;
    const timeMin = t.time_minutes ?? 0;
    return {
      name: new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      accuracy: r.accuracy ?? 0,
      score: r.overall_score ?? 0,
      readiness: r.readiness_score ?? 0,
      wrong: t.wrong ?? 0,
      skipped: t.skipped ?? 0,
      speed: total && timeMin ? +(timeMin / total).toFixed(2) : 0,
    };
  });

  const avg = (n: number[]) => n.length ? Math.round(n.reduce((a,b)=>a+b,0)/n.length) : 0;
  const avgAccuracy = avg(reports.map(r => r.accuracy ?? 0));
  const avgScore = avg(reports.map(r => r.overall_score ?? 0));
  const avgReadiness = avg(reports.map(r => r.readiness_score ?? 0));

  const totalQuestions = reports.reduce((n, r) => n + (r.report?.totals?.questions ?? 0), 0);
  const totalCorrect = reports.reduce((n, r) => n + (r.report?.totals?.correct ?? 0), 0);
  const totalWrong = reports.reduce((n, r) => n + (r.report?.totals?.wrong ?? 0), 0);
  const totalSkipped = reports.reduce((n, r) => n + (r.report?.totals?.skipped ?? 0), 0);

  const best = reports.reduce<Report | null>((b, r) => (r.overall_score ?? 0) > (b?.overall_score ?? -1) ? r : b, null);
  const worst = reports.reduce<Report | null>((b, r) => (r.overall_score ?? Infinity) < (b?.overall_score ?? Infinity) ? r : b, null);

  // Improvement: latest 3 vs first 3
  const first3 = reports.slice(0, 3).map(r => r.accuracy ?? 0);
  const last3 = reports.slice(-3).map(r => r.accuracy ?? 0);
  const improvementPct = first3.length && last3.length ? Math.round(((avg(last3) - avg(first3)))) : 0;

  // Subject tracker
  const subjectMap: Record<string, { accs: number[]; latest: number }> = {};
  for (const r of reports) {
    for (const s of (r.report?.subject_analysis ?? [])) {
      if (!s.subject) continue;
      subjectMap[s.subject] = subjectMap[s.subject] ?? { accs: [], latest: 0 };
      subjectMap[s.subject].accs.push(s.accuracy ?? 0);
      subjectMap[s.subject].latest = s.accuracy ?? 0;
    }
  }
  const subjectProgress = Object.entries(subjectMap).map(([subject, d]) => {
    const first = d.accs[0] ?? 0;
    const latest = d.accs[d.accs.length - 1] ?? 0;
    const confidence = latest >= 80 ? "strong" : latest >= 60 ? "average" : latest >= 40 ? "weak" : "critical";
    return {
      subject, latestAccuracy: latest, improvement: Math.round(latest - first), confidence,
      trend: d.accs.map((v, i) => ({ i, v })),
    };
  }).sort((a, b) => b.latestAccuracy - a.latestAccuracy);

  const strongestSubject = subjectProgress[0]?.subject ?? null;
  const weakestSubject = subjectProgress[subjectProgress.length - 1]?.subject ?? null;

  // Chapters
  const chapMap: Record<string, { accs: number[] }> = {};
  for (const r of reports) {
    for (const c of (r.report?.chapter_analysis ?? [])) {
      if (!c.chapter) continue;
      chapMap[c.chapter] = chapMap[c.chapter] ?? { accs: [] };
      chapMap[c.chapter].accs.push(c.accuracy ?? 0);
    }
  }
  const chapArr = Object.entries(chapMap).map(([chapter, d]) => {
    const first = d.accs[0] ?? 0;
    const latest = d.accs[d.accs.length - 1] ?? 0;
    return { chapter, latest, delta: Math.round(latest - first), avgAcc: avg(d.accs), samples: d.accs.length };
  });
  const chapters = {
    mastered: chapArr.filter(c => c.latest >= 85).slice(0, 10),
    improving: chapArr.filter(c => c.delta >= 10 && c.samples > 1).sort((a,b)=>b.delta-a.delta).slice(0, 10),
    declining: chapArr.filter(c => c.delta <= -10 && c.samples > 1).sort((a,b)=>a.delta-b.delta).slice(0, 10),
    weak: chapArr.filter(c => c.latest < 50).sort((a,b)=>a.latest-b.latest).slice(0, 10),
  };

  // Topics — from weak/strong/critical/immediate/frequent lists
  const topicCount: Record<string, number> = {};
  const topicLatest: Record<string, "strong"|"weak"|"critical"> = {};
  for (const r of reports) {
    for (const t of (r.report?.strong_topics ?? [])) topicLatest[t] = "strong";
    for (const t of (r.report?.weak_topics ?? [])) { topicLatest[t] = "weak"; topicCount[t] = (topicCount[t]??0)+1; }
    for (const t of (r.report?.critical_topics ?? [])) { topicLatest[t] = "critical"; topicCount[t] = (topicCount[t]??0)+2; }
    for (const t of (r.report?.frequent_mistakes ?? [])) topicCount[t] = (topicCount[t]??0)+1;
  }
  const topics = {
    improved: Object.keys(topicLatest).filter(t => topicLatest[t] === "strong" && (topicCount[t] ?? 0) > 0).slice(0, 10),
    declining: Object.keys(topicLatest).filter(t => topicLatest[t] === "critical").slice(0, 10),
    frequent: Object.entries(topicCount).sort((a,b)=>b[1]-a[1]).slice(0, 10).map(([t])=>t),
    forgotten: Object.entries(topicCount).filter(([,c])=>c>=3).map(([t])=>t).slice(0, 10),
  };

  // Heatmap
  const collectLevel = (arr: any[], key: string) => {
    const map: Record<string, string> = {};
    for (const h of arr) { const k = h[key]; if (k) map[k] = h.level ?? "average"; }
    return map;
  };
  const heat = reports.flatMap(r => r.report?.heatmap ?? []);
  const heatmap = {
    subjects: Object.entries(collectLevel(heat, "subject")).map(([label, level]) => ({ label, level })),
    chapters: Object.entries(collectLevel(heat.filter(h=>h.chapter), "chapter")).map(([label, level]) => ({ label, level })),
    topics: Object.entries(collectLevel(heat.filter(h=>h.topic), "topic")).map(([label, level]) => ({ label, level })),
  };

  // Insights
  const insights: { text: string; tone: "up"|"down"|"info" }[] = [];
  for (const s of subjectProgress) {
    if (s.improvement >= 10) insights.push({ tone: "up", text: `Your ${s.subject} is improving consistently (+${s.improvement}%).` });
    else if (s.improvement <= -10) insights.push({ tone: "down", text: `${s.subject} accuracy is decreasing (${s.improvement}%).` });
    else if (s.trend.length >= 3) {
      const variance = Math.max(...s.trend.map(t=>t.v)) - Math.min(...s.trend.map(t=>t.v));
      if (variance > 25) insights.push({ tone: "info", text: `${s.subject} performance is unstable (${variance}% swing).` });
    }
  }
  if (strongestSubject) insights.push({ tone: "up", text: `${strongestSubject} has become your strongest subject.` });
  for (const c of chapters.weak.slice(0, 3)) insights.push({ tone: "down", text: `${c.chapter} is repeatedly weak — needs urgent revision.` });

  // Consistency (unique days)
  const days = new Set(reports.map(r => new Date(r.created_at).toDateString()));
  const weeks = new Set(reports.map(r => { const d = new Date(r.created_at); return `${d.getFullYear()}-W${Math.floor(d.getDate()/7)}-${d.getMonth()}`; }));
  const months = new Set(reports.map(r => { const d = new Date(r.created_at); return `${d.getFullYear()}-${d.getMonth()}`; }));

  // Streak
  const sortedDays = [...days].map(d => new Date(d).getTime()).sort((a,b)=>a-b);
  let streakDays = 0, current = 0, prev = 0;
  for (const t of sortedDays) {
    if (prev && (t - prev) <= 86400000 * 2) current++; else current = 1;
    streakDays = Math.max(streakDays, current); prev = t;
  }

  const spanDays = reports.length > 1 ? Math.max(1, (new Date(reports.at(-1)!.created_at).getTime() - new Date(reports[0].created_at).getTime())/86400000) : 1;
  const consistencyScore = Math.min(100, Math.round((days.size / spanDays) * 100));
  const improvementScore = Math.min(100, Math.max(0, 50 + improvementPct * 2));
  const stability = Math.max(0, 100 - Math.round(variance(reports.map(r => r.accuracy ?? 0))));

  return {
    timeline, avgAccuracy, avgScore, avgReadiness,
    totalQuestions, totalCorrect, totalWrong, totalSkipped,
    best, worst, improvementPct, strongestSubject, weakestSubject,
    subjectProgress, chapters, topics, heatmap, insights,
    consistencyScore, improvementScore, stability,
    dailyActive: days.size, weeklyActive: weeks.size, monthlyActive: months.size,
    streakDays,
  };
}

function variance(arr: number[]) {
  if (arr.length < 2) return 0;
  const m = arr.reduce((a,b)=>a+b,0)/arr.length;
  return Math.round(Math.sqrt(arr.reduce((a,b)=>a+(b-m)*(b-m),0)/arr.length));
}

/* ==================== SMALL COMPONENTS ==================== */

function Stat({ label, value, sub, tint, icon, small }: { label: string; value: any; sub?: string; tint: string; icon?: React.ReactNode; small?: boolean }) {
  return (
    <div className={`rounded-xl border bg-gradient-to-br ${tint} p-3 backdrop-blur`}>
      <div className="mb-1 flex items-center gap-1 text-primary [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</div>
      <p className={`font-bold ${small ? "truncate text-sm" : "text-xl"}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-md bg-muted/50 p-2 text-center">
      <p className="text-sm font-semibold">{value}</p>
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
    </div>
  );
}

function ChartCard({ title, data, dataKey, color }: { title: string; data: any[]; dataKey: string; color: string }) {
  return (
    <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="h-52 pt-0">
        <ResponsiveContainer>
          <AreaChart data={data}>
            <defs><linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.4}/><stop offset="100%" stopColor={color} stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} width={30} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
            <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#g-${dataKey})`} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function ChapterList({ title, items, tone }: { title: string; items: any[]; tone: string }) {
  if (!items.length) return null;
  return (
    <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-1 pt-0">
        {items.map(c => (
          <div key={c.chapter} className="flex items-center justify-between rounded-md border px-2 py-1.5 text-sm">
            <span className="truncate">{c.chapter}</span>
            <div className="flex gap-1">
              <Badge variant="outline" className="text-[10px]">Acc {c.latest}%</Badge>
              {c.delta !== 0 && <Badge variant="outline" className={`text-[10px] ${c.delta > 0 ? "text-emerald-500 border-emerald-500/30" : "text-red-500 border-red-500/30"}`}>{c.delta > 0 ? "+" : ""}{c.delta}%</Badge>}
              <Badge variant="outline" className={`text-[10px] ${LEVEL_TINT[tone]}`}>{tone}</Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TopicBox({ title, items, tone }: { title: string; items: string[]; tone?: "green"|"red" }) {
  return (
    <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? <p className="text-xs text-muted-foreground">No data yet</p> : (
          <div className="flex flex-wrap gap-1">
            {items.map((t, i) => <Badge key={i} variant="outline" className={tone==="green"?"bg-emerald-500/15 text-emerald-500 border-emerald-500/30":tone==="red"?"bg-red-500/15 text-red-500 border-red-500/30":""}>{t}</Badge>)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HeatmapBlock({ title, items }: { title: string; items: { label: string; level: string }[] }) {
  if (!items.length) return null;
  return (
    <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 gap-1 pt-0 sm:grid-cols-4">
        {items.map((i, idx) => (
          <div key={idx} className="flex items-center gap-2 rounded-md border p-2 text-xs">
            <span className={`h-3 w-3 rounded-full ${LEVEL_COLOR[i.level] ?? "bg-muted"}`} />
            <span className="truncate">{i.label}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CompareView({ a, b, bestVsWorst }: { a: Report; b: Report; bestVsWorst?: boolean }) {
  const rows = [
    ["Accuracy %", a.accuracy ?? 0, b.accuracy ?? 0],
    ["Score", a.overall_score ?? 0, b.overall_score ?? 0],
    ["Readiness %", a.readiness_score ?? 0, b.readiness_score ?? 0],
    ["Wrong", a.report?.totals?.wrong ?? 0, b.report?.totals?.wrong ?? 0],
    ["Skipped", a.report?.totals?.skipped ?? 0, b.report?.totals?.skipped ?? 0],
  ];
  const setA = new Set<string>(a.report?.strong_subjects ?? []);
  const setB = new Set<string>(b.report?.strong_subjects ?? []);
  const improved = [...setA].filter(x => !setB.has(x));
  const declined = [...setB].filter(x => !setA.has(x));
  const improvementPct = ((a.accuracy ?? 0) - (b.accuracy ?? 0));

  return (
    <Card><CardContent className="space-y-3 p-3">
      <div className="grid grid-cols-3 gap-1 text-xs font-semibold">
        <span></span>
        <span className="text-center">{a.title}</span>
        <span className="text-center">{b.title}</span>
      </div>
      {rows.map(([label, va, vb]) => {
        const better = (va as number) > (vb as number);
        const worse = (va as number) < (vb as number);
        return (
          <div key={label as string} className="grid grid-cols-3 items-center gap-1 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className={`text-center font-semibold ${better?"text-emerald-500":worse?"text-red-500":""}`}>{va as any}</span>
            <span className={`text-center font-semibold ${!better?"text-emerald-500":worse?"":"text-red-500"}`}>{vb as any}</span>
          </div>
        );
      })}
      <div className="grid gap-2 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-emerald-500">✅ Gained in A</p>
          <div className="mt-1 flex flex-wrap gap-1">{improved.length ? improved.map(x => <Badge key={x} variant="outline" className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">{x}</Badge>) : <span className="text-xs text-muted-foreground">—</span>}</div>
        </div>
        <div>
          <p className="text-xs font-semibold text-red-500">❌ Lost in A</p>
          <div className="mt-1 flex flex-wrap gap-1">{declined.length ? declined.map(x => <Badge key={x} variant="outline" className="bg-red-500/15 text-red-500 border-red-500/30">{x}</Badge>) : <span className="text-xs text-muted-foreground">—</span>}</div>
        </div>
      </div>
      <div className="rounded-md bg-muted/40 p-2 text-sm">
        <p className="font-semibold">
          {bestVsWorst ? "🏆 Best vs 😞 Worst" : "📊 Overall change"}: {improvementPct > 0 ? `+${improvementPct}% accuracy improvement` : improvementPct < 0 ? `${improvementPct}% accuracy decline` : "same accuracy"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {improvementPct >= 0
            ? `You improved in ${improved.length} subject(s) and maintained core concepts. Keep the momentum.`
            : `You regressed on ${declined.length} subject(s). Focus revision there before the next mock.`}
        </p>
      </div>
    </CardContent></Card>
  );
}

function GoalInput({ label, value, current, onSave }: { label: string; value: number | null; current: number; onSave: (n: number|null)=>void }) {
  const [v, setV] = useState<string>(value?.toString() ?? "");
  useEffect(() => setV(value?.toString() ?? ""), [value]);
  const target = Number(v) || 0;
  const pct = target ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold">{label}</p>
      <div className="flex gap-1">
        <Input value={v} onChange={e => setV(e.target.value)} type="number" placeholder="—" />
        <Button size="sm" onClick={() => onSave(v ? Number(v) : null)}>Save</Button>
      </div>
      {target > 0 && (
        <div className="space-y-0.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[10px] text-muted-foreground">Now {current} / Target {target} — {pct}%</p>
        </div>
      )}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{label}</CardContent></Card>;
}
