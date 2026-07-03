import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, CheckCircle2, XCircle, ArrowLeft, ArrowRight, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const LETTERS = ["A", "B", "C", "D"] as const;

export default function TestRunner() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [test, setTest] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);
  const startTime = useRef<number>(0);

  useEffect(() => {
    (async () => {
      const { data: t } = await supabase.from("tests").select("*, subjects(name)").eq("id", id).maybeSingle();
      const { data: q } = await supabase.from("questions").select("*").eq("test_id", id).order("sort_order");
      setTest(t);
      setQuestions(q ?? []);
      setSecondsLeft((t?.duration_minutes ?? 30) * 60);
      setLoading(false);
    })();
  }, [id]);

  const q = questions[current];

  const submit = useCallback(async () => {
    if (submitted) return;
    setSubmitted(true);
    let correct = 0;
    let score = 0;
    let totalMarks = 0;
    for (const item of questions) {
      totalMarks += item.marks ?? 1;
      if (answers[item.id] === item.correct_option) {
        correct += 1;
        score += item.marks ?? 1;
      }
    }
    const timeTaken = Math.round((Date.now() - startTime.current) / 1000);
    const res = {
      score, total_marks: totalMarks, correct_count: correct,
      total_questions: questions.length, time_taken_seconds: timeTaken,
    };
    setResult(res);
    if (user) {
      await supabase.from("results").insert({ ...res, test_id: id, user_id: user.id, answers } as any);
    }
  }, [answers, questions, submitted, user, id]);

  // timer
  useEffect(() => {
    if (!started || submitted) return;
    if (secondsLeft <= 0) { submit(); return; }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [started, submitted, secondsLeft, submit]);

  if (loading) return <div className="space-y-3"><Skeleton className="h-40 rounded-xl" /></div>;
  if (!test || questions.length === 0)
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        <p>This test has no questions.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Go Back</Button>
      </CardContent></Card>
    );

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const answeredCount = Object.keys(answers).length;

  // Intro screen
  if (!started) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader><CardTitle>{test.title}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {test.subjects?.name && <Badge variant="secondary">{test.subjects.name}</Badge>}
          {test.test_part && <Badge className="ml-2">{test.test_part}</Badge>}
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>Total Questions: <b className="text-foreground">{questions.length}</b></li>
            <li>Total Marks: <b className="text-foreground">{test.total_marks ?? questions.length}</b></li>
            <li>Time Limit: <b className="text-foreground">{test.duration_minutes} minutes</b></li>
          </ul>
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            The timer starts when you begin. Your answers auto-submit when time runs out.
          </div>
          <Button className="w-full" onClick={() => { setStarted(true); startTime.current = Date.now(); }}>
            Start Test / टेस्ट शुरू करें
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Result screen
  if (submitted && result) {
    const pct = result.total_marks ? Math.round((result.score / result.total_marks) * 100) : 0;
    return (
      <div className="space-y-4">
        <Card className="mx-auto max-w-lg text-center">
          <CardContent className="space-y-3 py-8">
            <Trophy className="mx-auto h-12 w-12 text-secondary" />
            <h2 className="text-2xl font-bold">{result.score} / {result.total_marks}</h2>
            <p className="text-muted-foreground">{result.correct_count} correct out of {result.total_questions} · {pct}%</p>
            {!user && <p className="text-xs text-muted-foreground">Sign in to save your result history.</p>}
            <div className="flex justify-center gap-2 pt-2">
              <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
              <Button onClick={() => navigate("/analysis")}>View Analysis</Button>
            </div>
          </CardContent>
        </Card>
        <h3 className="font-semibold">Review Answers</h3>
        {questions.map((item, i) => {
          const chosen = answers[item.id];
          return (
            <Card key={item.id}>
              <CardContent className="space-y-2 p-4">
                <p className="font-medium">Q{i + 1}. {item.question_text}</p>
                {LETTERS.map((L) => {
                  const val = item[`option_${L.toLowerCase()}`];
                  if (!val || val === "-") return null;
                  const isCorrect = item.correct_option === L;
                  const isChosen = chosen === L;
                  return (
                    <div key={L} className={cn(
                      "flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm",
                      isCorrect && "border-green-500 bg-green-500/10",
                      isChosen && !isCorrect && "border-destructive bg-destructive/10"
                    )}>
                      <span className="font-semibold">{L}.</span> {val}
                      {isCorrect && <CheckCircle2 className="ml-auto h-4 w-4 text-green-600" />}
                      {isChosen && !isCorrect && <XCircle className="ml-auto h-4 w-4 text-destructive" />}
                    </div>
                  );
                })}
                {item.explanation && <p className="text-xs text-muted-foreground"><b>Explanation:</b> {item.explanation}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  // Question screen
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="mr-1 h-4 w-4" /> Exit</Button>
        <Badge variant={secondsLeft < 60 ? "destructive" : "secondary"} className="gap-1 text-sm">
          <Clock className="h-4 w-4" /> {mm}:{ss}
        </Badge>
      </div>
      <Progress value={((current + 1) / questions.length) * 100} />
      <p className="text-sm text-muted-foreground">Question {current + 1} of {questions.length} · Answered {answeredCount}</p>

      <Card>
        <CardContent className="space-y-4 p-5">
          <p className="text-lg font-medium">{q.question_text}</p>
          <div className="space-y-2">
            {LETTERS.map((L) => {
              const val = q[`option_${L.toLowerCase()}`];
              if (!val || val === "-") return null;
              const selected = answers[q.id] === L;
              return (
                <button
                  key={L}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: L }))}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                    selected ? "border-primary bg-primary/10" : "hover:bg-muted"
                  )}
                >
                  <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                    selected && "border-primary bg-primary text-primary-foreground")}>{L}</span>
                  <span>{val}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Prev
        </Button>
        {current < questions.length - 1 ? (
          <Button onClick={() => setCurrent((c) => c + 1)}>Next <ArrowRight className="ml-1 h-4 w-4" /></Button>
        ) : (
          <Button onClick={() => {
            if (answeredCount < questions.length && !confirm(`${questions.length - answeredCount} unanswered. Submit anyway?`)) return;
            submit();
          }}>Submit Test</Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {questions.map((item, i) => (
          <button key={item.id} onClick={() => setCurrent(i)}
            className={cn("h-8 w-8 rounded-md border text-xs font-medium",
              i === current && "ring-2 ring-primary",
              answers[item.id] ? "bg-primary text-primary-foreground" : "bg-muted")}>
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
