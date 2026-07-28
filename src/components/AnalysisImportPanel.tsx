import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, Upload, Trash2, Eye, TrendingUp, TrendingDown, Sparkles,
  FileText, RotateCcw, ClipboardPaste, BookOpen, AlertTriangle, SkipForward, BookMarked,
} from "lucide-react";

type ReportRow = {
  id: string;
  report_number: number;
  mock_name: string | null;
  original_text: string;
  extracted: any;
  source_ai: string | null;
  score: number | null;
  accuracy: number | null;
  attempt_percent: number | null;
  negative_marks: number | null;
  overall_rank: number | null;
  percentile: number | null;
  time_used: string | null;
  verdict: string | null;
  exam_readiness: string | null;
  created_at: string;
};

type Insights = {
  report_id: string;
  mistake_bank: any[]; skipped_bank: any[]; learning_repository: any[];
  additional_insights: string[]; improving_topics: string[]; declining_topics: string[];
  weak_chapters: string[]; weak_topics: string[]; strong_subjects: string[]; weak_subjects: string[];
  hierarchy?: any; patterns?: any; scores?: any; recurring?: any;
  deep_analysis_status?: string; deep_analysis_error?: string | null;
};

type AutoTest = {
  id: string; report_id: string; kind: string; title: string;
  subject: string | null; chapter: string | null; topic: string | null; subtopic: string | null;
  item_count: number; priority: string; difficulty_curve: string | null; meta: any;
  created_at: string;
};

function Chips({ items }: { items: string[] }) {
  if (!items?.length) return <p className="text-xs text-muted-foreground">Insufficient Data.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t, i) => (
        <Badge key={i} variant="secondary" className="whitespace-normal text-left text-xs">{t}</Badge>
      ))}
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <Chips items={items ?? []} />
    </div>
  );
}

export default function AnalysisImportPanel() {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [mockName, setMockName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importStage, setImportStage] = useState<string>("");
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [insights, setInsights] = useState<Insights[]>([]);
  const [autoTests, setAutoTests] = useState<AutoTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<ReportRow | null>(null);

  async function load() {
    if (!user) return;
    setLoading(true);
    const [{ data: r }, { data: ins }, { data: at }] = await Promise.all([
      supabase.from("imported_mock_reports").select("*").eq("user_id", user.id).order("report_number", { ascending: false }),
      supabase.from("imported_report_insights").select("*").eq("user_id", user.id),
      supabase.from("imported_auto_tests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    setReports((r as any) ?? []);
    setInsights((ins as any) ?? []);
    setAutoTests((at as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  async function handleImport() {
    if (text.trim().length < 40) {
      toast({ title: "Paste the full report", description: "Report is too short.", variant: "destructive" });
      return;
    }
    setImporting(true);
    setImportStage("Extracting structure…");
    // rolling stage hints so the user sees what's happening
    const stageTimer = setTimeout(() => setImportStage("Deep analysis: subjects → chapters → topics…"), 8000);
    const stageTimer2 = setTimeout(() => setImportStage("Detecting recurring patterns & scoring…"), 22000);
    const stageTimer3 = setTimeout(() => setImportStage("Generating personalized recovery tests…"), 40000);
    try {
      const { data, error } = await supabase.functions.invoke("import-mock-analysis", {
        body: { text, mockName: mockName || null },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const d: any = data;
      toast({
        title: "✅ Analysis complete",
        description: `Mock ${d.report.report_number} · ${d.auto_tests_generated ?? 0} personalized tests generated · deep analysis ${d.deep_analysis_status ?? "done"}.`,
      });
      setText(""); setMockName("");
      load();
    } catch (e: any) {
      toast({ title: "Import failed", description: e.message ?? "Try again.", variant: "destructive" });
    } finally {
      clearTimeout(stageTimer); clearTimeout(stageTimer2); clearTimeout(stageTimer3);
      setImportStage(""); setImporting(false);
    }
  }


  async function handleDelete(id: string) {
    if (!confirm("Delete this imported report?")) return;
    const { error } = await supabase.from("imported_mock_reports").delete().eq("id", id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    setReports((r) => r.filter((x) => x.id !== id));
    setInsights((i) => i.filter((x) => x.report_id !== id));
  }

  const trend = useMemo(() => {
    const ordered = [...reports].sort((a, b) => a.report_number - b.report_number);
    const diff = (xs: (number | null)[]) => {
      const clean = xs.filter((n): n is number => n != null);
      return clean.length >= 2 ? clean[clean.length - 1] - clean[0] : null;
    };
    return {
      accuracyDelta: diff(ordered.map((r) => r.accuracy)),
      scoreDelta: diff(ordered.map((r) => r.score)),
      attemptDelta: diff(ordered.map((r) => r.attempt_percent)),
      negativeDelta: diff(ordered.map((r) => r.negative_marks)),
      percentileDelta: diff(ordered.map((r) => r.percentile)),
    };
  }, [reports]);

  const comparison = useMemo(() => {
    if (reports.length < 2) return null;
    const subjAcc = new Map<string, { strong: number; weak: number }>();
    const chapCount = new Map<string, number>();
    const topicCount = new Map<string, number>();
    const mistakeCount = new Map<string, number>();
    reports.forEach((r) => {
      const e = r.extracted ?? {};
      (e.strong_subjects ?? []).forEach((s: string) => {
        const c = subjAcc.get(s) ?? { strong: 0, weak: 0 }; c.strong++; subjAcc.set(s, c);
      });
      (e.weak_subjects ?? []).forEach((s: string) => {
        const c = subjAcc.get(s) ?? { strong: 0, weak: 0 }; c.weak++; subjAcc.set(s, c);
      });
      (e.weak_chapters ?? []).forEach((c: string) => chapCount.set(c, (chapCount.get(c) ?? 0) + 1));
      (e.weak_topics ?? []).forEach((t: string) => topicCount.set(t, (topicCount.get(t) ?? 0) + 1));
      [...(e.conceptual_errors ?? []), ...(e.silly_mistakes ?? []), ...(e.calculation_errors ?? []), ...(e.reading_errors ?? [])]
        .forEach((m: string) => mistakeCount.set(m, (mistakeCount.get(m) ?? 0) + 1));
    });
    const improving: string[] = [], declining: string[] = [];
    subjAcc.forEach((v, k) => {
      if (v.strong > v.weak) improving.push(k);
      else if (v.weak > v.strong) declining.push(k);
    });
    const topN = (m: Map<string, number>, n = 10) =>
      [...m.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, c]) => `${k} (×${c})`);
    return {
      improving, declining,
      repeatedWeakChapters: topN(chapCount),
      repeatedWeakTopics: topN(topicCount),
      repeatedMistakes: topN(mistakeCount),
    };
  }, [reports]);

  const banks = useMemo(() => {
    const mistakes: any[] = [], skipped: any[] = [], learning: any[] = [];
    const extra = new Set<string>();
    insights.forEach((i) => {
      (i.mistake_bank ?? []).forEach((m) => mistakes.push(m));
      (i.skipped_bank ?? []).forEach((s) => skipped.push(s));
      (i.learning_repository ?? []).forEach((l) => learning.push(l));
      (i.additional_insights ?? []).forEach((a) => extra.add(a));
    });
    return { mistakes, skipped, learning, extra: [...extra] };
  }, [insights]);

  return (
    <div className="space-y-4">
      <Tabs defaultValue="new" className="w-full">
        <TabsList className="flex flex-wrap h-auto justify-start bg-card/60 backdrop-blur">
          <TabsTrigger value="new"><Upload className="mr-1 h-3.5 w-3.5" />📥 New Analysis</TabsTrigger>
          <TabsTrigger value="brain"><Sparkles className="mr-1 h-3.5 w-3.5" />🧠 AI Analysis</TabsTrigger>
          <TabsTrigger value="tests"><BookMarked className="mr-1 h-3.5 w-3.5" />🎯 Personalized Tests</TabsTrigger>
          <TabsTrigger value="history"><FileText className="mr-1 h-3.5 w-3.5" />📚 History</TabsTrigger>
          <TabsTrigger value="repos"><BookMarked className="mr-1 h-3.5 w-3.5" />📚 Repositories</TabsTrigger>
          <TabsTrigger value="compare"><TrendingUp className="mr-1 h-3.5 w-3.5" />📈 Compare</TabsTrigger>
        </TabsList>

        {/* NEW ANALYSIS — paste from any AI */}
        <TabsContent value="new" className="space-y-4">
          <Card className="border-primary/20 bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardPaste className="h-4 w-4 text-primary" />
                New Mock Analysis — paste report from any AI (Gemini / ChatGPT / Claude / DeepSeek / any)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Mock name (optional) — e.g. NEET Full Mock #12"
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
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{text.length.toLocaleString()} / 80,000 chars</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleImport} disabled={importing || text.trim().length < 40}>
                  {importing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing…</> : <><Upload className="mr-2 h-4 w-4" />Analyze &amp; Save</>}
                </Button>
                <Button variant="outline" onClick={() => { setText(""); setMockName(""); }} disabled={importing}>
                  <RotateCcw className="mr-2 h-4 w-4" />Clear
                </Button>
              </div>
              {importing && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
                  <div className="flex items-center gap-2 font-medium text-primary">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {importStage || "Extracting structure…"}
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    AJIT AI is extracting insights, building a Subject → Chapter → Topic → Subtopic map, detecting recurring patterns and auto-generating personalized recovery tests. Please stay on this screen.
                  </p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                🧠 After import, AJIT 360 automatically deep-analyses the report, refreshes every module in the Performance Center, and generates Wrong / Skipped / Weak-Subject / Chapter / Topic / Recurring / Recovery tests for you.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI ANALYSIS — deep understanding of latest report */}
        <TabsContent value="brain" className="space-y-4">
          {(() => {
            const latest = reports[0];
            const latestIns = latest ? insights.find((i) => i.report_id === latest.id) : null;
            if (!latest || !latestIns) {
              return <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Import a report to unlock AI Analysis.</CardContent></Card>;
            }
            const s = latestIns.scores ?? {};
            const h = latestIns.hierarchy ?? {};
            const p = latestIns.patterns ?? {};
            const rec = latestIns.recurring ?? {};
            const scoreCards: Array<[string, number | undefined, string]> = [
              ["Mastery", s.mastery, "text-emerald-500"],
              ["Weakness", s.weakness, "text-destructive"],
              ["Recovery", s.recovery, "text-amber-500"],
              ["Confidence", s.confidence, "text-primary"],
              ["Learning Progress", s.learning_progress, "text-sky-500"],
            ];
            return (
              <>
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" /> Mock {latest.report_number} — {latest.mock_name ?? "Latest"}
                      <Badge variant="outline" className="text-[10px]">{latestIns.deep_analysis_status ?? "pending"}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {scoreCards.map(([label, val, color]) => (
                        <div key={label} className="rounded-md border bg-muted/40 p-2 text-center">
                          <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
                          <p className={`text-xl font-bold ${color}`}>{val ?? "—"}{val != null && <span className="text-xs">/100</span>}</p>
                        </div>
                      ))}
                    </div>
                    {latestIns.deep_analysis_error && (
                      <p className="mt-2 text-[11px] text-destructive">Deep analysis warning: {latestIns.deep_analysis_error}</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">📚 Subject → Chapter → Topic Map</CardTitle></CardHeader>
                  <CardContent>
                    {Array.isArray(h.subjects) && h.subjects.length ? (
                      <ScrollArea className="max-h-[420px] pr-2">
                        <div className="space-y-3">
                          {h.subjects.map((sub: any, i: number) => (
                            <div key={i} className="rounded-md border bg-muted/30 p-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="default">{sub.name}</Badge>
                                {sub.priority && <Badge variant={sub.priority === "critical" ? "destructive" : "outline"} className="text-[10px]">{sub.priority}</Badge>}
                                {sub.accuracy != null && <span className="text-xs text-muted-foreground">Accuracy: {sub.accuracy}%</span>}
                                <span className="text-xs text-muted-foreground">❌ {sub.mistakes ?? 0} · ⏭ {sub.skipped ?? 0}</span>
                              </div>
                              {Array.isArray(sub.chapters) && sub.chapters.map((ch: any, j: number) => (
                                <div key={j} className="ml-3 mt-2 border-l-2 border-primary/30 pl-3">
                                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                    <Badge variant="secondary" className="text-[10px]">{ch.name}</Badge>
                                    {ch.priority && <Badge variant="outline" className="text-[10px]">{ch.priority}</Badge>}
                                    <span className="text-muted-foreground">❌ {ch.mistakes ?? 0} · ⏭ {ch.skipped ?? 0}</span>
                                  </div>
                                  {Array.isArray(ch.topics) && ch.topics.map((tp: any, k: number) => (
                                    <div key={k} className="ml-3 mt-1 border-l border-border pl-2 text-[11px]">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="font-medium">{tp.name}</span>
                                        {tp.priority && <Badge variant="outline" className="text-[10px]">{tp.priority}</Badge>}
                                        <span className="text-muted-foreground">❌ {tp.mistakes ?? 0} · ⏭ {tp.skipped ?? 0}</span>
                                      </div>
                                      {Array.isArray(tp.subtopics) && tp.subtopics.length > 0 && (
                                        <div className="ml-2 mt-0.5 flex flex-wrap gap-1">
                                          {tp.subtopics.map((st: any, m: number) => (
                                            <Badge key={m} variant="outline" className="text-[10px]">{st.name} ({(st.mistakes ?? 0) + (st.skipped ?? 0)})</Badge>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : <p className="text-xs text-muted-foreground">Hierarchy not built yet — re-import if deep analysis failed.</p>}
                  </CardContent>
                </Card>

                <div className="grid gap-3 md:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">🧩 Detected Patterns</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      <Section title="Time Management" items={p.time_management ?? []} />
                      <Section title="Silly Mistakes" items={p.silly_mistakes ?? []} />
                      <Section title="Concept Mistakes" items={p.concept_mistakes ?? []} />
                      <Section title="Guesswork" items={p.guesswork ?? []} />
                      <Section title="Confidence" items={p.confidence_issues ?? []} />
                      <Section title="Skipped Patterns" items={p.skipped_patterns ?? []} />
                      <Section title="Question Patterns" items={p.question_patterns ?? []} />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">🔁 Recurring Across Mocks</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      <Section title="Recurring Weak Subjects" items={(rec.weak_subjects ?? []).map((x: any) => `${x.name} (×${x.count})`)} />
                      <Section title="Recurring Weak Chapters" items={(rec.weak_chapters ?? []).map((x: any) => `${x.name} (×${x.count})`)} />
                      <Section title="Recurring Weak Topics" items={(rec.weak_topics ?? []).map((x: any) => `${x.name} (×${x.count})`)} />
                      <Section title="Recurring Critical Topics" items={(rec.critical_topics ?? []).map((x: any) => `${x.name} (×${x.count})`)} />
                    </CardContent>
                  </Card>
                </div>
              </>
            );
          })()}
        </TabsContent>

        {/* PERSONALIZED TESTS — auto-generated per report */}
        <TabsContent value="tests" className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : autoTests.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Personalized tests appear here automatically after each import.</CardContent></Card>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Auto-generated from your imported reports. Wrong and skipped repositories are always kept separate.
              </p>
              {autoTests.map((t) => {
                const rep = reports.find((r) => r.id === t.report_id);
                const priorityVariant = t.priority === "critical" ? "destructive" : t.priority === "high" ? "default" : "secondary";
                return (
                  <Card key={t.id} className="border-border/60 hover:border-primary/40 transition">
                    <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-medium">{t.title}</span>
                          <Badge variant={priorityVariant as any} className="text-[10px]">{t.priority}</Badge>
                          <Badge variant="outline" className="text-[10px]">{t.kind.replace(/_/g, " ")}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {rep && <span>Mock {rep.report_number}</span>}
                          <span>{t.item_count} items</span>
                          {t.difficulty_curve && <span>{t.difficulty_curve}</span>}
                          {t.subject && <span>· {t.subject}</span>}
                          {t.chapter && <span>· {t.chapter}</span>}
                          {t.topic && <span>· {t.topic}</span>}
                        </div>
                      </div>
                      <Button size="sm" onClick={() => (window.location.href = `/imported-auto-test/${t.id}`)}>
                        <Sparkles className="mr-1 h-4 w-4" />Start
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )}
        </TabsContent>


        {/* HISTORY */}
        <TabsContent value="history" className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : reports.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No imported reports yet.</CardContent></Card>
          ) : reports.map((r) => (
            <Card key={r.id} className="border-border/60 transition hover:border-primary/40">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="default">Mock {r.report_number}</Badge>
                    <span className="truncate text-sm font-medium">{r.mock_name ?? "Untitled"}</span>
                    {r.source_ai && <Badge variant="outline" className="text-[10px]">{r.source_ai}</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>{new Date(r.created_at).toLocaleDateString()}</span>
                    {r.score != null && <span>Score: <b>{r.score}</b></span>}
                    {r.accuracy != null && <span>Accuracy: <b>{r.accuracy}%</b></span>}
                    {r.attempt_percent != null && <span>Attempt: <b>{r.attempt_percent}%</b></span>}
                    {r.negative_marks != null && <span>Neg: <b>{r.negative_marks}</b></span>}
                    {r.percentile != null && <span>Percentile: <b>{r.percentile}</b></span>}
                    {r.overall_rank != null && <span>Rank: <b>{r.overall_rank}</b></span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setViewing(r)}><Eye className="mr-1 h-4 w-4" />View</Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* REPOSITORIES — aggregated banks */}
        <TabsContent value="repos" className="space-y-4">
          {insights.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Import at least one report to build your repositories.</CardContent></Card>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    Mistake Bank <Badge variant="outline">{banks.mistakes.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {banks.mistakes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No mistakes captured yet.</p>
                  ) : (
                    <ScrollArea className="h-72 pr-3">
                      <div className="space-y-2">
                        {banks.mistakes.slice(0, 200).map((m, i) => (
                          <div key={i} className="rounded-md border bg-muted/30 p-2 text-xs space-y-1">
                            <div className="flex flex-wrap gap-1">
                              {m.subject && <Badge variant="secondary">{m.subject}</Badge>}
                              {m.chapter && <Badge variant="outline">{m.chapter}</Badge>}
                              {m.topic && <Badge variant="outline">{m.topic}</Badge>}
                              {m.type && <Badge variant="destructive" className="text-[10px]">{m.type}</Badge>}
                            </div>
                            {m.question && <p className="font-medium">{m.question}</p>}
                            {m.why_wrong && <p className="text-muted-foreground">❌ {m.why_wrong}</p>}
                            {m.correct_concept && <p className="text-emerald-600 dark:text-emerald-400">✅ {m.correct_concept}</p>}
                            {m.trick && <p className="text-primary">💡 {m.trick}</p>}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <SkipForward className="h-4 w-4 text-amber-500" />
                    Skipped Bank <Badge variant="outline">{banks.skipped.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {banks.skipped.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No skipped-question insights captured yet.</p>
                  ) : (
                    <ScrollArea className="h-60 pr-3">
                      <div className="space-y-2">
                        {banks.skipped.slice(0, 200).map((s, i) => (
                          <div key={i} className="rounded-md border bg-muted/30 p-2 text-xs space-y-1">
                            <div className="flex flex-wrap gap-1">
                              {s.subject && <Badge variant="secondary">{s.subject}</Badge>}
                              {s.chapter && <Badge variant="outline">{s.chapter}</Badge>}
                              {s.topic && <Badge variant="outline">{s.topic}</Badge>}
                            </div>
                            {s.question && <p className="font-medium">{s.question}</p>}
                            {s.reason && <p className="text-muted-foreground">⏭ {s.reason}</p>}
                            {s.recommendation && <p className="text-primary">👉 {s.recommendation}</p>}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    Learning Repository <Badge variant="outline">{banks.learning.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {banks.learning.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No formulas / tricks captured yet.</p>
                  ) : (
                    <ScrollArea className="h-60 pr-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {banks.learning.slice(0, 200).map((l, i) => (
                          <div key={i} className="rounded-md border bg-muted/30 p-2 text-xs space-y-1">
                            <div className="flex flex-wrap gap-1">
                              {l.kind && <Badge variant="secondary" className="text-[10px]">{l.kind}</Badge>}
                              {l.subject && <Badge variant="outline" className="text-[10px]">{l.subject}</Badge>}
                              {l.topic && <Badge variant="outline" className="text-[10px]">{l.topic}</Badge>}
                            </div>
                            {l.title && <p className="font-semibold">{l.title}</p>}
                            {l.content && <p className="text-muted-foreground whitespace-pre-wrap">{l.content}</p>}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {banks.extra.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">🗒 Additional Insights</CardTitle></CardHeader>
                  <CardContent><Chips items={banks.extra} /></CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* COMPARE */}
        <TabsContent value="compare" className="space-y-4">
          {reports.length < 2 ? (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Import at least 2 reports to compare.</CardContent></Card>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  { label: "Accuracy", delta: trend.accuracyDelta, suffix: "%" },
                  { label: "Score", delta: trend.scoreDelta, suffix: "" },
                  { label: "Attempt", delta: trend.attemptDelta, suffix: "%" },
                  { label: "Negative", delta: trend.negativeDelta, suffix: "", inverse: true },
                  { label: "Percentile", delta: trend.percentileDelta, suffix: "" },
                ].map((m) => {
                  const good = m.delta == null ? null : m.inverse ? m.delta < 0 : m.delta > 0;
                  return (
                    <Card key={m.label}>
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">{m.label} Trend</p>
                        <div className="mt-1 flex items-center gap-1">
                          {m.delta == null ? (
                            <span className="text-sm text-muted-foreground">Insufficient Data</span>
                          ) : (
                            <>
                              {good ? <TrendingUp className="h-4 w-4 text-success" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
                              <span className={`text-lg font-bold ${good ? "text-success" : "text-destructive"}`}>
                                {m.delta > 0 ? "+" : ""}{m.delta.toFixed(1)}{m.suffix}
                              </span>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <Card>
                <CardHeader><CardTitle className="text-base">Subject Direction</CardTitle></CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <Section title="✅ Improving Subjects" items={comparison?.improving ?? []} />
                  <Section title="⚠️ Declining Subjects" items={comparison?.declining ?? []} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Repeated Patterns</CardTitle></CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-3">
                  <Section title="Weak Chapters" items={comparison?.repeatedWeakChapters ?? []} />
                  <Section title="Weak Topics" items={comparison?.repeatedWeakTopics ?? []} />
                  <Section title="Repeated Mistakes" items={comparison?.repeatedMistakes ?? []} />
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Mock {viewing?.report_number} — {viewing?.mock_name ?? "Untitled"}
              {viewing?.source_ai && <Badge variant="outline" className="text-[10px]">{viewing.source_ai}</Badge>}
            </DialogTitle>
          </DialogHeader>
          {viewing && (
            <ScrollArea className="max-h-[70vh] pr-2">
              <div className="space-y-4 pb-2">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ["Score", viewing.score],
                    ["Accuracy", viewing.accuracy != null ? `${viewing.accuracy}%` : null],
                    ["Attempt", viewing.attempt_percent != null ? `${viewing.attempt_percent}%` : null],
                    ["Negative", viewing.negative_marks],
                    ["Percentile", viewing.percentile],
                    ["Rank", viewing.overall_rank],
                    ["Time", viewing.time_used],
                    ["Readiness", viewing.exam_readiness],
                  ].map(([l, v]) => (
                    <div key={String(l)} className="rounded-md bg-muted/50 p-2 text-center">
                      <p className="text-[10px] uppercase text-muted-foreground">{l}</p>
                      <p className="text-sm font-semibold">{v == null || v === "" ? "—" : String(v)}</p>
                    </div>
                  ))}
                </div>
                {viewing.verdict && (
                  <div><h4 className="text-xs font-semibold uppercase text-muted-foreground">Verdict</h4>
                    <p className="text-sm">{viewing.verdict}</p></div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Section title="Strong Subjects" items={viewing.extracted?.strong_subjects ?? []} />
                  <Section title="Weak Subjects" items={viewing.extracted?.weak_subjects ?? []} />
                  <Section title="Weak Chapters" items={viewing.extracted?.weak_chapters ?? []} />
                  <Section title="Weak Topics" items={viewing.extracted?.weak_topics ?? []} />
                  <Section title="Critical Topics" items={viewing.extracted?.critical_topics ?? []} />
                  <Section title="Revision Priority" items={viewing.extracted?.revision_priority ?? []} />
                  <Section title="3-Day Action Plan" items={viewing.extracted?.action_plan_3day ?? []} />
                  <Section title="Next Mock Strategy" items={viewing.extracted?.next_mock_strategy ?? []} />
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
