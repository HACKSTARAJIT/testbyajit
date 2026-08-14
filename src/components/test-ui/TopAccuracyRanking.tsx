import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Loader2 } from "lucide-react";

type Row = {
  user_id: string;
  display_name: string;
  accuracy: number;
  rank: number;
  is_me: boolean;
};

const MEDALS = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];

/**
 * 🏆 TOP 5 ACCURACY — ranking for ONE test, based on accuracy % only.
 * Read-only: never writes or changes any attempt/score data.
 */
export function TopAccuracyRanking({ testId }: { testId?: string | null }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  const load = useCallback(async () => {
    if (!testId) return;
    const { data } = await supabase.rpc("get_test_accuracy_leaderboard", { _test_id: testId });
    setRows((data ?? []) as Row[]);
  }, [testId]);

  useEffect(() => {
    load();
    if (!testId) return;
    // Live updates as other students submit the same test.
    const ch = supabase
      .channel(`acc-rank-${testId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "test_attempts", filter: `test_id=eq.${testId}` },
        () => load()
      )
      .subscribe();
    const timer = window.setInterval(load, 20000);
    return () => {
      supabase.removeChannel(ch);
      window.clearInterval(timer);
    };
  }, [testId, load]);

  if (!testId) return null;

  const top5 = (rows ?? []).filter((r) => r.rank <= 5).slice(0, 8);
  const me = (rows ?? []).find((r) => r.is_me);
  const meOutside = me && me.rank > 5;

  return (
    <div className="test-glass rounded-3xl p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">🏆 TOP 5 ACCURACY</h3>
        <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">This test only</span>
      </div>

      {rows === null ? (
        <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading ranking…
        </div>
      ) : top5.length === 0 ? (
        <p className="py-3 text-xs text-muted-foreground">No completed attempts yet for this test.</p>
      ) : (
        <ul className="space-y-1.5">
          {top5.map((r, i) => (
            <li
              key={r.user_id}
              className={`flex items-center gap-3 rounded-2xl border px-3 py-2 text-sm ${
                r.is_me ? "border-primary/50 bg-primary/10" : "border-white/10 bg-white/5"
              }`}
            >
              <span className="w-6 shrink-0 text-center text-base">{MEDALS[Math.min(r.rank, 5) - 1] ?? "•"}</span>
              <span className="min-w-0 flex-1 truncate font-medium">
                {r.display_name}
                {r.is_me && <span className="ml-1 text-[10px] text-primary">(You)</span>}
              </span>
              <span className="shrink-0 font-bold tabular-nums">{Math.round(r.accuracy)}%</span>
            </li>
          ))}
        </ul>
      )}

      {meOutside && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <div className="flex items-center justify-between rounded-2xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Your Accuracy</span>
            <span className="font-bold tabular-nums">{Math.round(me!.accuracy)}%</span>
          </div>
          <p className="mt-1.5 text-center text-xs text-muted-foreground">
            Your Rank: <b className="text-foreground">#{me!.rank}</b>
          </p>
        </div>
      )}
    </div>
  );
}
