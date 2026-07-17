import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Brain, Upload, Sparkles, Trash2, Search, FileText, Loader2, X, TrendingUp, Target, Clock, Award } from "lucide-react";
import { toast } from "sonner";

type Report = {
  id: string; title: string; exam_name: string | null; status: string;
  created_at: string; file_paths: string[]; report: any; ocr_text: string | null;
  accuracy: number | null; readiness_score: number | null; overall_score: number | null; error: string | null;
};

const ACCEPT = ".pdf,.jpg,.jpeg,.png,image/*,application/pdf";

export default function AIMockAnalyzer() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Report | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("ai_mock_reports")
      .select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setReports((data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return reports;
    return reports.filter(r =>
      r.title.toLowerCase().includes(q) ||
      (r.exam_name ?? "").toLowerCase().includes(q) ||
      new Date(r.created_at).toLocaleDateString().includes(q) ||
      JSON.stringify(r.report ?? {}).toLowerCase().includes(q)
    );
  }, [reports, search]);

  const onFiles = (list: FileList | null) => {
    if (!list) return;
    const arr = [...list].filter(f => {
      const ok = /\.(pdf|jpg|jpeg|png)$/i.test(f.name);
      if (!ok) toast.error(`Skipped ${f.name} — unsupported format`);
      return ok && f.size <= 20 * 1024 * 1024;
    });
    arr.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    setFiles(f => [...f, ...arr]);
  };

  const removeFile = (i: number) => setFiles(f => f.filter((_, idx) => idx !== i));

  const uploadAndCreate = async () => {
    if (!user || !files.length) return;
    setUploading(true); setProgress(0);
    try {
      const paths: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const path = `${user.id}/${Date.now()}_${i}_${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error } = await supabase.storage.from("mock-uploads").upload(path, f, { upsert: false });
        if (error) throw error;
        paths.push(path);
        setProgress(Math.round(((i + 1) / files.length) * 100));
      }
      const { data, error } = await supabase.from("ai_mock_reports").insert({
        user_id: user.id,
        title: title.trim() || `Mock ${new Date().toLocaleDateString()}`,
        file_paths: paths,
        status: "pending",
      }).select().single();
      if (error) throw error;
      toast.success("Uploaded. Press Analyze Mock to generate the AI report.");
      setFiles([]); setTitle(""); setProgress(0);
      await load();
      setSelected(data as any);
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const analyze = async (id: string) => {
    setAnalyzingId(id);
    try {
      await supabase.from("ai_mock_reports").update({ status: "analyzing", error: null }).eq("id", id);
      await load();
      const { data, error } = await supabase.functions.invoke("analyze-mock-test", { body: { reportId: id } });
      if (error) throw error;
      toast.success("Analysis complete");
      await load();
      const fresh = (await supabase.from("ai_mock_reports").select("*").eq("id", id).single()).data as any;
      setSelected(fresh);
    } catch (e: any) {
      toast.error(e.message ?? "Analysis failed");
      await supabase.from("ai_mock_reports").update({ status: "failed", error: e.message }).eq("id", id);
      await load();
    } finally {
      setAnalyzingId(null);
    }
  };

  const del = async (id: string) => {
    if (!confirm("Delete this report?")) return;
    await supabase.from("ai_mock_reports").delete().eq("id", id);
    toast.success("Deleted");
    load();
  };

  const rename = async (r: Report) => {
    const name = prompt("Rename report", r.title);
    if (!name?.trim()) return;
    await supabase.from("ai_mock_reports").update({ title: name.trim() }).eq("id", r.id);
    load();
  };

  const duplicate = async (r: Report) => {
    if (!user) return;
    await supabase.from("ai_mock_reports").insert({
      user_id: user.id, title: `${r.title} (copy)`, exam_name: r.exam_name,
      file_paths: r.file_paths, ocr_text: r.ocr_text, report: r.report,
      accuracy: r.accuracy, readiness_score: r.readiness_score,
      overall_score: r.overall_score, status: r.status,
    });
    toast.success("Duplicated");
    load();
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="rounded-xl bg-gradient-to-br from-primary to-secondary p-2 text-primary-foreground">
          <Brain className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">AI Mock Analyzer</h1>
          <p className="text-sm text-muted-foreground">Upload any external mock test — get a premium AI performance report.</p>
        </div>
      </header>

      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Upload className="h-4 w-4" />New Mock Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Title (e.g. SSC CGL Testbook Mock 12)" value={title} onChange={e => setTitle(e.target.value)} />

          <div
            onDragOver={e => { e.preventDefault(); }}
            onDrop={e => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
            className="cursor-pointer rounded-xl border-2 border-dashed border-primary/30 bg-muted/30 p-6 text-center transition hover:border-primary hover:bg-muted/50"
          >
            <Upload className="mx-auto mb-2 h-8 w-8 text-primary" />
            <p className="text-sm font-medium">Drop PDF / images or click to browse</p>
            <p className="text-xs text-muted-foreground">Multiple screenshots auto-arranged alphabetically. Max 20MB each.</p>
            <input ref={fileRef} type="file" accept={ACCEPT} multiple hidden onChange={e => onFiles(e.target.files)} />
          </div>

          {files.length > 0 && (
            <div className="space-y-1">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5 text-sm">
                  <span className="truncate"><FileText className="mr-1 inline h-3.5 w-3.5" />{f.name}</span>
                  <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}

          {uploading && <Progress value={progress} />}

          <Button onClick={uploadAndCreate} disabled={!files.length || uploading} className="w-full">
            {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</> : "Upload"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">AI analysis runs only after you press <span className="font-semibold text-foreground">Analyze Mock</span> on a report.</p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Report History</h2>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by exam, date, keyword..." className="pl-9" />
          </div>
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">
            <Sparkles className="mx-auto mb-2 h-8 w-8 text-primary/50" />
            No reports yet. Upload a mock test to begin.
          </CardContent></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(r => (
              <Card key={r.id} className="transition hover:shadow-md">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  {r.exam_name && <Badge variant="outline">{r.exam_name}</Badge>}
                  {r.report && (
                    <div className="grid grid-cols-3 gap-1 pt-1 text-center text-xs">
                      <MiniStat icon={<Target className="h-3 w-3" />} label="Acc" value={r.accuracy ? `${r.accuracy}%` : "-"} />
                      <MiniStat icon={<Award className="h-3 w-3" />} label="Score" value={r.overall_score ?? "-"} />
                      <MiniStat icon={<TrendingUp className="h-3 w-3" />} label="Ready" value={r.readiness_score ? `${r.readiness_score}%` : "-"} />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1 pt-2">
                    {r.status !== "completed" && r.status !== "analyzing" && (
                      <Button size="sm" onClick={() => analyze(r.id)} disabled={analyzingId === r.id} className="flex-1">
                        {analyzingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Sparkles className="mr-1 h-3.5 w-3.5" />Analyze Mock</>}
                      </Button>
                    )}
                    {r.status === "completed" && (
                      <Button size="sm" variant="secondary" onClick={() => setSelected(r)} className="flex-1">Open Report</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => rename(r)}>Rename</Button>
                    <Button size="sm" variant="ghost" onClick={() => duplicate(r)}>Dup</Button>
                    {r.status === "completed" && (
                      <Button size="sm" variant="ghost" onClick={() => analyze(r.id)}>Re-run</Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                  {r.error && <p className="text-xs text-destructive">{r.error}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selected && <ReportView r={selected} onAnalyze={() => analyze(selected.id)} analyzing={analyzingId === selected.id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    analyzing: "bg-blue-500/20 text-blue-600",
    completed: "bg-green-500/20 text-green-600",
    failed: "bg-red-500/20 text-red-600",
  };
  return <Badge className={map[status] ?? ""} variant="outline">{status}</Badge>;
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  return (
    <div className="rounded-md bg-muted/50 p-1.5">
      <div className="flex items-center justify-center gap-1 text-muted-foreground">{icon}<span>{label}</span></div>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function ReportView({ r, onAnalyze, analyzing }: { r: Report; onAnalyze: () => void; analyzing: boolean }) {
  const d = r.report ?? {};
  if (r.status !== "completed" || !r.report) {
    return (
      <div className="space-y-3">
        <DialogHeader><DialogTitle>{r.title}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">This report has not been analyzed yet.</p>
        <Button onClick={onAnalyze} disabled={analyzing}>
          {analyzing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing...</> : <><Sparkles className="mr-2 h-4 w-4" />Analyze Mock</>}
        </Button>
      </div>
    );
  }
  const totals = d.totals ?? {};
  const levelColor = (l: string) => ({ strong: "bg-green-500", average: "bg-yellow-500", weak: "bg-orange-500", critical: "bg-red-500" } as any)[l] ?? "bg-muted";
  const priorityBadge = (p: string) => ({
    critical: "bg-red-500/20 text-red-600 border-red-500/40",
    high: "bg-orange-500/20 text-orange-600 border-orange-500/40",
    medium: "bg-yellow-500/20 text-yellow-600 border-yellow-500/40",
    strong: "bg-green-500/20 text-green-600 border-green-500/40",
  } as any)[p] ?? "";
  return (
    <div className="space-y-5">
      <DialogHeader>
        <DialogTitle>{r.title}</DialogTitle>
        <p className="text-xs text-muted-foreground">{d.exam_name ?? "External Mock"} · {new Date(r.created_at).toLocaleString()}</p>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <BigStat label="Accuracy" value={`${d.accuracy ?? 0}%`} icon={<Target />} />
        <BigStat label="Score" value={`${totals.score ?? "-"}${totals.max_score ? ` / ${totals.max_score}` : ""}`} icon={<Award />} />
        <BigStat label="Readiness" value={`${d.readiness_score ?? 0}%`} icon={<TrendingUp />} />
        <BigStat label="Time" value={totals.time_minutes ? `${totals.time_minutes}m` : "-"} icon={<Clock />} />
      </div>

      <Section title="🧠 AI Coach Feedback">
        <p className="whitespace-pre-wrap text-sm">{d.coach_feedback ?? "-"}</p>
      </Section>

      <div className="grid gap-3 md:grid-cols-2">
        <Section title="✅ Strong Subjects"><Chips items={d.strong_subjects} tone="green" /></Section>
        <Section title="❌ Weak Subjects"><Chips items={d.weak_subjects} tone="red" /></Section>
        <Section title="📖 Weak Chapters"><Chips items={d.weak_chapters} /></Section>
        <Section title="🧩 Weak Topics"><Chips items={d.weak_topics} /></Section>
        <Section title="🔥 Frequent Mistakes"><Chips items={d.frequent_mistakes} tone="red" /></Section>
        <Section title="⚡ Silly Mistakes"><Chips items={d.silly_mistakes} /></Section>
        <Section title="🧠 Concept Weakness"><Chips items={d.concept_weakness} /></Section>
        <Section title="📝 Guess Answers"><Chips items={d.guess_answers} /></Section>
      </div>

      <Section title="📊 Mistake Categories">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Object.entries(d.mistake_categories ?? {}).map(([k, v]) => (
            <div key={k} className="rounded-lg border p-2 text-center">
              <p className="text-lg font-bold">{v as any}</p>
              <p className="text-[11px] capitalize text-muted-foreground">{k.replace(/_/g, " ")}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="🗺️ Performance Heatmap">
        <div className="space-y-1">
          {(d.heatmap ?? []).map((h: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className={`h-3 w-3 rounded-full ${levelColor(h.level)}`} />
              <span className="flex-1 truncate">{[h.subject, h.chapter, h.topic].filter(Boolean).join(" › ")}</span>
              <Badge variant="outline" className="text-[10px] capitalize">{h.level}</Badge>
            </div>
          ))}
          {!(d.heatmap ?? []).length && <p className="text-sm text-muted-foreground">No heatmap data.</p>}
        </div>
      </Section>

      <Section title="📌 Revision Priority">
        <div className="space-y-1">
          {(d.revision_priority ?? []).map((p: any, i: number) => (
            <div key={i} className="flex items-center justify-between rounded-md border px-2 py-1.5 text-sm">
              <span className="truncate">{p.item}</span>
              <Badge variant="outline" className={priorityBadge(p.priority)}>{p.priority}</Badge>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-3 md:grid-cols-2">
        <Section title="📅 7-Day Plan">
          <div className="space-y-2">
            {(d.plan_7_day ?? []).map((p: any) => (
              <div key={p.day} className="rounded-md border p-2 text-sm">
                <p className="font-semibold">Day {p.day} · {p.focus}</p>
                <ul className="ml-4 list-disc text-xs text-muted-foreground">{(p.tasks ?? []).map((t: string, i: number) => <li key={i}>{t}</li>)}</ul>
              </div>
            ))}
          </div>
        </Section>
        <Section title="📅 30-Day Plan">
          <div className="space-y-2">
            {(d.plan_30_day ?? []).map((p: any) => (
              <div key={p.week} className="rounded-md border p-2 text-sm">
                <p className="font-semibold">Week {p.week} · {p.focus}</p>
                <ul className="ml-4 list-disc text-xs text-muted-foreground">{(p.tasks ?? []).map((t: string, i: number) => <li key={i}>{t}</li>)}</ul>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section title="⏳ Time & Difficulty">
        <p className="text-sm"><span className="font-semibold">Speed:</span> {d.speed_analysis ?? "-"}</p>
        <p className="text-sm"><span className="font-semibold">Time Pressure:</span> {d.time_pressure ?? "-"}</p>
        <p className="text-sm"><span className="font-semibold">Difficulty:</span> {d.difficulty_analysis ?? "-"}</p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card/50 p-3 backdrop-blur">
      <p className="mb-2 text-sm font-semibold">{title}</p>
      {children}
    </div>
  );
}
function Chips({ items, tone }: { items?: string[]; tone?: "green" | "red" }) {
  if (!items?.length) return <p className="text-xs text-muted-foreground">None</p>;
  const cls = tone === "green" ? "bg-green-500/15 text-green-600 border-green-500/30"
           : tone === "red" ? "bg-red-500/15 text-red-600 border-red-500/30" : "";
  return <div className="flex flex-wrap gap-1">{items.map((x, i) => <Badge key={i} variant="outline" className={cls}>{x}</Badge>)}</div>;
}
function BigStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-secondary/5 p-3 text-center">
      <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</div>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
