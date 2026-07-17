import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, TrendingUp, Award, Activity, Sparkles, ChevronRight, Dice5 } from "lucide-react";

type Row = {
  id: string;
  marks_obtained: number;
  correct_count: number;
  incorrect_count: number;
  unattempted_count: number;
  created_at: string;
  guesses: Record<string, { guess: true; selected: string; timeMs: number }> | null;
  answers: Record<string, string> | null;
  total_questions: number | null;
  tests: { title: string; subject_id: string | null; subjects: { name: string } | null } | null;
};

export default function TestAnalysis() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("test_attempts")
        .select("*, tests(title, subject_id, subjects(name))")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setRows((data as any) ?? []);
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="grid gap-4 sm:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;

  const marks = rows.map((r) => Number(r.marks_obtained));
  const overall = {
    total: rows.length,
    avg: marks.length ? Math.round(marks.reduce((a, b) => a + b, 0) / marks.length) : 0,
    best: marks.length ? Math.max(...marks) : 0,
    lowest: marks.length ? Math.min(...marks) : 0,
    correct: rows.reduce((a, r) => a + (r.correct_count || 0), 0),
    incorrect: rows.reduce((a, r) => a + (r.incorrect_count || 0), 0),
  };

  const bySubject = new Map<string, { name: string; m: number[] }>();
  rows.forEach((r) => {
    const name = r.tests?.subjects?.name ?? "Other";
    const key = name;
    if (!bySubject.has(key)) bySubject.set(key, { name, m: [] });
    bySubject.get(key)!.m.push(Number(r.marks_obtained));
  });
  const subjectStats = [...bySubject.values()].map((s) => ({
    name: s.name,
    count: s.m.length,
    avg: Math.round(s.m.reduce((a, b) => a + b, 0) / s.m.length),
    best: Math.max(...s.m),
  })).sort((a, b) => b.count - a.count);

  // ---- Guess Intelligence (long-term) ----
  const guessSeries = rows
    .slice()
    .reverse()
    .map((r) => {
      const g = r.guesses ?? {};
      const a = r.answers ?? {};
      const ids = Object.keys(g);
      let gc = 0;
      // We can only know correctness if a matching question was scored.
      // We derive it from stored answers vs the guess.selected — if a guess selection was correct,
      // the row's correct_count already includes it, but we still need per-guess correctness.
      // We approximate: assume each guess is correct if its selected option matches the answer key we kept in-memory.
      // The engine records `guesses[id].selected` — we compare against answers[id] which is the same value.
      // Without correct_option here, we cannot recompute; we fall back to counting only totals.
      // (Per-attempt accuracy is shown on the individual analysis page.)
      for (const id of ids) if (a[id] && g[id].selected === a[id]) gc += 0; // no-op
      return { total: ids.length, count: r.total_questions ?? 0, date: r.created_at };
    });
  const guessTotals = guessSeries.reduce((acc, x) => ({
    tests: acc.tests + (x.count > 0 ? 1 : 0),
    guessed: acc.guessed + x.total,
    questions: acc.questions + x.count,
  }), { tests: 0, guessed: 0, questions: 0 });
  const avgGuessPerTest = guessTotals.tests ? Math.round((guessTotals.guessed / guessTotals.tests) * 10) / 10 : 0;
  const guessFrequency = guessTotals.questions ? Math.round((guessTotals.guessed / guessTotals.questions) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Test Score & Analysis</h1>
      </div>

      {rows.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <Activity className="h-10 w-10" /><p>No test results saved yet. Save a result from any test to see your analysis.</p>
        </CardContent></Card>
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><TrendingUp className="h-5 w-5 text-primary" /> Overall Analysis</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Metric label="Total Tests Attempted" value={overall.total} />
              <Metric label="Average Score" value={overall.avg} />
              <Metric label="Best Score" value={overall.best} />
              <Metric label="Lowest Score" value={overall.lowest} />
              <Metric label="Total Correct" value={overall.correct} />
              <Metric label="Total Incorrect" value={overall.incorrect} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Award className="h-5 w-5 text-primary" /> Subject-wise Analysis</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {subjectStats.map((s) => (
                <div key={s.name} className="rounded-lg border p-3">
                  <p className="mb-2 font-semibold">{s.name}</p>
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <SubMetric label="Attempted" value={s.count} />
                    <SubMetric label="Avg Score" value={s.avg} />
                    <SubMetric label="Best Score" value={s.best} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {guessTotals.guessed > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Dice5 className="h-5 w-5 text-primary" /> Guess Intelligence (long-term)
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Metric label="Total Guesses" value={guessTotals.guessed} />
                <Metric label="Avg Guesses / Test" value={avgGuessPerTest} />
                <Metric label="Guess Frequency %" value={guessFrequency} />
              </CardContent>
            </Card>
          )}



          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Activity className="h-5 w-5 text-primary" /> Recent Activity</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {rows.slice(0, 10).map((r) => (
                <Link
                  key={r.id}
                  to={`/analysis/${r.id}`}
                  className="group flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <span className="truncate">
                    {r.tests?.subjects?.name ? `${r.tests.subjects.name} · ` : ""}{r.tests?.title ?? "Test"}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="font-medium">{Number(r.marks_obtained)} Marks</span>
                    <span className="hidden items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary sm:inline-flex">
                      <Sparkles className="h-3 w-3" /> AI Analysis
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className="text-2xl font-bold leading-none">{value}</p>
      <p className="mt-1.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function SubMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/50 p-2">
      <p className="text-base font-bold leading-none">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
