import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2, XCircle, Lightbulb, RotateCcw, Brain, Loader2, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  saveAttempt, requestAI, formatDuration,
  type AttemptRow, type PracticeQuestion, type PracticeSource,
} from "@/lib/revisionPractice";

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
 */
export function PracticeRunner({
  userId, source, sourceKey, title, subject, chapter, questions, onExit, onFinished,
}: Props) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [finished, setFinished] = useState(false);
  const [attempt, setAttempt] = useState<AttemptRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [comparison, setComparison] = useState("");
  const [aiBusy, setAiBusy] = useState<"analyze" | "compare" | null>(null);
  const [aiError, setAiError] = useState("");
  const startedAt = useRef(Date.now());

  const stats = useMemo(() => {
    const answered = questions.filter((q) => answers[q.id]);
    const correct = answered.filter((q) => answers[q.id] === q.correct_answer).length;
    return {
      correct,
      wrong: answered.length - correct,
      attempted: answered.length,
      accuracy: answered.length ? Math.round((correct / answered.length) * 100) : 0,
      revise: questions.filter((q) => answers[q.id] && answers[q.id] !== q.correct_answer),
    };
  }, [questions, answers]);

  async function finish() {
    setFinished(true);
    setSaving(true);
    const row = await saveAttempt({
      userId, source, sourceKey, title, subject, chapter,
      questions, answers,
      timeTakenSeconds: Math.round((Date.now() - startedAt.current) / 1000),
    });
    setAttempt(row);
    setSaving(false);
    onFinished?.();
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
    setAnswers({});
    setIdx(0);
    setFinished(false);
    setAttempt(null);
    setAnalysis("");
    setComparison("");
    setAiError("");
    startedAt.current = Date.now();
  }

  useEffect(() => { startedAt.current = Date.now(); }, []);

  if (finished) {
    const timeTaken = attempt?.time_taken_seconds ?? 0;
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="rounded-3xl bg-gradient-royal p-6 text-white shadow-lg">
          <h1 className="font-display text-2xl font-bold">Practice Complete 🎉</h1>
          <p className="mt-1 text-sm text-white/85">{title}</p>
          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            <Stat label="Score" value={`${stats.correct}/${questions.length}`} />
            <Stat label="Correct" value={String(stats.correct)} />
            <Stat label="Wrong" value={String(stats.wrong)} />
            <Stat label="Accuracy" value={`${Math.round((stats.correct / questions.length) * 100)}%`} />
          </div>
          <p className="mt-3 text-center text-xs text-white/80">
            {saving ? "Saving attempt…" : `Attempt saved · ${formatDuration(timeTaken)}`}
          </p>
        </div>

        {/* AJIT AI — integrated, no separate page */}
        <div className="glass-card space-y-3 rounded-3xl p-5">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-secondary" />
            <h3 className="text-sm font-bold">AJIT AI</h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              className="rounded-2xl" disabled={!attempt || aiBusy !== null}
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
            <div className="whitespace-pre-wrap rounded-2xl bg-muted/50 p-4 text-sm leading-relaxed">{analysis}</div>
          )}
          {comparison && (
            <div className="whitespace-pre-wrap rounded-2xl bg-primary/5 p-4 text-sm leading-relaxed">{comparison}</div>
          )}
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

        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" className="rounded-2xl" onClick={onExit}>Back</Button>
          <Button className="rounded-2xl" onClick={restart}>
            <RotateCcw className="mr-2 h-4 w-4" /> Practice Again
          </Button>
        </div>
      </div>
    );
  }

  const q = questions[idx];
  const picked = answers[q.id];
  const revealed = Boolean(picked);
  const isCorrect = picked === q.correct_answer;

  return (
    <div className="space-y-4 animate-fade-in">
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
              Your answer: <b className="text-foreground">{picked}</b> · Correct answer:{" "}
              <b className="text-foreground">{q.correct_answer || "—"}</b>
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
            {q.previous_answer && (
              <p className="text-xs text-muted-foreground">
                📝 Earlier you answered: <b className="text-foreground">{q.previous_answer}</b>
              </p>
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
          <Button className="rounded-2xl" disabled={!revealed} onClick={finish}>Finish</Button>
        )}
      </div>
      {!revealed && <p className="text-center text-xs text-muted-foreground">Select an option to see the answer instantly.</p>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/15 p-3">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[11px] text-white/80">{label}</p>
    </div>
  );
}
