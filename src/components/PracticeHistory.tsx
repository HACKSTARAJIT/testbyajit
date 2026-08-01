import { AttemptRow, computeStats, formatDuration } from "@/lib/revisionPractice";
import { History } from "lucide-react";

export function PracticeHistory({ attempts }: { attempts: AttemptRow[] }) {
  const stats = computeStats(attempts);
  if (!stats) {
    return (
      <div className="glass-card rounded-3xl p-5 text-center text-sm text-muted-foreground">
        अभी तक कोई attempt नहीं — पहला practice test शुरू करें।
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="glass-card grid grid-cols-2 gap-3 rounded-3xl p-5 sm:grid-cols-4">
        <Cell label="Latest Score" value={stats.latestScore} />
        <Cell label="Best Score" value={stats.bestScore} />
        <Cell label="Average Score" value={String(stats.averageScore)} />
        <Cell label="Total Attempts" value={String(stats.totalAttempts)} />
        <Cell label="Latest Accuracy" value={`${stats.latestAccuracy}%`} />
        <Cell label="Highest Accuracy" value={`${stats.highestAccuracy}%`} />
        <Cell
          label="Improvement"
          value={`${stats.improvementPct > 0 ? "+" : ""}${stats.improvementPct}%`}
          tone={stats.improvementPct >= 0 ? "up" : "down"}
        />
        <Cell
          label="Last Played"
          value={stats.lastPlayed ? new Date(stats.lastPlayed).toLocaleDateString() : "—"}
        />
      </div>

      <div className="glass-card rounded-3xl p-5">
        <div className="mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold">Attempt History</h3>
        </div>
        <ul className="space-y-2">
          {[...attempts].reverse().map((a, i) => (
            <li key={a.id} className="rounded-2xl bg-muted/50 p-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Attempt #{attempts.length - i}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleString()}
                </p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Score: <b className="text-foreground">{a.correct_count}/{a.total_questions}</b> ·
                {" "}Accuracy: <b className="text-foreground">{a.accuracy}%</b> ·
                {" "}Time: <b className="text-foreground">{formatDuration(a.time_taken_seconds)}</b>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded-2xl bg-muted/40 p-3 text-center">
      <p
        className={
          tone === "up" ? "text-lg font-bold text-emerald-600 dark:text-emerald-400"
            : tone === "down" ? "text-lg font-bold text-destructive"
            : "text-lg font-bold"
        }
      >
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
