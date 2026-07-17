import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CheckCircle2, Trophy, TrendingUp, TrendingDown, Minus, RotateCcw, Crown, History } from "lucide-react";
import type { Attempt } from "@/components/TestTracker";

type ExtendedAttempt = Attempt & {
  status?: string | null;
  accuracy?: number | null;
  total_questions?: number | null;
  time_taken_seconds?: number | null;
};

function relDate(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const day = 86400000;
  if (diff < day && new Date().getDate() === d.getDate()) return "Today";
  if (diff < 2 * day) return "Yesterday";
  const days = Math.floor(diff / day);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function fmtTime(sec?: number | null) {
  if (!sec || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function accuracyOf(a: ExtendedAttempt, total?: number | null) {
  if (a.accuracy != null) return Math.round(Number(a.accuracy));
  const att = (a.correct_count || 0) + (a.incorrect_count || 0);
  if (att > 0) return Math.round((a.correct_count / att) * 100);
  const t = total ?? a.total_questions ?? 0;
  if (t > 0) return Math.round((a.correct_count / t) * 100);
  return 0;
}

export function TestAttemptSummary({
  attempts,
  totalMarks,
}: {
  attempts: ExtendedAttempt[];
  totalMarks?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const completed = attempts
    .filter((a) => {
      // Include if explicitly not in_progress, OR if has any recorded activity
      const hasData =
        (a.correct_count || 0) > 0 ||
        (a.incorrect_count || 0) > 0 ||
        Number(a.marks_obtained || 0) > 0;
      return a.status !== "in_progress" || hasData;
    })
    .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));

  if (completed.length === 0) return null;

  const latest = completed[completed.length - 1];
  const prev = completed.length > 1 ? completed[completed.length - 2] : null;
  const best = completed.reduce((b, a) => (Number(a.marks_obtained) > Number(b.marks_obtained) ? a : b), completed[0]);

  const lastMarks = Number(latest.marks_obtained);
  const bestMarks = Number(best.marks_obtained);
  const lastAcc = accuracyOf(latest, totalMarks);
  const bestAcc = accuracyOf(best, totalMarks);
  const diff = prev ? lastMarks - Number(prev.marks_obtained) : 0;

  const denom = totalMarks ?? latest.total_questions ?? null;

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/30" variant="outline">
          <CheckCircle2 className="h-3 w-3" /> Completed
        </Badge>
        <Badge variant="outline" className="gap-1">
          <History className="h-3 w-3" /> {completed.length}× Attempted
        </Badge>
        {lastAcc >= 90 && (
          <Badge className="gap-1 bg-amber-500/15 text-amber-600 border-amber-500/30" variant="outline">
            <Crown className="h-3 w-3" /> Mastered
          </Badge>
        )}
        {lastAcc < 70 && (
          <Badge className="gap-1 bg-orange-500/15 text-orange-600 border-orange-500/30" variant="outline">
            <RotateCcw className="h-3 w-3" /> Retake
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="rounded-md bg-background/60 p-1.5 text-left transition hover:bg-background">
              <p className="text-[10px] text-muted-foreground">Last Score</p>
              <p className="text-sm font-bold text-primary">
                {lastMarks}{denom ? `/${denom}` : ""}
              </p>
              <p className="text-[10px] text-muted-foreground">{lastAcc}% · {relDate(latest.created_at)}</p>
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4" /> Attempt History
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {completed.map((a, i) => {
                const isLatest = i === completed.length - 1;
                return (
                  <div
                    key={a.id}
                    className={`rounded-lg border p-2.5 text-sm ${isLatest ? "border-primary/40 bg-primary/5" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        Attempt {i + 1} {isLatest && <span className="text-[10px] text-primary">· Latest</span>}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <div>
                        <p className="text-[10px]">Score</p>
                        <p className="font-semibold text-foreground">
                          {Number(a.marks_obtained)}{denom ? `/${denom}` : ""}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px]">Accuracy</p>
                        <p className="font-semibold text-foreground">{accuracyOf(a, totalMarks)}%</p>
                      </div>
                      <div>
                        <p className="text-[10px]">Time</p>
                        <p className="font-semibold text-foreground">{fmtTime(a.time_taken_seconds)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>

        <div className="rounded-md bg-background/60 p-1.5">
          <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
            <Trophy className="h-3 w-3 text-amber-500" /> Best
          </p>
          <p className="text-sm font-bold text-amber-600">
            {bestMarks}{denom ? `/${denom}` : ""}
          </p>
          <p className="text-[10px] text-muted-foreground">{bestAcc}%</p>
        </div>

        <div className="rounded-md bg-background/60 p-1.5">
          <p className="text-[10px] text-muted-foreground">Trend</p>
          {prev ? (
            diff > 0 ? (
              <p className="flex items-center justify-center gap-0.5 text-sm font-bold text-emerald-600">
                <TrendingUp className="h-3 w-3" /> +{diff}
              </p>
            ) : diff < 0 ? (
              <p className="flex items-center justify-center gap-0.5 text-sm font-bold text-red-500">
                <TrendingDown className="h-3 w-3" /> {diff}
              </p>
            ) : (
              <p className="flex items-center justify-center gap-0.5 text-sm font-bold text-muted-foreground">
                <Minus className="h-3 w-3" /> 0
              </p>
            )
          ) : (
            <p className="text-sm font-bold text-muted-foreground">—</p>
          )}
          <p className="text-[10px] text-muted-foreground">{prev ? "vs prev" : "first"}</p>
        </div>
      </div>
    </div>
  );
}
