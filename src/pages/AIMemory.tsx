import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Brain, Sparkles, TrendingUp, TrendingDown, Minus, History, Loader2, Trophy, AlertTriangle, ArrowUpRight, ArrowDownRight, Target } from "lucide-react";
import { toast } from "sonner";

type MockRow = {
  id: string; title: string; created_at: string;
  accuracy: number | null; readiness_score: number | null; overall_score: number | null;
  report: any;
};

const avg = (xs: number[]) => xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0;
const trendOf = (xs: number[]): "up" | "down" | "flat" => {
  if (xs.length < 2) return "flat";
  const half = Math.max(1, Math.floor(xs.length / 2));
  const a = avg(xs.slice(0, half));
  const b = avg(xs.slice(-half));
  if (b - a >= 3) return "up";
  if (a - b >= 3) return "down";
  return "flat";
};
const arrow = (t: "up" | "down" | "flat") =>
  t === "up" ? <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> :
  t === "down" ? <TrendingDown className="h-3.5 w-3.5 text-red-500" /> :
  <Minus className="h-3.5 w-3.5 text-muted-foreground" />;

function collect(mocks: MockRow[], key: "weak_subjects" | "strong_subjects" | "weak_chapters" | "weak_topics" | "strong_topics") {
  const counter = new Map<string, number>();
  mocks.forEach(m => {
    const arr: string[] = m.report?.[key] ?? [];
    arr.forEach(x => x && counter.set(String(x).trim(), (counter.get(String(x).trim()) ?? 0) + 1));
  });
  return [...counter.entries()].sort((a, b) => b[1] - a[1]);
}

// Per-subject accuracy series from subject_analysis[]
function subjectSeries(mocks: MockRow[]) {
  const map = new Map<string, { series: number[]; latest: number; count: number }>();
  mocks.forEach(m => {
    const sa: any[] = m.report?.subject_analysis ?? [];
    sa.forEach(s => {
      const name = String(s?.subject ?? "").trim();
      const acc = Number(s?.accuracy);
      if (!name || !Number.isFinite(acc)) return;
      const e = map.get(name) ?? { series: [], latest: 0, count: 0 };
      e.series.push(acc);
      e.latest = acc;
      e.count += 1;
      map.set(name, e);
    });
  });
  return [...map.entries()].map(([name, e]) => ({
    name, count: e.count, latest: e.latest, avg: avg(e.series), trend: trendOf(e.series), delta: e.series.length >= 2 ? e.series[e.series.length - 1] - e.series[0] : 0,
    series: e.series,
  })).sort((a, b) => b.count - a.count);
}

export default function AIMemory() {
  const { user } = useAuth();
  const [mocks, setMocks] = useState<MockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mentor, setMentor] = useState<string>("");
  const [generatingMentor, setGeneratingMentor] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("ai_mock_reports")
        .select("id,title,created_at,accuracy,readiness_score,overall_score,report,report_type,status")
        .eq("user_id", user.id).eq("status", "completed")
        .in("report_type", ["full_mock", "previous_year"])
        .order("created_at", { ascending: true }).limit(50);
      setMocks((data as any) ?? []);
      setLoading(false);
    })();
  }, [user]);

  const scores = mocks.map(m => Number(m.overall_score ?? m.report?.totals?.marks ?? 0)).filter(x => x > 0);
  const accs = mocks.map(m => Number(m.accuracy ?? 0)).filter(x => x > 0);
  const readys = mocks.map(m => Number(m.readiness_score ?? 0)).filter(x => x > 0);
  const times = mocks.map(m => Number(m.report?.totals?.time_taken_minutes ?? m.report?.totals?.time ?? 0)).filter(x => x > 0);

  const trends = {
    score: { avg: avg(scores), trend: trendOf(scores), best: scores.length ? Math.max(...scores) : 0, latest: scores.at(-1) ?? 0 },
    accuracy: { avg: avg(accs), trend: trendOf(accs), best: accs.length ? Math.max(...accs) : 0, latest: accs.at(-1) ?? 0 },
    readiness: { avg: avg(readys), trend: trendOf(readys), best: readys.length ? Math.max(...readys) : 0, latest: readys.at(-1) ?? 0 },
    time: { avg: avg(times), trend: trendOf(times), latest: times.at(-1) ?? 0 },
  };

  const weakSubjects = collect(mocks, "weak_subjects").slice(0, 6);
  const strongSubjects = collect(mocks, "strong_subjects").slice(0, 6);
  const weakChapters = collect(mocks, "weak_chapters").slice(0, 8);
  const weakTopics = collect(mocks, "weak_topics").slice(0, 8);
  const strongTopics = collect(mocks, "strong_topics").slice(0, 6);

  const subjects = useMemo(() => subjectSeries(mocks), [mocks]);
  const improving = subjects.filter(s => s.trend === "up").slice(0, 5);
  const declining = subjects.filter(s => s.trend === "down").slice(0, 5);
  const stable = subjects.filter(s => s.trend === "flat").slice(0, 5);

  // Improvement opportunities (rough expected marks impact = gap × frequency, capped)
  const opportunities = useMemo(() => {
    const items: { label: string; expected: number; reason: string }[] = [];
    subjects.forEach(s => {
      if (s.avg < 75 && s.count >= 2) {
        const gap = Math.max(0, 80 - s.avg);
        const expected = Math.max(2, Math.round(gap * 0.15));
        items.push({ label: `Improve ${s.name}`, expected, reason: `Avg accuracy ${s.avg}% across ${s.count} mocks` });
      }
    });
    weakChapters.slice(0, 3).forEach(([name, freq]) => {
      items.push({ label: `Revise ${name}`, expected: 2 + freq, reason: `Weak in ${freq} mocks` });
    });
    const carelessTotal = mocks.reduce((s, m) => s + Number(m.report?.mistake_categories?.silly ?? 0), 0);
    if (carelessTotal >= 3) items.push({ label: "Reduce Careless Mistakes", expected: Math.min(10, carelessTotal), reason: `${carelessTotal} silly mistakes across history` });
    return items.sort((a, b) => b.expected - a.expected).slice(0, 6);
  }, [subjects, weakChapters, mocks]);

  const biggest = {
    strength: strongSubjects[0]?.[0] ?? subjects.find(s => s.avg >= 75)?.name ?? "—",
    weakness: weakSubjects[0]?.[0] ?? subjects.filter(s => s.avg < 60)[0]?.name ?? "—",
    fastImprovingSubject: [...subjects].sort((a, b) => b.delta - a.delta)[0],
    fastDecliningSubject: [...subjects].sort((a, b) => a.delta - b.delta)[0],
    fastImprovingChapter: weakChapters.length && strongTopics.length ? strongTopics[0][0] : "—",
    fastDecliningChapter: weakChapters[0]?.[0] ?? "—",
  };

  async function loadMentor() {
    setGeneratingMentor(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-memory-mentor", { body: {} });
      if (error) throw new Error(error.message);
      setMentor(data?.mentor ?? "");
    } catch (e: any) {
      toast.error(e.message || "Mentor fetch failed");
    } finally {
      setGeneratingMentor(false);
    }
  }
  useEffect(() => { if (mocks.length > 0 && !mentor) loadMentor(); /* eslint-disable-next-line */ }, [mocks.length]);

  if (loading) return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;

  if (mocks.length === 0) {
    return (
      <Card className="border-dashed bg-card/40 backdrop-blur">
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <Brain className="h-10 w-10 text-primary" />
          <p className="text-sm font-semibold">AI Memory अभी खाली है</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            पहला Full Mock upload होते ही AI हर mock को permanently याद रखना शुरू कर देगा — और long-term trends generate करेगा।
          </p>
        </CardContent>
      </Card>
    );
  }

  const timeline = mocks.slice().reverse().slice(0, 20);

  return (
    <div className="space-y-4">
      {/* Mentor letter */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-card/60 to-secondary/10 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary" /> AJIT AI Mentor — Long-term Memory
            <Badge variant="secondary" className="ml-auto text-[10px]">{mocks.length} mocks remembered</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {generatingMentor && !mentor ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> AI आपकी पूरी mock history पढ़ रहा है…</div>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{mentor || "—"}</p>
          )}
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={loadMentor} disabled={generatingMentor}>
              {generatingMentor ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
              Refresh Mentor
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Trends */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <TrendCard label="Score Trend" latest={trends.score.latest} avg={trends.score.avg} best={trends.score.best} trend={trends.score.trend} />
        <TrendCard label="Accuracy Trend" latest={trends.accuracy.latest} avg={trends.accuracy.avg} best={trends.accuracy.best} trend={trends.accuracy.trend} suffix="%" />
        <TrendCard label="Readiness Trend" latest={trends.readiness.latest} avg={trends.readiness.avg} best={trends.readiness.best} trend={trends.readiness.trend} suffix="%" />
        <TrendCard label="Time Trend (min)" latest={trends.time.latest} avg={trends.time.avg} best={0} trend={trends.time.trend === "up" ? "down" : trends.time.trend === "down" ? "up" : "flat"} hideBest />
      </section>

      {/* Selection Intelligence highlights */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="bg-card/60 backdrop-blur">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Trophy className="h-4 w-4 text-yellow-500" /> Selection Intelligence</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-xs">
            <KV label="Biggest Strength" value={biggest.strength} tone="ok" />
            <KV label="Biggest Weakness" value={biggest.weakness} tone="warn" />
            <KV label="Fast ↑ Subject" value={biggest.fastImprovingSubject ? `${biggest.fastImprovingSubject.name} (+${biggest.fastImprovingSubject.delta}%)` : "—"} tone="ok" />
            <KV label="Fast ↓ Subject" value={biggest.fastDecliningSubject && biggest.fastDecliningSubject.delta < 0 ? `${biggest.fastDecliningSubject.name} (${biggest.fastDecliningSubject.delta}%)` : "—"} tone="warn" />
            <KV label="Fast ↑ Chapter" value={biggest.fastImprovingChapter} tone="ok" />
            <KV label="Fast ↓ Chapter" value={biggest.fastDecliningChapter} tone="warn" />
          </CardContent>
        </Card>

        <Card className="bg-card/60 backdrop-blur">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Target className="h-4 w-4 text-primary" /> Improvement Opportunities</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {opportunities.length === 0 && <p className="text-xs text-muted-foreground">कोई stand-out opportunity नहीं — accuracy अच्छी बनी हुई है।</p>}
            {opportunities.map((o, i) => (
              <div key={i} className="flex items-start justify-between gap-2 rounded-md border bg-muted/30 px-2 py-1.5 text-xs">
                <div className="min-w-0">
                  <p className="truncate font-medium">{o.label}</p>
                  <p className="text-[10px] text-muted-foreground">{o.reason}</p>
                </div>
                <Badge className="shrink-0 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">+{o.expected} Marks</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Subject memory */}
      <Card className="bg-card/60 backdrop-blur">
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm">📚 Subject Memory ({subjects.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {subjects.length === 0 && <p className="text-xs text-muted-foreground">Subject-level analysis अभी available नहीं।</p>}
          {subjects.map(s => (
            <div key={s.name} className="rounded-md border bg-muted/30 p-2">
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 font-medium">{arrow(s.trend)} {s.name}</span>
                <span className="text-muted-foreground">
                  avg <b className="text-foreground">{s.avg}%</b> · latest <b className="text-foreground">{s.latest}%</b>
                  {s.delta !== 0 && <span className={s.delta > 0 ? "text-emerald-500" : "text-red-500"}> · {s.delta > 0 ? "+" : ""}{s.delta}%</span>}
                  <span className="ml-1">· {s.count} mocks</span>
                </span>
              </div>
              <Progress value={s.avg} className="h-1.5" />
            </div>
          ))}
          <div className="grid grid-cols-3 gap-2 pt-2 text-[11px]">
            <MiniList title="Improving" items={improving.map(s => `${s.name} +${s.delta}%`)} tone="ok" />
            <MiniList title="Stable" items={stable.map(s => s.name)} tone="flat" />
            <MiniList title="Declining" items={declining.map(s => `${s.name} ${s.delta}%`)} tone="warn" />
          </div>
        </CardContent>
      </Card>

      {/* Chapter + Topic memory */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="bg-card/60 backdrop-blur">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm">📖 Chapter Memory</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <p className="mb-1 text-[10px] uppercase text-muted-foreground">Recurring Weak Chapters</p>
            {weakChapters.map(([name, freq]) => (
              <FreqRow key={name} name={name} freq={freq} tone="warn" />
            ))}
            {weakChapters.length === 0 && <p className="text-xs text-muted-foreground">No recurring weak chapters — great consistency.</p>}
          </CardContent>
        </Card>
        <Card className="bg-card/60 backdrop-blur">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm">🎯 Topic Memory</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <p className="mb-1 text-[10px] uppercase text-muted-foreground">Recurring Weak Topics</p>
            {weakTopics.map(([name, freq]) => (
              <FreqRow key={name} name={name} freq={freq} tone="warn" />
            ))}
            {strongTopics.length > 0 && (
              <>
                <p className="mb-1 mt-2 text-[10px] uppercase text-muted-foreground">Consistent Strong Topics</p>
                {strongTopics.map(([name, freq]) => (
                  <FreqRow key={name} name={name} freq={freq} tone="ok" />
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card className="bg-card/60 backdrop-blur">
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><History className="h-4 w-4 text-primary" /> AI Performance Timeline (last {timeline.length} mocks)</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {timeline.map((m, i) => {
            const prev = timeline[i + 1];
            const scoreNow = Number(m.overall_score ?? m.report?.totals?.marks ?? 0);
            const scorePrev = prev ? Number(prev.overall_score ?? prev.report?.totals?.marks ?? 0) : scoreNow;
            const delta = scoreNow - scorePrev;
            return (
              <div key={m.id} className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-2 py-1.5 text-xs">
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.title}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">Score {scoreNow}</Badge>
                  <Badge variant="outline" className="text-[10px]">Acc {m.accuracy ?? 0}%</Badge>
                  <Badge variant="outline" className="text-[10px]">Ready {m.readiness_score ?? 0}%</Badge>
                  {prev && (delta !== 0) && (
                    <span className={`flex items-center text-[10px] font-semibold ${delta > 0 ? "text-emerald-500" : "text-red-500"}`}>
                      {delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {delta > 0 ? "+" : ""}{delta}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function TrendCard({ label, latest, avg, best, trend, suffix = "", hideBest }: { label: string; latest: number; avg: number; best: number; trend: "up" | "down" | "flat"; suffix?: string; hideBest?: boolean }) {
  return (
    <div className="rounded-xl border bg-card/60 p-3 backdrop-blur">
      <div className="mb-1 flex items-center justify-between text-[10px] uppercase text-muted-foreground">
        <span>{label}</span>{arrow(trend)}
      </div>
      <p className="text-xl font-bold">{latest}{suffix}</p>
      <p className="text-[10px] text-muted-foreground">avg {avg}{suffix}{!hideBest && ` · best ${best}${suffix}`}</p>
    </div>
  );
}

function KV({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" }) {
  return (
    <div className={`rounded-md border p-2 ${tone === "ok" ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function MiniList({ title, items, tone }: { title: string; items: string[]; tone: "ok" | "warn" | "flat" }) {
  const colour = tone === "ok" ? "text-emerald-500" : tone === "warn" ? "text-red-500" : "text-muted-foreground";
  return (
    <div>
      <p className={`mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase ${colour}`}>
        {tone === "ok" ? <TrendingUp className="h-3 w-3" /> : tone === "warn" ? <AlertTriangle className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
        {title}
      </p>
      {items.length === 0 && <p className="text-[10px] text-muted-foreground">—</p>}
      <ul className="space-y-0.5">{items.map(i => <li key={i} className="truncate">{i}</li>)}</ul>
    </div>
  );
}

function FreqRow({ name, freq, tone }: { name: string; freq: number; tone: "ok" | "warn" }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="truncate">{name}</span>
      <Badge variant="outline" className={`text-[10px] ${tone === "warn" ? "border-red-500/40 text-red-500" : "border-emerald-500/40 text-emerald-500"}`}>×{freq}</Badge>
    </div>
  );
}
