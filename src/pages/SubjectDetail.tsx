import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getSignedUrl } from "@/lib/storage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  FileText, ClipboardList, Download, Eye, ArrowLeft, BookOpen, Search, BarChart3,
  Pin, PinOff, ChevronDown, RotateCw, Trophy, Sparkles, Clock, Play, CheckCircle2, Circle,
  TrendingUp, BookMarked,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { TestTracker, attemptStats, type Attempt } from "@/components/TestTracker";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Chapter = { id: string; name: string; name_hi?: string | null };

const PIN_KEY = (uid: string, sid: string) => `ajit360_pins_${uid}_${sid}`;

export default function SubjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [subject, setSubject] = useState<any>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [pdfs, setPdfs] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [performance, setPerformance] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [wrongQs, setWrongQs] = useState<any[]>([]);
  const [chapterViews, setChapterViews] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [pins, setPins] = useState<Set<string>>(new Set());

  const loadAttempts = async () => {
    if (!user) return;
    const { data } = await supabase.from("test_attempts").select("*").eq("user_id", user.id);
    setAttempts((data as any) ?? []);
  };

  useEffect(() => {
    if (!user || !id) return;
    try {
      const raw = localStorage.getItem(PIN_KEY(user.id, id));
      if (raw) setPins(new Set(JSON.parse(raw)));
    } catch {}
  }, [user, id]);

  useEffect(() => {
    (async () => {
      const [s, c, p, t, perf, wq, cv] = await Promise.all([
        supabase.from("subjects").select("*").eq("id", id).maybeSingle(),
        supabase.from("chapters").select("*").eq("subject_id", id).order("sort_order"),
        supabase.from("pdfs").select("*").eq("subject_id", id).order("created_at", { ascending: false }),
        supabase.from("tests").select("*").eq("subject_id", id).order("created_at", { ascending: false }),
        supabase.from("performance").select("*").eq("subject_id", id).order("created_at"),
        user ? supabase.from("wrong_questions").select("id,chapter_id,status").eq("user_id", user.id).eq("subject_id", id) : Promise.resolve({ data: [] } as any),
        user ? supabase.from("chapter_views").select("chapter_id,viewed_at").eq("user_id", user.id) : Promise.resolve({ data: [] } as any),
      ]);
      setSubject(s.data);
      setChapters(c.data ?? []);
      setPdfs(p.data ?? []);
      setTests(t.data ?? []);
      setPerformance(perf.data ?? []);
      setWrongQs((wq as any).data ?? []);
      setChapterViews((cv as any).data ?? []);
      await loadAttempts();
    })();
  }, [id, user]);

  const togglePin = (cid: string) => {
    if (!user || !id) return;
    const next = new Set(pins);
    next.has(cid) ? next.delete(cid) : next.add(cid);
    setPins(next);
    localStorage.setItem(PIN_KEY(user.id, id), JSON.stringify([...next]));
  };

  const recordView = async (chapterId: string) => {
    if (!user || !chapterId) return;
    await supabase.from("chapter_views").upsert(
      { user_id: user.id, chapter_id: chapterId, viewed_at: new Date().toISOString() },
      { onConflict: "user_id,chapter_id" }
    );
  };

  const openPdf = async (path: string) => {
    const url = await getSignedUrl(path);
    if (url) window.open(url, "_blank");
    else toast.error("Could not open file");
  };

  const downloadPdf = async (path: string, title: string) => {
    const url = await getSignedUrl(path);
    if (!url) return toast.error("Could not download file");
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${title}.${path.split(".").pop()}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, "_blank");
    }
  };

  const chapterPdfs = (chId: string) => pdfs.filter((p) => p.chapter_id === chId);
  const chapterTests = (chId: string) => tests.filter((t) => t.chapter_id === chId);
  const chapterPerformance = (chId: string) => performance.filter((p) => p.chapter_id === chId);
  const generalPdfs = pdfs.filter((p) => !p.chapter_id);
  const generalTests = tests.filter((t) => !t.chapter_id);

  const filtered = chapters.filter((c) =>
    [c.name, c.name_hi].some((f) => f?.toLowerCase().includes(q.toLowerCase()))
  );
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const ap = pins.has(a.id) ? 0 : 1;
      const bp = pins.has(b.id) ? 0 : 1;
      return ap - bp;
    });
  }, [filtered, pins]);

  // Subject-level aggregates
  const subjectStats = useMemo(() => {
    const subjectTestIds = new Set(tests.map((t) => t.id));
    const myAtt = attempts.filter((a) => subjectTestIds.has(a.test_id));
    const scored = myAtt.filter((a) => (a.marks_obtained ?? null) !== null || (a.correct_count ?? 0) > 0);
    const best = scored.reduce((m, a) => Math.max(m, Number(a.marks_obtained ?? a.correct_count ?? 0)), 0);
    const accArr = scored.map((a) => Number((a as any).accuracy ?? 0)).filter((n) => n > 0);
    const avgAcc = accArr.length ? Math.round(accArr.reduce((s, n) => s + n, 0) / accArr.length) : 0;
    const lastAtt = scored.sort((a: any, b: any) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""))[0];
    const completedTestIds = new Set(scored.map((a) => a.test_id));
    const totalTests = tests.length || 1;
    const progress = Math.min(100, Math.round((completedTestIds.size / totalTests) * 100));
    return {
      totalChapters: chapters.length,
      totalPdfs: pdfs.length,
      totalTests: tests.length,
      progress,
      avgAcc,
      best,
      lastStudied: lastAtt ? (lastAtt as any).updated_at || (lastAtt as any).created_at : null,
    };
  }, [tests, attempts, chapters, pdfs]);

  if (!subject) return null;

  return (
    <div className="space-y-4 pb-8">
      <Button asChild variant="ghost" size="sm">
        <Link to="/subjects"><ArrowLeft className="mr-1 h-4 w-4" /> Subjects</Link>
      </Button>

      {/* Compact premium header */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-primary/30 via-primary/10 to-accent/20 p-4 shadow-lg backdrop-blur-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/.25),transparent_60%)] pointer-events-none" />
        <div className="relative">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white/10 p-2 backdrop-blur"><BookOpen className="h-6 w-6" /></div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-bold leading-tight">{subject.name}</h1>
              {subject.name_hi && <p className="truncate text-xs text-muted-foreground">{subject.name_hi}</p>}
            </div>
            <ProgressRing value={subjectStats.progress} size={54} />
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            <Stat label="Chapters" value={subjectStats.totalChapters} />
            <Stat label="PDFs" value={subjectStats.totalPdfs} />
            <Stat label="Tests" value={subjectStats.totalTests} />
            <Stat label="Accuracy" value={`${subjectStats.avgAcc}%`} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {subjectStats.best > 0 && <span className="inline-flex items-center gap-1"><Trophy className="h-3 w-3 text-amber-400" /> Best {subjectStats.best}</span>}
            {subjectStats.lastStudied && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> Last {relativeTime(subjectStats.lastStudied)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="rounded-xl border-white/10 bg-white/5 pl-9 backdrop-blur"
          placeholder="Search chapter... / अध्याय खोजें"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* Learning Journey */}
      {sorted.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No chapters found.</p>
      ) : (
        <div className="space-y-3">
          {sorted.map((ch) => (
            <ChapterCard
              key={ch.id}
              chapter={ch}
              pdfs={chapterPdfs(ch.id)}
              tests={chapterTests(ch.id)}
              perf={chapterPerformance(ch.id)}
              attempts={attempts}
              wrongQs={wrongQs.filter((w) => w.chapter_id === ch.id)}
              viewed={chapterViews.some((v) => v.chapter_id === ch.id)}
              subjectId={id!}
              pinned={pins.has(ch.id)}
              expanded={!!expanded[ch.id]}
              onTogglePin={() => togglePin(ch.id)}
              onToggleExpand={() => {
                setExpanded((s) => ({ ...s, [ch.id]: !s[ch.id] }));
                if (!expanded[ch.id]) recordView(ch.id);
              }}
              openPdf={openPdf}
              downloadPdf={downloadPdf}
              onAttemptSaved={loadAttempts}
            />
          ))}
        </div>
      )}

      {(generalPdfs.length > 0 || generalTests.length > 0) && (
        <Card className="border-white/10 bg-white/5 backdrop-blur">
          <CardHeader><CardTitle className="text-base">General Material</CardTitle></CardHeader>
          <CardContent>
            <MaterialList pdfs={generalPdfs} tests={generalTests} onOpen={openPdf} onDownload={downloadPdf} attempts={attempts} onAttemptSaved={loadAttempts} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-lg bg-white/5 px-1 py-1.5 backdrop-blur">
      <p className="text-sm font-bold leading-none">{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function ProgressRing({ value, size = 48, stroke = 5 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-white/10" />
      <circle
        cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke}
        className="fill-none stroke-primary transition-all duration-700"
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="rotate-90 fill-foreground text-[10px] font-bold" transform={`rotate(90 ${size / 2} ${size / 2})`}>
        {value}%
      </text>
    </svg>
  );
}

function ChapterCard({
  chapter, pdfs, tests, perf, attempts, wrongQs, viewed, subjectId,
  pinned, expanded, onTogglePin, onToggleExpand, openPdf, downloadPdf, onAttemptSaved,
}: {
  chapter: Chapter; pdfs: any[]; tests: any[]; perf: any[]; attempts: Attempt[]; wrongQs: any[];
  viewed: boolean; subjectId: string; pinned: boolean; expanded: boolean;
  onTogglePin: () => void; onToggleExpand: () => void;
  openPdf: (p: string) => void; downloadPdf: (p: string, t: string) => void; onAttemptSaved: () => void;
}) {
  const testIds = new Set(tests.map((t) => t.id));
  const myAtt = attempts.filter((a) => testIds.has(a.test_id));
  const scored = myAtt.filter((a) => (a.marks_obtained ?? null) !== null || (a.correct_count ?? 0) > 0);
  const completedIds = new Set(scored.map((a) => a.test_id));
  const inProgress = myAtt.find((a: any) => (a.status === "in_progress") && (a.current_index ?? 0) > 0 && !completedIds.has(a.test_id));

  const bestScore = scored.reduce((m, a) => Math.max(m, Number(a.marks_obtained ?? a.correct_count ?? 0)), 0);
  const lastAtt: any = scored.sort((a: any, b: any) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""))[0];
  const lastScore = lastAtt ? Number(lastAtt.marks_obtained ?? lastAtt.correct_count ?? 0) : null;
  const accArr = scored.map((a) => Number((a as any).accuracy ?? 0)).filter((n) => n > 0);
  const avgAcc = accArr.length ? Math.round(accArr.reduce((s, n) => s + n, 0) / accArr.length) : 0;
  const bestAcc = accArr.length ? Math.max(...accArr) : 0;

  const totalTests = tests.length;
  const progressPct = totalTests
    ? Math.round((completedIds.size / totalTests) * 100)
    : (viewed ? 30 : 0);
  const mastery = avgAcc;

  const pendingRevision = wrongQs.filter((w) => w.status === "pending").length;
  const remainingTests = Math.max(0, totalTests - completedIds.size);
  const avgDuration = tests.reduce((s, t) => s + (t.duration_minutes || 15), 0) / (totalTests || 1);
  const remainingMin = Math.round(remainingTests * avgDuration);

  // Status
  let status: "mastered" | "in_progress" | "revision_due" | "not_started" = "not_started";
  if (mastery >= 85 && totalTests > 0 && completedIds.size === totalTests) status = "mastered";
  else if (pendingRevision >= 5) status = "revision_due";
  else if (myAtt.length > 0 || viewed) status = "in_progress";

  const statusMeta = {
    mastered: { label: "Mastered", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", dot: "🟢" },
    in_progress: { label: "In Progress", cls: "bg-amber-500/20 text-amber-300 border-amber-500/30", dot: "🟡" },
    revision_due: { label: "Revision Due", cls: "bg-blue-500/20 text-blue-300 border-blue-500/30", dot: "🔵" },
    not_started: { label: "Not Started", cls: "bg-white/10 text-muted-foreground border-white/10", dot: "⚪" },
  }[status];

  // AI recommendation (rule based, chapter-specific)
  const recommendation = (() => {
    if (status === "mastered") return `Mastery ${mastery}% — revise once every 2 weeks to keep it locked.`;
    if (pendingRevision > 0) return `${pendingRevision} question${pendingRevision > 1 ? "s" : ""} pending in Smart Revision — clear before attempting a new test.`;
    if (lastAtt && avgAcc < 60) return `Accuracy is ${avgAcc}% — re-read the PDF and re-attempt "${trimName(tests.find(t=>t.id===lastAtt.test_id)?.title)}".`;
    if (completedIds.size > 0 && completedIds.size < totalTests) return `${completedIds.size}/${totalTests} tests done — attempt the next test today to keep momentum.`;
    if (viewed && myAtt.length === 0 && totalTests > 0) return `You've read the material — attempt the first practice test now.`;
    if (totalTests > 0) return `Start with the PDF, then attempt "${trimName(tests[tests.length - 1]?.title)}".`;
    return `Read the PDFs and revisit weekly.`;
  })();

  // Flow steps done
  const steps = [
    { icon: "📖", label: "Read", done: viewed || pdfs.length === 0 },
    { icon: "📝", label: "Practice", done: myAtt.length > 0 },
    { icon: "🔄", label: "Revise", done: pendingRevision === 0 && myAtt.length > 0 },
    { icon: "📊", label: "Analyze", done: scored.length > 0 },
    { icon: "🏆", label: "Master", done: status === "mastered" },
  ];

  return (
    <div className={cn(
      "group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl transition-all",
      "animate-fade-in shadow-lg hover:border-primary/30",
      pinned && "ring-1 ring-primary/40"
    )}>
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        <ProgressRing value={progressPct} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{chapter.name}</h3>
            <Badge variant="outline" className={cn("h-5 shrink-0 gap-1 border px-1.5 text-[10px]", statusMeta.cls)}>
              <span>{statusMeta.dot}</span>{statusMeta.label}
            </Badge>
          </div>
          {chapter.name_hi && <p className="truncate text-[11px] text-muted-foreground">{chapter.name_hi}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" /> {pdfs.length}</span>
            <span className="inline-flex items-center gap-1"><ClipboardList className="h-3 w-3" /> {tests.length}</span>
            {bestScore > 0 && <span className="inline-flex items-center gap-1 text-amber-300"><Trophy className="h-3 w-3" /> {bestScore}</span>}
            {lastAtt && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {relativeTime(lastAtt.updated_at || lastAtt.created_at)}</span>}
            {remainingMin > 0 && <span className="inline-flex items-center gap-1">⏱ ~{remainingMin}m</span>}
          </div>
        </div>
        <button onClick={onTogglePin} className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-white/10 hover:text-primary" aria-label="Pin chapter">
          {pinned ? <Pin className="h-4 w-4 fill-primary text-primary" /> : <PinOff className="h-4 w-4" />}
        </button>
      </div>

      {/* Learning flow */}
      <div className="px-4">
        <div className="flex items-center justify-between gap-1 rounded-xl bg-white/5 p-2">
          {steps.map((s, i) => (
            <div key={i} className="flex flex-1 items-center">
              <div className={cn(
                "flex flex-col items-center gap-0.5 text-[9px] font-medium transition",
                s.done ? "text-emerald-300" : "text-muted-foreground/60"
              )}>
                <div className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[11px]",
                  s.done ? "bg-emerald-500/20" : "bg-white/5"
                )}>{s.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span>{s.icon}</span>}</div>
                <span>{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={cn("mx-0.5 h-px flex-1", s.done && steps[i + 1].done ? "bg-emerald-400/40" : "bg-white/10")} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Continue learning */}
      {inProgress && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 p-2.5">
          <Play className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-primary">Continue Learning</p>
            <p className="truncate text-[10px] text-muted-foreground">
              {trimName(tests.find((t) => t.id === inProgress.test_id)?.title)} · Q{(inProgress as any).current_index + 1}
            </p>
          </div>
          <Button size="sm" className="h-7 px-2 text-[11px]" asChild>
            <Link to={`/test/${inProgress.test_id}`}>Resume</Link>
          </Button>
        </div>
      )}

      {/* Badges row */}
      <div className="flex flex-wrap gap-1.5 px-4 pt-3">
        {pendingRevision > 0 && (
          <Badge variant="outline" className="h-5 border-blue-500/30 bg-blue-500/10 text-[10px] text-blue-300">
            <RotateCw className="mr-1 h-2.5 w-2.5" /> {pendingRevision} Pending
          </Badge>
        )}
        {mastery >= 90 && (
          <Badge variant="outline" className="h-5 border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-300">
            <Trophy className="mr-1 h-2.5 w-2.5" /> Mastered
          </Badge>
        )}
        {avgAcc > 0 && avgAcc < 60 && (
          <Badge variant="outline" className="h-5 border-rose-500/30 bg-rose-500/10 text-[10px] text-rose-300">
            <TrendingUp className="mr-1 h-2.5 w-2.5" /> Retake
          </Badge>
        )}
      </div>

      {/* AI recommendation */}
      <div className="mx-4 mt-3 flex items-start gap-2 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 to-transparent p-2.5">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <p className="text-[11px] leading-snug text-foreground/90">{recommendation}</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-1.5 p-4 pt-3">
        <QuickAction icon={<BookMarked className="h-3.5 w-3.5" />} label="Read" onClick={onToggleExpand} disabled={pdfs.length === 0} />
        <QuickAction icon={<ClipboardList className="h-3.5 w-3.5" />} label="Practice" onClick={onToggleExpand} disabled={tests.length === 0} />
        <QuickAction icon={<RotateCw className="h-3.5 w-3.5" />} label="Revise" asLink={`/smart-revision/subject/${subjectId}/chapter/${chapter.id}`} />
        <QuickAction icon={<BarChart3 className="h-3.5 w-3.5" />} label="Analyze" asLink="/ai-performance-center" />
      </div>

      {/* Expand toggle */}
      <button
        onClick={onToggleExpand}
        className="flex w-full items-center justify-center gap-1 border-t border-white/5 py-2 text-[11px] text-muted-foreground hover:bg-white/5 hover:text-foreground"
      >
        {expanded ? "Hide details" : "View details"}
        <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="space-y-3 border-t border-white/5 bg-black/20 p-4 animate-fade-in">
          <div className="grid grid-cols-3 gap-2 text-center">
            <MiniStat label="Best" value={bestScore || "—"} />
            <MiniStat label="Last" value={lastScore ?? "—"} />
            <MiniStat label="Attempts" value={myAtt.length} />
            <MiniStat label="Avg Acc" value={`${avgAcc}%`} />
            <MiniStat label="Top Acc" value={`${bestAcc}%`} />
            <MiniStat label="Pending" value={pendingRevision} />
          </div>

          {perf.length > 0 && (
            <div className="rounded-lg bg-white/5 p-2.5">
              <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <BarChart3 className="h-3 w-3" /> Performance
              </p>
              <PerformanceList items={perf} />
            </div>
          )}

          <MaterialList pdfs={pdfs} tests={tests} onOpen={openPdf} onDownload={downloadPdf} attempts={attempts} onAttemptSaved={onAttemptSaved} />
        </div>
      )}
    </div>
  );
}

function QuickAction({ icon, label, onClick, asLink, disabled }: {
  icon: React.ReactNode; label: string; onClick?: () => void; asLink?: string; disabled?: boolean;
}) {
  const cls = "flex flex-col items-center gap-0.5 rounded-lg border border-white/10 bg-white/5 py-1.5 text-[10px] font-medium transition hover:border-primary/40 hover:bg-primary/10 disabled:opacity-40";
  if (asLink && !disabled) return <Link to={asLink} className={cls}>{icon}{label}</Link>;
  return <button className={cls} onClick={onClick} disabled={disabled}>{icon}{label}</button>;
}

function MiniStat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-lg bg-white/5 py-1.5">
      <p className="text-xs font-bold leading-none">{value}</p>
      <p className="mt-1 text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function relativeTime(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  const w = Math.floor(days / 7);
  if (w < 5) return `${w}w ago`;
  return new Date(iso).toLocaleDateString();
}

function trimName(s?: string | null) {
  if (!s) return "the next test";
  return s.length > 32 ? s.slice(0, 30) + "…" : s;
}

function MaterialList({ pdfs, tests, onOpen, onDownload, attempts, onAttemptSaved }: {
  pdfs: any[]; tests: any[]; onOpen: (p: string) => void; onDownload: (p: string, title: string) => void;
  attempts: Attempt[]; onAttemptSaved: () => void;
}) {
  if (pdfs.length === 0 && tests.length === 0)
    return <p className="text-sm text-muted-foreground">No material for this section yet.</p>;
  return (
    <div className="space-y-2">
      {pdfs.length > 0 && (
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Available PDFs</p>
      )}
      {pdfs.map((p) => (
        <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 p-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 shrink-0 text-secondary" />
            <span className="truncate text-sm font-medium">{p.title}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-7" onClick={() => onOpen(p.file_path)}><Eye className="mr-1 h-3 w-3" /> View</Button>
            <Button size="sm" variant="outline" className="h-7" onClick={() => onDownload(p.file_path, p.title)}><Download className="mr-1 h-3 w-3" /> Save</Button>
          </div>
        </div>
      ))}
      {tests.filter((t) => t.test_link).length > 0 && (
        <p className="pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Test Parts</p>
      )}
      {tests.filter((t) => t.test_link).map((t) => {
        const mine = attempts.filter((a) => a.test_id === t.id);
        const s = attemptStats(mine);
        return (
          <div key={t.id} className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <ClipboardList className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate text-sm font-medium">{t.title}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Last: {s.last ?? "—"} · Best: {s.best ?? "—"} · Attempts: {s.count}
            </p>
            <TestTracker
              test={{ id: t.id, title: t.title, test_link: t.test_link, subject_id: t.subject_id, chapter_id: t.chapter_id }}
              attempts={mine}
              onSaved={onAttemptSaved}
              triggerClassName="w-full"
            />
          </div>
        );
      })}

      {tests.filter((t) => !t.test_link && t.total_questions).length > 0 && (
        <p className="pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Online Tests</p>
      )}
      {tests.filter((t) => !t.test_link && t.total_questions).map((t) => {
        const mine = attempts.filter((a) => a.test_id === t.id);
        const s = attemptStats(mine);
        return (
          <div key={t.id} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <ClipboardList className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate text-sm font-medium">{t.title}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {t.total_questions} Q · {t.total_marks ?? t.total_questions} M · {t.duration_minutes}m
              {s.count > 0 && <> · Last {s.last} · Best {s.best}</>}
            </p>
            <Button size="sm" className="mt-2 h-7 w-full" asChild><Link to={`/test/${t.id}`}>{s.count > 0 ? "Retake" : "Start"} Test</Link></Button>
          </div>
        );
      })}
    </div>
  );
}

function PerformanceList({ items }: { items: any[] }) {
  return (
    <div className="space-y-2">
      {items.map((p) => (
        <PerformanceItem key={p.id} item={p} />
      ))}
    </div>
  );
}

function PerformanceItem({ item }: { item: any }) {
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (item.image_path) getSignedUrl(item.image_path).then(setUrl);
  }, [item.image_path]);

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
      {item.title && <p className="mb-1 text-sm font-semibold">{item.title}</p>}
      {item.text_content && (
        <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground">{item.text_content}</pre>
      )}
      {url && (
        <button type="button" onClick={() => setOpen(true)} className="mt-2 block w-full">
          <img src={url} alt={item.title || "Performance result"} className="w-full rounded-md border transition hover:opacity-90" loading="lazy" />
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] border-0 bg-transparent p-0 shadow-none sm:max-w-4xl">
          {url && <img src={url} alt={item.title || "Performance result"} className="max-h-[90vh] w-full rounded-md object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
