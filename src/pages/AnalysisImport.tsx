import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { Loader2, Upload, Trash2, Eye, MessageSquare, TrendingUp, TrendingDown, Sparkles, FileText, RotateCcw } from "lucide-react";

type ReportRow = {
  id: string;
  report_number: number;
  mock_name: string | null;
  original_text: string;
  extracted: any;
  score: number | null;
  accuracy: number | null;
  attempt_percent: number | null;
  negative_marks: number | null;
  time_used: string | null;
  verdict: string | null;
  exam_readiness: string | null;
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

export default function AnalysisImport() {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [mockName, setMockName] = useState("");
  const [importing, setImporting] = useState(false);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<ReportRow | null>(null);

  // coach
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("imported_mock_reports")
      .select("*")
      .eq("user_id", user.id)
      .order("report_number", { ascending: false });
    setReports((data as ReportRow[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  async function handleImport() {
    if (text.trim().length < 40) {
      toast({ title: "Paste the full report", description: "Report is too short.", variant: "destructive" });
      return;
    }
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-mock-analysis", {
        body: { text, mockName: mockName || null },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "✅ Analysis imported", description: `Saved as Mock ${(data as any).report.report_number}.` });
      setText(""); setMockName("");
      load();
    } catch (e: any) {
      toast({ title: "Import failed", description: e.message ?? "Try again.", variant: "destructive" });
    } finally { setImporting(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this imported report?")) return;
    const { error } = await supabase.from("imported_mock_reports").delete().eq("id", id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    setReports((r) => r.filter((x) => x.id !== id));
  }

  async function ask() {
    if (!question.trim()) return;
    const q = question.trim();
    setMessages((m) => [...m, { role: "user", content: q }]);
    setQuestion(""); setAsking(true);
    try {
      const { data, error } = await supabase.functions.invoke("imported-coach-chat", {
        body: { question: q, history: messages },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setMessages((m) => [...m, { role: "assistant", content: (data as any).answer ?? "Insufficient Data." }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: `Error: ${e.message ?? "try again"}` }]);
    } finally { setAsking(false); }
  }

  const trend = useMemo(() => {
    const ordered = [...reports].sort((a, b) => a.report_number - b.report_number);
    const accs = ordered.map((r) => r.accuracy).filter((n): n is number => n != null);
    const scores = ordered.map((r) => r.score).filter((n): n is number => n != null);
    const attempts = ordered.map((r) => r.attempt_percent).filter((n): n is number => n != null);
    const negs = ordered.map((r) => r.negative_marks).filter((n): n is number => n != null);
    const diff = (xs: number[]) => xs.length >= 2 ? xs[xs.length - 1] - xs[0] : null;
    return {
      accuracyDelta: diff(accs), scoreDelta: diff(scores),
      attemptDelta: diff(attempts), negativeDelta: diff(negs),
      ordered,
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
    const topN = (m: Map<string, number>, n = 8) =>
      [...m.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, c]) => `${k} (×${c})`);
    return {
      improving, declining,
      repeatedWeakChapters: topN(chapCount),
      repeatedWeakTopics: topN(topicCount),
      repeatedMistakes: topN(mistakeCount),
    };
  }, [reports]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold font-display">📥 Mock Analysis Import</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Paste the complete Gemini analysis report. AJIT 360 will structure, remember and use it for personalized guidance — nothing is generated, only imported.
        </p>
      </header>

      <Tabs defaultValue="import" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="import"><Upload className="mr-1 h-4 w-4" />Import</TabsTrigger>
          <TabsTrigger value="history"><FileText className="mr-1 h-4 w-4" />History</TabsTrigger>
          <TabsTrigger value="compare"><TrendingUp className="mr-1 h-4 w-4" />Compare</TabsTrigger>
          <TabsTrigger value="coach"><MessageSquare className="mr-1 h-4 w-4" />AI Coach</TabsTrigger>
        </TabsList>

        {/* IMPORT */}
        <TabsContent value="import" className="space-y-4">
          <Card className="border-primary/20 bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-lg">Paste Gemini Analysis Report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Mock name (optional) — e.g. NEET Full Mock #12"
                value={mockName}
                onChange={(e) => setMockName(e.target.value)}
                maxLength={120}
              />
              <Textarea
                placeholder="Paste your complete Gemini Mock Analysis Report here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={14}
                className="font-mono text-xs"
                maxLength={60000}
              />
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{text.length.toLocaleString()} / 60,000 chars</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleImport} disabled={importing || text.trim().length < 40}>
                  {importing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing…</> : <><Upload className="mr-2 h-4 w-4" />Import Analysis</>}
                </Button>
                <Button variant="outline" onClick={() => { setText(""); setMockName(""); }} disabled={importing}>
                  <RotateCcw className="mr-2 h-4 w-4" />Clear
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                🔒 AJIT 360 does NOT analyze the PDF. It only imports the analysis you already generated in Gemini, structures it, and uses it for personalized coaching.
              </p>
            </CardContent>
          </Card>
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
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>{new Date(r.created_at).toLocaleDateString()}</span>
                    {r.score != null && <span>Score: <b>{r.score}</b></span>}
                    {r.accuracy != null && <span>Accuracy: <b>{r.accuracy}%</b></span>}
                    {r.attempt_percent != null && <span>Attempt: <b>{r.attempt_percent}%</b></span>}
                    {r.negative_marks != null && <span>Neg: <b>{r.negative_marks}</b></span>}
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

        {/* COMPARE */}
        <TabsContent value="compare" className="space-y-4">
          {reports.length < 2 ? (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Import at least 2 reports to compare.</CardContent></Card>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Accuracy", delta: trend.accuracyDelta, suffix: "%" },
                  { label: "Score", delta: trend.scoreDelta, suffix: "" },
                  { label: "Attempt", delta: trend.attemptDelta, suffix: "%" },
                  { label: "Negative", delta: trend.negativeDelta, suffix: "", inverse: true },
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

        {/* COACH */}
        <TabsContent value="coach" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />AI Coach (from your imported reports only)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {reports.length === 0 && (
                <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">Import at least one report to talk to the coach.</p>
              )}
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {[
                    "What should I study today?",
                    "What should I revise first?",
                    "Which topic is my weakest?",
                    "What mistakes do I repeat?",
                    "What should I focus on this week?",
                  ].map((q) => (
                    <Button key={q} size="sm" variant="outline" onClick={() => setQuestion(q)}>{q}</Button>
                  ))}
                </div>
                <ScrollArea className="h-72 rounded-md border p-3">
                  {messages.length === 0 && (
                    <p className="text-sm text-muted-foreground">Ask anything — answers come only from your imported reports.</p>
                  )}
                  <div className="space-y-3">
                    {messages.map((m, i) => (
                      <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          {m.content}
                        </div>
                      </div>
                    ))}
                    {asking && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />thinking…</div>}
                  </div>
                </ScrollArea>
                <div className="flex gap-2">
                  <Input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask your coach…"
                    onKeyDown={(e) => { if (e.key === "Enter" && !asking) ask(); }}
                    disabled={reports.length === 0}
                  />
                  <Button onClick={ask} disabled={asking || !question.trim() || reports.length === 0}>
                    {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ask"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View dialog */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Mock {viewing?.report_number} — {viewing?.mock_name}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <Tabs defaultValue="structured">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="structured">Structured</TabsTrigger>
                <TabsTrigger value="original">Original Report</TabsTrigger>
              </TabsList>
              <TabsContent value="structured">
                <ScrollArea className="h-[60vh] pr-3">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        ["Score", viewing.score], ["Accuracy", viewing.accuracy != null ? `${viewing.accuracy}%` : null],
                        ["Attempt", viewing.attempt_percent != null ? `${viewing.attempt_percent}%` : null],
                        ["Negative", viewing.negative_marks], ["Time", viewing.time_used],
                        ["Readiness", viewing.exam_readiness],
                      ].map(([k, v]) => (
                        <div key={k as string} className="rounded-md border p-2">
                          <p className="text-[10px] uppercase text-muted-foreground">{k}</p>
                          <p className="text-sm font-semibold">{v == null || v === "" ? "—" : String(v)}</p>
                        </div>
                      ))}
                    </div>
                    {viewing.verdict && (
                      <div className="rounded-md border bg-muted/40 p-3 text-sm"><b>Verdict:</b> {viewing.verdict}</div>
                    )}
                    {(() => {
                      const e = viewing.extracted ?? {};
                      const sections: Array<[string, string[]]> = [
                        ["✅ Strong Subjects", e.strong_subjects], ["⚠️ Weak Subjects", e.weak_subjects],
                        ["Strong Chapters", e.strong_chapters], ["Weak Chapters", e.weak_chapters],
                        ["Strong Topics", e.strong_topics], ["Weak Topics", e.weak_topics],
                        ["🔥 Critical Topics", e.critical_topics],
                        ["Conceptual Errors", e.conceptual_errors], ["Silly Mistakes", e.silly_mistakes],
                        ["Guesswork", e.guesswork], ["Calculation Errors", e.calculation_errors],
                        ["Reading Errors", e.reading_errors], ["Time Problems", e.time_problems],
                        ["🚩 Red Flags", e.red_flags], ["💪 Strengths", e.strengths], ["🩹 Weaknesses", e.weaknesses],
                        ["🎯 Revision Priority", e.revision_priority],
                        ["📅 3-Day Action Plan", e.action_plan_3day],
                        ["🎯 Next Mock Strategy", e.next_mock_strategy],
                        ["💎 High ROI Chapters", e.high_roi_chapters], ["💎 High ROI Topics", e.high_roi_topics],
                      ];
                      return sections.map(([title, items]) => (
                        <Section key={title} title={title} items={items ?? []} />
                      ));
                    })()}
                  </div>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="original">
                <ScrollArea className="h-[60vh]">
                  <pre className="whitespace-pre-wrap p-2 text-xs">{viewing.original_text}</pre>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
