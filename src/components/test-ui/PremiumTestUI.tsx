import { ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Brain, CheckCircle2, XCircle, Lightbulb, Zap, Sparkles, ChevronDown,
  ArrowLeft, ArrowRight, Flag, Timer, ListOrdered,
} from "lucide-react";

/**
 * Universal Premium Test UI kit.
 * Presentation only — no scoring, navigation, AI or data logic lives here.
 * Used by every test surface in AJIT 360 (TestEngine + PracticeRunner).
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

/* --------------------------------- Header --------------------------------- */
export function TestHeader({
  title, current, total, progress, right, subtitle,
}: {
  title: string; current: number; total: number; progress: number;
  right?: ReactNode; subtitle?: string;
}) {
  return (
    <div className="sticky top-0 z-30 -mx-3 mb-4 px-3 pt-3 sm:-mx-5 sm:px-5">
      <div className="test-glass-strong mx-auto max-w-4xl overflow-hidden p-4">

        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-base font-bold">{title}</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Question {current} / {total}{subtitle ? ` · ${subtitle}` : ""}
            </p>
          </div>
          {right}
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-neon transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/* --------------------------- Live performance panel ------------------------ */
export type LiveStats = {
  correct: number; wrong: number; skipped: number;
  accuracy: number; score?: number | string;
  streak?: number; bestStreak?: number; remaining?: number;
};

export function LivePerformancePanel({ stats }: { stats: LiveStats }) {
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
    <div className="test-glass grid grid-cols-4 gap-1 p-3 text-center">
      {cells.map(([label, value, tone]) => (
        <div key={label} className="rounded-xl px-1 py-1.5">
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
    <div className="test-glass animate-test-slide p-5 sm:p-7">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-gradient-neon px-3 py-1 text-xs font-bold text-white shadow-sm">
          Q{index}
        </span>
        {tags.map((t) => <span key={t} className="test-chip">{t}</span>)}
        {difficulty && <span className="test-chip">{difficultyStars(difficulty)}</span>}
        {actions && <div className="ml-auto">{actions}</div>}
      </div>
      <p className="text-[19px] font-semibold leading-[1.75] sm:text-[21px]">{question}</p>
      <div className="mt-6 space-y-3.5">{children}</div>
    </div>

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
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm font-bold",
          state === "idle" && "border-white/15 bg-white/5 text-muted-foreground",
          state === "dim" && "border-white/10 bg-white/5 text-muted-foreground",
          state === "selected" && "border-primary bg-primary text-primary-foreground",
          state === "correct" && "border-emerald-500 bg-emerald-500 text-white",
          state === "wrong" && "border-destructive bg-destructive text-white",
        )}
      >
        {letter}
      </span>
      <span className="flex-1 text-[16px] leading-relaxed sm:text-[17px]">{text}</span>
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
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-background/80 p-3 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-4xl items-center gap-2">{children}</div>
    </div>
  );
}

/* --------------------------- Question navigator ---------------------------- */
export type NavItemStatus = "answered" | "correct" | "wrong" | "marked" | "skipped" | "unvisited";

const NAV_STATUS_CLASS: Record<NavItemStatus, string> = {
  correct: "border-emerald-500/60 bg-emerald-500/20 text-emerald-300",
  answered: "border-primary/60 bg-primary/20 text-primary",
  wrong: "border-destructive/60 bg-destructive/20 text-destructive",
  marked: "border-amber-500/60 bg-amber-500/20 text-amber-300",
  skipped: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  unvisited: "border-white/10 bg-white/5 text-muted-foreground",
};

const NAV_LEGEND: Array<[NavItemStatus, string]> = [
  ["correct", "🟢 Answered / Correct"],
  ["wrong", "🔴 Wrong"],
  ["skipped", "🟡 Skipped / Review"],
  ["unvisited", "⚪ Not Visited"],
];

/**
 * Universal Question Navigator — floating trigger + drawer.
 * Desktop/tablet: slides in from the left. Mobile: bottom sheet.
 * Purely presentational; jumping is delegated to `onJump`.
 */
export function QuestionNavigator({
  total, current, statusFor, onJump, triggerClassName, floating = false,
}: {
  total: number;
  current: number;
  statusFor: (index: number) => NavItemStatus;
  onJump: (index: number) => void;
  triggerClassName?: string;
  floating?: boolean;
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
            "inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-card/70 px-4 text-sm font-semibold backdrop-blur-2xl transition-colors hover:border-primary/50 hover:text-primary",
            floating
              ? "fixed bottom-24 left-3 z-30 h-12 shadow-lg"
              : "h-12 shrink-0",
            triggerClassName,
          )}
        >
          <ListOrdered className="h-4 w-4" />
          <span className={floating ? "" : "hidden sm:inline"}>Questions</span>
        </button>
      </SheetTrigger>
      <SheetContent
        side={isMobile ? "bottom" : "left"}
        className={cn(
          "border-white/10 bg-background/95 backdrop-blur-2xl",
          isMobile ? "h-[80dvh] rounded-t-3xl" : "w-[320px] sm:max-w-sm",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="pb-3 pr-8">
            <h2 className="font-display text-base font-bold">📋 Question Navigator</h2>
            <p className="text-xs text-muted-foreground">Question {current + 1} of {total}</p>
          </div>

          <div className="-mx-1 flex-1 overflow-y-auto px-1 py-2">
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-5">
              {Array.from({ length: total }, (_, i) => {
                const st = statusFor(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { onJump(i); setOpen(false); }}
                    className={cn(
                      "flex h-11 items-center justify-center rounded-xl border text-sm font-bold transition-transform hover:scale-105",
                      NAV_STATUS_CLASS[st],
                      i === current && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                    )}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1 border-t border-white/10 pt-3 text-[11px] text-muted-foreground">
            {NAV_LEGEND.map(([, label]) => (
              <p key={label}>{label}</p>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
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
