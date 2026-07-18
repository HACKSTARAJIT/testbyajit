import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Brain, TrendingUp, TrendingDown, Minus, BookOpen, BookMarked, Target,
  Sparkles, RefreshCw, Timer, Trophy, AlertTriangle, ListChecks, Activity,
} from "lucide-react";
import { toast } from "sonner";

type Row = {
  name: string; mastery: number; samples: number; wrongs: number;
  mistakes: number; trend: "improving" | "declining" | "stable"; delta: number;
  expected_gain: number;
};
type Data = {
  totals: any;
  strong_subjects: Row[]; weak_subjects: Row[];
  strong_chapters: Row[]; weak_chapters: Row[];
  strong_topics: Row[]; weak_topics: Row[];
  mistake_dna: any;
  timeline: { date: string; type: string; label: string; value?: any }[];
  mentor: string;
};

const TrendIcon = ({ t }: { t: Row["trend"] }) =>
  t === "improving" ? <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
  : t === "declining" ? <TrendingDown className="h-3.5 w-3.5 text-red-500" />
  : <Minus className="h-3.5 w-3.5 text-muted-foreground" />;

function RowCard({ r, tone }: { r: Row; tone: "strong" | "weak" }) {
  const bar = tone === "strong" ? "bg-emerald-500/70" : "bg-red-500/70";
  return (
    <div className="rounded-lg border bg-muted/30 p-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium truncate">{r.name}</p>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <TrendIcon t={r.trend} />
          {r.delta > 0 ? `+${r.delta}` : r.delta}
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${bar}`} style={{ width: `${Math.min(100, r.mastery)}%` }} />
      </div>
      <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
        <span>Mastery {r.mastery}%</span>
        {r.wrongs > 0 && <span>· Wrongs {r.wrongs}</span>}
        {r.mistakes > 0 && <span>· Mistakes {r.mistakes}</span>}
        {r.expected_gain > 0 && (
          <Badge variant="outline" className="ml-auto text-[10px] py-0 px-1 border-primary/30 text-primary">
            +{r.expected_gain} marks
          </Badge>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, hint, tint = "from-primary/20 to-primary/5" }: any) {
  return (
    <div className={`rounded-xl border bg-gradient-to-br ${tint} p-3`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

export default function AcademicIntelligence() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.functions.invoke("academic-intelligence", { body: {} });
    if (error) toast.error(error.message);
    else setData(data as Data);
    setLoading(false);
    setRefreshing(false);
  };
  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>
    );
  }
  if (!data) return null;
  const t = data.totals;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header + refresh */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-gradient-to-br from-primary to-secondary p-2 text-primary-foreground shadow-lg shadow-primary/20">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold leading-tight">Academic Intelligence Engine</h2>
            <p className="text-[11px] text-muted-foreground">
              Permanent academic memory across every AJIT 360 module.
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => { setRefreshing(true); load(); }} disabled={refreshing}>
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Mentor letter */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-card/60 to-secondary/10 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary" /> AJIT AI — Personal Academic Mentor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-line leading-relaxed">{data.mentor}</p>
        </CardContent>
      </Card>

      {/* Selection Gap */}
      <Card className="bg-card/60 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Selection Gap Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span>Current Level: <b>{Math.round(t.current_level)}</b></span>
            <span>Target: <b>{t.target_level}</b></span>
            <span className="text-red-500">Gap: <b>{Math.round(t.gap)}</b></span>
          </div>
          <Progress value={Math.min(100, t.current_level)} className="h-2" />
          <p className="text-[11px] text-muted-foreground">
            Expected recovery: <b>{Math.max(2, Math.ceil(t.gap / Math.max(1, t.attempts_per_week * 0.4)))} weeks</b> at
            current pace ({t.attempts_per_week}/week attempts).
          </p>
        </CardContent>
      </Card>

      {/* Totals grid */}
      <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Full Mocks" value={t.mocks} tint="from-primary/20 to-primary/5" />
        <Stat label="Practice Tests" value={t.practice_tests} tint="from-sky-500/20 to-sky-500/5" />
        <Stat label="Revision Tests" value={t.revision_tests} tint="from-violet-500/20 to-violet-500/5" />
        <Stat label="Wrong Questions" value={t.wrong_questions} tint="from-red-500/20 to-red-500/5" />
        <Stat label="Avg Mock Accuracy" value={`${t.avg_mock_accuracy}%`} hint={`trend ${t.accuracy_trend.trend}`} tint="from-emerald-500/20 to-emerald-500/5" />
        <Stat label="Avg Readiness" value={`${t.avg_readiness}%`} hint={`trend ${t.readiness_trend.trend}`} tint="from-indigo-500/20 to-indigo-500/5" />
        <Stat label="Consistency" value={`${t.consistency}/100`} hint={`${t.completion_rate}% targets done`} tint="from-orange-500/20 to-orange-500/5" />
        <Stat label="Learning Speed" value={`${t.attempts_per_week}/wk`} hint={`${t.revision_mastered} mastered`} tint="from-yellow-500/20 to-yellow-500/5" />
      </section>

      {/* Subject Intelligence */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="bg-card/60 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="h-4 w-4 text-emerald-500" /> Strong Subjects
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {data.strong_subjects.length === 0 && <p className="text-xs text-muted-foreground">Build mastery — appear as you cross 75%.</p>}
            {data.strong_subjects.map(r => <RowCard key={r.name} r={r} tone="strong" />)}
          </CardContent>
        </Card>
        <Card className="bg-card/60 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" /> Weak Subjects
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {data.weak_subjects.length === 0 && <p className="text-xs text-muted-foreground">No weak subjects detected. 🎉</p>}
            {data.weak_subjects.map(r => <RowCard key={r.name} r={r} tone="weak" />)}
          </CardContent>
        </Card>
      </div>

      {/* Chapter Intelligence */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="bg-card/60 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookMarked className="h-4 w-4 text-emerald-500" /> Strong Chapters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {data.strong_chapters.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
            {data.strong_chapters.map(r => <RowCard key={r.name} r={r} tone="strong" />)}
          </CardContent>
        </Card>
        <Card className="bg-card/60 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-red-500" /> Weak Chapters — Revision Needed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {data.weak_chapters.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
            {data.weak_chapters.map(r => <RowCard key={r.name} r={r} tone="weak" />)}
          </CardContent>
        </Card>
      </div>

      {/* Topic Intelligence */}
      <Card className="bg-card/60 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Topic Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold text-emerald-500 mb-1.5">Strong Topics</p>
            <div className="space-y-1.5">
              {data.strong_topics.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
              {data.strong_topics.map(r => <RowCard key={r.name} r={r} tone="strong" />)}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-red-500 mb-1.5">Repeated Error Topics</p>
            <div className="space-y-1.5">
              {data.weak_topics.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
              {data.weak_topics.map(r => <RowCard key={r.name} r={r} tone="weak" />)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mistake DNA snapshot */}
      {data.mistake_dna && (
        <Card className="bg-card/60 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" /> Mistake DNA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-[11px] whitespace-pre-wrap text-muted-foreground max-h-40 overflow-auto">
{JSON.stringify(data.mistake_dna, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Learning Timeline */}
      <Card className="bg-card/60 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Learning Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-72 overflow-auto space-y-1.5 pr-1">
            {data.timeline.map((ev, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-2 py-1.5 text-xs">
                <div className="min-w-0 flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase">{ev.type}</Badge>
                  <span className="truncate">{ev.label}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
                  {ev.value?.accuracy != null && <span>{ev.value.accuracy}%</span>}
                  {ev.value?.readiness != null && <span>· R {ev.value.readiness}</span>}
                  <Timer className="h-3 w-3" />
                  {new Date(ev.date).toLocaleDateString()}
                </div>
              </div>
            ))}
            {data.timeline.length === 0 && <p className="text-xs text-muted-foreground">No events yet.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
