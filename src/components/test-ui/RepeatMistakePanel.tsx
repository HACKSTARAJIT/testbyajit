import { useEffect, useState } from "react";
import { Flame, Loader2 } from "lucide-react";
import {
  detectRepeatMistakes, questionLine, topicLine, SEVERITY_META,
  type RepeatSummary,
} from "@/lib/repeatMistakes";

type Props = {
  userId: string;
  /** Question ids of the test just attempted (App Test only). */
  questionIds: string[];
};

/**
 * 🔥 REPEAT MISTAKES — compact, read-only result-screen section.
 * Runs AFTER the result is saved; a failure here never affects the result.
 */
export function RepeatMistakePanel({ userId, questionIds }: Props) {
  const [data, setData] = useState<RepeatSummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    // Deferred so test submission/saving is never slowed down.
    const t = window.setTimeout(() => {
      detectRepeatMistakes(userId, questionIds)
        .then((r) => alive && setData(r))
        .catch(() => alive && setFailed(true));
    }, 400);
    return () => { alive = false; window.clearTimeout(t); };
  }, [userId, questionIds]);

  if (failed) return null;

  return (
    <div className="test-glass rounded-3xl p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Flame className="h-4 w-4 text-orange-400" />
        <h3 className="text-sm font-bold">🔥 REPEAT MISTAKES</h3>
      </div>

      {data === null ? (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> इतिहास जाँचा जा रहा है…
        </div>
      ) : !data.hasEvidence ? (
        <p className="text-xs text-muted-foreground">अभी कोई दोहराई गई गलती नहीं मिली।</p>
      ) : (
        <ul className="space-y-1.5">
          {data.topics.slice(0, 4).map((t) => {
            const meta = SEVERITY_META[t.severity as keyof typeof SEVERITY_META];
            return (
              <li
                key={`t-${t.topic}`}
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs"
              >
                <span>{meta?.icon ?? "⚠️"}</span>
                <span className="min-w-0 flex-1 truncate">{topicLine(t)}</span>
                <span className={`shrink-0 text-[10px] ${meta?.tone ?? ""}`}>{meta?.label}</span>
              </li>
            );
          })}
          {data.questions.slice(0, 3).map((q, i) => {
            const meta = SEVERITY_META[q.severity as keyof typeof SEVERITY_META];
            return (
              <li
                key={`q-${q.question_id}`}
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs"
              >
                <span>{meta?.icon ?? "⚠️"}</span>
                <span className="min-w-0 flex-1 truncate">{questionLine(q, i)}</span>
                <span className={`shrink-0 text-[10px] ${meta?.tone ?? ""}`}>{meta?.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
