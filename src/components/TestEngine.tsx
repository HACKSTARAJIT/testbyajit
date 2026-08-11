import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Clock, CheckCircle2, XCircle, ArrowLeft, ArrowRight, Trophy, Flag,
  Target, RotateCcw, ListChecks, Sparkles, Info, Dice5, Brain, Star,
} from "lucide-react";
import { recordAttempt } from "@/lib/revisionEngine";
import {
  shuffleArray, buildOptionOrder, displayLetter, OPTION_LETTERS, type OptionLetter,
} from "@/lib/shuffleMode";

import {
  TestHeader, CircularTimer, LivePerformancePanel, QuestionCard, OptionCard,
  AnswerFeedback, FloatingAIStatus, TestBottomNav, AIAnalyzingLoader,
  ResultHero, ResultStatGrid, gradeFor, xpFor, buildInsight,
  QuestionNavigator, NavigatorPanel, TestWorkspace, FocusModeButton, useFocusMode,
  type NavItemStatus,
} from "@/components/test-ui/PremiumTestUI";


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
  shuffle = false,
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
  /** Presentation-only: randomise question + option order for this attempt. */
  shuffle?: boolean;
  onSubmit?: (answers: Record<string, string>, questions: EngineQuestion[]) => void | Promise<void>;
  onExit: () => void;
  resume?: {
    attemptId: string;
    answers: Record<string, string>;
    current_index: number;
    marked: Record<string, MarkState>;
  };
}) {
  // Shuffle is applied only to the display order of this session; question IDs,
  // option texts and correct answers are never modified.
  const [sessionQs, setSessionQs] = useState<EngineQuestion[]>(() =>
    shuffle ? shuffleArray(questions) : questions
  );
  const [optionOrder, setOptionOrder] = useState<Record<string, OptionLetter[]>>(() =>
    buildOptionOrder(questions.map((x) => x.id), shuffle)
  );
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
  const orderFor = (id: string) => optionOrder[id] ?? [...OPTION_LETTERS];
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
      shuffle_mode: shuffle,
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
  }, [canSave, userId, test.id, stats, sessionQs.length, mode, shuffle, current, answers, marked, guesses]);

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
        else if (autoRecord) await recordAttempt(userId, test, sessionQs, answers, { marked, guesses });
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
    // Fresh randomisation on every new shuffled attempt.
    setSessionQs(shuffle ? shuffleArray(base) : base);
    setOptionOrder(buildOptionOrder(base.map((x) => x.id), shuffle));

    setAnswers({});
    setMarked({});
    setRevealed({});
    setGuessArmed({});
    setGuesses({});
    setCurrent(0);
    setSubmitted(false);
    setResult(null);
    setSecondsLeft((test.duration_minutes ?? 30) * 60);
    startTime.current = Date.now();
    qStartTime.current = Date.now();
    attemptId.current = null;
    savedWrong.current = new Set();
    if (canSave) persist("in_progress");
  };

  // ---------- GUESS INTELLIGENCE ----------
  const guessStats = useMemo(() => {
    const gIds = Object.keys(guesses);
    const total = gIds.length;
    let gCorrect = 0, gWrong = 0, kCorrect = 0, kWrong = 0, kAttempted = 0;
    for (const item of sessionQs) {
      const ans = answers[item.id];
      if (!ans) continue;
      const isCorrect = ans === item.correct_option;
      if (guesses[item.id]) {
        if (isCorrect) gCorrect += 1; else gWrong += 1;
      } else {
        kAttempted += 1;
        if (isCorrect) kCorrect += 1; else kWrong += 1;
      }
    }
    const guessAccuracy = total ? Math.round((gCorrect / total) * 100) : 0;
    const knowledgeAccuracy = kAttempted ? Math.round((kCorrect / kAttempted) * 100) : 0;
    const guessPct = sessionQs.length ? Math.round((total / sessionQs.length) * 100) : 0;
    return { total, gCorrect, gWrong, kCorrect, kWrong, kAttempted, guessAccuracy, knowledgeAccuracy, guessPct };
  }, [guesses, answers, sessionQs]);


  // ---------- RESULT SCREEN ----------
  if (submitted && result) {
    const totalMarks = result.totalMarks || sessionQs.length;
    const pct = totalMarks ? Math.round((result.score / totalMarks) * 100) : 0;
    const tm = String(Math.floor(result.timeTaken / 60)).padStart(2, "0");
    const ts = String(result.timeTaken % 60).padStart(2, "0");
    const bestStreak = (() => {
      let cur = 0, best = 0;
      for (const item of sessionQs) {
        const a = answers[item.id];
        if (!a) continue;
        if (a === item.correct_option) { cur += 1; best = Math.max(best, cur); } else cur = 0;
      }
      return best;
    })();
    return (
      <div className="test-shell pb-10">
        <div className="test-shell-body animate-fade-in space-y-4">

        <ResultHero
          title={test.title}
          score={String(result.score)}
          total={String(totalMarks)}
          grade={gradeFor(result.accuracy)}
          xp={xpFor(result.correct, result.accuracy)}
        />

        <AIAnalyzingLoader />

        <ResultStatGrid
          items={[
            { label: "Correct", value: result.correct },
            { label: "Wrong", value: result.incorrect },
            { label: "Skipped", value: result.skipped },
            { label: "Accuracy", value: `${result.accuracy}%` },
            { label: "Best Streak", value: bestStreak },
            { label: "Total Time", value: `${tm}:${ts}` },
            { label: "XP Earned", value: xpFor(result.correct, result.accuracy) },
            { label: "Grade", value: gradeFor(result.accuracy) },
          ]}
        />

        {guessStats.total > 0 && (
          <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-card to-primary/5 p-5 shadow-md">
            <div className="mb-3 flex items-center gap-2">
              <Dice5 className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Guess Intelligence</h3>
              <Badge variant="secondary" className="ml-auto text-[10px]">AI Analysis</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniStat label="Guessed" value={guessStats.total} />
              <MiniStat label="Guess ✓" value={guessStats.gCorrect} tone="success" />
              <MiniStat label="Guess ✗" value={guessStats.gWrong} tone="danger" />
              <MiniStat label="Guess Acc." value={`${guessStats.guessAccuracy}%`} />
              <MiniStat label="Knowledge ✓" value={guessStats.kCorrect} tone="success" />
              <MiniStat label="Knowledge ✗" value={guessStats.kWrong} tone="danger" />
              <MiniStat label="Knowledge Acc." value={`${guessStats.knowledgeAccuracy}%`} />
              <MiniStat label="Guess %" value={`${guessStats.guessPct}%`} />
            </div>
            <p className="mt-3 rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
              <Brain className="mr-1 inline h-3.5 w-3.5 text-primary" />
              {guessInsight(guessStats)}
            </p>
          </div>
        )}

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
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">Q{i + 1}. {item.question_text}</p>
                {guesses[item.id] && (
                  <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
                    <Dice5 className="h-3 w-3" /> Guess
                  </Badge>
                )}
              </div>
              <div className="mt-2 space-y-1.5">
                {orderFor(item.id).map((L, oi) => {
                  const val = item[`option_${L.toLowerCase()}` as keyof EngineQuestion] as string;
                  if (!val || val === "-") return null;
                  const label = LETTERS[oi];
                  const isCorrect = item.correct_option === L;
                  const isChosen = chosen === L;
                  return (
                    <div key={L} className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm",
                      isCorrect && "border-success bg-success/10",
                      isChosen && !isCorrect && "border-destructive bg-destructive/10"
                    )}>
                      <span className="font-semibold">{label}.</span> {val}
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
      </div>
    );

  }

  // ---------- QUESTION SCREEN ----------
  const revealedNow = mode === "practice" && revealed[q.id];
  const answeredCount = Object.keys(answers).length;

  const navStatus = (i: number): NavItemStatus => {
    const item = sessionQs[i];
    if (!item) return "unvisited";
    const a = answers[item.id];
    const mk = marked[item.id];
    if (mode === "practice" && revealed[item.id]) {
      return a === item.correct_option ? "correct" : "wrong";
    }
    if (mk === "review" || mk === "doubt") return "marked";
    if (a) return "answered";
    return i < current ? "skipped" : "unvisited";
  };


  // Presentational streak metrics (no scoring impact)
  const streaks = (() => {
    let cur = 0, best = 0;
    for (const item of sessionQs) {
      const a = answers[item.id];
      if (!a) continue;
      if (a === item.correct_option) { cur += 1; best = Math.max(best, cur); }
      else cur = 0;
    }
    return { cur, best };
  })();

  return (
    <div className="test-shell">
      <TestHeader
        title={test.title}
        current={current + 1}
        total={sessionQs.length}
        progress={((current + 1) / sessionQs.length) * 100}
        subtitle={`${mode === "practice" ? "⚡ Practice Mode" : "🎯 Exam Mode"}${shuffle ? " · 🔀 Shuffled" : ""}`}
        timer={<CircularTimer secondsLeft={secondsLeft} totalSeconds={(test.duration_minutes ?? 30) * 60} />}
        stats={{
          correct: stats.correct,
          wrong: stats.incorrect,
          skipped: stats.skipped,
          accuracy: stats.accuracy,
          score: stats.score,
        }}
        right={
          <div className="flex items-center gap-2">
            <div className={cn(focus ? "block" : "hidden")}>
              <QuestionNavigator
                total={sessionQs.length}
                current={current}
                statusFor={navStatus}
                onJump={goto}
              />
            </div>
            <FocusModeButton focus={focus} onToggle={toggleFocus} />
          </div>
        }
      />

      <TestWorkspace
        showSidebar={!focus}
        sidebar={
          <NavigatorPanel
            total={sessionQs.length}
            current={current}
            statusFor={navStatus}
            onJump={goto}
          />
        }
      >
        <LivePerformancePanel
          className="xl:hidden"
          stats={{
            correct: stats.correct,
            wrong: stats.incorrect,
            skipped: stats.skipped,
            accuracy: stats.accuracy,
            score: stats.score,
            streak: streaks.cur,
            bestStreak: streaks.best,
            remaining: sessionQs.length - stats.attempted,
          }}
        />



        <QuestionCard
          key={q.id}
          index={current + 1}
          meta={[test.subjectName, test.test_part]}
          question={q.question_text}
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleGuess}
                aria-pressed={!!guessArmed[q.id]}
                aria-label="Toggle guess mode for this question"
                title="Mark this answer as a guess (does not affect scoring)"
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                  guessArmed[q.id]
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-white/10 bg-white/5 text-muted-foreground hover:border-primary/50",
                )}
              >
                <Dice5 className="h-3.5 w-3.5" /> Guess {guessArmed[q.id] ? "ON" : "OFF"}
              </button>
              <button
                type="button"
                onClick={() => toggleMark("review")}
                aria-pressed={marked[q.id] === "review"}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                  marked[q.id] === "review"
                    ? "text-amber-400"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Star className={cn("h-4 w-4", marked[q.id] === "review" && "fill-amber-400")} />
                Mark for Review
              </button>
            </div>
          }

        >
          {marked[q.id] && (
            <p className="text-[11px] font-semibold text-amber-400">
              {marked[q.id] === "review" ? "🚩 Marked for Review" : "❓ Marked as Doubt"}
            </p>
          )}
          {orderFor(q.id).map((L, oi) => {
            const val = q[`option_${L.toLowerCase()}` as keyof EngineQuestion] as string;
            if (!val || val === "-") return null;
            const selected = answers[q.id] === L;
            const isCorrect = q.correct_option === L;
            const state = revealedNow
              ? isCorrect ? "correct" : selected ? "wrong" : "dim"
              : selected ? "selected" : "idle";
            return (
              <OptionCard
                key={L}
                letter={LETTERS[oi]}
                text={val}
                state={state as any}
                disabled={!!revealedNow}
                onClick={() => choose(L)}
              />
            );
          })}
        </QuestionCard>

        {revealedNow && (
          <AnswerFeedback
            correct={answers[q.id] === q.correct_option}
            correctOption={displayLetter(orderFor(q.id), q.correct_option)}
            yourOption={answers[q.id] ? displayLetter(orderFor(q.id), answers[q.id]) : answers[q.id]}

            explanation={q.explanation}
            aiInsight={buildInsight({
              correct: answers[q.id] === q.correct_option,
              subject: test.subjectName,
              chapter: test.test_part,
              wasGuess: !!guesses[q.id],
            })}
            extra={
              answers[q.id] !== q.correct_option && !isPreview && userId ? (
                <p className="px-1 text-xs text-muted-foreground">📓 Saved to your Wrong Questions Notebook.</p>
              ) : undefined
            }
          />
        )}

      </TestWorkspace>


      <FloatingAIStatus />

      <TestBottomNav>
        <div className={cn(focus ? "block" : "xl:hidden")}>
          <QuestionNavigator
            total={sessionQs.length}
            current={current}
            statusFor={navStatus}
            onJump={goto}
          />
        </div>

        <Button
          variant="outline"
          className="h-12 flex-1 rounded-2xl"
          disabled={current === 0}
          onClick={() => setCurrent((c) => c - 1)}
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Previous
        </Button>

        <Button
          variant="outline"
          className={cn("h-12 flex-1 rounded-2xl", marked[q.id] === "review" && "border-amber-500/60 bg-amber-500/15 text-amber-400")}
          onClick={() => toggleMark("review")}
        >
          <Flag className="mr-1 h-4 w-4" /> Review &amp; Mark
        </Button>

        {current < sessionQs.length - 1 ? (
          <Button className="h-12 flex-1 rounded-2xl bg-gradient-neon text-white" onClick={() => setCurrent((c) => c + 1)}>
            Next <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button
            className="h-12 flex-1 rounded-2xl bg-gradient-neon text-white"
            onClick={() => {
              if (mode === "exam" && answeredCount < sessionQs.length &&
                !confirm(`${sessionQs.length - answeredCount} unanswered. Submit anyway?`)) return;
              submit();
            }}
          >
            Submit Test
          </Button>
        )}
      </TestBottomNav>
    </div>
  );
}



function MiniStat({ label, value, tone }: { label: string; value: any; tone?: "success" | "danger" }) {
  return (
    <div className={cn(
      "rounded-xl border p-2 text-center",
      tone === "success" && "border-success/30 bg-success/10",
      tone === "danger" && "border-destructive/30 bg-destructive/10",
      !tone && "border-border bg-muted/40",
    )}>
      <p className="text-base font-bold leading-none">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function guessInsight(s: {
  total: number; gCorrect: number; guessAccuracy: number;
  knowledgeAccuracy: number; guessPct: number;
}) {
  const parts: string[] = [];
  parts.push(`You guessed ${s.total} question${s.total === 1 ? "" : "s"}.`);
  parts.push(`Your Guess Accuracy is ${s.guessAccuracy}%.`);
  if (s.guessPct >= 40) parts.push("High Guess Dependency — try to strengthen core concepts instead of relying on guesses.");
  else if (s.guessPct >= 20) parts.push("Balanced Guess Strategy — keep improving your first-instinct accuracy.");
  else parts.push("Low Guess Dependency — most answers are knowledge-based, keep it up!");
  if (s.guessAccuracy >= 60 && s.total >= 3) parts.push("Your educated-guessing skill is strong.");
  else if (s.total >= 3 && s.guessAccuracy < 35) parts.push("Try eliminating 1–2 options before guessing to raise your odds.");
  if (s.knowledgeAccuracy && s.knowledgeAccuracy - s.guessAccuracy >= 25) {
    parts.push("Knowledge answers are significantly more accurate than guesses — trust what you know.");
  }
  return parts.join(" ");
}
