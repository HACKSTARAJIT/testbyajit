import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import {
  Brain, Sparkles, ClipboardPaste, Loader2, Upload, FileText, BookOpen, BarChart3,
  MessageCircle, TrendingUp, TrendingDown, Target, ChevronRight, ChevronLeft,
  AlertTriangle, SkipForward, Send,
} from "lucide-react";

/* ============================================================
   AI PERFORMANCE CENTER — imported AI report is single source of truth
   Sections: New Mock · Mock Report · AI Memory · Academic Intelligence ·
             Overview · Subjects · Performance · AI Coach
============================================================ */

type ReportRow = {
  id: string; report_number: number; mock_name: string | null;
  source_ai: string | null; score: number | null; accuracy: number | null;
  attempt_percent: number | null; negative_marks: number | null;
  overall_rank: number | null; percentile: number | null; time_used: string | null;
  verdict: string | null; exam_readiness: string | null;
  section_scores: any; extracted: any; created_at: string;
};

type InsightRow = {
  report_id: string;
  mistake_bank: any[]; skipped_bank: any[]; learning_repository: any[];
  additional_insights: string[]; improving_topics: string[]; declining_topics: string[];
  weak_subjects: string[]; weak_chapters: string[]; weak_topics: string[];
  strong_subjects: string[]; strong_chapters?: string[]; strong_topics?: string[];
  hierarchy?: any; patterns?: any; scores?: any; recurring?: any;
  revision_priority?: string[]; action_plan_3day?: string[]; next_mock_strategy?: string[];
  high_roi_chapters?: string[]; high_roi_topics?: string[]; red_flags?: string[];
  strengths?: string[]; weaknesses?: string[];
  deep_analysis_status?: string;
};

export default function AIPerformanceCenter() {
  const { user } = useAuth();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [insights, setInsights] = useState<InsightRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("new");

  async function load() {
    if (!user) return;
    const [{ data: r }, { data: i }] = await Promise.all([
      supabase.from("imported_mock_reports").select("*")
        .eq("user_id", user.id).order("report_number", { ascending: false }),
      supabase.from("imported_report_insights").select("*").eq("user_id", user.id),
    ]);
    setReports((r as any) ?? []);
    setInsights((i as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const insightsById = useMemo(() => {
    const m = new Map<string, InsightRow>();
    insights.forEach(i => m.set(i.report_id, i));
    return m;
  }, [insights]);

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <div className="rounded-xl bg-gradient-to-br from-primary to-secondary p-2 text-primary-foreground shadow-lg shadow-primary/20">
          <Brain className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">🧠 AI Performance Center</h1>
          <p className="text-xs text-muted-foreground">
            Paste your AI mock report — AJIT AI does the rest. Single source of truth for the whole ecosystem.
          </p>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto justify-start bg-card/60 backdrop-blur">
          <TabsTrigger value="new"><ClipboardPaste className="mr-1 h-3.5 w-3.5" />📥 New Mock</TabsTrigger>
          <TabsTrigger value="report"><FileText className="mr-1 h-3.5 w-3.5" />📄 Mock Report</TabsTrigger>
          <TabsTrigger value="memory"><Brain className="mr-1 h-3.5 w-3.5" />🧠 AJIT AI Memory</TabsTrigger>
          <TabsTrigger value="academic"><Sparkles className="mr-1 h-3.5 w-3.5" />🎓 Academic Intelligence</TabsTrigger>
          <TabsTrigger value="overview"><BarChart3 className="mr-1 h-3.5 w-3.5" />📊 Overview</TabsTrigger>
          <TabsTrigger value="subjects"><BookOpen className="mr-1 h-3.5 w-3.5" />📚 Subjects</TabsTrigger>
          <TabsTrigger value="performance"><TrendingUp className="mr-1 h-3.5 w-3.5" />📈 Performance</TabsTrigger>
          <TabsTrigger value="coach"><MessageCircle className="mr-1 h-3.5 w-3.5" />🤖 AJIT AI Coach</TabsTrigger>
        </TabsList>

        <TabsContent value="new"><NewMockSection onDone={() => { load(); setTab("report"); }} /></TabsContent>
        <TabsContent value="report"><MockReportSection reports={reports} insights={insightsById} onGoImport={() => setTab("new")} /></TabsContent>
        <TabsContent value="memory"><AIMemorySection reports={reports} insights={insightsById} /></TabsContent>
        <TabsContent value="academic"><AcademicSection reports={reports} insights={insights} /></TabsContent>
        <TabsContent value="overview"><OverviewSection reports={reports} insights={insights} /></TabsContent>
        <TabsContent value="subjects"><SubjectsSection insights={insights} /></TabsContent>
        <TabsContent value="performance"><PerformanceSection reports={reports} /></TabsContent>
        <TabsContent value="coach"><CoachSection hasData={reports.length > 0} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- 1. NEW MOCK ---------- */
function NewMockSection({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState("");
  const [mockName, setMockName] = useState("");
  const [importing, setImporting] = useState(false);
  const [stage, setStage] = useState("");

  async function handleImport() {
    if (text.trim().length < 40) {
      toast({ title: "Paste the full report", description: "Report is too short.", variant: "destructive" });
      return;
    }
    setImporting(true);
    setStage("Extracting structure…");
    const t1 = setTimeout(() => setStage("Deep analysis: subjects → chapters → topics…"), 8000);
    const t2 = setTimeout(() => setStage("Detecting recurring patterns & scoring…"), 22000);
    const t3 = setTimeout(() => setStage("Updating AI Memory & Subjects…"), 40000);
    try {
      const { data, error } = await supabase.functions.invoke("import-mock-analysis", {
        body: { text, mockName: mockName || null },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "✅ Analysis complete", description: "AJIT AI has updated every module." });
      setText(""); setMockName("");
      onDone();
    } catch (e: any) {
      toast({ title: "Import failed", description: e.message ?? "Try again.", variant: "destructive" });
    } finally {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      setStage(""); setImporting(false);
    }
  }

  return (
    <Card className="border-primary/20 bg-card/60 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardPaste className="h-4 w-4 text-primary" />
          New Mock Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          placeholder="Mock name (e.g. NEET Full Mock #12)"
          value={mockName}
          onChange={(e) => setMockName(e.target.value)}
          maxLength={120}
        />
        <Textarea
          placeholder="Paste your complete AI-generated mock analysis report here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          className="font-mono text-xs"
          maxLength={80000}
        />
        <div className="text-xs text-muted-foreground">{text.length.toLocaleString()} / 80,000 chars</div>
        <Button onClick={handleImport} disabled={importing || text.trim().length < 40}>
          {importing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing…</> : <><Upload className="mr-2 h-4 w-4" />Analyze &amp; Save</>}
        </Button>
        {importing && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
            <div className="flex items-center gap-2 font-medium text-primary">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {stage || "Extracting structure…"}
            </div>
            <p className="mt-1 text-muted-foreground">
              AJIT AI is understanding the report, updating memory and rebuilding all modules automatically.
            </p>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          After import, every section — Mock Report, AI Memory, Academic Intelligence, Overview, Subjects, Performance and AI Coach — refreshes automatically.
        </p>
      </CardContent>
    </Card>
  );
}

/* ---------- 2. MOCK REPORT (latest) ---------- */
function MockReportSection({ reports, insights, onGoImport }: {
  reports: ReportRow[]; insights: Map<string, InsightRow>; onGoImport: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const r = reports[idx];
  if (!r) return <EmptyState label="No mock imported yet." onAction={onGoImport} actionLabel="Import your first mock" />;
  const ins = insights.get(r.id);
  const e = r.extracted ?? {};

  return (
    <div className="space-y-3">
      <Card className="border-primary/30">
        <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" disabled={idx >= reports.length - 1} onClick={() => setIdx(i => i + 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <div>
              <p className="text-sm font-semibold">Mock {r.report_number} · {r.mock_name ?? "Untitled"}</p>
              <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()} {r.source_ai && `· ${r.source_ai}`}</p>
            </div>
            <Button size="icon" variant="outline" disabled={idx === 0} onClick={() => setIdx(i => i - 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Overall Performance</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Score" value={r.score} />
          <Stat label="Accuracy" value={r.accuracy != null ? `${r.accuracy}%` : null} />
          <Stat label="Attempt" value={r.attempt_percent != null ? `${r.attempt_percent}%` : null} />
          <Stat label="Negative" value={r.negative_marks} />
          <Stat label="Percentile" value={r.percentile} />
          <Stat label="Rank" value={r.overall_rank} />
          <Stat label="Time Used" value={r.time_used} />
          <Stat label="Readiness" value={r.exam_readiness} />
        </CardContent>
      </Card>

      {Array.isArray(r.section_scores) && r.section_scores.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Section-wise Analysis</CardTitle></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {r.section_scores.map((s: any, i: number) => (
              <div key={i} className="rounded-md border bg-muted/30 p-2 text-xs">
                <p className="font-semibold">{s.name ?? s.section ?? `Section ${i + 1}`}</p>
                <p className="text-muted-foreground">
                  {s.score != null && `Score: ${s.score}`} {s.accuracy != null && ` · Acc: ${s.accuracy}%`} {s.attempted != null && ` · Att: ${s.attempted}`}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <ListCard title="✅ Strengths" items={ins?.strengths ?? e.strengths ?? []} />
        <ListCard title="⚠️ Weaknesses" items={ins?.weaknesses ?? e.weaknesses ?? []} tone="warn" />
        <ListCard title="🎯 High ROI Areas" items={[...(ins?.high_roi_chapters ?? []), ...(ins?.high_roi_topics ?? [])]} />
        <ListCard title="🚩 Red Flags" items={ins?.red_flags ?? e.red_flags ?? []} tone="danger" />
      </div>

      <MistakeSkippedCards ins={ins} />

      <div className="grid gap-3 md:grid-cols-2">
        <ListCard title="🗓 Revision Plan" items={ins?.revision_priority ?? []} />
        <ListCard title="🚀 Action Plan" items={[...(ins?.action_plan_3day ?? []), ...(ins?.next_mock_strategy ?? [])]} />
      </div>

      {r.verdict && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">🏁 Final Verdict</CardTitle></CardHeader>
          <CardContent><p className="text-sm">{r.verdict}</p></CardContent>
        </Card>
      )}
    </div>
  );
}

function MistakeSkippedCards({ ins }: { ins?: InsightRow }) {
  if (!ins) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" />Mistakes <Badge variant="outline">{ins.mistake_bank?.length ?? 0}</Badge></CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-56 pr-2">
            <div className="space-y-2">
              {(ins.mistake_bank ?? []).slice(0, 50).map((m: any, i: number) => (
                <div key={i} className="rounded-md border bg-muted/30 p-2 text-xs space-y-1">
                  <div className="flex flex-wrap gap-1">
                    {m.subject && <Badge variant="secondary" className="text-[10px]">{m.subject}</Badge>}
                    {m.chapter && <Badge variant="outline" className="text-[10px]">{m.chapter}</Badge>}
                    {m.topic && <Badge variant="outline" className="text-[10px]">{m.topic}</Badge>}
                  </div>
                  {m.question && <p className="font-medium">{m.question}</p>}
                  {m.why_wrong && <p className="text-muted-foreground">❌ {m.why_wrong}</p>}
                  {m.correct_concept && <p className="text-emerald-500">✅ {m.correct_concept}</p>}
                </div>
              ))}
              {(ins.mistake_bank ?? []).length === 0 && <p className="text-xs text-muted-foreground">Insufficient Data.</p>}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><SkipForward className="h-4 w-4 text-amber-500" />Skipped Questions <Badge variant="outline">{ins.skipped_bank?.length ?? 0}</Badge></CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-56 pr-2">
            <div className="space-y-2">
              {(ins.skipped_bank ?? []).slice(0, 50).map((s: any, i: number) => (
                <div key={i} className="rounded-md border bg-muted/30 p-2 text-xs space-y-1">
                  <div className="flex flex-wrap gap-1">
                    {s.subject && <Badge variant="secondary" className="text-[10px]">{s.subject}</Badge>}
                    {s.chapter && <Badge variant="outline" className="text-[10px]">{s.chapter}</Badge>}
                    {s.topic && <Badge variant="outline" className="text-[10px]">{s.topic}</Badge>}
                  </div>
                  {s.question && <p className="font-medium">{s.question}</p>}
                  {s.reason && <p className="text-muted-foreground">⏭ {s.reason}</p>}
                </div>
              ))}
              {(ins.skipped_bank ?? []).length === 0 && <p className="text-xs text-muted-foreground">Insufficient Data.</p>}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- 3. AJIT AI MEMORY ---------- */
function AIMemorySection({ reports, insights }: { reports: ReportRow[]; insights: Map<string, InsightRow> }) {
  if (reports.length === 0) return <EmptyState label="Memory is empty. Import a mock to begin." />;
  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Permanent History <Badge variant="outline">{reports.length} mocks</Badge></CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[70vh] pr-2">
            <div className="space-y-3">
              {reports.map((r) => {
                const ins = insights.get(r.id);
                return (
                  <div key={r.id} className="rounded-md border bg-muted/30 p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>Mock {r.report_number}</Badge>
                      <span className="text-sm font-medium">{r.mock_name ?? "Untitled"}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {r.score != null && <span>Score: <b>{r.score}</b></span>}
                      {r.accuracy != null && <span>Acc: <b>{r.accuracy}%</b></span>}
                      {r.negative_marks != null && <span>Neg: <b>{r.negative_marks}</b></span>}
                      {r.percentile != null && <span>%ile: <b>{r.percentile}</b></span>}
                    </div>
                    <div className="grid gap-2 text-xs sm:grid-cols-2">
                      <MiniList title="Mistakes" items={(ins?.mistake_bank ?? []).slice(0, 4).map((m: any) => m.question || m.topic || m.chapter).filter(Boolean)} />
                      <MiniList title="Skipped" items={(ins?.skipped_bank ?? []).slice(0, 4).map((s: any) => s.question || s.topic || s.chapter).filter(Boolean)} />
                      <MiniList title="Improving" items={ins?.improving_topics ?? []} />
                      <MiniList title="Recurring Weakness" items={(ins?.recurring?.weak_topics ?? []).map((x: any) => `${x.name} ×${x.count}`)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- 4. ACADEMIC INTELLIGENCE ---------- */
function AcademicSection({ reports, insights }: { reports: ReportRow[]; insights: InsightRow[] }) {
  const agg = useMemo(() => {
    const subj = new Map<string, { strong: number; weak: number }>();
    const chap = new Map<string, { strong: number; weak: number }>();
    const topic = new Map<string, { strong: number; weak: number }>();
    const mistakes = new Map<string, number>();
    const inc = (m: Map<string, { strong: number; weak: number }>, k: string, key: "strong" | "weak") => {
      const v = m.get(k) ?? { strong: 0, weak: 0 }; v[key]++; m.set(k, v);
    };
    insights.forEach(i => {
      (i.strong_subjects ?? []).forEach(s => inc(subj, s, "strong"));
      (i.weak_subjects ?? []).forEach(s => inc(subj, s, "weak"));
      (i.strong_chapters ?? []).forEach(s => inc(chap, s, "strong"));
      (i.weak_chapters ?? []).forEach(s => inc(chap, s, "weak"));
      (i.strong_topics ?? []).forEach(s => inc(topic, s, "strong"));
      (i.weak_topics ?? []).forEach(s => inc(topic, s, "weak"));
      (i.mistake_bank ?? []).forEach((m: any) => {
        const key = m.topic || m.chapter || m.subject;
        if (key) mistakes.set(key, (mistakes.get(key) ?? 0) + 1);
      });
    });
    const rank = (m: Map<string, { strong: number; weak: number }>, weak = true) =>
      [...m.entries()]
        .map(([k, v]) => ({ name: k, s: v.strong, w: v.weak, net: v.weak - v.strong }))
        .filter(x => (weak ? x.w > 0 : x.s > 0))
        .sort((a, b) => weak ? b.net - a.net : (b.s - b.w) - (a.s - a.w))
        .slice(0, 12);
    const recurring = [...mistakes.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, c]) => `${k} (×${c})`);
    const mostImproved = new Set<string>();
    insights.forEach(i => (i.improving_topics ?? []).forEach(t => mostImproved.add(t)));
    const priorities = new Set<string>();
    insights.forEach(i => (i.revision_priority ?? []).forEach(p => priorities.add(p)));
    const recs = new Set<string>();
    insights.forEach(i => (i.next_mock_strategy ?? []).forEach(p => recs.add(p)));
    return {
      weakSubjects: rank(subj), strongSubjects: rank(subj, false),
      weakChapters: rank(chap), strongChapters: rank(chap, false),
      weakTopics: rank(topic), strongTopics: rank(topic, false),
      recurring, mostImproved: [...mostImproved], priorities: [...priorities], recs: [...recs],
    };
  }, [insights]);

  if (reports.length === 0) return <EmptyState label="Import mocks to unlock academic intelligence." />;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <RankCard title="⚠️ Weak Subjects" rows={agg.weakSubjects} tone="warn" />
        <RankCard title="✅ Strong Subjects" rows={agg.strongSubjects} />
        <RankCard title="⚠️ Weak Chapters" rows={agg.weakChapters} tone="warn" />
        <RankCard title="✅ Strong Chapters" rows={agg.strongChapters} />
        <RankCard title="⚠️ Weak Topics" rows={agg.weakTopics} tone="warn" />
        <RankCard title="✅ Strong Topics" rows={agg.strongTopics} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <ListCard title="🔁 Recurring Mistakes" items={agg.recurring} tone="warn" />
        <ListCard title="📈 Most Improved Areas" items={agg.mostImproved} />
        <ListCard title="🎯 Highest Priority" items={agg.priorities} tone="warn" />
        <ListCard title="💡 Future Study Recommendations" items={agg.recs} />
      </div>
    </div>
  );
}

/* ---------- 5. OVERVIEW ---------- */
function OverviewSection({ reports, insights }: { reports: ReportRow[]; insights: InsightRow[] }) {
  const stats = useMemo(() => {
    const avg = (xs: (number | null | undefined)[]) => {
      const c = xs.filter((n): n is number => n != null); return c.length ? Math.round(c.reduce((s, x) => s + x, 0) / c.length) : null;
    };
    const scores = insights.map(i => i.scores ?? {}).filter(Boolean);
    const readiness = avg(scores.map((s: any) => s.recovery)) ?? avg(scores.map((s: any) => s.mastery));
    const confidence = avg(scores.map((s: any) => s.confidence));
    let status = "Getting Started";
    if (readiness != null) {
      if (readiness >= 80) status = "Exam Ready 🚀";
      else if (readiness >= 60) status = "On Track ✅";
      else if (readiness >= 40) status = "Needs Work ⚠️";
      else status = "Foundation Building 🧱";
    }
    return {
      total: reports.length,
      overallScore: avg(reports.map(r => r.score)),
      accuracy: avg(reports.map(r => r.accuracy)),
      attempt: avg(reports.map(r => r.attempt_percent)),
      negTrend: reports.length >= 2 ? (reports[0].negative_marks ?? 0) - (reports[reports.length - 1].negative_marks ?? 0) : null,
      readiness, confidence, status,
    };
  }, [reports, insights]);

  if (reports.length === 0) return <EmptyState label="Import at least one mock to see your overview." />;

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
      <StatCard label="Overall Score" value={stats.overallScore ?? "—"} tint="from-primary/20 to-primary/5" />
      <StatCard label="Overall Accuracy" value={stats.accuracy != null ? `${stats.accuracy}%` : "—"} tint="from-emerald-500/20 to-emerald-500/5" />
      <StatCard label="Avg Attempt" value={stats.attempt != null ? `${stats.attempt}%` : "—"} tint="from-sky-500/20 to-sky-500/5" />
      <StatCard label="Negative Trend" value={stats.negTrend == null ? "—" : (stats.negTrend > 0 ? `↓ ${stats.negTrend.toFixed(1)}` : `↑ ${Math.abs(stats.negTrend).toFixed(1)}`)} tint="from-red-500/20 to-red-500/5" />
      <StatCard label="Total Mocks" value={stats.total} tint="from-violet-500/20 to-violet-500/5" />
      <StatCard label="Readiness Score" value={stats.readiness != null ? `${stats.readiness}/100` : "—"} tint="from-amber-500/20 to-amber-500/5" />
      <StatCard label="Confidence Score" value={stats.confidence != null ? `${stats.confidence}/100` : "—"} tint="from-indigo-500/20 to-indigo-500/5" />
      <StatCard label="Preparation Status" value={stats.status} tint="from-fuchsia-500/20 to-fuchsia-500/5" />
    </div>
  );
}

/* ---------- 6. SUBJECTS ---------- */
type Node = { name: string; mistakes: any[]; children: Map<string, Node> };
function newNode(name: string): Node { return { name, mistakes: [], children: new Map() }; }

function SubjectsSection({ insights }: { insights: InsightRow[] }) {
  const tree = useMemo(() => {
    const root = new Map<string, Node>();
    insights.forEach(i => {
      (i.mistake_bank ?? []).forEach((m: any) => {
        const sub = (m.subject || "General").trim();
        const chap = (m.chapter || "General").trim();
        const top = (m.topic || "General").trim();
        const stop = (m.subtopic || "").trim();
        const s = root.get(sub) ?? newNode(sub); root.set(sub, s);
        const c = s.children.get(chap) ?? newNode(chap); s.children.set(chap, c);
        const t = c.children.get(top) ?? newNode(top); c.children.set(top, t);
        if (stop) {
          const st = t.children.get(stop) ?? newNode(stop); t.children.set(stop, st);
          st.mistakes.push(m);
        } else {
          t.mistakes.push(m);
        }
      });
    });
    return root;
  }, [insights]);

  const [openSubject, setOpenSubject] = useState<string | null>(null);
  const [openChapter, setOpenChapter] = useState<string | null>(null);

  if (tree.size === 0) return <EmptyState label="No subject-level mistakes yet. Import a mock so AJIT AI can build your personalized subjects." />;

  const subjectList = [...tree.entries()].sort((a, b) => count(b[1]) - count(a[1]));

  if (!openSubject) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {subjectList.map(([name, node]) => (
          <button key={name} onClick={() => setOpenSubject(name)}
            className="rounded-xl border bg-gradient-to-br from-primary/10 to-primary/5 p-4 text-left transition hover:border-primary/40 hover:-translate-y-0.5">
            <div className="mb-2 flex items-center justify-between">
              <BookOpen className="h-5 w-5 text-primary" />
              <Badge variant="outline">{count(node)} mistakes</Badge>
            </div>
            <p className="text-base font-semibold">{name}</p>
            <p className="text-xs text-muted-foreground">{node.children.size} chapters</p>
          </button>
        ))}
      </div>
    );
  }

  const subjectNode = tree.get(openSubject)!;
  if (!openChapter) {
    const chapters = [...subjectNode.children.entries()].sort((a, b) => count(b[1]) - count(a[1]));
    return (
      <div className="space-y-3">
        <Button size="sm" variant="ghost" onClick={() => setOpenSubject(null)}><ChevronLeft className="mr-1 h-4 w-4" />Subjects</Button>
        <h2 className="text-lg font-bold">📚 {openSubject}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {chapters.map(([name, node]) => (
            <button key={name} onClick={() => setOpenChapter(name)}
              className="rounded-md border bg-card/60 p-3 text-left transition hover:border-primary/40">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{name}</p>
                <Badge variant="outline">{count(node)}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{node.children.size} topics</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const chapNode = subjectNode.children.get(openChapter)!;
  const topics = [...chapNode.children.entries()].sort((a, b) => count(b[1]) - count(a[1]));
  return (
    <div className="space-y-3">
      <Button size="sm" variant="ghost" onClick={() => setOpenChapter(null)}><ChevronLeft className="mr-1 h-4 w-4" />{openSubject}</Button>
      <h2 className="text-lg font-bold">📖 {openChapter}</h2>
      <p className="text-xs text-muted-foreground">Personalized practice — pulled automatically from your imported mock mistakes.</p>
      {topics.map(([topicName, tNode]) => {
        const items = [...tNode.mistakes, ...[...tNode.children.values()].flatMap(st => st.mistakes.map(m => ({ ...m, subtopic: st.name })))];
        return (
          <Card key={topicName}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>🎯 {topicName}</span>
                <Badge variant="outline">{items.length} questions</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.slice(0, 20).map((m: any, i: number) => (
                <div key={i} className="rounded-md border bg-muted/30 p-2 text-xs space-y-1">
                  {m.subtopic && <Badge variant="outline" className="text-[10px]">{m.subtopic}</Badge>}
                  {m.question && <p className="font-medium">{m.question}</p>}
                  {m.why_wrong && <p className="text-muted-foreground">❌ {m.why_wrong}</p>}
                  {m.correct_concept && <p className="text-emerald-500">✅ {m.correct_concept}</p>}
                  {m.trick && <p className="text-primary">💡 {m.trick}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function count(n: Node): number {
  let c = n.mistakes.length;
  n.children.forEach(ch => c += count(ch));
  return c;
}

/* ---------- 7. PERFORMANCE ---------- */
function PerformanceSection({ reports }: { reports: ReportRow[] }) {
  const ordered = useMemo(() => [...reports].sort((a, b) => a.report_number - b.report_number), [reports]);
  if (ordered.length === 0) return <EmptyState label="No performance data yet." />;

  const trend = (xs: (number | null)[]) => {
    const clean = xs.map((n, i) => ({ i, n })).filter(x => x.n != null) as { i: number; n: number }[];
    if (clean.length < 2) return null;
    return clean[clean.length - 1].n - clean[0].n;
  };
  const rows: [string, (number | null)[], boolean][] = [
    ["Overall Score", ordered.map(r => r.score), false],
    ["Accuracy", ordered.map(r => r.accuracy), false],
    ["Attempt %", ordered.map(r => r.attempt_percent), false],
    ["Negative Marks", ordered.map(r => r.negative_marks), true],
  ];

  const subjPerf = new Map<string, number[]>();
  ordered.forEach(r => {
    const s = r.section_scores;
    if (Array.isArray(s)) s.forEach((x: any) => {
      const n = x.name ?? x.section; const v = x.score ?? x.accuracy;
      if (n && typeof v === "number") { const arr = subjPerf.get(n) ?? []; arr.push(v); subjPerf.set(n, arr); }
    });
  });

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map(([label, xs, inverse]) => {
          const d = trend(xs);
          const good = d == null ? null : inverse ? d < 0 : d > 0;
          return (
            <Card key={label}>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <div className="flex items-center gap-1">
                  {d == null ? <span className="text-sm text-muted-foreground">Insufficient Data</span> : (
                    <>
                      {good ? <TrendingUp className="h-4 w-4 text-emerald-500" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
                      <span className={`text-lg font-bold ${good ? "text-emerald-500" : "text-destructive"}`}>
                        {d > 0 ? "+" : ""}{d.toFixed(1)}
                      </span>
                    </>
                  )}
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {xs.filter(n => n != null).map(n => n).join(" → ")}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {subjPerf.size > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Subject Performance (across mocks)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {[...subjPerf.entries()].map(([name, arr]) => {
              const delta = arr[arr.length - 1] - arr[0];
              return (
                <div key={name} className="flex items-center justify-between rounded-md border bg-muted/30 p-2 text-xs">
                  <span className="font-medium">{name}</span>
                  <span className="text-muted-foreground">{arr.join(" → ")}</span>
                  <Badge variant={delta >= 0 ? "default" : "destructive"} className="text-[10px]">
                    {delta > 0 ? "+" : ""}{delta.toFixed(1)}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ---------- 8. AJIT AI COACH ---------- */
function CoachSection({ hasData }: { hasData: boolean }) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const suggestions = [
    "What should I study today?",
    "Which chapter is weakest?",
    "Which topic keeps repeating?",
    "What should I revise before my next mock?",
    "What mistakes am I repeating?",
    "How can I improve my score?",
  ];

  async function send(q?: string) {
    const question = (q ?? input).trim();
    if (!question || sending) return;
    setInput("");
    const next = [...messages, { role: "user" as const, content: question }];
    setMessages(next);
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("imported-coach-chat", {
        body: { question, history: next.slice(-8) },
      });
      if (error) throw error;
      const answer = (data as any)?.answer ?? (data as any)?.error ?? "Insufficient Data.";
      setMessages(m => [...m, { role: "assistant", content: answer }]);
    } catch (e: any) {
      setMessages(m => [...m, { role: "assistant", content: `Error: ${e.message ?? "try again"}` }]);
    } finally { setSending(false); }
  }

  if (!hasData) return <EmptyState label="Import a mock to unlock AJIT AI Coach." />;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><MessageCircle className="h-4 w-4 text-primary" />AJIT AI Coach — grounded in your imported mocks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ScrollArea className="h-[50vh] rounded-md border bg-muted/20 p-3">
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Ask anything — I answer strictly from your stored AI reports.</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map(s => (
                  <button key={s} onClick={() => send(s)} className="rounded-full border bg-card px-3 py-1 text-xs hover:border-primary/40">{s}</button>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2">
            {messages.map((m, i) => (
              <div key={i} className={`rounded-md p-2 text-sm ${m.role === "user" ? "bg-primary/10 ml-8" : "bg-card border mr-8"}`}>
                <p className="text-[10px] uppercase text-muted-foreground mb-1">{m.role === "user" ? "You" : "AJIT AI"}</p>
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}
            {sending && <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" />Thinking…</div>}
            <div ref={endRef} />
          </div>
        </ScrollArea>
        <div className="flex gap-2">
          <Input
            placeholder="Ask AJIT AI…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            disabled={sending}
          />
          <Button onClick={() => send()} disabled={sending || !input.trim()}><Send className="h-4 w-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- shared UI ---------- */
function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2 text-center">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="text-base font-bold">{value == null || value === "" ? "—" : String(value)}</p>
    </div>
  );
}
function StatCard({ label, value, tint }: { label: string; value: any; tint: string }) {
  return (
    <div className={`rounded-xl border bg-gradient-to-br ${tint} p-3 backdrop-blur`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
function ListCard({ title, items, tone }: { title: string; items: string[]; tone?: "warn" | "danger" }) {
  const color = tone === "danger" ? "border-destructive/30" : tone === "warn" ? "border-amber-500/30" : "";
  return (
    <Card className={color}>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>
        {items?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {items.map((t, i) => <Badge key={i} variant="secondary" className="whitespace-normal text-left text-xs">{t}</Badge>)}
          </div>
        ) : <p className="text-xs text-muted-foreground">Insufficient Data.</p>}
      </CardContent>
    </Card>
  );
}
function RankCard({ title, rows, tone }: { title: string; rows: { name: string; s: number; w: number }[]; tone?: "warn" }) {
  return (
    <Card className={tone === "warn" ? "border-amber-500/30" : ""}>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? <p className="text-xs text-muted-foreground">Insufficient Data.</p> : (
          <div className="space-y-1">
            {rows.map(r => (
              <div key={r.name} className="flex items-center justify-between rounded-md border bg-muted/30 p-2 text-xs">
                <span className="font-medium">{r.name}</span>
                <span className="text-muted-foreground">✅ {r.s} · ⚠ {r.w}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
function MiniList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-muted-foreground">{title}</p>
      {items.length === 0 ? <p className="text-[11px] text-muted-foreground">—</p> : (
        <ul className="list-disc pl-4 text-[11px]">{items.slice(0, 4).map((t, i) => <li key={i}>{t}</li>)}</ul>
      )}
    </div>
  );
}
function EmptyState({ label, onAction, actionLabel }: { label: string; onAction?: () => void; actionLabel?: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <Target className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{label}</p>
        {onAction && actionLabel && <Button size="sm" onClick={onAction}>{actionLabel}</Button>}
      </CardContent>
    </Card>
  );
}
