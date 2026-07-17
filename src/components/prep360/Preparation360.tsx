import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain, Target, TrendingUp, TrendingDown, Flame, CalendarDays, BookMarked,
  Sparkles, RefreshCw, Trophy, AlertTriangle, ArrowRight, Loader2, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

type Pick = { name: string; avg: number; delta: number; samples: number } | null;
type Prep360 = {
  student_name: string;
  scores: { preparation: number; accuracy: number; readiness: number; progress: number };
  streak: number;
  targets: {
    today: { done: number; goal: number; label: string };
    week:  { done: number; goal: number; label: string };
    month: { done: number; goal: number; label: string };
    pending_revision: number;
  };
  subjects: { strongest: Pick; weakest: Pick; most_improved: Pick };
  chapters: { weakest: Pick; most_improved: Pick };
  topics:   { weakest: Pick; most_improved: Pick };
  common_mistake: string | null;
  current_recommendation: string | null;
  insights: string[];
  recommendations: Array<{ label: string; type: string; reason?: string }>;
  totals: any;
};

export default function Preparation360() {
  const [data, setData] = useState<Prep360 | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("preparation-360", { body: {} });
      if (error) throw new Error(error.message);
      if ((res as any)?.error) throw new Error((res as any).error);
      setData(res as Prep360);
    } catch (e: any) {
      toast.error(e.message ?? "Preparation 360° load failed");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  };
  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 rounded-xl" />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="border-dashed"><CardContent className="p-6 text-center text-sm text-muted-foreground">
        Preparation 360° could not load. <Button size="sm" onClick={() => load()} className="ml-2">Retry</Button>
      </CardContent></Card>
    );
  }

  const s = data.scores;

  return (
    <div className="space-y-4">
      {/* Hero */}
      <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/15 via-secondary/10 to-background">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Preparation 360° · {data.student_name}</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-4xl font-extrabold tabular-nums">{s.preparation}</span>
                <span className="text-sm text-muted-foreground">/ 100 Preparation Score</span>
              </div>
              {data.current_recommendation && (
                <p className="mt-2 line-clamp-3 text-sm"><Sparkles className="mr-1 inline h-3.5 w-3.5 text-primary" />{data.current_recommendation}</p>
              )}
            </div>
            <Button size="sm" variant="secondary" onClick={() => load(true)} disabled={refreshing}>
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
          <div className="mt-3"><Progress value={s.preparation} className="h-2" /></div>
        </CardContent>
      </Card>

      {/* Core stats */}
      <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat icon={<Target />}     label="Overall Accuracy" value={`${s.accuracy}%`}  tint="from-emerald-500/20 to-emerald-500/5" />
        <Stat icon={<TrendingUp />} label="Exam Readiness"   value={`${s.readiness}%`} tint="from-sky-500/20 to-sky-500/5" />
        <Stat icon={<Trophy />}     label="Overall Progress" value={`${s.progress}%`}  tint="from-yellow-500/20 to-yellow-500/5" />
        <Stat icon={<Flame />}      label="Study Streak"     value={`${data.streak}d`} tint="from-orange-500/20 to-orange-500/5" />
      </section>

      {/* Targets */}
      <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <TargetChip label="Today"   t={data.targets.today} />
        <TargetChip label="Week"    t={data.targets.week} />
        <TargetChip label="Month"   t={data.targets.month} />
        <div className="rounded-xl border bg-gradient-to-br from-red-500/15 to-red-500/5 p-3">
          <div className="mb-1 flex h-7 w-7 items-center justify-center rounded-lg bg-background/60 text-red-500 [&_svg]:h-4 [&_svg]:w-4"><BookMarked /></div>
          <p className="text-xl font-bold">{data.targets.pending_revision}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Pending Revision</p>
        </div>
      </section>

      {/* Subjects / Chapters / Topics highlight */}
      <div className="grid gap-3 md:grid-cols-3">
        <HighlightCard title="📚 Subjects" items={[
          { icon: <Trophy className="h-3.5 w-3.5 text-emerald-500" />, label: "Strongest", pick: data.subjects.strongest },
          { icon: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />, label: "Weakest", pick: data.subjects.weakest },
          { icon: <TrendingUp className="h-3.5 w-3.5 text-sky-500" />, label: "Most Improved", pick: data.subjects.most_improved, showDelta: true },
        ]} />
        <HighlightCard title="📖 Chapters" items={[
          { icon: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />, label: "Weakest", pick: data.chapters.weakest },
          { icon: <TrendingUp className="h-3.5 w-3.5 text-sky-500" />, label: "Most Improved", pick: data.chapters.most_improved, showDelta: true },
        ]} />
        <HighlightCard title="🎯 Topics" items={[
          { icon: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />, label: "Weakest", pick: data.topics.weakest },
          { icon: <TrendingUp className="h-3.5 w-3.5 text-sky-500" />, label: "Most Improved", pick: data.topics.most_improved, showDelta: true },
        ]} />
      </div>

      {/* Common mistake */}
      {data.common_mistake && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-start gap-2 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="text-sm">
              <span className="font-semibold">Most Common Mistake — </span>
              <span className="text-muted-foreground">{data.common_mistake}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Insights */}
      <Card className="bg-card/60 backdrop-blur">
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Brain className="h-4 w-4 text-primary" />AI Insights</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {data.insights.length === 0 && <p className="text-xs text-muted-foreground">Attempt a few Practice Tests or upload a Mock — insights need data to be meaningful.</p>}
          {data.insights.map((it, i) => (
            <div key={i} className="flex items-start gap-2 rounded-md border bg-muted/30 p-2 text-xs">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <p>{it}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* AI Recommendations */}
      <Card className="bg-card/60 backdrop-blur">
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Target className="h-4 w-4 text-primary" />AI Recommendations</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {data.recommendations.length === 0 && <p className="text-xs text-muted-foreground">No recommendations yet.</p>}
          {data.recommendations.map((r, i) => (
            <Link key={i} to={recRoute(r.type)} className="flex items-start gap-2 rounded-md border bg-muted/30 p-2 text-xs transition hover:bg-muted/60">
              <Badge variant="outline" className="shrink-0 text-[9px] uppercase">{r.type}</Badge>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{r.label}</p>
                {r.reason && <p className="text-[11px] text-muted-foreground">{r.reason}</p>}
              </div>
              <ChevronRight className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
            </Link>
          ))}
        </CardContent>
      </Card>

      {/* Quick jumps */}
      <Card className="bg-card/60 backdrop-blur">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Jump into action</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Button asChild size="sm" variant="outline"><Link to="/tests"><Target className="mr-1 h-3.5 w-3.5" />Practice Tests</Link></Button>
          <Button asChild size="sm" variant="outline"><Link to="/smart-revision"><BookMarked className="mr-1 h-3.5 w-3.5" />Smart Revision</Link></Button>
          <Button asChild size="sm" variant="outline"><Link to="/ai-coach/chat"><Sparkles className="mr-1 h-3.5 w-3.5" />Chat Coach</Link></Button>
          <Button asChild size="sm" variant="outline"><Link to="/dashboard"><TrendingUp className="mr-1 h-3.5 w-3.5" />Dashboard</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}

function recRoute(type: string) {
  switch (type) {
    case "practice": return "/tests";
    case "revision": return "/smart-revision";
    case "pdf": return "/pdfs";
    case "planner": return "/ai-performance-center";
    default: return "/ai-performance-center";
  }
}

function Stat({ icon, label, value, tint }: { icon: React.ReactNode; label: string; value: any; tint: string }) {
  return (
    <div className={`rounded-xl border bg-gradient-to-br ${tint} p-3`}>
      <div className="mb-1 flex h-7 w-7 items-center justify-center rounded-lg bg-background/60 text-primary [&_svg]:h-4 [&_svg]:w-4">{icon}</div>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function TargetChip({ label, t }: { label: string; t: { done: number; goal: number; label: string } }) {
  const pct = Math.min(100, Math.round((t.done / Math.max(1, t.goal)) * 100));
  return (
    <div className="rounded-xl border bg-card/60 p-3 backdrop-blur">
      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>{label} Target</span><CalendarDays className="h-3 w-3" />
      </div>
      <p className="text-lg font-bold tabular-nums">{t.done}<span className="text-xs text-muted-foreground">/{t.goal}</span></p>
      <Progress value={pct} className="mt-1 h-1.5" />
      <p className="mt-1 truncate text-[10px] text-muted-foreground">{t.label}</p>
    </div>
  );
}

function HighlightCard({ title, items }: { title: string; items: Array<{ icon: React.ReactNode; label: string; pick: Pick; showDelta?: boolean }> }) {
  return (
    <Card className="bg-card/60 backdrop-blur">
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center justify-between rounded-md border bg-muted/30 px-2 py-1.5 text-xs">
            <div className="flex min-w-0 items-center gap-1.5">
              {it.icon}
              <span className="text-[10px] uppercase text-muted-foreground">{it.label}</span>
              <span className="truncate font-medium">{it.pick?.name ?? "—"}</span>
            </div>
            {it.pick && (
              <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">
                {it.showDelta && it.pick.delta !== 0
                  ? (<span className={it.pick.delta >= 0 ? "text-emerald-500" : "text-red-500"}>
                      {it.pick.delta >= 0 ? "+" : ""}{it.pick.delta}%
                    </span>)
                  : `${it.pick.avg}%`}
              </span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
