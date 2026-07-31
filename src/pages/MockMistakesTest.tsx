import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CheckCircle2, XCircle, Lightbulb, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

type QRow = {
  id: string;
  question_text: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  correct_answer: string | null;
  user_answer: string | null;
  chapter: string | null;
  topic: string | null;
  explanation: string | null;
};

const LETTERS = ["A", "B", "C", "D"] as const;

export default function MockMistakesTest() {
  const { subject = "", mockId = "" } = useParams();
  const subjectName = decodeURIComponent(subject);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<QRow[]>([]);
  const [mockName, setMockName] = useState("");
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) { setLoading(false); return; }
      const [{ data: mock }, { data }] = await Promise.all([
        supabase.from("mock_mistake_mocks").select("name").eq("id", mockId).maybeSingle(),
        supabase
          .from("mock_mistake_questions")
          .select("id, question_text, option_a, option_b, option_c, option_d, correct_answer, user_answer, chapter, topic, explanation")
          .eq("mock_id", mockId)
          .order("sort_order"),
      ]);
      setMockName((mock as any)?.name ?? "Mock");
      setQuestions((data as QRow[]) ?? []);
      setLoading(false);
    })();
  }, [user, mockId]);

  const stats = useMemo(() => {
    const answered = questions.filter((q) => answers[q.id]);
    const correct = answered.filter((q) => answers[q.id] === q.correct_answer).length;
    const wrong = answered.length - correct;
    return {
      correct,
      wrong,
      attempted: answered.length,
      total: questions.length,
      accuracy: answered.length ? Math.round((correct / answered.length) * 100) : 0,
      revise: answered.filter((q) => answers[q.id] !== q.correct_answer),
    };
  }, [questions, answers]);

  const back = () => navigate(`/mock-mistakes/${encodeURIComponent(subjectName)}/${mockId}`);

  if (loading) return <div className="space-y-3"><Skeleton className="h-32 rounded-3xl" /><Skeleton className="h-48 rounded-2xl" /></div>;

  if (questions.length === 0) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={back}><ArrowLeft className="mr-1 h-4 w-4" /> {mockName}</Button>
        <div className="glass-card rounded-3xl p-10 text-center text-muted-foreground">No questions imported yet.</div>
      </div>
    );
  }

  const restart = () => { setAnswers({}); setIdx(0); setFinished(false); };

  if (finished) {
    return (
      <div className="space-y-5 animate-fade-in">
        <Button variant="ghost" size="sm" onClick={back}><ArrowLeft className="mr-1 h-4 w-4" /> {mockName}</Button>
        <div className="rounded-3xl bg-gradient-royal p-6 text-white shadow-lg">
          <h1 className="font-display text-2xl font-bold">Practice Complete 🎉</h1>
          <p className="mt-1 text-sm text-white/85">{mockName}</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-white/15 p-3">
              <p className="text-lg font-bold">{stats.correct}</p>
              <p className="text-[11px] text-white/80">Correct</p>
            </div>
            <div className="rounded-2xl bg-white/15 p-3">
              <p className="text-lg font-bold">{stats.wrong}</p>
              <p className="text-[11px] text-white/80">Wrong</p>
            </div>
            <div className="rounded-2xl bg-white/15 p-3">
              <p className="text-lg font-bold">{stats.accuracy}%</p>
              <p className="text-[11px] text-white/80">Accuracy</p>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <p className="font-semibold">🔁 Questions to Revise Again ({stats.revise.length})</p>
          {stats.revise.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nothing pending — all correct!</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {stats.revise.map((q, i) => (
                <li key={q.id} className="rounded-xl bg-muted/50 p-2 text-xs">
                  <span className="font-medium">{i + 1}. </span>{q.question_text}
                  {(q.chapter || q.topic) && (
                    <span className="block pt-1 text-muted-foreground">{[q.chapter, q.topic].filter(Boolean).join(" · ")}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <Button className="w-full rounded-2xl" onClick={restart}>
          <RotateCcw className="mr-2 h-4 w-4" /> Practice Again
        </Button>
      </div>
    );
  }

  const q = questions[idx];
  const picked = answers[q.id];
  const revealed = Boolean(picked);
  const isCorrect = picked === q.correct_answer;

  return (
    <div className="space-y-4 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={back}><ArrowLeft className="mr-1 h-4 w-4" /> {mockName}</Button>

      <div className="glass-card space-y-3 rounded-2xl p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Question {idx + 1} of {questions.length}</span>
          <span>⚡ Practice Mode</span>
        </div>
        <Progress value={((idx + (revealed ? 1 : 0)) / questions.length) * 100} className="h-2" />
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
            <b className="block text-base">{stats.correct}</b>Correct
          </div>
          <div className="rounded-xl bg-destructive/10 p-2 text-destructive">
            <b className="block text-base">{stats.wrong}</b>Wrong
          </div>
          <div className="rounded-xl bg-primary/10 p-2 text-primary">
            <b className="block text-base">{stats.accuracy}%</b>Accuracy
          </div>
        </div>
      </div>

      <div className="glass-card space-y-4 rounded-3xl p-5">
        <p className="font-medium">{q.question_text}</p>
        <div className="space-y-2">
          {LETTERS.map((L) => {
            const val = (q as any)[`option_${L.toLowerCase()}`] as string | null;
            if (!val) return null;
            const isRight = q.correct_answer === L;
            const isMine = picked === L;
            return (
              <button
                key={L}
                disabled={revealed}
                onClick={() => setAnswers((a) => ({ ...a, [q.id]: L }))}
                className={cn(
                  "flex w-full items-start gap-2 rounded-2xl border p-3 text-left text-sm transition-colors",
                  !revealed && "border-border hover:bg-muted",
                  revealed && isRight && "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                  revealed && isMine && !isRight && "border-destructive bg-destructive/15 text-destructive",
                  revealed && !isRight && !isMine && "border-border opacity-60",
                )}
              >
                <span className="font-semibold">{L}.</span>
                <span className="flex-1">{val}</span>
                {revealed && isRight && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
                {revealed && isMine && !isRight && <XCircle className="h-4 w-4 shrink-0 text-destructive" />}
              </button>
            );
          })}
        </div>

        {revealed && (
          <div className="animate-fade-in space-y-2 rounded-2xl bg-muted/50 p-4 text-sm">
            <p className={cn("font-bold", isCorrect ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
              {isCorrect ? "✅ Correct!" : "❌ Wrong"}
            </p>
            <p className="text-muted-foreground">
              Your answer: <b className="text-foreground">{picked}</b> · Correct answer: <b className="text-foreground">{q.correct_answer || "—"}</b>
            </p>
            {(q.chapter || q.topic) && (
              <p className="text-xs text-muted-foreground">📚 {[q.chapter, q.topic].filter(Boolean).join(" · ")}</p>
            )}
            {q.explanation && (
              <p className="flex gap-2 text-muted-foreground">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <span>{q.explanation}</span>
              </p>
            )}
            {q.user_answer && (
              <p className="text-xs text-muted-foreground">📝 Note — earlier you answered: <b className="text-foreground">{q.user_answer}</b></p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" className="rounded-2xl" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
          Previous
        </Button>
        {idx < questions.length - 1 ? (
          <Button className="rounded-2xl" disabled={!revealed} onClick={() => setIdx((i) => i + 1)}>Next Question</Button>
        ) : (
          <Button className="rounded-2xl" disabled={!revealed} onClick={() => setFinished(true)}>Finish</Button>
        )}
      </div>
      {!revealed && <p className="text-center text-xs text-muted-foreground">Select an option to see the answer instantly.</p>}
    </div>
  );
}
