import { ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { APP_LOGO, APP_LOGO_ALT, APP_NAME } from "@/lib/brand";
import {
  Brain, CheckCircle2, XCircle, Lightbulb, Zap, Sparkles, ChevronDown,
  ArrowLeft, ArrowRight, Flag, Timer, ListOrdered, Maximize2, Minimize2,
  Minus, Plus,
} from "lucide-react";

/**
 * Universal Premium Test UI kit.
 * Presentation only — no scoring, navigation, AI or data logic lives here.
 * Used by every test surface in PRACTICE WITH AJIT (TestEngine + PracticeRunner).
 */


/* ------------------------------ Circular timer ----------------------------- */
export function CircularTimer({
  secondsLeft, totalSeconds, size = 56, label,
}: { secondsLeft: number; totalSeconds: number; size?: number; label?: string }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const pct = totalSeconds > 0 ? Math.max(0, Math.min(1, secondsLeft / totalSeconds)) : 0;
  const danger = secondsLeft <= 60;
  const mm = String(Math.floor(Math.max(secondsLeft, 0) / 60)).padStart(2, "0");
  const ss = String(Math.max(secondsLeft, 0) % 60).padStart(2, "0");
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-label={label ?? "Time remaining"}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={4} className="fill-none stroke-white/15" />
        <circle
          cx={size / 2} cy={size / 2} r={r} strokeWidth={4} strokeLinecap="round"
          className={cn("fill-none transition-[stroke-dashoffset] duration-1000 ease-linear",
            danger ? "stroke-destructive" : "stroke-white")}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-[11px] font-bold tabular-nums", danger && "text-destructive")}>{mm}:{ss}</span>
      </div>
    </div>
  );
}

export function Stopwatch({ seconds }: { seconds: number }) {
  const h = Math.floor(seconds / 3600);
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return (
    <div className="flex h-10 shrink-0 items-center gap-1 rounded-md border bg-background px-2 text-sm font-bold tabular-nums" aria-label="Time taken" role="timer">
      <span aria-hidden>⏱</span>{h > 0 ? `${h}:` : ""}{mm}:{ss}
    </div>
  );
}

/* --------------------------------- Header --------------------------------- */
export function TestHeader({
  title, current, total, progress, right, mobileTools, onExit, subtitle, section, timer, stats, textSizeControl,
}: {
  title: string; current: number; total: number; progress: number;
  right?: ReactNode; subtitle?: string; section?: string | null; timer?: ReactNode;
  stats?: LiveStats; textSizeControl?: ReactNode; mobileTools?: ReactNode; onExit?: () => void;
}) {
  return (
    <header className="test-header sticky top-0 z-30 -mx-3 mb-3 border-b bg-background/95 px-3 py-2 backdrop-blur-xl sm:-mx-5 sm:px-5">
      <div className="mx-auto flex max-w-[1600px] items-center gap-2 md:gap-3">
        {onExit && (
          <Button type="button" variant="ghost" size="icon" onClick={onExit} aria-label="Exit test" className="h-11 w-11 shrink-0 md:hidden">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        {/* Brand */}
        <div className="hidden min-w-0 items-center gap-2 pr-2 lg:flex">
          <img src={APP_LOGO} alt={APP_LOGO_ALT} className="h-8 w-8 shrink-0 object-contain" />
          <span className="max-w-36 text-xs font-bold leading-tight">{APP_NAME}</span>
        </div>
        <div className="hidden h-8 w-px bg-border lg:block" />

        {/* Test name */}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-sm font-bold">{title}</h1>
          <p className="truncate text-[11px] text-muted-foreground">
            <span className="md:hidden">Q {current} / {total}</span>
            <span className="hidden md:inline">{section ? `${section} · ` : ""}Question {current} / {total}</span>
            {subtitle ? <span className="hidden lg:inline"> · {subtitle}</span> : null}
          </p>
        </div>

        {/* Timer */}
        {timer && (
          <div className="flex shrink-0 items-center gap-2 px-1 md:border-x md:border-border md:px-3">
            {timer}
            <div className="hidden leading-tight lg:block">
              <p className="text-[11px] text-muted-foreground">Time Left</p>
            </div>
          </div>
        )}

        {textSizeControl && <div className="hidden shrink-0 md:block">{textSizeControl}</div>}

        {/* Inline stat strip (desktop) */}
        {stats && (
          <div className="hidden shrink-0 items-center gap-5 px-3 xl:flex">
            <HeaderStat label="Correct" value={stats.correct} tone="text-emerald-400" />
            <HeaderStat label="Wrong" value={stats.wrong} tone="text-destructive" />
            <HeaderStat label="Skipped" value={stats.skipped} tone="text-amber-400" />
            <HeaderStat label="Accuracy" value={`${stats.accuracy}%`} tone="text-foreground" />
            {stats.score !== undefined && (
              <HeaderStat label="Score" value={stats.score} tone="text-primary" />
            )}
          </div>
        )}

        {right && <div className="hidden shrink-0 md:block">{right}</div>}
        {onExit && (
          <Button type="button" variant="outline" onClick={onExit} className="hidden h-11 shrink-0 md:inline-flex" aria-label="Exit test">
            Exit
          </Button>
        )}
      </div>

      {mobileTools && <div className="mx-auto mt-2 flex max-w-[1600px] items-center justify-between gap-2 md:hidden">{mobileTools}</div>}

      <div className="mx-auto mt-2 h-0.5 max-w-[1600px] overflow-hidden bg-muted">
        <div
          className="h-full bg-primary transition-[width] duration-300"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </header>
  );
}

export type TestTextSize = "xs" | "s" | "m" | "l" | "xl";
const TEXT_SIZES: TestTextSize[] = ["xs", "s", "m", "l", "xl"];
const TEXT_SIZE_KEY = "practice-with-ajit:test-text-size";

export function useTestTextSize() {
  const [size, setSize] = useState<TestTextSize>(() => {
    if (typeof window === "undefined") return "m";
    const saved = window.localStorage.getItem(TEXT_SIZE_KEY) as TestTextSize | null;
    return saved && TEXT_SIZES.includes(saved) ? saved : "m";
  });
  useEffect(() => { window.localStorage.setItem(TEXT_SIZE_KEY, size); }, [size]);
  const index = TEXT_SIZES.indexOf(size);
  return {
    size,
    decrease: () => setSize(TEXT_SIZES[Math.max(0, index - 1)]),
    reset: () => setSize("m"),
    increase: () => setSize(TEXT_SIZES[Math.min(TEXT_SIZES.length - 1, index + 1)]),
    canDecrease: index > 0,
    canIncrease: index < TEXT_SIZES.length - 1,
  };
}

export function TestTextSizeControl({
  size, decrease, reset, increase, canDecrease, canIncrease, compact = false,
}: ReturnType<typeof useTestTextSize> & { compact?: boolean }) {
  return (
    <div className={cn("inline-flex h-11 items-center overflow-hidden rounded-md border bg-card", compact && "h-10")} aria-label="Question text size">
      <button type="button" onClick={decrease} disabled={!canDecrease} aria-label="Decrease question text size" className={cn("flex h-11 w-11 items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-40", compact && "h-10 w-10")}>
        <Minus className="h-3.5 w-3.5" /><span className="text-xs font-bold">A</span>
      </button>
      <button type="button" onClick={reset} aria-label={`Question text size ${size.toUpperCase()}; reset to medium`} className={cn("flex h-11 min-w-11 items-center justify-center border-x px-2 text-xs font-bold hover:bg-muted", compact && "h-10 min-w-10")}>
        {compact ? "A" : size.toUpperCase()}
      </button>
      <button type="button" onClick={increase} disabled={!canIncrease} aria-label="Increase question text size" className={cn("flex h-11 w-11 items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-40", compact && "h-10 w-10")}>
        <span className="text-sm font-bold">A</span><Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function HeaderStat({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className="text-center leading-tight">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-bold tabular-nums", tone)}>{value}</p>
    </div>
  );
}

/* --------------------------- Live performance panel ------------------------ */
export type LiveStats = {
  correct: number; wrong: number; skipped: number;
  accuracy: number; score?: number | string;
  streak?: number; bestStreak?: number; remaining?: number;
};

/**
 * Exam-mode progress strip. Deliberately receives NO correctness data —
 * it cannot leak score/accuracy because those values are never passed in.
 */
export function ExamProgressPanel({
  total, current, attempted, skipped, marked, className,
}: {
  total: number; current: number; attempted: number; skipped: number;
  marked?: number; className?: string;
}) {
  const cells: Array<[string, string | number, string]> = [
    ["Question", `${current}/${total}`, "text-primary"],
    ["Attempted", attempted, "text-foreground"],
    ["Skipped", skipped, "text-amber-400"],
  ];
  if (marked !== undefined) cells.push(["Review", marked, "text-purple-300"]);
  return (
    <div className={cn("grid grid-cols-4 gap-px overflow-hidden rounded-md border bg-border text-center", className)}>
      {cells.map(([label, value, tone]) => (
        <div key={label} className="bg-card px-1 py-2">
          <p className={cn("text-sm font-extrabold leading-none tabular-nums", tone)}>{value}</p>
          <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}

export function LivePerformancePanel({ stats, className }: { stats: LiveStats; className?: string }) {
  const cells: Array<[string, string | number, string]> = [
    ["Correct", stats.correct, "text-emerald-400"],
    ["Wrong", stats.wrong, "text-destructive"],
    ["Skipped", stats.skipped, "text-muted-foreground"],
    ["Accuracy", `${stats.accuracy}%`, "text-primary"],
  ];
  if (stats.score !== undefined) cells.push(["Score", stats.score, "text-foreground"]);
  if (stats.streak !== undefined) cells.push(["Streak", `🔥 ${stats.streak}`, "text-amber-400"]);
  if (stats.bestStreak !== undefined) cells.push(["Best", stats.bestStreak, "text-amber-400"]);
  if (stats.remaining !== undefined) cells.push(["Left", stats.remaining, "text-muted-foreground"]);
  return (
    <div className={cn("grid grid-cols-4 gap-px overflow-hidden rounded-md border bg-border text-center", className)}>
      {cells.map(([label, value, tone]) => (
        <div key={label} className="bg-card px-1 py-2">
          <p className={cn("text-sm font-extrabold leading-none tabular-nums", tone)}>{value}</p>
          <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}


/* ------------------------------ Question card ------------------------------ */
export function QuestionCard({
  index, meta, difficulty, question, children, actions,
}: {
  index: number;
  meta?: Array<string | null | undefined>;
  difficulty?: string | null;
  question: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const tags = (meta ?? []).filter(Boolean) as string[];
  return (
    <section className="test-question-card rounded-md border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-2">
        <span className="rounded border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
          Q{index}
        </span>
        {tags.map((t, i) => (
          <span key={t} className="flex items-center gap-2 text-xs text-muted-foreground">
            {i > 0 && <span className="opacity-40">›</span>}
            {t}
          </span>
        ))}
        {difficulty && (
          <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400">
            {difficultyStars(difficulty)}
          </span>
        )}
        {actions && <div className="ml-auto max-w-full">{actions}</div>}
      </div>
      <p className="test-question-text break-words font-semibold">{question}</p>
      <div className="test-supporting-content mt-5 space-y-3">{children}</div>
    </section>

  );
}


export function difficultyStars(d?: string | null) {
  const map: Record<string, string> = {
    easy: "★★☆☆", medium: "★★★☆", hard: "★★★★", expert: "★★★★",
  };
  const key = (d ?? "").toLowerCase();
  return `${map[key] ?? "★★★☆"} ${d ? d[0].toUpperCase() + d.slice(1) : "Medium"}`;
}

/* --------------------------------- Option --------------------------------- */
export function OptionCard({
  letter, text, state, onClick, disabled,
}: {
  letter: string;
  text: string;
  state: "idle" | "selected" | "correct" | "wrong" | "dim";
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={state === "selected" || state === "correct" || state === "wrong"}
      className={cn(
        "test-option",
        state === "selected" && "test-option-selected",
        state === "correct" && "test-option-correct animate-test-pulse",
        state === "wrong" && "test-option-wrong animate-test-shake",
        state === "dim" && "test-option-dim",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold",
          state === "idle" && "border-white/20 bg-white/5 text-muted-foreground",
          state === "dim" && "border-white/10 bg-white/5 text-muted-foreground",
          state === "selected" && "border-primary bg-primary text-primary-foreground",
          state === "correct" && "border-emerald-500 bg-emerald-500 text-white",
          state === "wrong" && "border-destructive bg-destructive text-white",
        )}
      >
        {letter}
      </span>

      <span className="test-option-text min-w-0 flex-1 break-words">{text}</span>
      {state === "correct" && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />}
      {state === "wrong" && <XCircle className="h-5 w-5 shrink-0 text-destructive" />}
    </button>
  );
}

/* ----------------------------- Expandable card ----------------------------- */
export function InsightCard({
  icon: Icon, title, tone = "muted", children, defaultOpen = false,
}: {
  icon: any; title: string; tone?: "muted" | "primary" | "success" | "warning";
  children: ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const tones = {
    muted: "border-white/10 bg-white/5",
    primary: "border-primary/25 bg-primary/10",
    success: "border-emerald-500/25 bg-emerald-500/10",
    warning: "border-amber-500/25 bg-amber-500/10",
  } as const;
  return (
    <div className={cn("overflow-hidden rounded-2xl border transition-colors", tones[tone])}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 p-3 text-left text-sm font-semibold"
      >
        <Icon className="h-4 w-4 shrink-0 opacity-80" />
        <span className="flex-1">{title}</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="animate-fade-in px-3 pb-3 text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
      )}
    </div>
  );
}

/* --------------------------- Answer feedback stack ------------------------- */
export function AnswerFeedback({
  correct, correctOption, yourOption, explanation, trick, concept, memoryTip, aiInsight, extra,
}: {
  correct: boolean;
  correctOption?: string | null;
  yourOption?: string | null;
  explanation?: string | null;
  trick?: string | null;
  concept?: string | null;
  memoryTip?: string | null;
  aiInsight?: string | null;
  extra?: ReactNode;
}) {
  return (
    <div className="animate-fade-in space-y-2">
      <div
        className={cn(
          "rounded-2xl border p-3 text-sm font-bold",
          correct
            ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
            : "border-destructive/30 bg-destructive/15 text-destructive",
        )}
      >
        {correct ? "✅ Correct!" : "❌ Wrong"}
        <span className="ml-2 text-xs font-medium text-muted-foreground">
          {yourOption ? `Your answer: ${yourOption} · ` : ""}Correct: {correctOption || "—"}
        </span>
      </div>
      {explanation && (
        <InsightCard icon={Lightbulb} title="Explanation" defaultOpen>{explanation}</InsightCard>
      )}
      {trick && <InsightCard icon={Zap} title="Shortcut Trick" tone="warning">{trick}</InsightCard>}
      {concept && <InsightCard icon={Sparkles} title="Important Concept">{concept}</InsightCard>}
      {memoryTip && <InsightCard icon={Brain} title="Memory Tip">{memoryTip}</InsightCard>}
      {aiInsight && (
        <InsightCard icon={Brain} title="🧠 AJIT AI Insight" tone="primary" defaultOpen>
          {aiInsight}
        </InsightCard>
      )}
      {extra}
    </div>
  );
}

/* ----------------------------- Floating AI status -------------------------- */
export function FloatingAIStatus({ text = "Watching your performance…" }: { text?: string }) {
  return (
    <div className="pointer-events-none fixed bottom-24 right-3 z-20 hidden sm:block">
      <div className="test-glass animate-soft-glow flex items-center gap-2 rounded-full px-3 py-2">
        <Brain className="h-4 w-4 text-primary" />
        <div className="leading-tight">
          <p className="text-[11px] font-bold">🧠 AJIT AI</p>
          <p className="text-[10px] text-muted-foreground">{text}</p>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- Bottom nav ------------------------------- */
export function TestBottomNav({ children }: { children: ReactNode }) {
  return (
    <div className="test-bottom-nav fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-2 pt-2 backdrop-blur-xl md:px-4">
      <div className="mx-auto grid w-full max-w-[1600px] grid-cols-3 gap-2">{children}</div>
    </div>
  );
}

/* --------------------------- Question navigator ---------------------------- */
export type NavItemStatus = "answered" | "answered-marked" | "correct" | "wrong" | "marked" | "skipped" | "unvisited";

const NAV_STATUS_CLASS: Record<NavItemStatus, string> = {
  correct: "border-emerald-500/60 bg-emerald-500/20 text-emerald-300",
  answered: "border-emerald-500/60 bg-emerald-500/20 text-emerald-300",
  "answered-marked": "border-primary bg-primary/20 text-primary",
  wrong: "border-destructive/60 bg-destructive/20 text-destructive",
  marked: "border-secondary/60 bg-secondary/15 text-secondary",
  skipped: "border-amber-500/50 bg-amber-500/15 text-amber-300",
  unvisited: "border-white/10 bg-white/5 text-muted-foreground",
};

const NAV_LEGEND: Array<[string, string]> = [
  ["bg-emerald-500", "Answered"],
  ["bg-destructive", "Wrong"],
  ["bg-amber-400", "Skipped"],
  ["bg-secondary", "Review"],
  ["bg-primary", "Answered + Review"],
  ["bg-muted-foreground", "Not Visited"],
];

type NavFilter = "all" | "answered" | "unanswered" | "review" | "skipped";

const ANSWERED_STATES: NavItemStatus[] = ["answered", "answered-marked", "correct", "wrong"];

function matchesFilter(st: NavItemStatus, filter: NavFilter) {
  if (filter === "answered") return ANSWERED_STATES.includes(st);
  if (filter === "unanswered") return st === "unvisited" || st === "skipped";
  if (filter === "review") return st === "marked" || st === "answered-marked";
  if (filter === "skipped") return st === "skipped";
  return true;
}

/**
 * Navigator body — filters + number grid + direct "Go to question".
 * Used inline as the desktop right column and inside the mobile/focus drawer.
 */
export function NavigatorPanel({
  total, current, statusFor, onJump, className, title = "Question Navigator", hideCorrectness = false,
}: {
  total: number;
  current: number;
  statusFor: (index: number) => NavItemStatus;
  onJump: (index: number) => void;
  className?: string;
  title?: string;
  /** Exam mode: never surface correct/wrong legend cues. */
  hideCorrectness?: boolean;
}) {
  const [filter, setFilter] = useState<NavFilter>("all");
  const [goTo, setGoTo] = useState("");

  const all = Array.from({ length: total }, (_, i) => i);
  const counts = {
    all: total,
    answered: all.filter((i) => ANSWERED_STATES.includes(statusFor(i))).length,
    unanswered: all.filter((i) => ["unvisited", "skipped"].includes(statusFor(i))).length,
    review: all.filter((i) => ["marked", "answered-marked"].includes(statusFor(i))).length,
    skipped: all.filter((i) => statusFor(i) === "skipped").length,
  };
  const visible = all.filter((i) => matchesFilter(statusFor(i), filter));

  const filters: Array<[NavFilter, string]> = [
    ["all", `All ${counts.all}`],
    ["answered", `Answered ${counts.answered}`],
    ["unanswered", `Unanswered ${counts.unanswered}`],
    ["review", `Review ${counts.review}`],
    ["skipped", `Skipped ${counts.skipped}`],
  ];

  const jump = (n: number) => {
    if (Number.isNaN(n)) return;
    const i = Math.min(total, Math.max(1, n)) - 1;
    onJump(i);
  };

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="flex items-center justify-between gap-2 pb-3 pr-8">
        <h2 className="font-display text-sm font-bold">{title}</h2>
        <span className="text-[11px] tabular-nums text-muted-foreground">{current + 1}/{total}</span>
      </div>

      <div className="flex flex-wrap gap-1.5 pb-3">
        {filters.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={cn(
              "rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors",
              filter === key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-white/10 bg-white/5 text-muted-foreground hover:border-primary/40",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 py-2">
        <div className="grid grid-cols-5 gap-2">
          {visible.map((i) => {
            const rawStatus = statusFor(i);
            const st = hideCorrectness && (rawStatus === "correct" || rawStatus === "wrong") ? "answered" : rawStatus;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onJump(i)}
                aria-current={i === current ? "step" : undefined}
                aria-label={`Question ${i + 1}, ${st.replace("-", " and ")}`}
                className={cn(
                  "flex h-11 items-center justify-center rounded-md border text-sm font-bold transition-colors hover:border-primary",
                  NAV_STATUS_CLASS[st],
                  i === current && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                )}
              >
                {i + 1}
              </button>
            );
          })}
          {visible.length === 0 && (
            <p className="col-span-5 py-6 text-center text-xs text-muted-foreground">
              No questions in this filter.
            </p>
          )}
        </div>
      </div>

      <form
        className="flex items-center gap-2 border-t border-white/10 pt-3"
        onSubmit={(e) => { e.preventDefault(); jump(parseInt(goTo, 10)); setGoTo(""); }}
      >
        <input
          value={goTo}
          onChange={(e) => setGoTo(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          placeholder="Go to question"
          aria-label="Go to question number"
          className="h-9 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
        />
        <button
          type="submit"
          className="h-9 shrink-0 rounded-xl border border-primary/50 bg-primary/15 px-3 text-xs font-semibold text-primary"
        >
          Go
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t pt-3 text-[10px] text-muted-foreground">
        {NAV_LEGEND.filter(([, l]) => !(hideCorrectness && l === "Wrong")).map(([dot, label]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", dot)} aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Universal Question Navigator — trigger button + drawer.
 * Desktop/tablet: slides in from the right. Mobile: bottom sheet.
 * Purely presentational; jumping is delegated to `onJump`.
 */
export function QuestionNavigator({
  total, current, statusFor, onJump, triggerClassName, floating = false, hideCorrectness = false,
}: {
  total: number;
  current: number;
  statusFor: (index: number) => NavItemStatus;
  onJump: (index: number) => void;
  triggerClassName?: string;
  floating?: boolean;
  hideCorrectness?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Open question navigator"
          className={cn(
            "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:bg-primary/20",
            floating ? "fixed bottom-24 left-3 z-30 shadow-lg" : "shrink-0",
            triggerClassName,
          )}
        >
          <ListOrdered className="h-4 w-4 text-primary" />
          <span>Questions</span>
          <span className="text-xs font-bold tabular-nums text-muted-foreground">
            {current + 1}/{total}
          </span>
        </button>
      </SheetTrigger>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "border-white/10 bg-background/95 backdrop-blur-2xl",
          isMobile ? "h-[88dvh] rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom,0px))]" : "w-[340px] sm:max-w-sm",
        )}
      >
        <NavigatorPanel
          total={total}
          current={current}
          statusFor={statusFor}
          hideCorrectness={hideCorrectness}
          onJump={(i) => { onJump(i); setOpen(false); }}
        />
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------ Focus mode -------------------------------- */
/** Hides the app chrome (header/footer/menus) while a test is running. */
export function useFocusMode() {
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    document.body.classList.toggle("test-focus", focus);
    return () => document.body.classList.remove("test-focus");
  }, [focus]);
  return { focus, setFocus, toggle: () => setFocus((f) => !f) };
}

export function FocusModeButton({ focus, onToggle }: { focus: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={focus}
      title={focus ? "Exit Focus Mode" : "Focus Mode"}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors",
        focus
          ? "border-primary bg-primary/20 text-primary"
          : "border-white/10 bg-white/5 text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {focus ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      <span className="hidden lg:inline">{focus ? "Exit Focus" : "Focus Mode"}</span>
    </button>
  );
}

/* ------------------------------- Workspace -------------------------------- */
/**
 * Two-column exam workspace: question column + persistent navigator column
 * on xl screens. In focus mode (or on smaller screens) the sidebar collapses
 * and the navigator is reached through the drawer trigger instead.
 */
export function TestWorkspace({
  children, sidebar, showSidebar = true,
}: { children: ReactNode; sidebar?: ReactNode; showSidebar?: boolean }) {
  return (
    <div
      className={cn(
        "mx-auto grid w-full items-start gap-4",
        showSidebar && sidebar
          ? "max-w-[1600px] md:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_330px]"
          : "max-w-4xl grid-cols-1",
      )}
    >
      <div className="min-w-0 space-y-4">{children}</div>
      {showSidebar && sidebar && (
        <aside className="sticky top-[76px] hidden max-h-[calc(100dvh-9rem)] rounded-md border bg-card p-4 shadow-sm md:block">
          {sidebar}
        </aside>
      )}
    </div>
  );
}



export const NavIcons = { ArrowLeft, ArrowRight, Flag, Timer };


/* --------------------------- AI analysing loader --------------------------- */
const AI_STEPS = [
  "Analyzing your performance…",
  "Finding hidden weak topics…",
  "Comparing with previous attempts…",
  "Updating memory…",
  "Preparing personalized recommendations…",
];

export function AIAnalyzingLoader({ active = true }: { active?: boolean }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setStep((s) => (s + 1) % AI_STEPS.length), 1400);
    return () => clearInterval(t);
  }, [active]);
  return (
    <div className="test-glass space-y-3 p-5">
      <div className="flex items-center gap-2">
        <Brain className="h-5 w-5 animate-pulse text-primary" />
        <p className="font-bold">🧠 AJIT AI</p>
      </div>
      <ul className="space-y-1.5">
        {AI_STEPS.map((s, i) => (
          <li
            key={s}
            className={cn(
              "flex items-center gap-2 text-sm transition-opacity",
              i <= step ? "text-foreground" : "text-muted-foreground opacity-50",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
            {s}
          </li>
        ))}
      </ul>
      <div className="h-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-neon transition-all duration-700"
          style={{ width: `${((step + 1) / AI_STEPS.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------ Result screen ------------------------------ */
export function ResultHero({
  title, score, total, grade, xp,
}: { title: string; score: string; total?: string; grade: string; xp: number }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-neon p-7 text-center text-white shadow-lg">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <p className="text-xs font-semibold uppercase tracking-widest text-white/80">Test Completed</p>
      <h2 className="mt-1 font-display text-lg font-semibold text-white/90">{title}</h2>
      <p className="mt-3 text-5xl font-extrabold tabular-nums">{score}{total ? <span className="text-2xl text-white/70"> / {total}</span> : null}</p>
      <div className="mt-4 flex items-center justify-center gap-2 text-sm">
        <span className="rounded-full bg-white/20 px-3 py-1 font-bold">Grade {grade}</span>
        <span className="rounded-full bg-white/20 px-3 py-1 font-bold">+{xp} XP</span>
      </div>
    </div>
  );
}

export function ResultStatGrid({ items }: { items: Array<{ label: string; value: string | number }> }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="test-glass p-4 text-center">
          <p className="text-xl font-extrabold tabular-nums">{i.value}</p>
          <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">{i.label}</p>
        </div>
      ))}
    </div>
  );
}

export function gradeFor(accuracy: number) {
  if (accuracy >= 90) return "A+";
  if (accuracy >= 80) return "A";
  if (accuracy >= 70) return "B";
  if (accuracy >= 60) return "C";
  if (accuracy >= 45) return "D";
  return "E";
}

export function xpFor(correct: number, accuracy: number) {
  return correct * 10 + Math.round(accuracy / 2);
}

export function formatClock(totalSeconds: number) {
  const m = String(Math.floor(Math.max(totalSeconds, 0) / 60)).padStart(2, "0");
  const s = String(Math.max(totalSeconds, 0) % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/** Presentational AI insight line built from the question's own metadata. */
export function buildInsight(opts: {
  correct: boolean;
  topic?: string | null;
  chapter?: string | null;
  subject?: string | null;
  wasGuess?: boolean;
  skipped?: boolean;
}) {
  const area = [opts.subject, opts.chapter, opts.topic].filter(Boolean).join(" › ");
  const where = area ? `यह प्रश्न ${area} से है।` : "यह प्रश्न आपके कमजोर क्षेत्र से जुड़ा है।";
  if (opts.skipped) return `${where} इसे छोड़ना मतलब यहाँ concept अधूरा है — आज ही इस topic का एक बार revision करें।`;
  if (opts.correct) {
    return opts.wasGuess
      ? `${where} उत्तर सही रहा, लेकिन यह guess था — concept पक्का नहीं है, इसे दोबारा पढ़ें।`
      : `${where} सही उत्तर — यह concept अब मजबूत हो रहा है, speed पर ध्यान दें।`;
  }
  return `${where} गलती concept/careless दोनों हो सकती है — correct option का reasoning एक बार लिखकर दोहराएँ ताकि यह mistake repeat न हो।`;
}
