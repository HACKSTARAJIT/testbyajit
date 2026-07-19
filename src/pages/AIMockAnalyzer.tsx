import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Brain, Upload, Sparkles, Trash2, Search, FileText, Loader2, X,
  TrendingUp, Target, Clock, Award, BarChart3, Trophy, CalendarClock,
  ListChecks, FileStack, CheckCircle2, AlertCircle, Image as ImageIcon,
  RotateCw, Copy, Pencil, Filter,
} from "lucide-react";
import { toast } from "sonner";

type Report = {
  id: string; title: string; exam_name: string | null; status: string;
  created_at: string; file_paths: string[]; report: any; ocr_text: string | null;
  accuracy: number | null; readiness_score: number | null; overall_score: number | null; error: string | null;
  analysis_status?: "pending" | "verified" | "failed" | string | null;
  verified_attempt_snapshot?: any;
  verification_error?: string | null;
  attempt_id?: string | null;
  source_test_id?: string | null;
};

const ACCEPT = ".pdf,.jpg,.jpeg,.png,image/*,application/pdf";
const MAX_MB = 20;

const STAGES = [
  { key: "upload", label: "Uploading" },
  { key: "read", label: "Reading Document" },
  { key: "ocr", label: "Running OCR" },
  { key: "prep", label: "Preparing AI Analysis" },
  { key: "ready", label: "Ready to Analyze" },
];

type Activity = { id: string; kind: string; title: string; at: number };

export default function AIMockAnalyzer() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [examFilter, setExamFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [examName, setExamName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(0);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Report | null>(null);
  const [verifyTarget, setVerifyTarget] = useState<Report | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const logActivity = (kind: string, title: string) => {
    setActivity(a => [{ id: crypto.randomUUID(), kind, title, at: Date.now() }, ...a].slice(0, 8));
  };

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("ai_mock_reports")
      .select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setReports((data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  // Dashboard stats
  const stats = useMemo(() => {
    const completed = reports.filter(r => isVerifiedReport(r) && hasValidReport(r.report));
    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    const accs = completed.map(r => r.accuracy ?? 0).filter(x => x > 0);
    const scores = completed.map(r => r.overall_score ?? 0).filter(x => x > 0);
    const readys = completed.map(r => r.readiness_score ?? 0).filter(x => x > 0);
    const best = completed.reduce<Report | null>((b, r) => (r.overall_score ?? 0) > (b?.overall_score ?? -1) ? r : b, null);
    const latest = reports[0] ?? null;
    const totalQ = completed.reduce((n, r) => n + (r.report?.totals?.total_questions ?? r.report?.totals?.total ?? 0), 0);
    return {
      total: reports.length,
      avgAcc: avg(accs),
      avgScore: avg(scores),
      avgReady: avg(readys),
      best, latest,
      totalQ,
      aiReports: completed.length,
    };
  }, [reports]);

  const exams = useMemo(() => {
    const s = new Set(reports.map(r => r.exam_name).filter(Boolean) as string[]);
    return Array.from(s);
  }, [reports]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = reports.filter(r => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (examFilter !== "all" && (r.exam_name ?? "") !== examFilter) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        (r.exam_name ?? "").toLowerCase().includes(q) ||
        new Date(r.created_at).toLocaleDateString().includes(q) ||
        JSON.stringify(r.report ?? {}).toLowerCase().includes(q)
      );
    });
    const t = (r: Report) => new Date(r.created_at).getTime();
    switch (sortBy) {
      case "oldest": list = [...list].sort((a, b) => t(a) - t(b)); break;
      case "acc_high": list = [...list].sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0)); break;
      case "acc_low": list = [...list].sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0)); break;
      default: list = [...list].sort((a, b) => t(b) - t(a));
    }
    return list;
  }, [reports, search, statusFilter, examFilter, sortBy]);

  const onFiles = (list: FileList | null) => {
    if (!list) return;
    const arr = [...list].filter(f => {
      const ok = /\.(pdf|jpg|jpeg|png)$/i.test(f.name);
      if (!ok) { toast.error(`Skipped ${f.name} — unsupported format`); return false; }
      if (f.size > MAX_MB * 1024 * 1024) { toast.error(`${f.name} exceeds ${MAX_MB}MB`); return false; }
      return true;
    });
    arr.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    setFiles(f => [...f, ...arr]);
  };

  const removeFile = (i: number) => setFiles(f => f.filter((_, idx) => idx !== i));

  const runStage = async (idx: number, ms: number) => {
    setStage(idx);
    await new Promise(r => setTimeout(r, ms));
  };

  const uploadAndCreate = async () => {
    if (!user || !files.length) return;
    setUploading(true); setProgress(0); setStage(0);
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
      await runStage(1, 400);
      await runStage(2, 500);
      await runStage(3, 400);
      const { data, error } = await supabase.from("ai_mock_reports").insert({
        user_id: user.id,
        title: title.trim() || `Mock ${new Date().toLocaleDateString()}`,
        exam_name: examName.trim() || null,
        file_paths: paths,
        status: "pending",
        analysis_status: "pending",
      }).select().single();
      if (error) throw error;
      await runStage(4, 300);
      toast.success("Uploaded — verify actual attempt data before AI Analysis");
      logActivity("upload", data.title);
      setFiles([]); setTitle(""); setExamName(""); setProgress(0); setStage(0);
      await load();
    } catch (e: any) {
      toast.error(friendly(e.message) || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const analyze = async (id: string, force = false) => {
    const target = reports.find(r => r.id === id);
    if (!force && target && !hasVerifiedAttemptData(target)) {
      setVerifyTarget(target);
      toast.message("Verify actual attempt data before AI analysis.");
      return;
    }
    setAnalyzingId(id);
    try {
      await supabase.from("ai_mock_reports").update({ status: "analyzing", error: null }).eq("id", id);
      await load();
      const { error } = await supabase.functions.invoke("analyze-mock-test", { body: { reportId: id } });
      if (error) {
        let backendMsg = error.message;
        try {
          const ctx: any = (error as any).context;
          if (ctx?.body) {
            const text = typeof ctx.body === "string" ? ctx.body : await new Response(ctx.body).text();
            try { backendMsg = JSON.parse(text).error ?? text; } catch { backendMsg = text; }
          }
        } catch {}
        throw new Error(backendMsg || "Analysis failed to start");
      }
      toast.info("Analyzing in background — this can take a few minutes.");
      const started = Date.now();
      let fresh: any = null;
      while (Date.now() - started < 10 * 60 * 1000) {
        await new Promise(r => setTimeout(r, 5000));
        const { data } = await supabase.from("ai_mock_reports").select("*").eq("id", id).single();
        fresh = data;
        if (fresh?.status === "completed" || fresh?.status === "failed") break;
      }
      await load();
      if (fresh?.status === "completed") {
        toast.success("Analysis complete");
        logActivity("analysis", fresh.title);
        setSelected(fresh);
      } else if (fresh?.status === "failed") {
        throw new Error(fresh.error || "Analysis failed");
      } else {
        toast.message("Still processing — check back shortly.");
      }
    } catch (e: any) {
      toast.error(friendly(e.message) || "AI analysis failed. Please retry.");
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
      analysis_status: r.analysis_status ?? "pending",
      verified_attempt_snapshot: r.verified_attempt_snapshot ?? null,
      verification_error: r.verification_error ?? null,
      source_test_id: r.source_test_id ?? null,
    });
    toast.success("Duplicated");
    load();
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-primary to-secondary p-2 text-primary-foreground shadow-lg shadow-primary/20">
            <Brain className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Mock Analyzer</h1>
            <p className="text-sm text-muted-foreground">Your premium mock analysis workspace.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <a href="/ai-coach"><Sparkles className="mr-1 h-4 w-4" />AI Coach</a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href="/performance"><TrendingUp className="mr-1 h-4 w-4" />Performance Intelligence</a>
          </Button>
        </div>

      </header>

      {/* Dashboard */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={<FileStack />} label="Total Mocks" value={stats.total} tint="from-primary/20 to-primary/5" />
        <StatCard icon={<Target />} label="Avg Accuracy" value={`${stats.avgAcc}%`} tint="from-emerald-500/20 to-emerald-500/5" />
        <StatCard icon={<Award />} label="Avg Score" value={stats.avgScore || "—"} tint="from-amber-500/20 to-amber-500/5" />
        <StatCard icon={<TrendingUp />} label="Avg Readiness" value={`${stats.avgReady}%`} tint="from-sky-500/20 to-sky-500/5" />
        <StatCard icon={<Trophy />} label="Best Mock" value={stats.best?.title ?? "—"} sub={stats.best ? `${stats.best.overall_score ?? "-"} pts` : ""} tint="from-yellow-500/20 to-yellow-500/5" small />
        <StatCard icon={<CalendarClock />} label="Latest Mock" value={stats.latest?.title ?? "—"} sub={stats.latest ? new Date(stats.latest.created_at).toLocaleDateString() : ""} tint="from-fuchsia-500/20 to-fuchsia-500/5" small />
        <StatCard icon={<ListChecks />} label="Questions Analyzed" value={stats.totalQ || "—"} tint="from-indigo-500/20 to-indigo-500/5" />
        <StatCard icon={<Sparkles />} label="AI Reports" value={stats.aiReports} tint="from-violet-500/20 to-violet-500/5" />
      </section>

      {/* Upload */}
      <Card className="border-primary/20 backdrop-blur bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Upload className="h-4 w-4" />New Mock Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input placeholder="Mock title (e.g. SSC CGL Mock 12)" value={title} onChange={e => setTitle(e.target.value)} />
            <Input placeholder="Exam name (optional)" value={examName} onChange={e => setExamName(e.target.value)} />
          </div>

          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
            className="cursor-pointer rounded-xl border-2 border-dashed border-primary/30 bg-gradient-to-br from-muted/30 to-muted/10 p-8 text-center transition hover:border-primary hover:bg-muted/50"
          >
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Upload className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium">Drop PDF / JPG / PNG or click to browse</p>
            <p className="text-xs text-muted-foreground">Multiple screenshots auto-ordered alphabetically · Max {MAX_MB}MB each</p>
            <input ref={fileRef} type="file" accept={ACCEPT} multiple hidden onChange={e => onFiles(e.target.files)} />
          </div>

          {files.length > 0 && (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {files.map((f, i) => {
                const isImg = /\.(jpg|jpeg|png)$/i.test(f.name);
                return (
                  <div key={i} className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-2 py-1.5 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      {isImg
                        ? <ImageIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
                        : <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />}
                      <span className="truncate">{f.name}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{(f.size/1024/1024).toFixed(1)}MB</span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {uploading && (
            <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
              <Progress value={stage === 0 ? progress : Math.min(100, (stage + 1) * 20)} className="h-2" />
              <div className="grid grid-cols-5 gap-1 text-[10px]">
                {STAGES.map((s, i) => (
                  <div key={s.key} className={`flex flex-col items-center gap-1 rounded-md p-1.5 transition ${i < stage ? "text-emerald-500" : i === stage ? "text-primary" : "text-muted-foreground/60"}`}>
                    {i < stage
                      ? <CheckCircle2 className="h-3.5 w-3.5" />
                      : i === stage
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <span className="h-3.5 w-3.5 rounded-full border border-current opacity-50" />}
                    <span className="text-center leading-tight">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button onClick={uploadAndCreate} disabled={!files.length || uploading} className="w-full">
            {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : <>Upload {files.length ? `(${files.length})` : ""}</>}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            AI analysis runs only after you press <span className="font-semibold text-foreground">Analyze Mock</span> on a report.
          </p>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><BarChart3 className="h-4 w-4" />Report History</h2>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search exam, date, keyword..." className="pl-9" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="analyzing">Analyzing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={examFilter} onValueChange={setExamFilter}>
            <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue placeholder="Exam" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Exams</SelectItem>
              {exams.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="acc_high">Highest Accuracy</SelectItem>
              <SelectItem value="acc_low">Lowest Accuracy</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-44 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasAny={reports.length > 0} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(r => (
              <ReportCard
                key={r.id}
                r={r}
                onOpen={() => setSelected(r)}
                onAnalyze={() => analyze(r.id)}
                onVerify={() => setVerifyTarget(r)}
                onRename={() => rename(r)}
                onDuplicate={() => duplicate(r)}
                onDelete={() => del(r.id)}
                analyzing={analyzingId === r.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recent activity */}
      {activity.length > 0 && (
        <Card className="bg-card/60 backdrop-blur">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Recent Activity</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {activity.map(a => (
              <div key={a.id} className="flex items-center gap-2 text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="font-medium capitalize">{a.kind}</span>
                <span className="text-muted-foreground truncate">— {a.title}</span>
                <span className="ml-auto text-muted-foreground">{new Date(a.at).toLocaleTimeString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selected && <ReportView r={selected} onAnalyze={() => analyze(selected.id)} analyzing={analyzingId === selected.id} />}
        </DialogContent>
      </Dialog>

      <VerifyAttemptDialog
        report={verifyTarget}
        open={!!verifyTarget}
        onOpenChange={(open) => !open && setVerifyTarget(null)}
        onVerified={async (id) => {
          setVerifyTarget(null);
          await load();
          await analyze(id, true);
        }}
      />
    </div>
  );
}

function friendly(msg?: string) {
  if (!msg) return msg;
  if (/ocr/i.test(msg)) return "OCR failed. Please retry.";
  if (/timeout|timed out/i.test(msg)) return "Request timed out. Please retry.";
  if (/network|fetch/i.test(msg)) return "Network error. Check your connection.";
  return msg.length > 220 ? msg.slice(0, 220) + "..." : msg;
}

function hasValidReport(report: any) {
  if (!report || typeof report !== "object" || Object.keys(report).length === 0) return false;
  const totals = report.totals ?? {};
  const questions = Number(totals.questions ?? totals.total_questions ?? totals.total ?? 0);
  return questions > 0 && report.accuracy != null && Array.isArray(report.subject_analysis) && report.subject_analysis.length > 0;
}

function isVerifiedReport(r: Report) {
  return r.status === "completed" && r.analysis_status === "verified";
}

function hasVerifiedAttemptData(r: Report) {
  return r.analysis_status === "verified" && !!r.verified_attempt_snapshot;
}

function StatCard({ icon, label, value, sub, tint, small }: { icon: React.ReactNode; label: string; value: any; sub?: string; tint: string; small?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${tint} p-3 backdrop-blur transition hover:scale-[1.02]`}>
      <div className="mb-1 flex h-7 w-7 items-center justify-center rounded-lg bg-background/60 text-primary [&_svg]:h-4 [&_svg]:w-4">
        {icon}
      </div>
      <p className={`font-bold ${small ? "text-sm truncate" : "text-xl"}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      {sub && <p className="mt-0.5 text-[10px] text-muted-foreground truncate">{sub}</p>}
    </div>
  );
}

function ReportCard({ r, onOpen, onAnalyze, onVerify, onRename, onDuplicate, onDelete, analyzing }: {
  r: Report; onOpen: () => void; onAnalyze: () => void; onVerify: () => void; onRename: () => void; onDuplicate: () => void; onDelete: () => void; analyzing: boolean;
}) {
  const pages = r.file_paths?.length ?? 0;
  const verified = hasVerifiedAttemptData(r);
  const validReport = isVerifiedReport(r) && hasValidReport(r.report);
  return (
    <Card className="group relative overflow-hidden bg-card/60 backdrop-blur transition hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{r.title}</p>
            <p className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
          </div>
          <StatusBadge status={r.status} />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {r.exam_name && <Badge variant="outline" className="text-[10px]">{r.exam_name}</Badge>}
          <Badge variant="outline" className="text-[10px]">{pages} file{pages !== 1 ? "s" : ""}</Badge>
          <Badge variant={verified ? "secondary" : "outline"} className="text-[10px]">
            {verified ? "Verified data ✓" : "Verify data required"}
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-1 text-center">
          <Mini label="Accuracy" value={r.accuracy ? `${r.accuracy}%` : "—"} />
          <Mini label="Score" value={r.overall_score ?? "—"} />
          <Mini label="Readiness" value={r.readiness_score ? `${r.readiness_score}%` : "—"} />
        </div>
        {(!verified || (r.error && r.status === "failed") || (r.status === "completed" && !validReport)) && (
          <div className="flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{r.verification_error || r.error || "Analysis unavailable because verified attempt data is incomplete."}</span>
          </div>
        )}
        <div className="flex flex-wrap gap-1">
          {validReport ? (
            <Button size="sm" variant="secondary" onClick={onOpen} className="flex-1">Open</Button>
          ) : !verified ? (
            <Button size="sm" onClick={onVerify} className="flex-1">
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />Verify Data
            </Button>
          ) : r.status === "analyzing" ? (
            <Button size="sm" disabled className="flex-1"><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Analyzing</Button>
          ) : (
            <Button size="sm" onClick={onAnalyze} disabled={analyzing} className="flex-1">
              {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Sparkles className="mr-1 h-3.5 w-3.5" />Analyze</>}
            </Button>
          )}
          {r.status === "completed" && (
            <Button size="icon" variant="ghost" title="Reanalyze" aria-label="Reanalyze" onClick={onAnalyze}><RotateCw className="h-4 w-4" /></Button>
          )}
          {r.status === "failed" && (
            <Button size="icon" variant="ghost" title="Retry" aria-label="Retry" onClick={onAnalyze}><RotateCw className="h-4 w-4" /></Button>
          )}
          <Button size="icon" variant="ghost" title="Rename" aria-label="Rename" onClick={onRename}><Pencil className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" title="Duplicate" aria-label="Duplicate" onClick={onDuplicate}><Copy className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" title="Delete" aria-label="Delete" onClick={onDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-md bg-muted/50 p-1.5">
      <p className="text-sm font-semibold">{value}</p>
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-muted text-muted-foreground border-muted-foreground/20",
    analyzing: "bg-blue-500/15 text-blue-500 border-blue-500/30",
    completed: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    failed: "bg-red-500/15 text-red-500 border-red-500/30",
  };
  return <Badge className={`text-[10px] ${map[status] ?? ""}`} variant="outline">{status}</Badge>;
}

function VerifyAttemptDialog({ report, open, onOpenChange, onVerified }: {
  report: Report | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: (id: string) => void | Promise<void>;
}) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    score: "",
    totalMarks: "120",
    correct: "",
    wrong: "",
    skipped: "0",
    accuracy: "",
    timeMinutes: "0",
    negativeMarks: "0",
  });

  useEffect(() => {
    if (!report || !open) return;
    const s = report.verified_attempt_snapshot ?? {};
    const ocr = extractPrintedResultCard(report.ocr_text);
    const t = (report as any).report?.totals ?? {};
    const pick = (a: any, b: any, c: any, d: any) => a ?? b ?? c ?? d;
    setForm({
      score: str(pick(s.score, ocr.score, t.score, report.overall_score), ""),
      totalMarks: str(pick(s.total_marks, s.max_score, ocr.totalMarks, t.max_score ?? t.total_marks), "120"),
      correct: str(pick(s.correct, ocr.correct, t.correct, null), ""),
      wrong: str(pick(s.wrong, ocr.wrong, t.wrong, null), ""),
      skipped: str(pick(s.skipped, ocr.skipped, t.skipped, 0), "0"),
      accuracy: str(pick(s.accuracy, ocr.accuracy, t.accuracy, report.accuracy), ""),
      timeMinutes: str(s.time_taken_seconds != null ? Math.round(Number(s.time_taken_seconds) / 60) : pick(ocr.timeMinutes, t.time_minutes, null, 0), "0"),
      negativeMarks: str(pick(s.negative_marks, ocr.negativeMarks, t.negative_marks, 0), "0"),
    });
  }, [report, open]);

  const set = (key: keyof typeof form, value: string) => setForm(prev => ({ ...prev, [key]: value }));
  const n = (key: keyof typeof form) => Number(form[key]);

  async function verify() {
    if (!report || !user) return;
    const values = {
      score: n("score"),
      totalMarks: n("totalMarks"),
      correct: n("correct"),
      wrong: n("wrong"),
      skipped: n("skipped"),
      accuracy: n("accuracy"),
      timeMinutes: n("timeMinutes"),
      negativeMarks: n("negativeMarks"),
    };
    const required = [values.score, values.totalMarks, values.correct, values.wrong, values.skipped, values.accuracy, values.timeMinutes, values.negativeMarks];
    if (required.some(v => !Number.isFinite(v))) {
      toast.error("Verified attempt data is incomplete.");
      return;
    }
    if (values.totalMarks <= 0 || values.score < 0 || values.correct < 0 || values.wrong < 0 || values.skipped < 0 || values.accuracy < 0 || values.accuracy > 100 || values.timeMinutes < 0 || values.negativeMarks < 0) {
      toast.error("Verified attempt data is incomplete.");
      return;
    }
    const attempted = values.correct + values.wrong;
    const expectedAccuracy = attempted > 0 ? Number(((values.correct / attempted) * 100).toFixed(2)) : 0;
    if (Math.abs(expectedAccuracy - values.accuracy) > 0.51) {
      toast.error(`Accuracy mismatch. For ${values.correct} correct and ${values.wrong} wrong, accuracy should be ${expectedAccuracy}%.`);
      return;
    }

    setSaving(true);
    try {
      const { error } = await (supabase as any).rpc("verify_ai_mock_report_data", {
        _report_id: report.id,
        _score: values.score,
        _total_marks: values.totalMarks,
        _correct: Math.round(values.correct),
        _wrong: Math.round(values.wrong),
        _skipped: Math.round(values.skipped),
        _accuracy: values.accuracy,
        _time_taken_seconds: Math.round(values.timeMinutes * 60),
        _submitted_at: report.created_at,
        _negative_marks: values.negativeMarks,
        _attempt_id: report.attempt_id ?? null,
        _source_test_id: report.source_test_id ?? null,
      });
      if (error) throw error;
      await (supabase as any).from("ai_mock_reports").update({
        accuracy: values.accuracy,
        overall_score: values.score,
      }).eq("id", report.id).eq("user_id", user.id);
      toast.success("Verified attempt data locked");
      await onVerified(report.id);
    } catch (e: any) {
      toast.error(friendly(e.message) || "Verification failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Verify Actual Attempt Data</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            AI analysis will use only these locked values for Score, Accuracy, Correct, Wrong and Skipped.
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Score" value={form.score} onChange={v => set("score", v)} />
            <Field label="Total Marks" value={form.totalMarks} onChange={v => set("totalMarks", v)} />
            <Field label="Correct" value={form.correct} onChange={v => set("correct", v)} />
            <Field label="Wrong" value={form.wrong} onChange={v => set("wrong", v)} />
            <Field label="Skipped" value={form.skipped} onChange={v => set("skipped", v)} />
            <Field label="Accuracy %" value={form.accuracy} onChange={v => set("accuracy", v)} />
            <Field label="Time Minutes" value={form.timeMinutes} onChange={v => set("timeMinutes", v)} />
            <Field label="Negative Marks" value={form.negativeMarks} onChange={v => set("negativeMarks", v)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button onClick={verify} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Locking...</> : <><CheckCircle2 className="mr-2 h-4 w-4" />Verify & Analyze</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type="number" inputMode="decimal" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <Card className="border-dashed bg-card/40 backdrop-blur">
      <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
        <div className="relative">
          <div className="absolute inset-0 animate-pulse rounded-full bg-primary/20 blur-2xl" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-xl">
            <Brain className="h-10 w-10" />
          </div>
        </div>
        <div>
          <p className="text-lg font-semibold">{hasAny ? "No matching reports" : "No reports yet"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasAny ? "Try changing your filters." : "Upload your first mock to begin AI Analysis."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Existing detailed report view (unchanged rendering) ---------- */
function ReportView({ r, onAnalyze, analyzing }: { r: Report; onAnalyze: () => void; analyzing: boolean }) {
  const d = r.report ?? {};
  if (!isVerifiedReport(r) || !hasValidReport(r.report)) {
    return (
      <div className="space-y-3">
        <DialogHeader><DialogTitle>{r.title}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          {r.analysis_status !== "verified" ? "Analysis unavailable because verified attempt data is incomplete." : r.status === "completed" ? "AI analysis returned empty values and was blocked from display. Please reanalyze." : "This report has not been analyzed yet."}
        </p>
        {(r.verification_error || r.error) && <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">{r.verification_error || r.error}</p>}
        <Button onClick={onAnalyze} disabled={analyzing || !hasVerifiedAttemptData(r)}>
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
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{d.exam_name ?? r.exam_name ?? "External Mock"}</span>
          <span>·</span>
          <span>Uploaded {new Date(r.created_at).toLocaleString()}</span>
          <span>·</span>
          <span>{r.file_paths?.length ?? 0} files</span>
          <span>·</span>
          <Badge variant="outline" className="text-[10px]">OCR ✓</Badge>
          <Badge variant="outline" className="text-[10px]">Verified Data ✓</Badge>
          <Badge variant="outline" className="text-[10px]">AI ✓</Badge>
        </div>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <BigStat label="Accuracy" value={`${d.accuracy ?? 0}%`} icon={<Target />} />
        <BigStat label="Score" value={`${totals.score ?? "-"}${totals.max_score ? ` / ${totals.max_score}` : ""}`} icon={<Award />} />
        <BigStat label="Readiness" value={`${d.readiness_score ?? 0}%`} icon={<TrendingUp />} />
        <BigStat label="Time" value={totals.time_minutes ? `${totals.time_minutes}m` : "-"} icon={<Clock />} />
      </div>

      {d.overall_performance && (
        <Section title="🎯 Overall Performance">
          <p className="whitespace-pre-wrap text-sm">{d.overall_performance}</p>
        </Section>
      )}

      {d.performance_summary && (
        <Section title="📋 Performance Summary">
          <p className="whitespace-pre-wrap text-sm">{d.performance_summary}</p>
        </Section>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {d.biggest_strength && (
          <Section title="💪 Biggest Strength"><p className="text-sm">{d.biggest_strength}</p></Section>
        )}
        {d.biggest_weakness && (
          <Section title="⚠️ Biggest Weakness"><p className="text-sm">{d.biggest_weakness}</p></Section>
        )}
        {d.positive_points?.length > 0 && (
          <Section title="✅ Positive Points"><Bullets items={d.positive_points} tone="green" /></Section>
        )}
        {d.negative_points?.length > 0 && (
          <Section title="❌ Negative Points"><Bullets items={d.negative_points} tone="red" /></Section>
        )}
      </div>

      {d.lost_marks_analysis && (
        <Section title="📉 Lost Marks Analysis">
          <p className="whitespace-pre-wrap text-sm">{d.lost_marks_analysis}</p>
        </Section>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {d.improvement_areas?.length > 0 && (
          <Section title="🚀 Improvement Areas"><Bullets items={d.improvement_areas} /></Section>
        )}
        {d.priority_chapters?.length > 0 && (
          <Section title="📚 Priority Chapters"><Chips items={d.priority_chapters} tone="red" /></Section>
        )}
        {d.priority_topics?.length > 0 && (
          <Section title="🎯 Priority Topics"><Chips items={d.priority_topics} tone="red" /></Section>
        )}
        {d.immediate_revision_topics?.length > 0 && (
          <Section title="⏱️ Immediate Revision"><Chips items={d.immediate_revision_topics} tone="red" /></Section>
        )}
      </div>

      {d.question_level && (
        <Section title="🧮 Question Level Analysis">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Easy Lost", d.question_level.easy_lost],
              ["Medium Lost", d.question_level.medium_lost],
              ["Hard Lost", d.question_level.hard_lost],
              ["Skipped", d.question_level.skipped],
              ["Guessed", d.question_level.guessed],
              ["Wrong", d.question_level.wrong],
              ["Correct", d.question_level.correct],
            ].map(([label, val]) => (
              <div key={label as string} className="rounded-lg border p-2 text-center">
                <p className="text-lg font-bold">{val ?? 0}</p>
                <p className="text-[11px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {d.subject_analysis?.length > 0 && (
        <Section title="📚 Subject Analysis">
          <div className="space-y-2">
            {d.subject_analysis.map((s: any, i: number) => (
              <div key={i} className="rounded-lg border p-2 text-sm">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="font-semibold">{s.subject}</p>
                  <div className="flex gap-1">
                    <Badge variant="outline" className="text-[10px]">Accuracy {s.accuracy ?? 0}%</Badge>
                    <Badge variant="outline" className={`text-[10px] ${priorityBadge(s.revision_priority)}`}>{s.revision_priority}</Badge>
                    <Badge variant="outline" className="text-[10px] capitalize">Conf: {s.confidence_level}</Badge>
                  </div>
                </div>
                <p className="text-xs"><span className="font-medium">Strength:</span> {s.strength}</p>
                <p className="text-xs"><span className="font-medium">Weakness:</span> {s.weakness}</p>
                <p className="text-xs text-muted-foreground"><span className="font-medium">Expected Improvement:</span> {s.expected_improvement}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {d.chapter_analysis?.length > 0 && (
        <Section title="📖 Chapter Analysis">
          <div className="space-y-2">
            {d.chapter_analysis.map((c: any, i: number) => (
              <div key={i} className="rounded-lg border p-2 text-sm">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
                  <p className="font-semibold">{c.chapter}{c.subject ? ` · ${c.subject}` : ""}</p>
                  <div className="flex gap-1">
                    <Badge variant="outline" className="text-[10px]">Acc {c.accuracy ?? 0}%</Badge>
                    <Badge variant="outline" className="text-[10px]">{c.attempted ?? 0} att · {c.wrong ?? 0} wrong</Badge>
                    <Badge variant="outline" className={`text-[10px] ${priorityBadge(c.priority)}`}>{c.priority}</Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{c.ai_advice}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        {d.strong_topics?.length > 0 && (
          <Section title="🟢 Strong Topics"><Chips items={d.strong_topics} tone="green" /></Section>
        )}
        {d.weak_topics?.length > 0 && (
          <Section title="🟠 Weak Topics"><Chips items={d.weak_topics} /></Section>
        )}
        {d.critical_topics?.length > 0 && (
          <Section title="🔴 Critical Topics"><Chips items={d.critical_topics} tone="red" /></Section>
        )}
      </div>

      {d.ai_coach && (
        <Section title="👨‍🏫 AI Coach">
          <div className="space-y-2 text-sm">
            {d.ai_coach.why_marks_lost && <p><span className="font-semibold">Why Marks Lost:</span> {d.ai_coach.why_marks_lost}</p>}
            {d.ai_coach.study_today && <p><span className="font-semibold">Study Today:</span> {d.ai_coach.study_today}</p>}
            {d.ai_coach.can_wait && <p><span className="font-semibold">Can Wait:</span> {d.ai_coach.can_wait}</p>}
            {d.ai_coach.revise_tomorrow && <p><span className="font-semibold">Revise Tomorrow:</span> {d.ai_coach.revise_tomorrow}</p>}
            {d.ai_coach.biggest_opportunity && <p><span className="font-semibold">Biggest Opportunity:</span> {d.ai_coach.biggest_opportunity}</p>}
            {d.ai_coach.common_mistakes && <p><span className="font-semibold">Common Mistakes:</span> {d.ai_coach.common_mistakes}</p>}
            {d.ai_coach.how_to_score_more_next_mock && <p><span className="font-semibold">Next Mock Strategy:</span> {d.ai_coach.how_to_score_more_next_mock}</p>}
          </div>
        </Section>
      )}

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
                {(p.chapters?.length || p.topics?.length) ? (
                  <p className="text-[11px] text-muted-foreground">
                    {p.chapters?.length ? <><span className="font-medium">Chapters:</span> {p.chapters.join(", ")} · </> : null}
                    {p.topics?.length ? <><span className="font-medium">Topics:</span> {p.topics.join(", ")}</> : null}
                  </p>
                ) : null}
                {(p.practice_questions != null || p.revision_minutes != null || p.mock_recommendation) && (
                  <p className="text-[11px] text-muted-foreground">
                    {p.practice_questions != null && <>{p.practice_questions} Practice Q · </>}
                    {p.revision_minutes != null && <>{p.revision_minutes} min Revision · </>}
                    {p.mock_recommendation && <>Mock: {p.mock_recommendation}</>}
                  </p>
                )}
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
                {(p.chapters?.length || p.topics?.length) ? (
                  <p className="text-[11px] text-muted-foreground">
                    {p.chapters?.length ? <><span className="font-medium">Chapters:</span> {p.chapters.join(", ")} · </> : null}
                    {p.topics?.length ? <><span className="font-medium">Topics:</span> {p.topics.join(", ")}</> : null}
                  </p>
                ) : null}
                <ul className="ml-4 list-disc text-xs text-muted-foreground">{(p.tasks ?? []).map((t: string, i: number) => <li key={i}>{t}</li>)}</ul>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {(d.revision_advice || d.time_management_advice) && (
        <div className="grid gap-3 md:grid-cols-2">
          {d.revision_advice && (
            <Section title="🔁 Revision Advice"><p className="text-sm">{d.revision_advice}</p></Section>
          )}
          {d.time_management_advice && (
            <Section title="⏱️ Time Management Advice"><p className="text-sm">{d.time_management_advice}</p></Section>
          )}
        </div>
      )}

      {d.mistake_reasons?.length > 0 && (
        <Section title="🔍 Why These Mistakes Happened">
          <div className="space-y-1">
            {d.mistake_reasons.map((m: any, i: number) => (
              <div key={i} className="rounded-md border p-2 text-sm">
                <p className="text-xs font-semibold capitalize">{(m.category ?? "").replace(/_/g, " ")}</p>
                <p className="text-xs text-muted-foreground">{m.why}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="⏳ Time & Difficulty">
        <p className="text-sm"><span className="font-semibold">Speed:</span> {d.speed_analysis ?? "-"}</p>
        <p className="text-sm"><span className="font-semibold">Time Pressure:</span> {d.time_pressure ?? "-"}</p>
        <p className="text-sm"><span className="font-semibold">Difficulty:</span> {d.difficulty_analysis ?? "-"}</p>
      </Section>

      {(d.readiness_reason || d.readiness_to_90) && (
        <Section title="📈 Readiness Explanation">
          {d.readiness_reason && <p className="text-sm"><span className="font-semibold">Why {d.readiness_score ?? 0}%:</span> {d.readiness_reason}</p>}
          {d.readiness_to_90 && <p className="mt-1 text-sm"><span className="font-semibold">Path to 90%:</span> {d.readiness_to_90}</p>}
        </Section>
      )}

      {d.motivational_feedback && (
        <Section title="🌟 Motivation">
          <p className="whitespace-pre-wrap text-sm">{d.motivational_feedback}</p>
        </Section>
      )}
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
function Bullets({ items, tone }: { items?: string[]; tone?: "green" | "red" }) {
  if (!items?.length) return <p className="text-xs text-muted-foreground">None</p>;
  const dot = tone === "green" ? "bg-emerald-500" : tone === "red" ? "bg-red-500" : "bg-primary";
  return (
    <ul className="space-y-1 text-sm">
      {items.map((x, i) => (
        <li key={i} className="flex gap-2"><span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />{x}</li>
      ))}
    </ul>
  );
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
