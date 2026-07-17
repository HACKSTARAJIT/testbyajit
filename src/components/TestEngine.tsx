import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  Clock, CheckCircle2, XCircle, ArrowLeft, ArrowRight, Trophy, Flag,
  Target, RotateCcw, ListChecks, Sparkles, Info, Dice5, Brain,
} from "lucide-react";
import { recordAttempt } from "@/lib/revisionEngine";

export type EngineQuestion = {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  explanation?: string | null;
  marks?: number | null;
};

export type EngineTest = {
  id: string;
  title: string;
  test_part?: string | null;
  subject_id?: string | null;
  chapter_id?: string | null;
  duration_minutes?: number | null;
  total_marks?: number | null;
  subjectName?: string | null;
};

const LETTERS = ["A", "B", "C", "D"] as const;

type Mode = "practice" | "exam";
type MarkState = "review" | "doubt";

export function TestEngine({
  test,
  questions,
  mode,
  userId,
  isPreview = false,
  saveAttempt = true,
  autoRecord = true,
  onSubmit,
  onExit,
  resume,
}: {
  test: EngineTest;
  questions: EngineQuestion[];
  mode: Mode;
  userId?: string;
  isPreview?: boolean;
  saveAttempt?: boolean;
  autoRecord?: boolean;
  onSubmit?: (answers: Record<string, string>, questions: EngineQuestion[]) => void | Promise<void>;
  onExit: () => void;
  resume?: {
    attemptId: string;
    answers: Record<string, string>;
    current_index: number;
    marked: Record<string, MarkState>;
  };
}) {
  const [sessionQs, setSessionQs] = useState<EngineQuestion[]>(questions);
  const [current, setCurrent] = useState(resume?.current_index ?? 0);
  const [answers, setAnswers] = useState<Record<string, string>>(resume?.answers ?? {});
  const [marked, setMarked] = useState<Record<string, MarkState>>(resume?.marked ?? {});
  // Guess Intelligence — per-question guess flag, does not affect scoring.
  // `guessArmed` = toggle state before answering; `guesses` = frozen at answer time.
  const [guessArmed, setGuessArmed] = useState<Record<string, boolean>>({});
  const [guesses, setGuesses] = useState<Record<string, { guess: true; selected: string; timeMs: number }>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>(
    mode === "practice" ? Object.fromEntries(Object.keys(resume?.answers ?? {}).map((k) => [k, true])) : {}
  );
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [secondsLeft, setSecondsLeft] = useState((test.duration_minutes ?? 30) * 60);
  const startTime = useRef<number>(Date.now());
  const qStartTime = useRef<number>(Date.now());
  const attemptId = useRef<string | null>(resume?.attemptId ?? null);
  const savedWrong = useRef<Set<string>>(new Set());

  const q = sessionQs[current];
  const perQMarks = (item: EngineQuestion) => item.marks ?? 1;

  const stats = useMemo(() => {
    let correct = 0, incorrect = 0, score = 0, totalMarks = 0;
    for (const item of sessionQs) {
      totalMarks += perQMarks(item);
      const a = answers[item.id];
      if (!a) continue;
      if (a === item.correct_option) { correct += 1; score += perQMarks(item); }
      else incorrect += 1;
    }
    const attempted = correct + incorrect;
    const skipped = sessionQs.length - attempted;
    const accuracy = attempted ? Math.round((correct / attempted) * 100) : 0;
    return { correct, incorrect, score, totalMarks, skipped, accuracy, attempted };
  }, [answers, sessionQs]);

  // ---- attempt persistence ----
  const canSave = !!userId && !isPreview && saveAttempt;

  const persist = useCallback(async (status: "in_progress" | "completed", finalStats?: typeof stats, timeTaken?: number) => {
    if (!canSave) return;
    const s = finalStats ?? stats;
    const payload: any = {
      user_id: userId,
      test_id: test.id,
      correct_count: s.correct,
      incorrect_count: s.incorrect,
      unattempted_count: s.skipped,
      skipped_count: s.skipped,
      marks_obtained: s.score,
      total_questions: sessionQs.length,
      accuracy: s.accuracy,
      status,
      mode,
      current_index: current,
      answers,
      marked,
      guesses,
      time_taken_seconds: timeTaken ?? Math.round((Date.now() - startTime.current) / 1000),
    };
    if (attemptId.current) {
      await supabase.from("test_attempts").update(payload).eq("id", attemptId.current);
    } else {
      const { data } = await supabase.from("test_attempts").insert(payload).select("id").single();
      if (data) attemptId.current = data.id;
    }
  }, [canSave, userId, test.id, stats, sessionQs.length, mode, current, answers, marked, guesses]);

  // create/resume attempt on mount
  useEffect(() => {
    if (canSave && !attemptId.current) persist("in_progress");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset per-question timer on navigation
  useEffect(() => { qStartTime.current = Date.now(); }, [current]);

  // autosave every 8s
  useEffect(() => {
    if (!canSave || submitted) return;
    const t = setInterval(() => persist("in_progress"), 8000);
    return () => clearInterval(t);
  }, [canSave, submitted, persist]);

  // Practice-mode immediate UI cue only; the durable bank update happens on submit
  const saveWrongQuestion = useCallback((item: EngineQuestion) => {
    if (!canSave) return;
    savedWrong.current.add(item.id);
  }, [canSave]);

  const submit = useCallback(async () => {
    if (submitted) return;
    setSubmitted(true);
    const timeTaken = Math.round((Date.now() - startTime.current) / 1000);
    const final = { ...stats };
    setResult({ ...final, timeTaken });
    await persist("completed", final, timeTaken);
    // Auto-update the smart wrong-question bank & regenerate the revision test
    if (userId && !isPreview) {
      try {
        if (onSubmit) await onSubmit(answers, sessionQs);
        else if (autoRecord) await recordAttempt(userId, test, sessionQs, answers);
      } catch (e) { console.error(e); }
    }
  }, [submitted, stats, persist, userId, isPreview, onSubmit, autoRecord, test, sessionQs, answers]);

  // timer
  useEffect(() => {
    if (submitted) return;
    if (secondsLeft <= 0) { submit(); return; }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [submitted, secondsLeft, submit]);

  const choose = (letter: string) => {
    if (mode === "practice" && revealed[q.id]) return; // locked after reveal
    const timeMs = Date.now() - qStartTime.current;
    setAnswers((a) => ({ ...a, [q.id]: letter }));
    if (guessArmed[q.id]) {
      setGuesses((g) => ({ ...g, [q.id]: { guess: true, selected: letter, timeMs } }));
    }
    if (mode === "practice") {
      setRevealed((r) => ({ ...r, [q.id]: true }));
      if (letter === q.correct_option) {
        setTimeout(() => setCurrent((c) => Math.min(c + 1, sessionQs.length - 1)), 900);
      } else {
        saveWrongQuestion(q);
      }
    }
  };

  const toggleGuess = () =>
    setGuessArmed((g) => {
      const next = { ...g, [q.id]: !g[q.id] };
      // If already answered and user un-arms guess, drop the record.
      if (!next[q.id]) setGuesses((gg) => { const { [q.id]: _drop, ...rest } = gg; return rest; });
      // If already answered and user arms it, retro-tag as guess.
      if (next[q.id] && answers[q.id]) {
        setGuesses((gg) => ({ ...gg, [q.id]: { guess: true, selected: answers[q.id], timeMs: Date.now() - qStartTime.current } }));
      }
      return next;
    });

  const toggleMark = (state: MarkState) =>
    setMarked((m) => ({ ...m, [q.id]: m[q.id] === state ? (undefined as any) : state }));

  const goto = (i: number) => setCurrent(i);

  const retry = (onlyIncorrect: boolean) => {
    const base = onlyIncorrect
      ? questions.filter((item) => answers[item.id] !== item.correct_option)
      : questions;
    setSessionQs(base);
    setAnswers({});
    setMarked({});
    setRevealed({});
    setCurrent(0);
    setSubmitted(false);
    setResult(null);
    setSecondsLeft((test.duration_minutes ?? 30) * 60);
    startTime.current = Date.now();
    attemptId.current = null;
    savedWrong.current = new Set();
    if (canSave) persist("in_progress");
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  // ---------- RESULT SCREEN ----------
  if (submitted && result) {
    const totalMarks = result.totalMarks || sessionQs.length;
    const pct = totalMarks ? Math.round((result.score / totalMarks) * 100) : 0;
    const tm = String(Math.floor(result.timeTaken / 60)).padStart(2, "0");
    const ts = String(result.timeTaken % 60).padStart(2, "0");
    return (
      <div className="mx-auto max-w-2xl space-y-4 animate-fade-in pb-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-royal p-8 text-center text-white shadow-lg">
          <Trophy className="mx-auto h-14 w-14 drop-shadow" />
          <p className="mt-2 text-sm font-medium uppercase tracking-wider text-white/80">Test Completed</p>
          <h2 className="mt-1 text-4xl font-extrabold">{result.score} / {totalMarks}</h2>
          <p className="mt-1 text-white/90">{pct}% Score</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <ResultStat label="Correct" value={result.correct} className="bg-gradient-emerald text-white" icon={CheckCircle2} />
          <ResultStat label="Incorrect" value={result.incorrect} className="bg-gradient-warm text-white" icon={XCircle} />
          <ResultStat label="Skipped" value={result.skipped} className="glass-card" icon={ListChecks} />
          <ResultStat label="Accuracy" value={`${result.accuracy}%`} className="glass-card" icon={Target} />
          <ResultStat label="Time Taken" value={`${tm}:${ts}`} className="glass-card" icon={Clock} />
          <ResultStat label="Questions" value={sessionQs.length} className="glass-card" icon={Sparkles} />
        </div>

        {userId && attemptId.current && (
          <Link to={`/analysis/${attemptId.current}`} className="block">
            <Button className="btn-ripple w-full bg-gradient-hero text-white shadow-lg">
              <Sparkles className="mr-1 h-4 w-4" /> AJIT AI Mistake Analysis
            </Button>
          </Link>
        )}

        <div className="flex flex-wrap gap-2">
          <Button className="btn-ripple flex-1 bg-gradient-royal text-white" onClick={() => retry(false)}>
            <RotateCcw className="mr-1 h-4 w-4" /> Retry Full Test
          </Button>
          {result.incorrect + result.skipped > 0 && (
            <Button variant="outline" className="btn-ripple flex-1" onClick={() => retry(true)}>
              <Flag className="mr-1 h-4 w-4" /> Retry Incorrect Only
            </Button>
          )}
        </div>
        {!userId && !isPreview && (
          <p className="text-center text-xs text-muted-foreground">Sign in to save your result history and wrong questions.</p>
        )}

        <h3 className="pt-2 font-semibold">Review Answers</h3>
        {sessionQs.map((item, i) => {
          const chosen = answers[item.id];
          return (
            <div key={item.id} className="rounded-2xl border bg-card p-4 shadow-sm">
              <p className="font-medium">Q{i + 1}. {item.question_text}</p>
              <div className="mt-2 space-y-1.5">
                {LETTERS.map((L) => {
                  const val = item[`option_${L.toLowerCase()}` as keyof EngineQuestion] as string;
                  if (!val || val === "-") return null;
                  const isCorrect = item.correct_option === L;
                  const isChosen = chosen === L;
                  return (
                    <div key={L} className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm",
                      isCorrect && "border-success bg-success/10",
                      isChosen && !isCorrect && "border-destructive bg-destructive/10"
                    )}>
                      <span className="font-semibold">{L}.</span> {val}
                      {isCorrect && <CheckCircle2 className="ml-auto h-4 w-4 text-success" />}
                      {isChosen && !isCorrect && <XCircle className="ml-auto h-4 w-4 text-destructive" />}
                    </div>
                  );
                })}
              </div>
              {item.explanation && (
                <p className="mt-2 rounded-lg bg-muted/60 p-2 text-xs text-muted-foreground">
                  <Info className="mr-1 inline h-3 w-3" /><b>Explanation:</b> {item.explanation}
                </p>
              )}
            </div>
          );
        })}
        <Button variant="outline" className="w-full" onClick={onExit}>Back</Button>
      </div>
    );
  }

  // ---------- QUESTION SCREEN ----------
  const revealedNow = mode === "practice" && revealed[q.id];
  const answeredCount = Object.keys(answers).length;

  const paletteColor = (item: EngineQuestion, i: number) => {
    const a = answers[item.id];
    const mk = marked[item.id];
    if (mode === "practice" && revealed[item.id]) {
      return a === item.correct_option ? "bg-success text-white border-success" : "bg-destructive text-white border-destructive";
    }
    if (mk === "review" || mk === "doubt") return "bg-warning text-white border-warning";
    if (a) return "bg-primary text-primary-foreground border-primary";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-28">
      {/* Premium gradient header */}
      <div className="rounded-3xl bg-gradient-royal p-4 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{test.title}</p>
            <p className="text-xs text-white/80">
              Question {current + 1} / {sessionQs.length}
              {mode === "practice" ? " · Practice Mode" : " · Exam Mode"}
            </p>
          </div>
          <Badge className={cn("gap-1 border-0 text-sm", secondsLeft < 60 ? "bg-destructive" : "bg-white/20")}>
            <Clock className="h-4 w-4" /> {mm}:{ss}
          </Badge>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-white transition-all" style={{ width: `${((current + 1) / sessionQs.length) * 100}%` }} />
        </div>
        <div className="mt-3 grid grid-cols-5 gap-1.5 text-center text-[11px]">
          <HeadStat label="Correct" value={stats.correct} />
          <HeadStat label="Wrong" value={stats.incorrect} />
          <HeadStat label="Skipped" value={stats.skipped} />
          <HeadStat label="Score" value={stats.score} />
          <HeadStat label="Accuracy" value={`${stats.accuracy}%`} />
        </div>
      </div>

      {/* Question card */}
      <div key={q.id} className="animate-fade-in rounded-3xl border border-primary/10 bg-gradient-to-br from-card to-muted/30 p-5 shadow-md">
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-full bg-gradient-royal px-3 py-1 text-xs font-bold text-white">Q{current + 1}</span>
          {marked[q.id] === "review" && <Badge className="bg-warning text-white">Marked for Review</Badge>}
          {marked[q.id] === "doubt" && <Badge className="bg-warning text-white">Doubt</Badge>}
        </div>
        <p className="text-lg font-semibold leading-relaxed">{q.question_text}</p>

        <div className="mt-4 space-y-2.5">
          {LETTERS.map((L) => {
            const val = q[`option_${L.toLowerCase()}` as keyof EngineQuestion] as string;
            if (!val || val === "-") return null;
            const selected = answers[q.id] === L;
            const isCorrect = q.correct_option === L;
            let style = "border-border hover:border-primary/50 hover:bg-primary/5";
            if (revealedNow) {
              if (isCorrect) style = "border-success bg-success/15 animate-scale-in";
              else if (selected) style = "border-destructive bg-destructive/15 animate-scale-in";
              else style = "border-border opacity-70";
            } else if (selected) {
              style = "border-primary bg-primary/10";
            }
            return (
              <button
                key={L}
                onClick={() => choose(L)}
                disabled={revealedNow}
                className={cn(
                  "btn-ripple flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left text-base transition-all",
                  style
                )}
              >
                <span className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold",
                  selected && !revealedNow && "border-primary bg-primary text-primary-foreground",
                  revealedNow && isCorrect && "border-success bg-success text-white",
                  revealedNow && selected && !isCorrect && "border-destructive bg-destructive text-white",
                )}>{L}</span>
                <span className="flex-1">{val}</span>
                {revealedNow && isCorrect && <CheckCircle2 className="h-5 w-5 text-success" />}
                {revealedNow && selected && !isCorrect && <XCircle className="h-5 w-5 text-destructive" />}
              </button>
            );
          })}
        </div>

        {/* Practice feedback */}
        {revealedNow && (
          <div className="mt-4 animate-fade-in space-y-2">
            <div className={cn(
              "rounded-xl p-3 text-sm font-medium",
              answers[q.id] === q.correct_option ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
            )}>
              {answers[q.id] === q.correct_option
                ? "✅ Correct!"
                : `❌ Incorrect. Correct answer: ${q.correct_option}`}
            </div>
            {q.explanation && (
              <div className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                <Info className="mr-1 inline h-4 w-4" /><b>Explanation:</b> {q.explanation}
              </div>
            )}
            {answers[q.id] !== q.correct_option && !isPreview && userId && (
              <p className="text-xs text-muted-foreground">📓 Saved to your Wrong Questions Notebook.</p>
            )}
          </div>
        )}
      </div>

      {/* Question palette */}
      <div className="rounded-2xl border bg-card p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Question Palette</p>
        <div className="flex flex-wrap gap-2">
          {sessionQs.map((item, i) => (
            <button
              key={item.id}
              onClick={() => goto(i)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold transition-transform hover:scale-110",
                paletteColor(item, i),
                i === current && "ring-2 ring-primary ring-offset-2 ring-offset-background"
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Sticky bottom navigation */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/90 p-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <Button variant="outline" className="btn-ripple" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            variant={marked[q.id] === "review" ? "default" : "outline"}
            className={cn("btn-ripple flex-1", marked[q.id] === "review" && "bg-warning text-white hover:bg-warning/90")}
            onClick={() => toggleMark("review")}
          >
            <Flag className="mr-1 h-4 w-4" /> Review
          </Button>
          {current < sessionQs.length - 1 ? (
            <Button className="btn-ripple flex-1 bg-gradient-royal text-white" onClick={() => setCurrent((c) => c + 1)}>
              Next <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button className="btn-ripple flex-1 bg-gradient-emerald text-white" onClick={() => {
              if (mode === "exam" && answeredCount < sessionQs.length &&
                !confirm(`${sessionQs.length - answeredCount} unanswered. Submit anyway?`)) return;
              submit();
            }}>
              Submit Test
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function HeadStat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-lg bg-white/15 py-1">
      <p className="text-sm font-bold leading-none">{value}</p>
      <p className="mt-0.5 text-white/80">{label}</p>
    </div>
  );
}

function ResultStat({ label, value, className, icon: Icon }: { label: string; value: any; className?: string; icon: any }) {
  return (
    <div className={cn("rounded-2xl p-4 text-center shadow-sm", className)}>
      <Icon className="mx-auto mb-1 h-5 w-5 opacity-90" />
      <p className="text-xl font-extrabold leading-none">{value}</p>
      <p className="mt-1 text-xs opacity-90">{label}</p>
    </div>
  );
}
