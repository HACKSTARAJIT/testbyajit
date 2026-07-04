import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GraduationCap, Zap, ArrowLeft, Clock, ListChecks, Award, PlayCircle } from "lucide-react";
import { TestEngine, type EngineQuestion, type EngineTest } from "@/components/TestEngine";

type Mode = "practice" | "exam";

export default function TestRunner() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [test, setTest] = useState<any>(null);
  const [questions, setQuestions] = useState<EngineQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode | null>(null);
  const [started, setStarted] = useState(false);
  const [resume, setResume] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: t } = await supabase.from("tests").select("*, subjects(name)").eq("id", id).maybeSingle();
      const { data: q } = await supabase.from("questions").select("*").eq("test_id", id).order("sort_order");
      setTest(t);
      setQuestions((q as any) ?? []);
      if (user) {
        const { data: att } = await supabase
          .from("test_attempts")
          .select("*")
          .eq("user_id", user.id).eq("test_id", id).eq("status", "in_progress")
          .order("updated_at", { ascending: false }).limit(1).maybeSingle();
        if (att) setResume(att);
      }
      setLoading(false);
    })();
  }, [id, user]);

  if (loading) return <div className="space-y-3"><Skeleton className="h-48 rounded-3xl" /><Skeleton className="h-32 rounded-2xl" /></div>;

  if (!test || questions.length === 0)
    return (
      <div className="rounded-3xl border bg-card p-10 text-center text-muted-foreground">
        <ListChecks className="mx-auto h-10 w-10" />
        <p className="mt-3">This test has no questions yet.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );

  const engineTest: EngineTest = {
    id: test.id, title: test.title, test_part: test.test_part,
    subject_id: test.subject_id, chapter_id: test.chapter_id,
    duration_minutes: test.duration_minutes, total_marks: test.total_marks,
    subjectName: test.subjects?.name,
  };

  if (started && mode) {
    return (
      <TestEngine
        test={engineTest}
        questions={questions}
        mode={mode}
        userId={user?.id}
        onExit={() => navigate(-1)}
        resume={resume && resume.mode === mode ? {
          attemptId: resume.id,
          answers: resume.answers ?? {},
          current_index: resume.current_index ?? 0,
          marked: resume.marked ?? {},
        } : undefined}
      />
    );
  }

  // Mode selection / intro
  return (
    <div className="mx-auto max-w-lg space-y-5 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="mr-1 h-4 w-4" /> Back</Button>

      <div className="rounded-3xl bg-gradient-royal p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold">{test.title}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          {test.subjects?.name && <Badge className="border-0 bg-white/20">{test.subjects.name}</Badge>}
          {test.test_part && <Badge className="border-0 bg-white/20">{test.test_part}</Badge>}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-xl bg-white/15 p-2"><ListChecks className="mx-auto mb-1 h-4 w-4" /><b>{questions.length}</b><p className="text-xs text-white/80">Questions</p></div>
          <div className="rounded-xl bg-white/15 p-2"><Award className="mx-auto mb-1 h-4 w-4" /><b>{test.total_marks ?? questions.length}</b><p className="text-xs text-white/80">Marks</p></div>
          <div className="rounded-xl bg-white/15 p-2"><Clock className="mx-auto mb-1 h-4 w-4" /><b>{test.duration_minutes ?? 30}</b><p className="text-xs text-white/80">Minutes</p></div>
        </div>
      </div>

      {resume && (
        <button
          onClick={() => { setMode(resume.mode); setStarted(true); }}
          className="btn-ripple flex w-full items-center gap-3 rounded-2xl border-2 border-primary bg-primary/5 p-4 text-left"
        >
          <PlayCircle className="h-6 w-6 text-primary" />
          <div>
            <p className="font-semibold">Resume previous attempt</p>
            <p className="text-xs text-muted-foreground">Continue from question {(resume.current_index ?? 0) + 1} · {resume.mode} mode</p>
          </div>
        </button>
      )}

      <div>
        <p className="mb-3 text-center font-semibold">Choose Test Mode</p>
        <div className="grid gap-3">
          <button
            onClick={() => { setMode("practice"); setStarted(true); }}
            className="btn-ripple flex items-center gap-4 rounded-2xl bg-gradient-practice p-5 text-left text-white shadow-md"
          >
            <Zap className="h-8 w-8 shrink-0" />
            <div>
              <p className="text-lg font-bold">🟢 Practice Mode</p>
              <p className="text-sm text-white/90">Instant feedback after each question, explanations & auto-saved mistakes.</p>
            </div>
          </button>
          <button
            onClick={() => { setMode("exam"); setStarted(true); }}
            className="btn-ripple flex items-center gap-4 rounded-2xl bg-gradient-exam p-5 text-left text-white shadow-md"
          >
            <GraduationCap className="h-8 w-8 shrink-0" />
            <div>
              <p className="text-lg font-bold">🔵 Exam Mode</p>
              <p className="text-sm text-white/90">Real exam feel. Results revealed only after you submit.</p>
            </div>
          </button>
        </div>
      </div>
      {!user && <p className="text-center text-xs text-muted-foreground">Sign in to save your progress, scores and wrong questions across devices.</p>}
    </div>
  );
}
