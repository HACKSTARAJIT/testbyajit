import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles, Brain, Clock, Target, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle2, XCircle, MinusCircle, RefreshCw, ArrowLeft, BookOpen, ClipboardList,
  Lightbulb, CalendarClock, Fingerprint, Trophy, Zap, Timer,
} from "lucide-react";
import { toast } from "sonner";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LineChart, Line, CartesianGrid } from "recharts";

const CAT_LABELS: Record<string, string> = {
  knowledge_gap: "Knowledge Gap",
  concept_confusion: "Concept Confusion",
  memory_failure: "Memory Failure",
  calculation_error: "Calculation Error",
  reading_mistake: "Reading Mistake",
  option_confusion: "Option Confusion",
  guessing: "Guessing",
  careless_mistake: "Careless Mistake",
  time_pressure: "Time Pressure",
  overthinking: "Overthinking",
  silly_mistake: "Silly Mistake",
  question_misinterpretation: "Question Misinterpretation",
  weak_revision: "Weak Revision",
  weak_concept: "Weak Concept",
  low_accuracy_under_pressure: "Low Accuracy Under Pressure",
};

const CAT_COLOR = (i: number) => [
  "hsl(var(--primary))", "hsl(var(--secondary))", "#f97316", "#8b5cf6",
  "#06b6d4", "#eab308", "#ef4444", "#10b981", "#ec4899", "#6366f1",
  "#14b8a6", "#f59e0b", "#a855f7", "#3b82f6", "#84cc16",
][i % 15];

const label = (k: string) => CAT_LABELS[k] ?? k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function TestMistakeAnalysis() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [analysis, setAnalysis] = useState<any | null>(null);
  const [dna, setDna] = useState<any | null>(null);
  const [attempt, setAttempt] = useState<any | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async (force = false) => {
    if (!user || !attemptId) return;
    setError(null);
    if (!force) setLoading(true);

    const [{ data: a }, { data: qs }, { data: existing }, { data: dnaRow }] = await Promise.all([
      supabase.from("test_attempts").select("*, tests(title, subject_id, subjects(name))").eq("id", attemptId).maybeSingle(),
      supabase.from("questions").select("id,question_text,correct_option,option_a,option_b,option_c,option_d,marks,explanation,sort_order")
        .in("test_id", [attemptId ? "" : ""]), // placeholder — filled below via attempt.test_id
      supabase.from("test_mistake_analyses").select("*").eq("attempt_id", attemptId).maybeSingle(),
      supabase.from("mistake_dna").select("*").eq("user_id", user.id).maybeSingle(),
    ]);
    setAttempt(a);
    setDna(dnaRow);
    if (a?.test_id) {
      const { data: qq } = await supabase.from("questions").select("id,question_text,correct_option,option_a,option_b,option_c,option_d,marks,explanation,sort_order")
        .eq("test_id", a.test_id).order("sort_order");
      setQuestions(qq ?? []);
    }
    setAnalysis(existing ?? null);
    setLoading(false);

    if (!existing && a?.status === "completed") {
      await generate(false);
    }
  };

  const generate = async (refresh: boolean) => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-test-mistakes", { body: { attemptId, refresh } });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      setAnalysis((data as any).analysis);
      toast.success(refresh ? "AI analysis refreshed" : "AI analysis ready");
      // reload DNA
      const { data: dnaRow } = await supabase.from("mistake_dna").select("*").eq("user_id", user!.id).maybeSingle();
      setDna(dnaRow);
    } catch (e: any) {
      setError(e.message ?? "Failed to analyze");
      toast.error(e.message ?? "Failed to analyze");
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id, attemptId]);

  const qMap = useMemo(() => Object.fromEntries(questions.map((q) => [q.id, q])), [questions]);
  const answers: Record<string, string> = (attempt?.answers as any) ?? {};
  const dist: Record<string, number> = analysis?.mistake_distribution ?? {};
  const distEntries = useMemo(() =>
    Object.entries(dist).sort((a, b) => Number(b[1]) - Number(a[1])).map(([k, v]) => ({ key: k, label: label(k), pct: Math.round(Number(v)) })),
    [dist],
  );
  const dnaEntries = useMemo(() => {
    const d = (dna?.distribution ?? {}) as Record<string, number>;
    return Object.entries(d).sort((a, b) => Number(b[1]) - Number(a[1])).map(([k, v]) => ({ key: k, label: label(k), pct: Math.round(Number(v)) }));
  }, [dna]);

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /><Skeleton className="h-96 rounded-2xl" /></div>;
  }

  if (!attempt) {
    return (
      <div className="space-y-4">
        <Link to="/analysis" className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><ArrowLeft className="h-3 w-3" /> Back to Test Analysis</Link>
        <Card><CardContent className="py-10 text-center text-muted-foreground">Test attempt not found.</CardContent></Card>
      </div>
    );
  }

  const analysing = generating || (!analysis && attempt.status === "completed");

  return (
    <div className="space-y-5 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/analysis" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-3 w-3" /> Test Analysis
        </Link>
        <Button size="sm" variant="outline" onClick={() => generate(true)} disabled={generating} aria-label="Refresh AI analysis">
          <RefreshCw className={`mr-1 h-3 w-3 ${generating ? "animate-spin" : ""}`} />
          {generating ? "Analysing…" : "Refresh AI"}
        </Button>
      </div>

      {/* Header */}
      <Card className="overflow-hidden border-primary/20 bg-gradient-hero text-primary-foreground">
        <CardContent className="space-y-2 p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-80">
            <Sparkles className="h-3 w-3" /> AJIT AI Mistake Intelligence
          </div>
          <h1 className="text-xl font-bold">{attempt.tests?.title ?? "Test"} <span className="font-normal opacity-80">· {attempt.tests?.subjects?.name ?? ""}</span></h1>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat icon={Target} label="Score" value={`${attempt.marks_obtained}`} />
            <MiniStat icon={TrendingUp} label="Accuracy" value={`${attempt.accuracy}%`} />
            <MiniStat icon={CheckCircle2} label="Correct" value={attempt.correct_count} />
            <MiniStat icon={XCircle} label="Wrong" value={attempt.incorrect_count} />
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
      )}

      {analysing && (
        <Card className="border-primary/30"><CardContent className="flex items-center gap-3 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
            <Sparkles className="h-5 w-5 animate-pulse text-primary" />
          </div>
          <div><p className="font-semibold">AJIT AI is analysing your mistakes…</p>
            <p className="text-xs text-muted-foreground">Identifying root causes for every wrong answer. This takes ~10s.</p></div>
        </CardContent></Card>
      )}

      {analysis && (
        <>
          {/* Coach summary */}
          {analysis.coach_summary && (
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5">
              <CardContent className="flex gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">AJIT AI Coach</p>
                  {analysis.overall?.headline && <p className="font-semibold">{analysis.overall.headline}</p>}
                  <p className="text-sm leading-relaxed text-foreground/90">{analysis.coach_summary}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="mistakes">Mistakes</TabsTrigger>
              <TabsTrigger value="questions">Per-Q</TabsTrigger>
              <TabsTrigger value="plan">Action</TabsTrigger>
              <TabsTrigger value="dna">DNA</TabsTrigger>
            </TabsList>

            {/* OVERVIEW */}
            <TabsContent value="overview" className="space-y-4">
              <StrengthWeakness overall={analysis.overall ?? {}} />
              <TimeAndThinking time={analysis.time_analysis ?? {}} thinking={analysis.thinking_profile ?? {}} attempt={attempt} />
              <MemorySection memory={analysis.memory_analysis ?? {}} />
              <ExpectedImprovements items={analysis.improvements ?? []} />
            </TabsContent>

            {/* MISTAKES */}
            <TabsContent value="mistakes" className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Brain className="h-4 w-4 text-primary" /> Mistake Distribution (this test)</CardTitle></CardHeader>
                <CardContent>
                  {distEntries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No mistakes to analyse — solid attempt!</p>
                  ) : (
                    <>
                      <div className="h-56 w-full">
                        <ResponsiveContainer>
                          <BarChart data={distEntries.slice(0, 8)} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis dataKey="label" type="category" tick={{ fontSize: 10 }} width={110} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12 }} />
                            <Bar dataKey="pct" radius={[0, 6, 6, 0]}>
                              {distEntries.slice(0, 8).map((_, i) => <Cell key={i} fill={CAT_COLOR(i)} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                        {distEntries.map((e, i) => (
                          <div key={e.key} className="flex items-center gap-2 text-xs">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CAT_COLOR(i) }} />
                            <span className="flex-1 truncate">{e.label}</span>
                            <span className="font-semibold tabular-nums">{e.pct}%</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <MistakeSpotlight overall={analysis.overall ?? {}} />
              <DifficultyBreakdown analyses={analysis.question_analyses ?? []} />
            </TabsContent>

            {/* PER-QUESTION */}
            <TabsContent value="questions" className="space-y-3">
              {(analysis.question_analyses ?? []).length === 0 ? (
                <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No wrong questions to break down 🎯</CardContent></Card>
              ) : (
                (analysis.question_analyses ?? []).map((qa: any) => (
                  <QuestionCard key={qa.question_id} qa={qa} q={qMap[qa.question_id]} selected={answers[qa.question_id]} />
                ))
              )}
            </TabsContent>

            {/* ACTION PLAN */}
            <TabsContent value="plan" className="space-y-4">
              <ActionPlan plan={analysis.action_plan ?? {}} />
              <RelatedLearning items={analysis.related_learning ?? []} />
            </TabsContent>

            {/* DNA */}
            <TabsContent value="dna" className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Fingerprint className="h-4 w-4 text-primary" /> Your Mistake DNA</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {dnaEntries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">DNA builds up after a few analysed tests.</p>
                  ) : dnaEntries.map((e, i) => (
                    <div key={e.key} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>{e.label}</span>
                        <span className="font-semibold tabular-nums">{e.pct}%</span>
                      </div>
                      <Progress value={e.pct} className="h-2" style={{ ["--progress-color" as any]: CAT_COLOR(i) }} />
                    </div>
                  ))}
                  <p className="pt-2 text-[11px] text-muted-foreground">Rolling average across your last analysed tests. Updates after every attempt.</p>
                </CardContent>
              </Card>
              <DnaTimeline dna={dna} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

// ---------- Sub-components ----------

function MiniStat({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 p-2.5 backdrop-blur-md">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-80"><Icon className="h-3 w-3" />{label}</div>
      <div className="text-lg font-bold leading-none">{value}</div>
    </div>
  );
}

function StrengthWeakness({ overall }: { overall: any }) {
  const chip = (name: string, tone: "good" | "bad") => (
    <Badge key={name} variant="outline" className={tone === "good" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700" : "border-rose-500/40 bg-rose-500/10 text-rose-700"}>
      {name}
    </Badge>
  );
  const Block = ({ title, strong, weak, icon: Icon }: any) => (
    <div className="rounded-xl border p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Icon className="h-3 w-3" />{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {(strong ?? []).map((s: string) => chip(`✓ ${s}`, "good"))}
        {(weak ?? []).map((s: string) => chip(`✗ ${s}`, "bad"))}
        {(strong ?? []).length + (weak ?? []).length === 0 && <span className="text-xs text-muted-foreground">—</span>}
      </div>
    </div>
  );
  return (
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Trophy className="h-4 w-4 text-primary" /> Strengths & Weaknesses</CardTitle></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        <Block title="Subjects" strong={overall.strong_subjects} weak={overall.weak_subjects} icon={BookOpen} />
        <Block title="Chapters" strong={overall.strong_chapters} weak={overall.weak_chapters} icon={ClipboardList} />
        <Block title="Topics" strong={overall.strong_topics} weak={overall.weak_topics} icon={Target} />
      </CardContent>
    </Card>
  );
}

function TimeAndThinking({ time, thinking, attempt }: { time: any; thinking: any; attempt: any }) {
  const total = attempt.time_taken_seconds ?? 0;
  const mm = Math.floor(total / 60), ss = total % 60;
  return (
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4 text-primary" /> Time & Thinking</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <TimeStat label="Total time" value={`${mm}m ${ss}s`} icon={Timer} />
          <TimeStat label="Too fast" value={time.too_fast_count ?? 0} icon={Zap} />
          <TimeStat label="Too slow" value={time.too_slow_count ?? 0} icon={Clock} />
          <TimeStat label="Skipped" value={time.skipped_count ?? attempt.unattempted_count ?? 0} icon={MinusCircle} />
        </div>
        {time.summary && <p className="rounded-lg bg-muted/40 p-3 text-sm">{time.summary}</p>}
        {thinking.style && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Thinking style: {thinking.style}</p>
            {thinking.summary && <p className="mt-1 text-sm">{thinking.summary}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(thinking.traits ?? []).map((t: string) => <Badge key={t} variant="secondary">{t}</Badge>)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TimeStat({ icon: Icon, label, value }: any) {
  return (
    <div className="rounded-lg border bg-card p-2.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground"><Icon className="h-3 w-3" />{label}</div>
      <div className="mt-0.5 text-base font-bold tabular-nums">{value}</div>
    </div>
  );
}

function MemorySection({ memory }: { memory: any }) {
  const bars = [
    { label: "Memory strength", value: memory.memory_strength ?? 0 },
    { label: "Revision quality", value: memory.revision_quality ?? 0 },
    { label: "Retention", value: memory.retention ?? 0 },
  ];
  return (
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Brain className="h-4 w-4 text-primary" /> Memory Analysis</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {bars.map(b => (
          <div key={b.label} className="space-y-1">
            <div className="flex justify-between text-xs"><span>{b.label}</span><span className="font-semibold tabular-nums">{Math.round(Number(b.value))}%</span></div>
            <Progress value={Number(b.value)} className="h-1.5" />
          </div>
        ))}
        {(memory.forgotten_concepts ?? []).length > 0 && (
          <div><p className="text-xs font-semibold text-muted-foreground">Forgotten concepts</p>
            <div className="mt-1 flex flex-wrap gap-1.5">{memory.forgotten_concepts.map((c: string) => <Badge key={c} variant="outline">{c}</Badge>)}</div></div>
        )}
        {(memory.revision_due ?? []).length > 0 && (
          <div><p className="text-xs font-semibold text-muted-foreground">Revision due</p>
            <div className="mt-1 flex flex-wrap gap-1.5">{memory.revision_due.map((c: string) => <Badge key={c} className="bg-orange-500/15 text-orange-700">{c}</Badge>)}</div></div>
        )}
      </CardContent>
    </Card>
  );
}

function ExpectedImprovements({ items }: { items: any[] }) {
  if (!items?.length) return null;
  const total = items.reduce((s, i) => s + (Number(i.expected_marks) || 0), 0);
  return (
    <Card className="border-emerald-500/30 bg-emerald-500/5">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4 text-emerald-600" /> Expected Mark Improvements (+{total})</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg border bg-card p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 font-bold text-emerald-700">+{it.expected_marks}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{it.action}</p>
              {it.why && <p className="text-xs text-muted-foreground">{it.why}</p>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function MistakeSpotlight({ overall }: { overall: any }) {
  const items = [
    { label: "Most repeated", value: overall.most_repeated_mistake, icon: RefreshCw },
    { label: "Most expensive", value: overall.most_expensive_mistake, icon: AlertTriangle },
    { label: "Common weakness", value: overall.most_common_weakness, icon: TrendingDown },
  ].filter(i => i.value);
  if (!items.length) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {items.map((it) => (
        <Card key={it.label}><CardContent className="space-y-1 p-3">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground"><it.icon className="h-3 w-3" />{it.label}</p>
          <p className="text-sm font-semibold">{it.value}</p>
        </CardContent></Card>
      ))}
    </div>
  );
}

function DifficultyBreakdown({ analyses }: { analyses: any[] }) {
  const buckets: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
  analyses.forEach((a) => { const d = (a.difficulty ?? "medium").toLowerCase(); if (d in buckets) buckets[d]++; });
  const easyWrong = buckets.easy;
  return (
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-primary" /> Difficulty of Mistakes</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-emerald-500/10 p-3"><p className="text-2xl font-bold text-emerald-700">{buckets.easy}</p><p className="text-[10px]">Easy wrong</p></div>
          <div className="rounded-xl bg-amber-500/10 p-3"><p className="text-2xl font-bold text-amber-700">{buckets.medium}</p><p className="text-[10px]">Medium wrong</p></div>
          <div className="rounded-xl bg-rose-500/10 p-3"><p className="text-2xl font-bold text-rose-700">{buckets.hard}</p><p className="text-[10px]">Hard wrong</p></div>
        </div>
        {easyWrong > 0 && (
          <Alert className="border-orange-500/40 bg-orange-500/5">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-xs">
              {easyWrong} easy question{easyWrong > 1 ? "s were" : " was"} wrong — likely careless or reading mistakes. Recovering these is your fastest score jump.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function QuestionCard({ qa, q, selected }: { qa: any; q: any; selected?: string }) {
  const diffCls = qa.difficulty === "hard" ? "bg-rose-500/15 text-rose-700"
    : qa.difficulty === "easy" ? "bg-emerald-500/15 text-emerald-700"
      : "bg-amber-500/15 text-amber-700";
  return (
    <Card className="border-l-4 border-l-primary/60">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">Q{qa.index ?? "?"}</Badge>
          <Badge className={diffCls}>{qa.difficulty ?? "medium"}</Badge>
          {qa.topic && <Badge variant="secondary">{qa.topic}</Badge>}
          {qa.chapter && <Badge variant="secondary">{qa.chapter}</Badge>}
          {typeof qa.confidence === "number" && <Badge variant="outline">AI confidence {Math.round(qa.confidence * (qa.confidence <= 1 ? 100 : 1))}%</Badge>}
        </div>
        {q?.question_text && <p className="text-sm leading-relaxed">{q.question_text}</p>}
        {q && (
          <div className="grid gap-1 sm:grid-cols-2">
            {(["A", "B", "C", "D"] as const).map((k) => {
              const val = q[`option_${k.toLowerCase()}`];
              const isCorrect = q.correct_option === k;
              const isSelected = selected === k;
              return (
                <div key={k} className={`flex items-start gap-2 rounded-lg border p-2 text-xs ${
                  isCorrect ? "border-emerald-500/50 bg-emerald-500/10"
                    : isSelected ? "border-rose-500/50 bg-rose-500/10"
                      : "border-border"
                }`}>
                  <span className="font-bold">{k}.</span><span className="flex-1">{val}</span>
                  {isCorrect && <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600" />}
                  {isSelected && !isCorrect && <XCircle className="h-3 w-3 shrink-0 text-rose-600" />}
                </div>
              );
            })}
          </div>
        )}
        {(qa.root_causes ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {qa.root_causes.map((c: string) => <Badge key={c} className="bg-primary/10 text-primary">{label(c)}</Badge>)}
          </div>
        )}
        {qa.why_wrong && (
          <div className="rounded-lg bg-muted/50 p-2.5"><p className="text-xs font-semibold uppercase text-muted-foreground">Why you got it wrong</p><p className="mt-1 text-sm">{qa.why_wrong}</p></div>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          {qa.suggested_improvement && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5"><p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-primary"><Lightbulb className="h-3 w-3" />Fix</p><p className="mt-1 text-xs">{qa.suggested_improvement}</p></div>
          )}
          {qa.suggested_revision && (
            <div className="rounded-lg border border-secondary/30 bg-secondary/5 p-2.5"><p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-secondary-foreground"><RefreshCw className="h-3 w-3" />Revise</p><p className="mt-1 text-xs">{qa.suggested_revision}</p></div>
          )}
        </div>
        {q?.explanation && (
          <details className="rounded-lg border bg-muted/30 p-2 text-xs">
            <summary className="cursor-pointer font-semibold">Official explanation</summary>
            <p className="mt-1 whitespace-pre-wrap">{q.explanation}</p>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function ActionPlan({ plan }: { plan: any }) {
  const cols = [
    { key: "today", label: "Today", icon: Zap, tone: "bg-primary/10 text-primary" },
    { key: "tomorrow", label: "Tomorrow", icon: Clock, tone: "bg-secondary/20 text-secondary-foreground" },
    { key: "this_week", label: "This Week", icon: CalendarClock, tone: "bg-emerald-500/10 text-emerald-700" },
    { key: "this_month", label: "This Month", icon: Trophy, tone: "bg-amber-500/10 text-amber-700" },
  ];
  return (
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4 text-primary" /> Personalised Action Plan</CardTitle></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {cols.map(c => {
          const items: string[] = plan[c.key] ?? [];
          return (
            <div key={c.key} className="rounded-xl border p-3">
              <p className={`mb-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${c.tone}`}>
                <c.icon className="h-3 w-3" />{c.label}
              </p>
              {items.length === 0 ? <p className="text-xs text-muted-foreground">—</p> : (
                <ul className="space-y-1.5">
                  {items.map((it, i) => <li key={i} className="flex gap-2 text-sm"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{it}</li>)}
                </ul>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function RelatedLearning({ items }: { items: any[] }) {
  if (!items?.length) return null;
  return (
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4 text-primary" /> Related Learning</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {items.slice(0, 10).map((it, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border p-2.5 text-sm">
            {it.question_index && <Badge variant="outline">Q{it.question_index}</Badge>}
            <div className="min-w-0 flex-1">
              {it.chapter && <p className="truncate font-medium">{it.chapter}</p>}
              {it.topic && <p className="truncate text-xs text-muted-foreground">{it.topic}</p>}
            </div>
            <div className="flex gap-1">
              {it.test_id && <Link to={`/test/${it.test_id}`}><Button size="sm" variant="outline"><ClipboardList className="mr-1 h-3 w-3" />Test</Button></Link>}
              {it.pdf_id && <Link to="/subjects"><Button size="sm" variant="outline"><BookOpen className="mr-1 h-3 w-3" />PDF</Button></Link>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function DnaTimeline({ dna }: { dna: any }) {
  const tl = (dna?.timeline ?? []) as any[];
  if (tl.length < 2) return null;
  const data = tl.map((t: any, i: number) => ({
    n: i + 1,
    accuracy: Number(t.accuracy) || 0,
    knowledge_gap: Number(t.dist?.knowledge_gap) || 0,
    careless_mistake: Number(t.dist?.careless_mistake) || 0,
    reading_mistake: Number(t.dist?.reading_mistake) || 0,
    time_pressure: Number(t.dist?.time_pressure) || 0,
  }));
  return (
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4 text-primary" /> Performance Timeline</CardTitle></CardHeader>
      <CardContent>
        <div className="h-56 w-full">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="n" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12 }} />
              <Line type="monotone" dataKey="accuracy" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="knowledge_gap" stroke="#8b5cf6" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="careless_mistake" stroke="#f97316" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="reading_mistake" stroke="#06b6d4" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="time_pressure" stroke="#ef4444" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
