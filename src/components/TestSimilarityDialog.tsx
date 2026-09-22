import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Copy, Loader2, RefreshCw, AlertTriangle, ShieldCheck, ShieldAlert, Trash2,
  CheckCircle2, EyeOff, GitCompare, Search,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_META: Record<string, { label: string; cls: string; icon: any; tone: "danger" | "warn" | "info" | "ok" }> = {
  exact_duplicate: { label: "Exact Duplicate", cls: "bg-rose-500/15 text-rose-700 border-rose-500/30", icon: Copy, tone: "danger" },
  nearly_duplicate: { label: "Nearly Duplicate", cls: "bg-orange-500/15 text-orange-700 border-orange-500/30", icon: AlertTriangle, tone: "danger" },
  concept_similar: { label: "Concept Similar", cls: "bg-amber-500/15 text-amber-700 border-amber-500/30", icon: GitCompare, tone: "warn" },
  pattern_similar: { label: "Pattern Similar", cls: "bg-sky-500/15 text-sky-700 border-sky-500/30", icon: Search, tone: "info" },
  original: { label: "Original", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", icon: ShieldCheck, tone: "ok" },
};

const nice = (s?: string | null) => (!s ? "—" : s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));

export function TestSimilarityDialog({ test }: { test: any }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [reports, setReports] = useState<Record<string, any>>({});

  const load = async () => {
    setLoading(true);
    const [{ data: qs }, { data: rs }] = await Promise.all([
      supabase.from("questions").select("id,question_text,correct_option,sort_order,embedded_at").eq("test_id", test.id).order("sort_order"),
      supabase.from("question_similarity_reports").select("*").eq("test_id", test.id),
    ]);
    setQuestions(qs ?? []);
    setReports(Object.fromEntries((rs ?? []).map((r: any) => [r.question_id, r])));
    setLoading(false);
  };

  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [open]);

  const runScan = async (embedFirst = true) => {
    setBusy(true);
    try {
      if (embedFirst) {
        const { data: em, error: emErr } = await supabase.functions.invoke("embed-questions", { body: { testId: test.id } });
        if (emErr) throw new Error(emErr.message);
        if ((em as any)?.error) throw new Error((em as any).error);
      }
      const { data, error } = await supabase.functions.invoke("find-similar-questions", { body: { testId: test.id } });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Scanned ${(data as any)?.analysed ?? 0} question(s)`);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Similarity scan failed");
    } finally {
      setBusy(false);
    }
  };

  const setAdminStatus = async (questionId: string, status: string) => {
    const { error } = await supabase.from("question_similarity_reports").update({ admin_status: status }).eq("question_id", questionId);
    if (error) return toast.error(error.message);
    setReports((prev) => ({ ...prev, [questionId]: { ...prev[questionId], admin_status: status } }));
    toast.success(status === "ignored" ? "Warning ignored" : "Marked as accepted");
  };

  const deleteQuestion = async (questionId: string) => {
    if (!confirm("Delete this uploaded question? This cannot be undone.")) return;
    const { error } = await supabase.from("questions").delete().eq("id", questionId);
    if (error) return toast.error(error.message);
    toast.success("Question deleted");
    setQuestions((prev) => prev.filter((q) => q.id !== questionId));
    setReports((prev) => { const { [questionId]: _, ...rest } = prev; return rest; });
  };

  const health = useMemo(() => {
    const total = questions.length;
    const rows = Object.values(reports);
    const counts: Record<string, number> = { exact_duplicate: 0, nearly_duplicate: 0, concept_similar: 0, pattern_similar: 0, original: 0 };
    rows.forEach((r: any) => { counts[r.top_match_status] = (counts[r.top_match_status] ?? 0) + 1; });
    const dupePct = total ? Math.round(((counts.exact_duplicate + counts.nearly_duplicate) / total) * 100) : 0;
    const uniqueCount = counts.original + (total - rows.length); // unscanned counted as unknown; count scanned originals
    return { total, counts, dupePct, uniqueCount, scanned: rows.length };
  }, [questions, reports]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Similarity review panel" title="AI Similarity Detector">
          <Copy className="h-4 w-4 text-primary" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Copy className="h-4 w-4 text-primary" />
            AI Similar Question Detector — {test.title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => runScan(true)} disabled={busy}>
            {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Search className="mr-1 h-3 w-3" />}
            {health.scanned === 0 ? "Run Similarity Scan" : "Re-scan"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => runScan(false)} disabled={busy}>
            <RefreshCw className={`mr-1 h-3 w-3 ${busy ? "animate-spin" : ""}`} /> Recompute only
          </Button>
        </div>

        {/* Health */}
        <div className="rounded-xl border bg-muted/30 p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <HealthStat label="Duplicate %" value={`${health.dupePct}%`} tone={health.dupePct > 20 ? "danger" : health.dupePct > 5 ? "warn" : "ok"} />
            <HealthStat label="Exact / Near" value={`${health.counts.exact_duplicate}/${health.counts.nearly_duplicate}`} tone={health.counts.exact_duplicate ? "danger" : "info"} />
            <HealthStat label="Concept similar" value={health.counts.concept_similar} tone="warn" />
            <HealthStat label="Original" value={health.counts.original} tone="ok" />
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-[10px] uppercase text-muted-foreground"><span>Bank health</span><span>{100 - health.dupePct}% unique</span></div>
            <Progress value={100 - health.dupePct} className="h-1.5" />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : questions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No questions in this test.</p>
        ) : (
          <div className="space-y-3">
            {questions.map((q, i) => (
              <SimilarityRow
                key={q.id}
                q={q}
                index={i}
                report={reports[q.id]}
                onAccept={() => setAdminStatus(q.id, "accepted")}
                onIgnore={() => setAdminStatus(q.id, "ignored")}
                onDelete={() => deleteQuestion(q.id)}
              />
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

function HealthStat({ label, value, tone }: { label: string; value: any; tone: "ok" | "warn" | "danger" | "info" }) {
  const cls = tone === "danger" ? "text-rose-700" : tone === "warn" ? "text-amber-700" : tone === "info" ? "text-sky-700" : "text-emerald-700";
  return (
    <div className="rounded-lg border bg-card p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}

function SimilarityRow({ q, index, report, onAccept, onIgnore, onDelete }: any) {
  const [expanded, setExpanded] = useState(false);
  const status = report?.top_match_status ?? "unscanned";
  const meta = STATUS_META[status];
  const StatusIcon = meta?.icon ?? Search;
  const score = report?.top_match_score ?? 0;
  const matches: any[] = report?.matches ?? [];
  const adminStatus = report?.admin_status ?? "pending";
  const flagged = status === "exact_duplicate" || status === "nearly_duplicate";

  return (
    <div className={`rounded-xl border p-3 ${flagged && adminStatus === "pending" ? "border-rose-500/40 bg-rose-500/5" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">
            Q{index + 1} · Correct: {q.correct_option}
            {!q.embedded_at && <span className="ml-2 text-amber-700">· not embedded yet</span>}
          </p>
          <p className="mt-0.5 line-clamp-2 text-sm">{q.question_text}</p>
        </div>
        <div className="shrink-0 space-x-1 text-right">
          {report ? (
            <>
              <Badge className={meta.cls} variant="outline"><StatusIcon className="mr-1 h-3 w-3" />{meta.label}</Badge>
              <div className="mt-1 text-[10px] font-semibold tabular-nums text-muted-foreground">{score}% match</div>
            </>
          ) : (
            <Badge variant="outline">Not scanned</Badge>
          )}
        </div>
      </div>

      {report && (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
            {report.variant_type && <Badge variant="secondary">Variant: {nice(report.variant_type)}</Badge>}
            {matches.length > 0 && <Badge variant="outline">{matches.length} similar in bank</Badge>}
            {adminStatus !== "pending" && (
              <Badge className={adminStatus === "accepted" ? "bg-emerald-500/15 text-emerald-700" : "bg-muted text-muted-foreground"}>
                {adminStatus === "accepted" ? <><CheckCircle2 className="mr-1 h-3 w-3" />Accepted</> : <><EyeOff className="mr-1 h-3 w-3" />Ignored</>}
              </Badge>
            )}
          </div>

          {flagged && adminStatus === "pending" && (
            <Alert className="mt-2 border-rose-500/40 bg-rose-500/5 py-2">
              <ShieldAlert className="h-4 w-4 text-rose-600" />
              <AlertDescription className="text-xs">{report.ai_recommendation}</AlertDescription>
            </Alert>
          )}

          {!flagged && report.ai_recommendation && (
            <p className="mt-2 text-xs text-muted-foreground">{report.ai_recommendation}</p>
          )}

          {matches.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-2 text-xs font-semibold text-primary hover:underline"
              >
                {expanded ? "Hide matches" : `Show ${matches.length} match${matches.length > 1 ? "es" : ""}`}
              </button>
              {expanded && (
                <div className="mt-2 space-y-2">
                  {matches.map((m: any) => {
                    const mMeta = STATUS_META[m.status] ?? STATUS_META.original;
                    return (
                      <div key={m.question_id} className="rounded-lg border bg-card p-2 text-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className={mMeta.cls}>{m.score}% · {mMeta.label}</Badge>
                          {m.variant_type && <Badge variant="secondary">{nice(m.variant_type)}</Badge>}
                          {m.exam_level && <Badge variant="outline">{m.exam_level}</Badge>}
                          {m.topic && <Badge variant="outline">{m.topic}</Badge>}
                        </div>
                        <p className="mt-1 line-clamp-2 leading-relaxed">{m.preview}</p>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                          <span>Test: <b>{m.test_title}</b></span>
                          {m.subject && <span>Subject: {m.subject}</span>}
                          {m.uploaded_at && <span>Uploaded: {new Date(m.uploaded_at).toLocaleDateString()}</span>}
                          <span className="font-mono">ID: {m.question_id.slice(0, 8)}…</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          <div className="mt-2 flex flex-wrap justify-end gap-1">
            {flagged && adminStatus === "pending" && (
              <>
                <Button size="sm" variant="outline" onClick={onIgnore}><EyeOff className="mr-1 h-3 w-3" />Ignore warning</Button>
                <Button size="sm" variant="outline" onClick={onAccept}><CheckCircle2 className="mr-1 h-3 w-3" />Publish anyway</Button>
                <Button size="sm" variant="destructive" onClick={onDelete}><Trash2 className="mr-1 h-3 w-3" />Delete upload</Button>
              </>
            )}
            {!flagged && (
              <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="mr-1 h-3 w-3" />Delete</Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
