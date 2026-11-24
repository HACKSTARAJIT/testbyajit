import { BookOpen, CalendarDays, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  attemptCompletedAt,
  completedAttemptHistory,
  formatAttemptTime,
  type NumberedAttempt,
  type TestAttemptRecord,
} from "@/lib/attemptHistory";

export function TestAttemptHistory({
  attempts,
  totalMarks,
  onViewSolution,
}: {
  attempts: TestAttemptRecord[];
  totalMarks: number;
  onViewSolution: (attempt: NumberedAttempt) => void;
}) {
  const completed = completedAttemptHistory(attempts);
  if (completed.length === 0) return null;

  return (
    <section className="space-y-3" aria-labelledby="previous-attempts-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="previous-attempts-heading" className="flex items-center gap-2 text-lg font-bold">
          <History className="h-5 w-5 text-primary" /> Previous Attempts
        </h2>
        <Badge variant="secondary">{completed.length} completed</Badge>
      </div>

      <div className="space-y-3">
        {completed.map((attempt, index) => {
          const skipped = attempt.skipped_count ?? attempt.unattempted_count;
          return (
            <article
              key={attempt.id}
              className="rounded-2xl border bg-card/70 p-4 shadow-sm"
              data-testid={`attempt-card-${attempt.attemptNumber}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold">Attempt {attempt.attemptNumber}</h3>
                    {index === 0 && <Badge variant="outline" className="text-[10px]">Latest</Badge>}
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {new Date(attemptCompletedAt(attempt)).toLocaleString()}
                  </p>
                </div>
                <Badge variant="secondary" className="capitalize">{attempt.mode} mode</Badge>
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
                <AttemptMetric label="Score" value={`${Number(attempt.marks_obtained)}/${totalMarks}`} />
                <AttemptMetric label="Correct" value={String(attempt.correct_count)} />
                <AttemptMetric label="Wrong" value={String(attempt.incorrect_count)} />
                <AttemptMetric label="Skipped" value={String(skipped)} />
                <AttemptMetric label="Accuracy" value={`${Math.round(Number(attempt.accuracy))}%`} />
                <AttemptMetric label="Time Taken" value={formatAttemptTime(attempt.time_taken_seconds)} />
              </dl>

              <Button
                variant="outline"
                className="mt-4 min-h-11 w-full"
                onClick={() => onViewSolution(attempt)}
                aria-label={`View Solution for Attempt ${attempt.attemptNumber}`}
              >
                <BookOpen className="mr-2 h-4 w-4" /> 📖 View Solution
              </Button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function AttemptMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/50 p-2">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-bold">{value}</dd>
    </div>
  );
}
