import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type QRow = {
  id: string;
  question_text: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  correct_answer: string | null;
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
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) { setLoading(false); return; }
      const [{ data: mock }, { data }] = await Promise.all([
        supabase.from("mock_mistake_mocks").select("name").eq("id", mockId).maybeSingle(),
        supabase
          .from("mock_mistake_questions")
          .select("id, question_text, option_a, option_b, option_c, option_d, correct_answer, chapter, topic, explanation")
          .eq("mock_id", mockId)
          .order("sort_order"),
      ]);
      setMockName((mock as any)?.name ?? "Mock");
      setQuestions((data as QRow[]) ?? []);
      setLoading(false);
    })();
  }, [user, mockId]);

  const result = useMemo(() => {
    const correct = questions.filter((q) => q.correct_answer && answers[q.id] === q.correct_answer).length;
    const attempted = questions.filter((q) => answers[q.id]).length;
    const wrong = attempted - correct;
    return {
      correct,
      wrong,
      attempted,
      total: questions.length,
      accuracy: attempted > 0 ? Math.round((correct / attempted) * 100) : 0,
    };
  }, [questions, answers]);

  if (loading) return <div className="space-y-3"><Skeleton className="h-32 rounded-3xl" /><Skeleton className="h-48 rounded-2xl" /></div>;

  const back = () => navigate(`/mock-mistakes/${encodeURIComponent(subjectName)}/${mockId}`);

  if (questions.length === 0) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={back}><ArrowLeft className="mr-1 h-4 w-4" /> {mockName}</Button>
        <div className="glass-card rounded-3xl p-10 text-center text-muted-foreground">No questions imported yet.</div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="space-y-5 animate-fade-in">
        <Button variant="ghost" size="sm" onClick={back}><ArrowLeft className="mr-1 h-4 w-4" /> {mockName}</Button>
        <div className="rounded-3xl bg-gradient-royal p-6 text-white shadow-lg">
          <h1 className="font-display text-2xl font-bold">Result</h1>
          <p className="mt-1 text-sm text-white/85">{mockName}</p>
          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            <div className="rounded-2xl bg-white/15 p-3">
              <p className="text-lg font-bold">{result.correct}/{result.total}</p>
              <p className="text-[11px] text-white/80">Score</p>
            </div>
            <div className="rounded-2xl bg-white/15 p-3">
              <p className="text-lg font-bold">{result.correct}</p>
              <p className="text-[11px] text-white/80">Correct</p>
            </div>
            <div className="rounded-2xl bg-white/15 p-3">
              <p className="text-lg font-bold">{result.wrong}</p>
              <p className="text-[11px] text-white/80">Wrong</p>
            </div>
            <div className="rounded-2xl bg-white/15 p-3">
              <p className="text-lg font-bold">{result.accuracy}%</p>
              <p className="text-[11px] text-white/80">Accuracy</p>
            </div>
          </div>
        </div>

        <h2 className="font-display text-lg font-bold">Review Answers</h2>
        <div className="space-y-3">
          {questions.map((q, i) => {
            const mine = answers[q.id];
            const ok = mine && mine === q.correct_answer;
            return (
              <div key={q.id} className="glass-card space-y-2 rounded-2xl p-4">
                <div className="flex items-start gap-2">
                  {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
                  <p className="text-sm font-medium">{i + 1}. {q.question_text}</p>
                </div>
                <div className="space-y-1 pl-6 text-xs">
                  {LETTERS.map((L) => {
                    const val = (q as any)[`option_${L.toLowerCase()}`] as string | null;
                    if (!val) return null;
                    return (
                      <p key={L} className={cn(
                        "rounded-lg px-2 py-1",
                        q.correct_answer === L && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                        mine === L && q.correct_answer !== L && "bg-destructive/15 text-destructive",
                      )}>
                        {L}. {val}
                      </p>
                    );
                  })}
                  <p className="pt-1 text-muted-foreground">
                    Your answer: {mine || "Skipped"} · Correct: {q.correct_answer || "—"}
                  </p>
                  {(q.chapter || q.topic) && (
                    <p className="text-muted-foreground">{[q.chapter, q.topic].filter(Boolean).join(" · ")}</p>
                  )}
                  {q.explanation && <p className="text-muted-foreground">💡 {q.explanation}</p>}
                </div>
              </div>
            );
          })}
        </div>
        <Button className="w-full rounded-2xl" onClick={back}>Back to Mock</Button>
      </div>
    );
  }

  const q = questions[idx];
  return (
    <div className="space-y-5 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={back}><ArrowLeft className="mr-1 h-4 w-4" /> {mockName}</Button>

      <div className="glass-card space-y-4 rounded-3xl p-5">
        <p className="text-xs text-muted-foreground">Question {idx + 1} of {questions.length}</p>
        <p className="font-medium">{q.question_text}</p>
        <div className="space-y-2">
          {LETTERS.map((L) => {
            const val = (q as any)[`option_${L.toLowerCase()}`] as string | null;
            if (!val) return null;
            const selected = answers[q.id] === L;
            return (
              <button
                key={L}
                onClick={() => setAnswers((a) => ({ ...a, [q.id]: L }))}
                className={cn(
                  "w-full rounded-2xl border p-3 text-left text-sm transition-colors",
                  selected ? "border-primary bg-primary/10" : "border-border hover:bg-muted",
                )}
              >
                <span className="font-semibold">{L}.</span> {val}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" className="rounded-2xl" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
          Previous
        </Button>
        {idx < questions.length - 1 ? (
          <Button className="rounded-2xl" onClick={() => setIdx((i) => i + 1)}>Next</Button>
        ) : (
          <Button className="rounded-2xl" onClick={() => setSubmitted(true)}>Submit</Button>
        )}
      </div>
      {idx < questions.length - 1 && (
        <Button variant="ghost" className="w-full rounded-2xl" onClick={() => setSubmitted(true)}>
          Submit Test
        </Button>
      )}
    </div>
  );
}
