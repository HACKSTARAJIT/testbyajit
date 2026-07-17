import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Trophy, Sparkles, TrendingUp, Calendar, Target } from "lucide-react";

const labelColor = (l?: string) => ({
  Excellent: "text-emerald-500", Good: "text-sky-500", Average: "text-amber-500", Poor: "text-rose-500",
}[l ?? ""] ?? "text-muted-foreground");

const seriousnessColor = (l?: string) => ({
  "Highly Committed": "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  "Committed": "bg-sky-500/15 text-sky-500 border-sky-500/30",
  "Needs More Discipline": "bg-amber-500/15 text-amber-500 border-amber-500/30",
  "Irregular": "bg-rose-500/15 text-rose-500 border-rose-500/30",
}[l ?? ""] ?? "");

export default function Accountability() {
  const { user } = useAuth();
  const [today, setToday] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [weekly, setWeekly] = useState<any>(null);
  const [monthly, setMonthly] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("daily_reviews").select("*").eq("user_id", user.id).order("review_date", { ascending: false }).limit(14)
      .then(({ data }) => {
        setReviews(data ?? []);
        setToday((data ?? [])[0] ?? null);
      });
  }, [user]);

  const runDaily = async () => {
    if (!user) return;
    setBusy(true);
    const { data } = await supabase.functions.invoke("daily-accountability", { body: { action: "daily" } });
    setBusy(false);
    if ((data as any)?.review) setToday((data as any).review);
  };

  const runPeriod = async (action: "weekly" | "monthly") => {
    setBusy(true);
    const { data } = await supabase.functions.invoke("daily-accountability", { body: { action } });
    setBusy(false);
    if (action === "weekly") setWeekly(data); else setMonthly(data);
  };

  if (!user) return null;

  return (
    <div className="space-y-4 pb-24">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow">
          <Target className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold">Daily Accountability</h1>
          <p className="text-xs text-muted-foreground">Consistency • Discipline • Commitment</p>
        </div>
      </header>

      <Card className="rounded-3xl border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <p className="text-xs font-bold uppercase text-primary">Today's Snapshot</p>
            </div>
            <Button size="sm" onClick={runDaily} disabled={busy}>
              {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Refresh AI Analysis
            </Button>
          </div>

          {!today ? (
            <p className="text-sm text-muted-foreground">Run today's analysis to see your consistency & mentor message.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Score" value={`${today.consistency_score}`} sub={today.consistency_label} color={labelColor(today.consistency_label)} />
                <Stat label="Targets" value={`${today.targets_completed}/${today.targets_total}`} sub="Completed" />
                <Stat label="Streak" value={`${today.metrics?.streak ?? 0}d`} sub="In a row" />
              </div>
              {today.seriousness_level && (
                <Badge className={`w-fit border ${seriousnessColor(today.seriousness_level)}`}>
                  Career Seriousness: {today.seriousness_level}
                </Badge>
              )}
              <div className="rounded-xl bg-background/50 p-3">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">AI Analysis</p>
                <p className="mt-1 text-sm">{today.analysis}</p>
              </div>
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-primary">
                  <Sparkles className="h-3 w-3" /> AJIT AI Mentor
                </p>
                <p className="mt-1 text-sm">{today.mentor_message}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="weekly">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly" className="mt-3 space-y-3">
          <Button size="sm" variant="outline" onClick={() => runPeriod("weekly")} disabled={busy}>
            <TrendingUp className="mr-1.5 h-4 w-4" /> Generate Weekly Review
          </Button>
          {weekly?.summary && <PeriodSummary period="This Week" s={weekly.summary} />}
        </TabsContent>

        <TabsContent value="monthly" className="mt-3 space-y-3">
          <Button size="sm" variant="outline" onClick={() => runPeriod("monthly")} disabled={busy}>
            <Calendar className="mr-1.5 h-4 w-4" /> Generate Monthly Review
          </Button>
          {monthly?.summary && <PeriodSummary period="This Month" s={monthly.summary} />}
        </TabsContent>

        <TabsContent value="history" className="mt-3 space-y-2">
          {reviews.length === 0 && <p className="text-sm text-muted-foreground">No history yet.</p>}
          {reviews.map(r => (
            <Card key={r.id} className="rounded-2xl">
              <CardContent className="space-y-1 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{r.review_date}</span>
                  <span className={`text-sm font-bold ${labelColor(r.consistency_label)}`}>{r.consistency_score}</span>
                </div>
                <p className="text-xs text-muted-foreground">{r.targets_completed}/{r.targets_total} tasks • {r.consistency_label}</p>
                {r.mentor_message && <p className="text-sm">{r.mentor_message}</p>}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl bg-background/50 p-2 text-center">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${color ?? ""}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function PeriodSummary({ period, s }: { period: string; s: any }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="space-y-3 p-4">
        <p className="text-xs font-bold uppercase text-muted-foreground">{period}</p>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Completion" value={`${s.completionRate}%`} />
          <Stat label="Done" value={`${s.completed}`} sub={`of ${s.total}`} />
          <Stat label="Days Tracked" value={`${s.trend?.length ?? 0}`} />
        </div>
        <div className="space-y-1 text-sm">
          {s.mostMissed && <p>❌ Most missed: <span className="font-semibold">{s.mostMissed}</span></p>}
          {s.mostConsistent && <p>🏆 Most consistent day: <span className="font-semibold">{s.mostConsistent.date}</span> ({s.mostConsistent.pct}%)</p>}
          {s.leastProductive && <p>📉 Least productive: <span className="font-semibold">{s.leastProductive.date}</span> ({s.leastProductive.pct}%)</p>}
        </div>
      </CardContent>
    </Card>
  );
}
