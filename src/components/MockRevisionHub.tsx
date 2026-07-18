import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Brain, FileStack, ClipboardList, XCircle, SkipForward, Dice5,
  Repeat, ShieldAlert, Trophy, Clock, ChevronRight, Sparkles, BookMarked,
  TrendingDown,
} from "lucide-react";
import { loadHubStats, loadHubGroups, type HubStats, type HubGroup } from "@/lib/mockRevisionHub";

/**
 * 🧠 AI Mock Revision Hub
 *
 * A read-only aggregation surface over the existing `wrong_questions` bank —
 * no new tables, no duplicated storage. Every wrong / skipped / guess-wrong /
 * marked question captured by `recordAttempt()` (after any Practice Test or
 * Full Mock) is grouped and served here.
 */
export function MockRevisionHub({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState<HubStats | null>(null);
  const [groups, setGroups] = useState<HubGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [s, g] = await Promise.all([loadHubStats(userId), loadHubGroups(userId)]);
      setStats(s);
      setGroups(g);
      setLoading(false);
    })();
  }, [userId]);

  if (loading) return <Skeleton className="h-96 rounded-3xl" />;
  if (!stats) return null;

  const empty =
    stats.pending + stats.mastered + stats.fullMocksAnalyzed + stats.practiceTestsAnalyzed === 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-fuchsia-600 via-purple-600 to-indigo-700 p-6 text-white shadow-lg">
        <Sparkles className="absolute -right-4 -top-4 h-28 w-28 opacity-15" />
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/20 p-3 backdrop-blur-sm">
            <Brain className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-display">🧠 Mock Revision Hub</h2>
            <p className="text-sm text-white/85">
              Every mock & practice test — permanently converted into revision.
            </p>
          </div>
        </div>
      </div>

      {empty ? (
        <div className="rounded-3xl border bg-card p-8 text-center text-sm text-muted-foreground">
          <BookMarked className="mx-auto h-8 w-8 opacity-60" />
          <p className="mt-2">Attempt any Practice Test or upload a Full Mock — the Hub will build itself.</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            <StatCard icon={FileStack} label="Full Mocks" value={stats.fullMocksAnalyzed} tint="text-fuchsia-500" />
            <StatCard icon={ClipboardList} label="Practice Tests" value={stats.practiceTestsAnalyzed} tint="text-indigo-500" />
            <StatCard icon={XCircle} label="Wrong" value={stats.wrong} tint="text-red-500" />
            <StatCard icon={SkipForward} label="Skipped" value={stats.skipped} tint="text-amber-500" />
            <StatCard icon={Dice5} label="Guess Wrong" value={stats.guessWrong} tint="text-orange-500" />
            <StatCard icon={Repeat} label="Repeated" value={stats.repeatedWrong} tint="text-rose-500" />
            <StatCard icon={ShieldAlert} label="Critical" value={stats.critical} tint="text-red-600" />
            <StatCard icon={TrendingDown} label="Never Solved" value={stats.neverCorrect} tint="text-pink-500" />
            <StatCard icon={Trophy} label="Mastered" value={stats.mastered} tint="text-emerald-500" />
            <StatCard icon={Clock} label="Pending" value={stats.pending} tint="text-primary" />
          </div>

          {/* AI collections */}
          <div>
            <p className="mb-2 text-sm font-bold">🧬 Auto Collections</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Collection label="Wrong Questions" count={stats.wrong} grad="bg-gradient-warm"
                onClick={() => navigate("/revise")} />
              <Collection label="Skipped" count={stats.skipped} grad="bg-gradient-exam"
                onClick={() => navigate("/revise?filter=skipped")} />
              <Collection label="Guess Wrong" count={stats.guessWrong} grad="bg-gradient-royal"
                onClick={() => navigate("/revise?filter=guess")} />
              <Collection label="Repeated Wrong" count={stats.repeatedWrong} grad="bg-gradient-practice"
                onClick={() => navigate("/revise?filter=repeated")} />
              <Collection label="Never Solved Correctly" count={stats.neverCorrect} grad="bg-gradient-emerald"
                onClick={() => navigate("/revise?filter=never-correct")} />
              <Collection label="Critical" count={stats.critical} grad="bg-gradient-to-br from-red-600 to-orange-500"
                onClick={() => navigate("/revise?filter=critical")} />
            </div>
          </div>

          {/* Final Exam Revision CTA */}
          <button
            onClick={() => navigate("/revise?mode2=final&limit=60")}
            disabled={stats.critical + stats.repeatedWrong + stats.neverCorrect === 0}
            className="btn-ripple w-full overflow-hidden rounded-3xl bg-gradient-to-br from-purple-700 via-fuchsia-600 to-red-500 p-5 text-left text-white shadow-lg transition-transform hover:scale-[1.01] disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/20 p-3"><Brain className="h-6 w-6" /></div>
              <div className="flex-1">
                <p className="text-lg font-bold">🎯 Final Exam Revision</p>
                <p className="text-xs text-white/85">
                  Only critical · repeated · never-solved-correctly — auto compiled.
                </p>
              </div>
              <ChevronRight className="h-5 w-5" />
            </div>
          </button>

          {/* Per-test groups */}
          {groups.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-bold">📚 Revision by Source Test</p>
              <div className="space-y-2">
                {groups.map((g) => (
                  <TestRow key={g.testId} g={g}
                    onOpen={() => navigate(`/revise?scopeTestId=${g.testId}&limit=100`)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tint }: { icon: any; label: string; value: number; tint: string }) {
  return (
    <div className="glass-card rounded-2xl p-3">
      <Icon className={`h-4 w-4 ${tint}`} />
      <p className="mt-1 text-lg font-bold leading-none">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function Collection({ label, count, grad, onClick }: { label: string; count: number; grad: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={count === 0}
      className={`btn-ripple rounded-2xl ${grad} p-3 text-left text-white shadow-md disabled:opacity-40`}
    >
      <p className="text-xl font-bold leading-none">{count}</p>
      <p className="mt-1 text-[11px] font-medium">{label}</p>
    </button>
  );
}

function TestRow({ g, onOpen }: { g: HubGroup; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      disabled={g.pending === 0}
      className="btn-ripple flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left transition hover:bg-accent/40 disabled:opacity-60"
    >
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-semibold">{g.title}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {g.pending > 0 && <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[10px]">{g.pending} pending</Badge>}
          {g.critical > 0 && <Badge className="rounded-md bg-red-500/15 px-1.5 py-0 text-[10px] text-red-500">{g.critical} critical</Badge>}
          {g.skipped > 0 && <Badge className="rounded-md bg-amber-500/15 px-1.5 py-0 text-[10px] text-amber-600">{g.skipped} skipped</Badge>}
          {g.guess > 0 && <Badge className="rounded-md bg-orange-500/15 px-1.5 py-0 text-[10px] text-orange-500">{g.guess} guess</Badge>}
          {g.repeated > 0 && <Badge className="rounded-md bg-rose-500/15 px-1.5 py-0 text-[10px] text-rose-500">{g.repeated} repeated</Badge>}
          {g.mastered > 0 && <Badge className="rounded-md bg-emerald-500/15 px-1.5 py-0 text-[10px] text-emerald-500">{g.mastered} mastered</Badge>}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
