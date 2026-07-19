import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TestEngine, type EngineQuestion, type EngineTest } from "@/components/TestEngine";
import { recordRevisionAttempt } from "@/lib/revisionEngine";
import {
  ArrowLeft, Brain, Layers, ListChecks, Zap, GraduationCap,
  CheckCircle2, XCircle, ChevronRight, Sparkles, BookMarked,
} from "lucide-react";

/**
 * 🔁 Mock Auto Test — plays back wrong/skipped questions extracted from an
 * uploaded Mock PDF (ai_mock_reports).
 *
 * Hybrid modes:
 *  - MCQ Engine → questions where AI extracted all 4 options + correct letter
 *  - Flashcards → questions missing options / correct letter (recall style)
 */

type Row = {
  id: string;
  q_no: number | null;
  question_text: string;
  option_a: string | null; option_b: string | null;
  option_c: string | null; option_d: string | null;
  correct_option: string | null;
  marked_option: string | null;
  original_status: string | null;
  subject: string | null;
  chapter: string | null;
  topic: string | null;
  explanation: string | null;
  has_options: boolean;
  sort_order: number;
};

type Mode = "practice" | "exam";

export default function MockAutoTest() {
  const { reportId } = useParams();
  const [searchParams] = useSearchParams();
  const filter = searchParams.get("filter"); // wrong | skipped | null(all)
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [report, setReport] = useState<{ title: string | null; exam_name: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode | null>(null);
  const [view, setView] = useState<"mcq" | "flashcard">("mcq");

  useEffect(() => {
    if (!user || !reportId) { setLoading(false); return; }
    (async () => {
      const [{ data: rep }, { data: qs }] = await Promise.all([
        supabase.from("ai_mock_reports").select("title, exam_name").eq("id", reportId).maybeSingle(),
        supabase.from("mock_generated_questions").select("*").eq("report_id", reportId).order("sort_order"),
      ]);
      setReport(rep as any);
      let list = ((qs as any[]) ?? []) as Row[];
      if (filter === "wrong") list = list.filter((r) => r.original_status === "wrong");
      if (filter === "skipped") list = list.filter((r) => r.original_status === "skipped");
      setRows(list);
      setLoading(false);
    })();
  }, [user, reportId, filter]);

  const mcq = useMemo(() => rows.filter((r) => r.has_options && r.correct_option), [rows]);
  const flash = useMemo(() => rows.filter((r) => !r.has_options || !r.correct_option), [rows]);

  const title =
    (report?.title || report?.exam_name || "Mock") +
    (filter === "wrong" ? " · Wrong Only" : filter === "skipped" ? " · Skipped Only" : " · Wrong + Skipped");

  if (loading) return <div className="space-y-3"><Skeleton className="h-40 rounded-3xl" /><Skeleton className="h-32 rounded-2xl" /></div>;

  if (!user) {
    return (
      <div className="rounded-3xl border bg-card p-10 text-center text-muted-foreground">
        <p>Sign in to start the auto test.</p>
        <Button className="mt-4" onClick={() => navigate("/auth")}>Sign In</Button>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-lg space-y-4 animate-fade-in">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="mr-1 h-4 w-4" /> Back</Button>
        <div className="rounded-3xl border bg-card p-10 text-center text-muted-foreground">
          <BookMarked className="mx-auto h-10 w-10 opacity-60" />
          <p className="mt-3 font-semibold">Auto test not ready yet</p>
          <p className="mt-1 text-sm">
            Ye mock ke wrong/skipped questions se auto test tab bnega jab AI analysis PDF se sawal & options nikaal legi.
            Agar analysis abhi chal rha hai, thodi der me refresh karein.
          </p>
        </div>
      </div>
    );
  }

  // Run MCQ engine
  if (mode && view === "mcq" && mcq.length > 0) {
    const engineQs: EngineQuestion[] = mcq.map((r) => ({
      id: r.id,
      question_text: r.question_text,
      option_a: r.option_a ?? "",
      option_b: r.option_b ?? "",
      option_c: r.option_c ?? "",
      option_d: r.option_d ?? "",
      correct_option: r.correct_option ?? "A",
      explanation: r.explanation,
      marks: 1,
    }));
    const engineTest: EngineTest = {
      id: `mock-auto-${reportId}`,
      title,
      duration_minutes: Math.max(10, engineQs.length),
      total_marks: engineQs.length,
    };
    return (
      <TestEngine
        test={engineTest}
        questions={engineQs}
        mode={mode}
        userId={user.id}
        saveAttempt={false}
        autoRecord={false}
        onSubmit={(answers, qs) => recordRevisionAttempt(user.id, qs, answers)}
        onExit={() => setMode(null)}
      />
    );
  }

  // Flashcard mode
  if (view === "flashcard") {
    return <FlashcardRunner title={title} rows={rows} onBack={() => setView("mcq")} />;
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 animate-fade-in pb-16">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="mr-1 h-4 w-4" /> Back</Button>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-fuchsia-600 via-purple-600 to-indigo-700 p-6 text-white shadow-lg">
        <Sparkles className="absolute -right-4 -top-4 h-28 w-28 opacity-15" />
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/20 p-3 backdrop-blur-sm"><Brain className="h-7 w-7" /></div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold font-display truncate">🔁 {title}</h1>
            <p className="text-sm text-white/85">Auto-generated from your uploaded mock — wrong + skipped questions only.</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Mini label="Total" value={rows.length} />
          <Mini label="Playable MCQ" value={mcq.length} />
          <Mini label="Flashcard" value={flash.length} />
        </div>
      </div>

      {mcq.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold">🟢 MCQ Auto Test ({mcq.length})</p>
          <button onClick={() => { setView("mcq"); setMode("practice"); }} className="btn-ripple flex w-full items-center gap-4 rounded-2xl bg-gradient-practice p-5 text-left text-white shadow-md">
            <Zap className="h-8 w-8 shrink-0" />
            <div><p className="text-lg font-bold">🟢 Practice Mode</p><p className="text-sm text-white/90">Instant feedback + explanations.</p></div>
          </button>
          <button onClick={() => { setView("mcq"); setMode("exam"); }} className="btn-ripple flex w-full items-center gap-4 rounded-2xl bg-gradient-exam p-5 text-left text-white shadow-md">
            <GraduationCap className="h-8 w-8 shrink-0" />
            <div><p className="text-lg font-bold">🔵 Exam Mode</p><p className="text-sm text-white/90">Results after you submit.</p></div>
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
          Is mock ke PDF se options clearly extract nahi ho paye — MCQ mode available nahi. Flashcard mode try karein.
        </div>
      )}

      {flash.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">🃏 Flashcard Recall ({flash.length})</p>
          <button
            onClick={() => setView("flashcard")}
            className="btn-ripple flex w-full items-center gap-4 rounded-2xl border bg-card p-4 text-left hover:bg-accent/40"
          >
            <div className="rounded-xl bg-amber-500/15 p-2 text-amber-600"><Layers className="h-5 w-5" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">Recall mode</p>
              <p className="text-xs text-muted-foreground">Question dekho → apna answer socho → "Show answer" tap karo.</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/15 p-2 backdrop-blur-sm">
      <p className="text-lg font-bold leading-none">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-white/80">{label}</p>
    </div>
  );
}

function FlashcardRunner({ title, rows, onBack }: { title: string; rows: Row[]; onBack: () => void }) {
  const [i, setI] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [know, setKnow] = useState<Record<string, boolean>>({});

  const q = rows[i];
  if (!q) return null;
  const knownCount = Object.values(know).filter(Boolean).length;

  return (
    <div className="mx-auto max-w-lg space-y-4 animate-fade-in pb-16">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="mr-1 h-4 w-4" /> Modes</Button>
      <div className="rounded-2xl border bg-card p-3 flex items-center justify-between text-xs">
        <span className="font-semibold truncate">{title}</span>
        <span className="text-muted-foreground shrink-0">{i + 1} / {rows.length} · ✅ {knownCount}</span>
      </div>

      <div className="rounded-3xl border bg-card p-5 space-y-4 min-h-[280px]">
        <div className="flex flex-wrap gap-1">
          {q.q_no && <Badge variant="outline" className="text-[10px]">Q{q.q_no}</Badge>}
          {q.original_status && <Badge variant="secondary" className="text-[10px]">{q.original_status}</Badge>}
          {q.subject && <Badge className="bg-primary/10 text-primary text-[10px]">{q.subject}</Badge>}
          {q.topic && <Badge className="bg-fuchsia-500/10 text-fuchsia-600 text-[10px]">{q.topic}</Badge>}
        </div>
        <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{q.question_text}</p>

        {q.has_options && (
          <div className="space-y-1.5 text-sm">
            {(["a", "b", "c", "d"] as const).map((L) => {
              const val = (q as any)[`option_${L}`] as string | null;
              if (!val) return null;
              const isCorrect = reveal && q.correct_option === L.toUpperCase();
              return (
                <div key={L} className={`rounded-xl border px-3 py-2 ${isCorrect ? "border-emerald-500 bg-emerald-500/10" : ""}`}>
                  <span className="font-bold mr-2">{L.toUpperCase()}.</span>{val}
                </div>
              );
            })}
          </div>
        )}

        {reveal && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 space-y-2">
            {q.correct_option && (
              <p className="text-sm"><b className="text-emerald-600">✅ Correct:</b> {q.correct_option}</p>
            )}
            {q.marked_option && q.marked_option !== q.correct_option && (
              <p className="text-xs text-red-600">Your marked: {q.marked_option}</p>
            )}
            {q.explanation && (
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{q.explanation}</p>
            )}
            {!q.correct_option && !q.explanation && (
              <p className="text-xs text-muted-foreground">Explanation PDF me visible nahi thi.</p>
            )}
          </div>
        )}
      </div>

      {!reveal ? (
        <Button className="w-full" onClick={() => setReveal(true)}>
          <ListChecks className="mr-2 h-4 w-4" /> Show Answer
        </Button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => { setKnow({ ...know, [q.id]: false }); next(); }}>
            <XCircle className="mr-2 h-4 w-4 text-red-500" /> Didn't know
          </Button>
          <Button onClick={() => { setKnow({ ...know, [q.id]: true }); next(); }}>
            <CheckCircle2 className="mr-2 h-4 w-4" /> Got it
          </Button>
        </div>
      )}
    </div>
  );

  function next() {
    setReveal(false);
    setI((v) => Math.min(v + 1, rows.length - 1));
  }
}
