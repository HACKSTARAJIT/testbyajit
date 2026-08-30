import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw, Brain, Loader2, TrendingUp, Pause, Play, Bookmark, LogOut } from "lucide-react";
import {
  saveAttempt, requestAI, formatDuration, loadAttempts,
  type AttemptRow, type PracticeQuestion, type PracticeSource,
} from "@/lib/revisionPractice";
import {
  createSession, formatClock, loadLiveSession, saveSession, setSessionStatus,
  type PracticeSessionRow,
} from "@/lib/practiceSession";
import { useFeedbackFX } from "@/hooks/useFeedbackFX";
import { ShuffleModeSetting } from "@/components/test-ui/ShuffleModeSetting";
import {
  shuffleArray, buildOptionOrder, displayLetter, OPTION_LETTERS, type OptionLetter,
} from "@/lib/shuffleMode";

import {
  TestHeader, LivePerformancePanel, QuestionCard, OptionCard, AnswerFeedback,
  FloatingAIStatus, TestBottomNav, AIAnalyzingLoader, ResultHero, ResultStatGrid,
  gradeFor, xpFor, buildInsight, QuestionNavigator, NavigatorPanel, TestWorkspace,
  FocusModeButton, useFocusMode, type NavItemStatus,
} from "@/components/test-ui/PremiumTestUI";


const LETTERS = ["A", "B", "C", "D"] as const;

type Props = {
  userId: string;
  source: PracticeSource;
  sourceKey: string;
  title: string;
  subject?: string | null;
  chapter?: string | null;
  questions: PracticeQuestion[];
  onExit: () => void;
  onFinished?: () => void;
};

/**
 * Practice Mode only — instant feedback, running score, no exam mode,
 * permanent attempt history + Hindi AJIT AI analysis after every test.
 * Session state (question index, answers, marked, elapsed time) is persisted
 * to `practice_sessions` so Pause / Resume survives refresh and app restarts.
 */
export function PracticeRunner({
  userId, source, sourceKey, title, subject, chapter, questions: allQuestions, onExit, onFinished,
}: Props) {
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [questions, setQuestions] = useState<PracticeQuestion[]>(allQuestions);
  const [optionOrder, setOptionOrder] = useState<Record<string, OptionLetter[]>>(() =>
    buildOptionOrder(allQuestions.map((x) => x.id), false)
  );
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [marked, setMarked] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const [attempt, setAttempt] = useState<AttemptRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [comparison, setComparison] = useState("");
  const [aiBusy, setAiBusy] = useState<"analyze" | "compare" | null>(null);
  const [aiError, setAiError] = useState("");

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [resumable, setResumable] = useState<PracticeSessionRow | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [clock, setClock] = useState(0);

  const startedAt = useRef(Date.now());
  const baseElapsed = useRef(0);
  const runStart = useRef<number | null>(null);
  const fx = useFeedbackFX();
  const { focus, toggle: toggleFocus } = useFocusMode();


  const orderFor = (id: string) => optionOrder[id] ?? [...OPTION_LETTERS];

  /** Active (non-paused) elapsed seconds. */
  const elapsedNow = useCallback(
    () => baseElapsed.current + (runStart.current ? (Date.now() - runStart.current) / 1000 : 0),
    [],
  );

  /* ---------------- resume detection ---------------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSessionLoading(true);
      const row = await loadLiveSession(userId, source, sourceKey);
      if (!cancelled) {
        setResumable(row);
        setSessionLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, source, sourceKey]);

  /** Presentation-only randomisation for this attempt; stored data never changes. */
  async function beginSession(useShuffle: boolean) {
    const list = useShuffle ? shuffleArray(allQuestions) : allQuestions;
    const order = buildOptionOrder(list.map((x) => x.id), useShuffle);
    setQuestions(list);
    setOptionOrder(order);
    setIdx(0);
    setAnswers({});
    setMarked([]);
    startedAt.current = Date.now();
    baseElapsed.current = 0;
    runStart.current = Date.now();
    setPaused(false);
    setStarted(true);
    setResumable(null);
    const id = await createSession({
      userId, source, sourceKey, title, subject, chapter,
      questionIds: list.map((x) => x.id),
      optionOrder: order as any,
      shuffleMode: useShuffle,
    });
    setSessionId(id);
  }

  /** Restores an existing paused/active session exactly where it stopped. */
  function resumeSession(row: PracticeSessionRow) {
    const byId = new Map(allQuestions.map((q) => [q.id, q]));
    const ordered = (row.question_ids ?? [])
      .map((id) => byId.get(id))
      .filter(Boolean) as PracticeQuestion[];
    const list = ordered.length ? ordered : allQuestions;
    setQuestions(list);
    setOptionOrder((row.option_order as any) ?? buildOptionOrder(list.map((x) => x.id), false));
    setShuffle(Boolean(row.shuffle_mode));
    setAnswers(row.answers ?? {});
    setMarked(row.marked ?? []);
    setIdx(Math.min(Math.max(row.current_index ?? 0, 0), Math.max(list.length - 1, 0)));
    baseElapsed.current = row.elapsed_seconds ?? 0;
    runStart.current = Date.now();
    startedAt.current = Date.now() - (row.elapsed_seconds ?? 0) * 1000;
    setSessionId(row.id);
    setResumable(null);
    setPaused(false);
    setStarted(true);
  }

  /* ---------------- autosave ---------------- */
  const persist = useCallback(
    async (status: "active" | "paused" | "completed" | "abandoned") => {
      if (!sessionId) return;
      const list = questions;
      const skipped = list
        .slice(0, Math.max(idx, 0))
        .filter((q) => !answers[q.id])
        .map((q) => q.id);
      await saveSession({
        sessionId,
        currentIndex: idx,
        currentQuestionId: list[idx]?.id ?? null,
        answers,
        marked,
        skipped,
        elapsedSeconds: elapsedNow(),
        status,
      });
    },
    [sessionId, questions, idx, answers, marked, elapsedNow],
  );

  // debounced save on every meaningful change
  useEffect(() => {
    if (!started || paused || finished || !sessionId) return;
    const t = window.setTimeout(() => { persist("active"); }, 700);
    return () => window.clearTimeout(t);
  }, [started, paused, finished, sessionId, idx, answers, marked, persist]);

  // periodic safety backup
  useEffect(() => {
    if (!started || paused || finished || !sessionId) return;
    const t = window.setInterval(() => { persist("active"); }, 30000);
    return () => window.clearInterval(t);
  }, [started, paused, finished, sessionId, persist]);

  // live clock (active time only)
  useEffect(() => {
    if (!started || paused || finished) return;
    setClock(elapsedNow());
    const t = window.setInterval(() => setClock(elapsedNow()), 1000);
    return () => window.clearInterval(t);
  }, [started, paused, finished, elapsedNow]);

  async function pauseTest() {
    baseElapsed.current = elapsedNow();
    runStart.current = null;
    setPaused(true);
    setClock(baseElapsed.current);
    if (sessionId) {
      await saveSession({
        sessionId,
        currentIndex: idx,
        currentQuestionId: questions[idx]?.id ?? null,
        answers,
        marked,
        skipped: questions.slice(0, Math.max(idx, 0)).filter((q) => !answers[q.id]).map((q) => q.id),
        elapsedSeconds: baseElapsed.current,
        status: "paused",
      });
    }
  }

  function resumeFromPause() {
    runStart.current = Date.now();
    setPaused(false);
    if (sessionId) setSessionStatus(sessionId, "active");
  }


  const stats = useMemo(() => {
    const answered = questions.filter((q) => answers[q.id]);
    const correct = answered.filter((q) => answers[q.id] === q.correct_answer).length;
    let streak = 0, best = 0;
    for (const q of questions) {
      const a = answers[q.id];
      if (!a) continue;
      if (a === q.correct_answer) { streak += 1; best = Math.max(best, streak); }
      else streak = 0;
    }
    return {
      correct,
      wrong: answered.length - correct,
      attempted: answered.length,
      accuracy: answered.length ? Math.round((correct / answered.length) * 100) : 0,
      revise: questions.filter((q) => answers[q.id] && answers[q.id] !== q.correct_answer),
      streak,
      best,
    };
  }, [questions, answers]);

  function selectAnswer(qid: string, letter: string, correctAnswer: string | null) {
    setAnswers((a) => ({ ...a, [qid]: letter }));
    fx.play(letter === correctAnswer ? "correct" : "wrong");
  }

  function toggleMark(qid: string) {
    setMarked((m) => (m.includes(qid) ? m.filter((x) => x !== qid) : [...m, qid]));
  }

  async function finish() {
    setFinished(true);
    setSaving(true);
    const seconds = Math.round(elapsedNow());
    runStart.current = null;
    const previous = await loadAttempts(userId, source, sourceKey);
    const previousBest = previous.length
      ? Math.max(...previous.map((p) => p.correct_count ?? 0))
      : null;
    const row = await saveAttempt({
      userId, source, sourceKey, title, subject, chapter,
      questions, answers,
      timeTakenSeconds: seconds,
      shuffleMode: shuffle,
    });
    setAttempt(row);
    if (sessionId) await setSessionStatus(sessionId, "completed");
    setSessionId(null);
    setSaving(false);
    onFinished?.();

    // Completion → Perfect → Improvement feedback, then AI analysis stays visible.
    await fx.play("completion");
    if (stats.correct === questions.length && questions.length > 0) {
      window.setTimeout(() => fx.play("perfect"), 900);
    } else if (previousBest !== null && stats.correct > previousBest) {
      window.setTimeout(() => fx.play("improvement"), 900);
    }
  }

  async function runAI(mode: "analyze" | "compare") {
    if (!attempt || aiBusy) return;
    setAiBusy(mode);
    setAiError("");
    try {
      const text = await requestAI(attempt.id, mode);
      if (mode === "analyze") setAnalysis(text);
      else setComparison(text);
    } catch (e: any) {
      setAiError(e?.message ?? "AI अभी उपलब्ध नहीं है, कुछ देर बाद कोशिश करें।");
    } finally {
      setAiBusy(null);
    }
  }

  function restart() {
    setFinished(false);
    setAttempt(null);
    setAnalysis("");
    setComparison("");
    setAiError("");
    fx.resetSession();
    // Fresh randomisation for every new shuffled attempt.
    beginSession(shuffle);
  }

  if (!started) {
    return (
      <div className="test-shell">
        <div className="test-shell-body animate-fade-in space-y-4 py-6">
          <div className="test-glass rounded-3xl p-5">
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {allQuestions.length} questions · ⚡ Practice Mode
            </p>
          </div>

          {resumable && !sessionLoading && (
            <div className="test-glass rounded-3xl border border-primary/40 p-5">
              <p className="text-sm font-bold">⏸ Paused Test</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Question {Math.min((resumable.current_index ?? 0) + 1, allQuestions.length)} of{" "}
                {resumable.question_ids?.length || allQuestions.length} ·{" "}
                {formatClock(resumable.elapsed_seconds ?? 0)} spent
              </p>
              <Button
                className="mt-3 h-11 w-full rounded-2xl bg-gradient-neon text-white"
                onClick={() => resumeSession(resumable)}
              >
                <Play className="mr-2 h-4 w-4" /> Resume Test
              </Button>
            </div>
          )}

          <ShuffleModeSetting value={shuffle} onChange={setShuffle} />
          <Button
            className="h-12 w-full rounded-2xl bg-gradient-neon text-white"
            onClick={() => beginSession(shuffle)}
          >
            {resumable ? "START NEW TEST" : "START TEST"}
          </Button>
          <Button variant="ghost" className="w-full" onClick={onExit}>Back</Button>
        </div>
      </div>
    );
  }

  if (paused && !finished) {
    return (
      <div className="test-shell">
        <div className="test-shell-body animate-fade-in space-y-4 py-10">
          <div className="test-glass rounded-3xl p-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15">
              <Pause className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-xl font-bold">Test Paused</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your progress has been saved.</p>
            <p className="mt-3 text-xs text-muted-foreground">
              Question {idx + 1} of {questions.length} · {formatClock(clock)} spent ·{" "}
              {stats.attempted} answered · {marked.length} marked
            </p>
          </div>

          {confirmExit ? (
            <div className="test-glass space-y-3 rounded-3xl p-5">
              <p className="text-sm font-semibold">Are you sure you want to exit?</p>
              <p className="text-xs text-muted-foreground">
                आपकी प्रगति सुरक्षित रहेगी और आप बाद में इसी प्रश्न से जारी रख सकते हैं।
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="secondary" className="h-11 rounded-2xl" onClick={() => setConfirmExit(false)}>
                  Continue Test
                </Button>
                <Button
                  className="h-11 rounded-2xl bg-gradient-neon text-white"
                  onClick={async () => { await persist("paused"); onExit(); }}
                >
                  Exit &amp; Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              <Button className="h-12 rounded-2xl bg-gradient-neon text-white" onClick={resumeFromPause}>
                <Play className="mr-2 h-4 w-4" /> Resume Test
              </Button>
              <Button variant="secondary" className="h-12 rounded-2xl" onClick={() => setConfirmExit(true)}>
                <LogOut className="mr-2 h-4 w-4" /> Exit Test
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (finished) {

    const timeTaken = attempt?.time_taken_seconds ?? 0;
    const accuracy = questions.length ? Math.round((stats.correct / questions.length) * 100) : 0;
    return (
      <div className="test-shell pb-10">
        <div className="test-shell-body animate-fade-in space-y-4">

        <ResultHero
          title={title}
          score={String(stats.correct)}
          total={String(questions.length)}
          grade={gradeFor(accuracy)}
          xp={xpFor(stats.correct, accuracy)}
        />

        <ResultStatGrid
          items={[
            { label: "Correct", value: stats.correct },
            { label: "Wrong", value: stats.wrong },
            { label: "Skipped", value: questions.length - stats.attempted },
            { label: "Accuracy", value: `${accuracy}%` },
            { label: "Best Streak", value: stats.best },
            { label: "Total Time", value: formatDuration(timeTaken) },
            { label: "XP Earned", value: xpFor(stats.correct, accuracy) },
            { label: "Grade", value: gradeFor(accuracy) },
          ]}
        />

        {(saving || aiBusy) && <AIAnalyzingLoader />}

        {/* AJIT AI — integrated, no separate page */}
        <div className="test-glass space-y-3 p-5">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold">AJIT AI</h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              className="rounded-2xl bg-gradient-neon text-white" disabled={!attempt || aiBusy !== null}
              onClick={() => runAI("analyze")}
            >
              {aiBusy === "analyze" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
              🧠 Analyze My Performance
            </Button>
            <Button
              variant="secondary" className="rounded-2xl" disabled={!attempt || aiBusy !== null}
              onClick={() => runAI("compare")}
            >
              {aiBusy === "compare" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-2 h-4 w-4" />}
              📈 Compare With Previous
            </Button>
          </div>
          {aiError && <p className="text-xs text-destructive">{aiError}</p>}
          {analysis && (
            <div className="whitespace-pre-wrap rounded-2xl bg-white/5 p-4 text-sm leading-relaxed">{analysis}</div>
          )}
          {comparison && (
            <div className="whitespace-pre-wrap rounded-2xl bg-primary/10 p-4 text-sm leading-relaxed">{comparison}</div>
          )}
        </div>

        <div className="test-glass p-4">
          <p className="font-semibold">🔁 Questions to Revise Again ({stats.revise.length})</p>
          {stats.revise.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nothing pending — all correct!</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {stats.revise.map((q, i) => (
                <li key={q.id} className="rounded-xl border border-white/10 bg-white/5 p-2 text-xs">
                  <span className="font-medium">{i + 1}. </span>{q.question_text}
                  {(q.chapter || q.topic) && (
                    <span className="block pt-1 text-muted-foreground">{[q.chapter, q.topic].filter(Boolean).join(" · ")}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" className="h-12 rounded-2xl" onClick={onExit}>Back</Button>
          <Button className="h-12 rounded-2xl bg-gradient-neon text-white" onClick={restart}>
            <RotateCcw className="mr-2 h-4 w-4" /> Practice Again
          </Button>
        </div>
        {fx.overlay}
        </div>
      </div>

    );
  }

  const q = questions[idx];
  const picked = answers[q.id];
  const revealed = Boolean(picked);
  const isCorrect = picked === q.correct_answer;
  const isMarked = marked.includes(q.id);

  const navStatus = (i: number): NavItemStatus => {
    const item = questions[i];
    if (!item) return "unvisited";
    const a = answers[item.id];
    if (a) return a === item.correct_answer ? "correct" : "wrong";
    if (marked.includes(item.id)) return "marked";
    return i < idx ? "skipped" : "unvisited";
  };


  return (
    <div className="test-shell">
      <TestHeader
        title={title}
        current={idx + 1}
        total={questions.length}
        progress={((idx + (revealed ? 1 : 0)) / questions.length) * 100}
        subtitle={`${shuffle ? "⚡ Practice Mode · 🔀 Shuffled" : "⚡ Practice Mode"} · ⏱ ${formatClock(clock)}`}
        stats={{
          correct: stats.correct,
          wrong: stats.wrong,
          skipped: Math.max(0, idx - stats.attempted),
          accuracy: stats.accuracy,
          score: `${stats.correct}/${questions.length}`,
        }}
        right={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="h-9 rounded-xl px-3"
              onClick={pauseTest}
              aria-label="Pause Test"
            >
              <Pause className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Pause</span>
            </Button>
            <div className={focus ? "block" : "hidden"}>
              <QuestionNavigator
                total={questions.length}
                current={idx}
                statusFor={navStatus}
                onJump={(i) => setIdx(i)}
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
            total={questions.length}
            current={idx}
            statusFor={navStatus}
            onJump={(i) => setIdx(i)}
          />
        }
      >
        <LivePerformancePanel
          className="xl:hidden"
          stats={{
            correct: stats.correct,
            wrong: stats.wrong,
            skipped: Math.max(0, idx - stats.attempted),
            accuracy: stats.accuracy,
            score: `${stats.correct}/${questions.length}`,
            streak: stats.streak,
            bestStreak: stats.best,
            remaining: questions.length - (idx + (revealed ? 1 : 0)),
          }}
        />



        <QuestionCard
          key={q.id}
          index={idx + 1}
          meta={[subject, q.chapter, q.topic]}
          question={q.question_text}
        >
          {orderFor(q.id).map((L, oi) => {
            const val = (q as any)[`option_${L.toLowerCase()}`] as string | null;
            if (!val) return null;
            const isRight = q.correct_answer === L;
            const isMine = picked === L;
            const state = !revealed
              ? "idle"
              : isRight ? "correct" : isMine ? "wrong" : "dim";
            return (
              <OptionCard
                key={L}
                letter={LETTERS[oi]}
                text={val}
                state={state as any}
                disabled={revealed}
                onClick={() => selectAnswer(q.id, L, q.correct_answer)}
              />
            );
          })}
        </QuestionCard>

        <div className="flex justify-center">
          <Button
            size="sm"
            variant={isMarked ? "default" : "outline"}
            className="rounded-2xl"
            onClick={() => toggleMark(q.id)}
          >
            <Bookmark className="mr-1 h-4 w-4" />
            {isMarked ? "Marked for Review" : "Mark for Review"}
          </Button>
        </div>

        {revealed && (
          <AnswerFeedback
            correct={isCorrect}
            correctOption={q.correct_answer ? displayLetter(orderFor(q.id), q.correct_answer) : q.correct_answer}
            yourOption={picked ? displayLetter(orderFor(q.id), picked) : picked}

            explanation={q.explanation}
            aiInsight={buildInsight({
              correct: isCorrect, topic: q.topic, chapter: q.chapter, subject,
            })}
            extra={q.previous_answer ? (
              <p className="px-1 text-xs text-muted-foreground">
                📝 Earlier you answered: <b className="text-foreground">{q.previous_answer}</b>
              </p>
            ) : undefined}
          />
        )}

        {!revealed && (
          <p className="text-center text-xs text-muted-foreground">
            Select an option to see the answer instantly.
          </p>
        )}
      </TestWorkspace>

      <FloatingAIStatus />

      <TestBottomNav>
        <div className={focus ? "block" : "xl:hidden"}>

          <QuestionNavigator
            total={questions.length}
            current={idx}
            statusFor={navStatus}
            onJump={(i) => setIdx(i)}
          />
        </div>

        <Button variant="outline" className="h-12 flex-1 rounded-2xl" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
          Previous
        </Button>

        {idx < questions.length - 1 ? (
          <Button className="h-12 flex-1 rounded-2xl bg-gradient-neon text-white" disabled={!revealed} onClick={() => setIdx((i) => i + 1)}>
            Next Question
          </Button>
        ) : (
          <Button className="h-12 flex-1 rounded-2xl bg-gradient-neon text-white" disabled={!revealed} onClick={finish}>
            Finish
          </Button>
        )}
      </TestBottomNav>
      {fx.overlay}
    </div>
  );
}
