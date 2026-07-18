import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GraduationCap, Zap, ArrowLeft, ListChecks } from "lucide-react";
import { TestEngine, type EngineQuestion, type EngineTest } from "@/components/TestEngine";
import { loadQuestionsByIds, loadTodaysRevisionIds, recordRevisionAttempt } from "@/lib/revisionEngine";
import { loadQuickRevisionIds } from "@/lib/smartRevision";
import { loadFilteredRevisionIds, type CommandFilter } from "@/lib/smartRevisionCommand";

type Mode = "practice" | "exam";

export default function RevisionRunner() {
  const { testId } = useParams();
  const [searchParams] = useSearchParams();
  const countParam = Number(searchParams.get("count")) || 0;
  const navigate = useNavigate();
  const { user } = useAuth();
  const [questions, setQuestions] = useState<EngineQuestion[]>([]);
  const [title, setTitle] = useState("Today's Revision");
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    (async () => {
      if (!user) { setLoading(false); return; }
      let ids: string[] = [];
      if (testId) {
        const { data } = await supabase
          .from("revision_tests")
          .select("title, question_ids")
          .eq("user_id", user.id)
          .eq("test_id", testId)
          .maybeSingle();
        ids = ((data as any)?.question_ids as string[]) ?? [];
        if ((data as any)?.title) setTitle((data as any).title);
      } else if (countParam > 0) {
        ids = await loadQuickRevisionIds(user.id, countParam);
        setTitle(`Quick Revision · ${countParam} Questions`);
      } else {
        const filter = searchParams.get("filter");
        const modeParam = searchParams.get("mode2");
        const scopeTestId = searchParams.get("scopeTestId");
        const limit = Number(searchParams.get("limit")) || 50;
        if (filter || modeParam === "final" || scopeTestId) {
          const f: CommandFilter = {
            onlyGuess: filter === "guess",
            onlyMarked: filter === "marked",
            onlyCritical: filter === "critical",
            onlyRepeated: filter === "repeated",
            onlySkipped: filter === "skipped",
            onlyNeverCorrect: filter === "never-correct",
            onlyFinalMode: modeParam === "final",
            testId: scopeTestId,
          };
          ids = await loadFilteredRevisionIds(user.id, f, limit);
          const labels: Record<string, string> = {
            guess: "Guess Wrong Revision",
            marked: "Marked for Review",
            critical: "Critical Revision",
            repeated: "Repeated Mistakes",
            skipped: "Skipped Question Revision",
            "never-correct": "Never Solved Correctly",
          };
          setTitle(
            modeParam === "final"
              ? "🎯 Final Exam Revision"
              : (labels[filter ?? ""] ?? (scopeTestId ? "Mock Revision" : "Smart Revision")),
          );
        } else {
          ids = await loadTodaysRevisionIds(user.id);
        }
      }
      setQuestions(await loadQuestionsByIds(ids));
      setLoading(false);
    })();
  }, [user, testId, countParam]);

  if (loading) return <div className="space-y-3"><Skeleton className="h-48 rounded-3xl" /><Skeleton className="h-32 rounded-2xl" /></div>;

  if (!user)
    return (
      <div className="rounded-3xl border bg-card p-10 text-center text-muted-foreground">
        <p>Sign in to start your revision.</p>
        <Button className="mt-4" onClick={() => navigate("/auth")}>Sign In</Button>
      </div>
    );

  if (questions.length === 0)
    return (
      <div className="rounded-3xl border bg-card p-10 text-center text-muted-foreground animate-fade-in">
        <ListChecks className="mx-auto h-10 w-10" />
        <p className="mt-3 font-semibold">Nothing to revise right now 🎉</p>
        <p className="mt-1 text-sm">Attempt tests to build your smart revision set. Mastered questions move out automatically.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );

  const engineTest: EngineTest = {
    id: testId ?? "revision",
    title,
    duration_minutes: Math.max(10, questions.length),
    total_marks: questions.length,
  };

  if (mode) {
    return (
      <TestEngine
        test={engineTest}
        questions={questions}
        mode={mode}
        userId={user.id}
        saveAttempt={false}
        autoRecord={false}
        onSubmit={(answers, qs) => recordRevisionAttempt(user.id, qs, answers)}
        onExit={() => navigate(-1)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="mr-1 h-4 w-4" /> Back</Button>
      <div className="rounded-3xl bg-gradient-royal p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-white/85">{questions.length} question{questions.length !== 1 ? "s" : ""} to revise · master after 2 correct in a row</p>
      </div>
      <p className="text-center font-semibold">Choose Mode</p>
      <div className="grid gap-3">
        <button onClick={() => setMode("practice")} className="btn-ripple flex items-center gap-4 rounded-2xl bg-gradient-practice p-5 text-left text-white shadow-md">
          <Zap className="h-8 w-8 shrink-0" />
          <div><p className="text-lg font-bold">🟢 Practice Mode</p><p className="text-sm text-white/90">Instant feedback & explanations.</p></div>
        </button>
        <button onClick={() => setMode("exam")} className="btn-ripple flex items-center gap-4 rounded-2xl bg-gradient-exam p-5 text-left text-white shadow-md">
          <GraduationCap className="h-8 w-8 shrink-0" />
          <div><p className="text-lg font-bold">🔵 Exam Mode</p><p className="text-sm text-white/90">Results after you submit.</p></div>
        </button>
      </div>
    </div>
  );
}
