import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Clock, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Trophy, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function TestAttempt() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [test, setTest] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);
  const startRef = useRef(Date.now());
  const submittedRef = useRef(false);

  useEffect(() => {
    (async () => {
      const [t, q] = await Promise.all([
        supabase.from("tests").select("*").eq("id", id).maybeSingle(),
        supabase.from("questions").select("*").eq("test_id", id).order("sort_order"),
      ]);
      setTest(t.data);
      setQuestions(q.data ?? []);
      setTimeLeft((t.data?.duration_minutes ?? 30) * 60);
    })();
  }, [id]);

  useEffect(() => {
    if (!test || submitted) return;
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timer); handleSubmit(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [test, submitted]);

  const handleSubmit = async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    let score = 0, correct = 0, totalMarks = 0;
    questions.forEach((qn) => {
      totalMarks += qn.marks;
      if (answers[qn.id] === qn.correct_option) { score += qn.marks; correct += 1; }
    });
    const timeTaken = Math.round((Date.now() - startRef.current) / 1000);
    const payload = {
      user_id: user!.id, test_id: id!, score, total_marks: totalMarks,
      correct_count: correct, total_questions: questions.length,
      answers, time_taken_seconds: timeTaken,
    };
    const { error } = await supabase.from("results").insert(payload);
    if (error) toast.error("Could not save result");
    setResult({ score, totalMarks, correct, total: questions.length });
    setSubmitted(true);
  };

  if (!test) return null;

  if (submitted && result) {
    const pct = result.totalMarks ? Math.round((result.score / result.totalMarks) * 100) : 0;
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="text-center animate-scale-in">
          <CardContent className="space-y-3 py-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-hero">
              <Trophy className="h-8 w-8 text-primary-foreground" />
            </div>
            <h2 className="text-2xl font-bold">Test Complete! 🎉</h2>
            <div className="text-5xl font-bold gradient-text">{pct}%</div>
            <p className="text-muted-foreground">
              Score: {result.score}/{result.totalMarks} • Correct: {result.correct}/{result.total}
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Button variant="outline" onClick={() => navigate("/tests")}>More Tests</Button>
              <Button onClick={() => navigate("/results")}>View History</Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h3 className="font-semibold">Review Answers</h3>
          {questions.map((qn, i) => {
            const userAns = answers[qn.id];
            const isCorrect = userAns === qn.correct_option;
            return (
              <Card key={qn.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-2">
                    {isCorrect ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />}
                    <div className="flex-1">
                      <p className="font-medium">Q{i + 1}. {qn.question_text}</p>
                      <div className="mt-2 space-y-1 text-sm">
                        {["a", "b", "c", "d"].map((opt) => (
                          <div key={opt} className={cn(
                            "rounded px-2 py-1",
                            opt === qn.correct_option && "bg-success/10 text-success font-medium",
                            opt === userAns && opt !== qn.correct_option && "bg-destructive/10 text-destructive"
                          )}>
                            {opt.toUpperCase()}. {qn[`option_${opt}`]}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  const qn = questions[current];
  if (!qn) return <p>No questions available.</p>;
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/tests")}><ArrowLeft className="mr-1 h-4 w-4" /> Exit</Button>
        <Badge variant={timeLeft < 60 ? "destructive" : "secondary"} className="text-base">
          <Clock className="mr-1 h-4 w-4" /> {mins}:{secs.toString().padStart(2, "0")}
        </Badge>
      </div>

      <div>
        <div className="mb-1 flex justify-between text-sm text-muted-foreground">
          <span>Question {current + 1} / {questions.length}</span>
          <span>{answeredCount} answered</span>
        </div>
        <Progress value={((current + 1) / questions.length) * 100} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg leading-snug">{qn.question_text}</CardTitle></CardHeader>
        <CardContent>
          <RadioGroup value={answers[qn.id] ?? ""} onValueChange={(v) => setAnswers((a) => ({ ...a, [qn.id]: v }))}>
            {["a", "b", "c", "d"].map((opt) => (
              <Label key={opt} htmlFor={`${qn.id}-${opt}`} className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted",
                answers[qn.id] === opt && "border-primary bg-primary/5"
              )}>
                <RadioGroupItem value={opt} id={`${qn.id}-${opt}`} />
                <span><strong>{opt.toUpperCase()}.</strong> {qn[`option_${opt}`]}</span>
              </Label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Prev
        </Button>
        {current < questions.length - 1 ? (
          <Button onClick={() => setCurrent((c) => c + 1)}>Next <ChevronRight className="ml-1 h-4 w-4" /></Button>
        ) : (
          <Button variant="secondary" onClick={handleSubmit}>Submit Test</Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {questions.map((q2, i) => (
          <button key={q2.id} onClick={() => setCurrent(i)}
            className={cn("h-8 w-8 rounded-lg border text-sm font-medium",
              i === current && "ring-2 ring-primary",
              answers[q2.id] ? "bg-primary text-primary-foreground" : "bg-muted")}>
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
