import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, AlertTriangle, RefreshCw, CheckCircle2, ClipboardList, BookOpen, Clock, Brain, Target, TrendingUp } from "lucide-react";
import { toast } from "sonner";

const DIFFICULTIES = ["very_easy", "easy", "medium", "hard", "very_hard"];
const BLOOM = ["remember", "understand", "apply", "analyze", "evaluate", "create"];
const IMPORTANCE = ["very_high", "high", "medium", "low", "rare"];
const EXAM_LEVELS = ["SSC MTS", "SSC CHSL", "SSC CGL", "SSC CPO", "Railway", "Banking", "State PCS", "General Competitive Exams"];

const nice = (s?: string | null) =>
  !s ? "—" : s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const diffTone = (d?: string | null) => {
  switch (d) {
    case "very_easy": return "bg-emerald-500/15 text-emerald-700";
    case "easy": return "bg-emerald-500/10 text-emerald-700";
    case "medium": return "bg-amber-500/15 text-amber-700";
    case "hard": return "bg-orange-500/15 text-orange-700";
    case "very_hard": return "bg-rose-500/15 text-rose-700";
    default: return "bg-muted text-muted-foreground";
  }
};

export function TestAIReviewDialog({ test }: { test: any }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [testRow, setTestRow] = useState<any>(test);
  const [questions, setQuestions] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    const [{ data: t }, { data: qs }] = await Promise.all([
      supabase.from("tests").select("*").eq("id", test.id).maybeSingle(),
      supabase.from("questions").select("*").eq("test_id", test.id).order("sort_order"),
    ]);
    setTestRow(t ?? test);
    setQuestions(qs ?? []);
    setLoading(false);
  };

  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [open]);

  const runAnalysis = async (force: boolean) => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-test-questions", { body: { testId: test.id, force } });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`AJIT AI analysed ${(data as any)?.analyzed ?? 0} question(s)`);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "AI analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const saveQuestion = async (id: string, patch: Record<string, any>) => {
    const { error } = await supabase.from("questions")
      .update({ ...patch, admin_reviewed: true })
      .eq("id", id);
    if (error) return toast.error(error.message);
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch, admin_reviewed: true } : q)));
    toast.success("Saved");
  };

  const summary = testRow?.ai_analysis_summary ?? null;
  const analyzedCount = questions.filter((q) => q.ai_analyzed_at).length;
  const flaggedCount = questions.filter((q) => Array.isArray(q.ai_issues) && q.ai_issues.length > 0).length;
  const reviewedCount = questions.filter((q) => q.admin_reviewed).length;
  const status = testRow?.ai_analysis_status ?? "pending";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="AI review panel" title="AI Review">
          <Sparkles className="h-4 w-4 text-primary" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Question Analysis — {test.title}
            <StatusBadge status={status} />
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => runAnalysis(false)} disabled={analyzing}>
            {analyzing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
            {analyzedCount === 0 ? "Run AI Analysis" : "Analyse remaining"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => runAnalysis(true)} disabled={analyzing}>
            <RefreshCw className={`mr-1 h-3 w-3 ${analyzing ? "animate-spin" : ""}`} /> Re-analyse all
          </Button>
          <div className="ml-auto flex flex-wrap gap-1.5 text-xs text-muted-foreground">
            <Badge variant="outline">{analyzedCount}/{questions.length} analysed</Badge>
            {flaggedCount > 0 && <Badge className="bg-rose-500/15 text-rose-700">{flaggedCount} flagged</Badge>}
            <Badge variant="outline">{reviewedCount} admin-reviewed</Badge>
          </div>
        </div>

        {summary && <TestSummary summary={summary} />}

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : questions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No questions in this test.</p>
        ) : (
          <div className="space-y-3">
            {questions.map((q, i) => (
              <QuestionAIRow key={q.id} q={q} index={i} onSave={saveQuestion} />
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: any }> = {
    pending: { label: "Pending", cls: "bg-muted text-muted-foreground", icon: Clock },
    analyzing: { label: "Analysing…", cls: "bg-primary/15 text-primary", icon: Loader2 },
    ready: { label: "Ready", cls: "bg-emerald-500/15 text-emerald-700", icon: CheckCircle2 },
    failed: { label: "Failed", cls: "bg-rose-500/15 text-rose-700", icon: AlertTriangle },
  };
  const s = map[status] ?? map.pending;
  const Icon = s.icon;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.cls}`}>
    <Icon className={`h-3 w-3 ${status === "analyzing" ? "animate-spin" : ""}`} />{s.label}
  </span>;
}

function TestSummary({ summary }: { summary: any }) {
  const items = [
    { icon: Target, label: "Avg quality", value: summary.avg_quality_score != null ? `${summary.avg_quality_score}/100` : "—" },
    { icon: Brain, label: "Avg complexity", value: summary.avg_complexity_score != null ? `${summary.avg_complexity_score}/100` : "—" },
    { icon: Clock, label: "Total time", value: summary.expected_total_time_seconds ? `${Math.round(summary.expected_total_time_seconds / 60)}m` : "—" },
    { icon: AlertTriangle, label: "Flagged", value: summary.flagged_questions ?? 0 },
  ];
  const dist = summary.difficulty ?? {};
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map((it) => (
          <div key={it.label} className="rounded-lg border bg-card p-2">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              <it.icon className="h-3 w-3" />{it.label}
            </div>
            <div className="text-sm font-bold tabular-nums">{it.value}</div>
          </div>
        ))}
      </div>
      {Object.keys(dist).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {DIFFICULTIES.filter((d) => dist[d]).map((d) => (
            <Badge key={d} className={diffTone(d)}>{nice(d)}: {dist[d]}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionAIRow({ q, index, onSave }: { q: any; index: number; onSave: (id: string, patch: any) => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    difficulty: q.difficulty ?? "",
    bloom_level: q.bloom_level ?? "",
    exam_level: q.exam_level ?? "",
    importance: q.importance ?? "",
    topic: q.topic ?? "",
    subtopic: q.subtopic ?? "",
    concept: q.concept ?? "",
    expected_time_seconds: q.expected_time_seconds ?? "",
    quality_score: q.quality_score ?? "",
    complexity_score: q.complexity_score ?? "",
  });
  const issues = (q.ai_issues ?? []) as any[];
  const analyzed = !!q.ai_analyzed_at;
  const analysis = q.ai_analysis ?? {};

  const save = async () => {
    const patch: any = { ...form };
    patch.expected_time_seconds = form.expected_time_seconds ? Number(form.expected_time_seconds) : null;
    patch.quality_score = form.quality_score !== "" ? Number(form.quality_score) : null;
    patch.complexity_score = form.complexity_score !== "" ? Number(form.complexity_score) : null;
    ["difficulty", "bloom_level", "exam_level", "importance", "topic", "subtopic", "concept"].forEach((k) => {
      if (patch[k] === "") patch[k] = null;
    });
    await onSave(q.id, patch);
    setEditing(false);
  };

  return (
    <div className={`rounded-xl border p-3 ${issues.length > 0 ? "border-rose-500/40 bg-rose-500/5" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">Q{index + 1} · Correct: {q.correct_option}</p>
          <p className="mt-0.5 line-clamp-2 text-sm">{q.question_text}</p>
        </div>
        <div className="shrink-0 space-x-1">
          {q.admin_reviewed && <Badge variant="outline" className="border-emerald-500/40 text-emerald-700">Reviewed</Badge>}
          {!analyzed && <Badge variant="outline">Not analysed</Badge>}
        </div>
      </div>

      {analyzed && !editing && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
          <Badge className={diffTone(q.difficulty)}>{nice(q.difficulty)}</Badge>
          {q.bloom_level && <Badge variant="secondary"><Brain className="mr-1 h-3 w-3" />{nice(q.bloom_level)}</Badge>}
          {q.exam_level && <Badge variant="outline"><ClipboardList className="mr-1 h-3 w-3" />{q.exam_level}</Badge>}
          {q.importance && <Badge variant="outline"><TrendingUp className="mr-1 h-3 w-3" />{nice(q.importance)}</Badge>}
          {q.topic && <Badge variant="outline"><BookOpen className="mr-1 h-3 w-3" />{q.topic}</Badge>}
          {q.expected_time_seconds != null && <Badge variant="outline"><Clock className="mr-1 h-3 w-3" />{q.expected_time_seconds}s</Badge>}
          {q.quality_score != null && <Badge variant="outline">Quality {q.quality_score}</Badge>}
          {q.complexity_score != null && <Badge variant="outline">Complexity {q.complexity_score}</Badge>}
          {q.ai_confidence != null && <Badge variant="outline">Conf {q.ai_confidence}%</Badge>}
        </div>
      )}

      {analyzed && !editing && (analysis.importance_reason || analysis.bloom_reason || analysis.concept) && (
        <details className="mt-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer">More AI insights</summary>
          <div className="mt-1 space-y-1">
            {analysis.concept && <p><b>Concept:</b> {analysis.concept}</p>}
            {analysis.bloom_reason && <p><b>Bloom reason:</b> {analysis.bloom_reason}</p>}
            {analysis.importance_reason && <p><b>Importance:</b> {analysis.importance_reason}</p>}
            {analysis.required_skill && <p><b>Skill:</b> {analysis.required_skill}</p>}
            {analysis.related_formula && <p><b>Formula:</b> {analysis.related_formula}</p>}
            {Array.isArray(analysis.complexity_factors) && analysis.complexity_factors.length > 0 && (
              <p><b>Complexity factors:</b> {analysis.complexity_factors.join(", ")}</p>
            )}
          </div>
        </details>
      )}

      {issues.length > 0 && !editing && (
        <div className="mt-2 space-y-1">
          {issues.map((it: any, i: number) => (
            <div key={i} className="flex items-start gap-1.5 text-[11px] text-rose-700">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span><b>{nice(it.type)}</b>{it.severity ? ` · ${it.severity}` : ""}{it.note ? ` — ${it.note}` : ""}</span>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <SelectField label="Difficulty" value={form.difficulty} onChange={(v) => setForm({ ...form, difficulty: v })} options={DIFFICULTIES} />
          <SelectField label="Bloom level" value={form.bloom_level} onChange={(v) => setForm({ ...form, bloom_level: v })} options={BLOOM} />
          <SelectField label="Exam level" value={form.exam_level} onChange={(v) => setForm({ ...form, exam_level: v })} options={EXAM_LEVELS} rawLabel />
          <SelectField label="Importance" value={form.importance} onChange={(v) => setForm({ ...form, importance: v })} options={IMPORTANCE} />
          <TextField label="Topic" value={form.topic} onChange={(v) => setForm({ ...form, topic: v })} />
          <TextField label="Subtopic" value={form.subtopic} onChange={(v) => setForm({ ...form, subtopic: v })} />
          <TextField label="Concept" value={form.concept} onChange={(v) => setForm({ ...form, concept: v })} />
          <NumberField label="Expected time (s)" value={form.expected_time_seconds} onChange={(v) => setForm({ ...form, expected_time_seconds: v })} />
          <NumberField label="Quality (0-100)" value={form.quality_score} onChange={(v) => setForm({ ...form, quality_score: v })} />
          <NumberField label="Complexity (0-100)" value={form.complexity_score} onChange={(v) => setForm({ ...form, complexity_score: v })} />
        </div>
      )}

      <div className="mt-2 flex justify-end gap-1">
        {!editing ? (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Override</Button>
        ) : (
          <>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" onClick={save}>Save</Button>
          </>
        )}
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, options, rawLabel }: { label: string; value: string; onChange: (v: string) => void; options: string[]; rawLabel?: boolean }) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{rawLabel ? o : nice(o)}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
function TextField({ label, value, onChange }: any) {
  return (
    <div><Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Input className="h-8 text-xs" value={value} onChange={(e) => onChange(e.target.value)} /></div>
  );
}
function NumberField({ label, value, onChange }: any) {
  return (
    <div><Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Input type="number" className="h-8 text-xs" value={value} onChange={(e) => onChange(e.target.value)} /></div>
  );
}
