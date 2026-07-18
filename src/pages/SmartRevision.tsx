import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Brain, ChevronRight, Flame, Star, TrendingUp, Zap, Trophy, Target,
  BookOpen, Search, Sparkles, Layers, AlertTriangle, Dice5, Flag,
  Repeat, ShieldAlert, Wand2, Loader2,
} from "lucide-react";
import {
  loadSubjectSummaries, loadOverallStats, loadMastered,
  type SubjectSummary, type OverallStats, type MasteredRow,
} from "@/lib/smartRevision";
import { loadCommandStats, type CommandStats } from "@/lib/smartRevisionCommand";


const CARD_GRADIENTS = [
  "bg-gradient-royal", "bg-gradient-exam", "bg-gradient-warm",
  "bg-gradient-emerald", "bg-gradient-practice",
];

export default function SmartRevision() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [stats, setStats] = useState<OverallStats | null>(null);
  const [mastered, setMastered] = useState<MasteredRow[]>([]);
  const [cmdStats, setCmdStats] = useState<CommandStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [insights, setInsights] = useState<string[]>([]);
  const [coach, setCoach] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) { setLoading(false); return; }
      const [s, st, m, cs] = await Promise.all([
        loadSubjectSummaries(user.id),
        loadOverallStats(user.id),
        loadMastered(user.id),
        loadCommandStats(user.id),
      ]);
      setSubjects(s);
      setStats(st);
      setMastered(m);
      setCmdStats(cs);
      setLoading(false);
    })();
  }, [user]);

  async function runAICoach() {
    if (!user || aiLoading) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("smart-revision-insights", { body: {} });
      if (error) throw error;
      setInsights((data as any)?.insights ?? []);
      setCoach((data as any)?.coachMessage ?? "");
    } catch (e) {
      console.error(e);
      setInsights(["Could not generate insights right now. Try again in a moment."]);
    } finally {
      setAiLoading(false);
    }
  }

  const filteredMastered = useMemo(
    () => mastered.filter((m) => (m.question_text ?? "").toLowerCase().includes(search.toLowerCase())),
    [mastered, search],
  );

  if (!user)
    return (
      <div className="glass-card mx-auto max-w-md rounded-3xl p-10 text-center animate-fade-in">
        <Brain className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-4 text-xl font-bold">Smart Revision</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to build your personal AI revision system.</p>
        <Button className="mt-4" onClick={() => navigate("/auth")}>Sign In</Button>
      </div>
    );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-royal p-6 text-white shadow-lg">
        <Sparkles className="absolute -right-4 -top-4 h-28 w-28 opacity-15" />
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/20 p-3 backdrop-blur-sm"><Brain className="h-7 w-7" /></div>
          <div>
            <h1 className="text-2xl font-bold font-display">🧠 Smart Revision</h1>
            <p className="text-sm text-white/85">Your mistakes, automatically turned into revision tests.</p>
          </div>
        </div>
      </div>

      {/* ============ AI Revision Command Center ============ */}
      {cmdStats && (cmdStats.pending > 0 || cmdStats.mastered > 0) && (
        <div className="space-y-4">
          {/* Compact command cards */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            <CmdCard icon={Flame} label="Pending" value={cmdStats.pending} tint="text-orange-500" />
            <CmdCard icon={ShieldAlert} label="Critical" value={cmdStats.critical} tint="text-red-500" />
            <CmdCard icon={AlertTriangle} label="Due Today" value={cmdStats.dueToday} tint="text-amber-500" />
            <CmdCard icon={Trophy} label="Mastered" value={cmdStats.mastered} tint="text-emerald-500" />
            <CmdCard icon={Layers} label="Subjects" value={cmdStats.subjectsPending} tint="text-primary" />
            <CmdCard icon={BookOpen} label="Topics" value={cmdStats.topicsPending} tint="text-cyan-500" />
          </div>

          {/* Filter shortcuts */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-secondary" />
              <h3 className="text-sm font-bold">Smart Revision Sets</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <FilterButton
                grad="bg-gradient-warm" icon={ShieldAlert} label="Critical"
                count={cmdStats.critical}
                onClick={() => navigate(`/revise?filter=critical`)}
              />
              <FilterButton
                grad="bg-gradient-exam" icon={Repeat} label="Repeated"
                count={cmdStats.repeatedMistakes}
                onClick={() => navigate(`/revise?filter=repeated`)}
              />
              <FilterButton
                grad="bg-gradient-royal" icon={Dice5} label="Guess Wrong"
                count={cmdStats.guessBank}
                onClick={() => navigate(`/revise?filter=guess`)}
              />
              <FilterButton
                grad="bg-gradient-practice" icon={Flag} label="Marked"
                count={cmdStats.markedBank}
                onClick={() => navigate(`/revise?filter=marked`)}
              />
            </div>
          </div>

          {/* Final Revision Mode */}
          <button
            onClick={() => navigate(`/revise?mode2=final&limit=60`)}
            disabled={cmdStats.critical + cmdStats.repeatedMistakes === 0}
            className="btn-ripple w-full overflow-hidden rounded-3xl bg-gradient-to-br from-red-600 via-orange-600 to-amber-500 p-5 text-left text-white shadow-lg transition-transform hover:scale-[1.01] disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/20 p-3"><Target className="h-6 w-6" /></div>
              <div className="flex-1">
                <p className="text-lg font-bold">🎯 Final Revision Mode</p>
                <p className="text-xs text-white/85">
                  Only critical, repeated & never-mastered · perfect before your exam
                </p>
              </div>
              <ChevronRight className="h-5 w-5" />
            </div>
          </button>

          {/* AI Insights */}
          <div className="glass-card rounded-3xl p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-secondary" />
                <h3 className="text-sm font-bold">AJIT AI Revision Coach</h3>
              </div>
              <Button size="sm" variant="secondary" onClick={runAICoach} disabled={aiLoading} className="rounded-xl">
                {aiLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-1 h-3.5 w-3.5" />}
                {insights.length ? "Refresh" : "Generate"}
              </Button>
            </div>
            {coach && <p className="mb-3 text-sm leading-relaxed">{coach}</p>}
            {insights.length > 0 ? (
              <ul className="space-y-2">
                {insights.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Badge variant="secondary" className="mt-0.5 shrink-0 rounded-md px-1.5 py-0 text-[10px]">{i + 1}</Badge>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            ) : (
              !aiLoading && !coach && (
                <p className="text-xs text-muted-foreground">
                  Tap Generate to let AJIT AI analyse your revision bank and suggest exactly what to revise next.
                </p>
              )
            )}
          </div>
        </div>
      )}

      {/* 🧠 Mock Revision Hub — single entry card to a dedicated page */}
      <button
        onClick={() => navigate("/mock-revision-hub")}
        className="btn-ripple relative flex w-full items-center gap-3 overflow-hidden rounded-3xl bg-gradient-to-br from-fuchsia-600 via-purple-600 to-indigo-700 p-5 text-left text-white shadow-lg transition-transform hover:scale-[1.01]"
      >
        <Sparkles className="absolute -right-4 -top-4 h-24 w-24 opacity-15" />
        <div className="rounded-2xl bg-white/20 p-3 backdrop-blur-sm"><Brain className="h-6 w-6" /></div>
        <div className="flex-1">
          <p className="text-lg font-bold">🧠 Mock Revision Hub</p>
          <p className="text-xs text-white/85">
            Automatically generated revision tests from your Full Mocks & Practice Tests.
          </p>
        </div>
        <ChevronRight className="h-5 w-5" />
      </button>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-3 rounded-2xl">
          <TabsTrigger value="pending" className="rounded-xl">🔴 Pending</TabsTrigger>
          <TabsTrigger value="mastered" className="rounded-xl">⭐ Mastered</TabsTrigger>
          <TabsTrigger value="progress" className="rounded-xl">📈 Progress</TabsTrigger>
        </TabsList>


        {/* ---------------- PENDING ---------------- */}
        <TabsContent value="pending" className="mt-5 space-y-6">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-3xl" />)}</div>
          ) : (
            <>
              {/* Priority strip */}
              <div className="grid grid-cols-3 gap-3">
                <PriorityChip label="High" count={stats?.high ?? 0} dot="bg-red-500" />
                <PriorityChip label="Medium" count={stats?.medium ?? 0} dot="bg-orange-500" />
                <PriorityChip label="Low" count={stats?.low ?? 0} dot="bg-emerald-500" />
              </div>

              {/* Quick Revision */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-secondary" />
                  <h2 className="text-lg font-bold">Quick Revision</h2>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[15, 25, 50].map((n) => (
                    <button
                      key={n}
                      disabled={(stats?.pending ?? 0) === 0}
                      onClick={() => navigate(`/revise?count=${n}`)}
                      className="btn-ripple rounded-2xl bg-gradient-practice p-4 text-left text-white shadow-md disabled:opacity-50"
                    >
                      <Flame className="h-5 w-5" />
                      <p className="mt-2 text-xl font-bold">{n}</p>
                      <p className="text-xs text-white/85">Questions</p>
                    </button>
                  ))}
                  <button
                    disabled={(stats?.pending ?? 0) === 0}
                    onClick={() => navigate(`/revise`)}
                    className="btn-ripple rounded-2xl bg-gradient-royal p-4 text-left text-white shadow-md disabled:opacity-50"
                  >
                    <Target className="h-5 w-5" />
                    <p className="mt-2 text-xl font-bold">All</p>
                    <p className="text-xs text-white/85">{stats?.pending ?? 0} pending</p>
                  </button>
                </div>
              </div>

              {/* Subject cards */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-bold">Subjects</h2>
                </div>
                {subjects.length === 0 ? (
                  <EmptyState />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {subjects.map((s, i) => (
                      <Link key={s.subject_id} to={`/smart-revision/subject/${s.subject_id}`}>
                        <div className={`btn-ripple group relative overflow-hidden rounded-3xl ${CARD_GRADIENTS[i % CARD_GRADIENTS.length]} p-5 text-white shadow-md transition-transform hover:scale-[1.02]`}>
                          <BookOpen className="absolute -right-3 -bottom-3 h-20 w-20 opacity-15" />
                          <div className="flex items-start justify-between">
                            <h3 className="text-lg font-bold">{s.name}</h3>
                            <ChevronRight className="h-5 w-5 opacity-80 transition-transform group-hover:translate-x-1" />
                          </div>
                          {s.name_hi && <p className="text-sm text-white/80">{s.name_hi}</p>}
                          <div className="mt-4 flex gap-4">
                            <div>
                              <p className="text-2xl font-bold">{s.pending}</p>
                              <p className="text-[11px] uppercase tracking-wide text-white/80">Pending</p>
                            </div>
                            <div>
                              <p className="text-2xl font-bold">{s.tests}</p>
                              <p className="text-[11px] uppercase tracking-wide text-white/80">Rev. Tests</p>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </TabsContent>

        {/* ---------------- MASTERED ---------------- */}
        <TabsContent value="mastered" className="mt-5 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search mastered questions…" value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-2xl pl-9" />
          </div>
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
          ) : filteredMastered.length === 0 ? (
            <div className="glass-card rounded-3xl p-10 text-center text-muted-foreground">
              <Star className="mx-auto h-10 w-10 text-secondary" />
              <p className="mt-3 font-semibold">No mastered questions yet</p>
              <p className="mt-1 text-sm">Answer a revision question correctly twice in a row to master it.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMastered.map((m) => (
                <div key={m.id} className="glass-card rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-emerald-500/15 p-2 text-emerald-500"><Trophy className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{m.question_text ?? "Question"}</p>
                      {m.correct_option && <p className="mt-1 text-xs text-emerald-500">Correct: {m.correct_option}</p>}
                      {m.explanation && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{m.explanation}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ---------------- PROGRESS ---------------- */}
        <TabsContent value="progress" className="mt-5 space-y-5">
          {loading || !stats ? (
            <div className="grid gap-4 sm:grid-cols-3">{[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <MetricCard icon={Layers} label="Total Wrong Ever" value={stats.totalEver} tint="text-primary" />
                <MetricCard icon={Flame} label="Pending" value={stats.pending} tint="text-orange-500" />
                <MetricCard icon={Trophy} label="Mastered" value={stats.mastered} tint="text-emerald-500" />
                <MetricCard icon={Target} label="Revision Tests" value={stats.revisionTests} tint="text-secondary" />
                <MetricCard icon={TrendingUp} label="This Week" value={stats.masteredThisWeek} tint="text-cyan-500" />
                <MetricCard icon={Star} label="This Month" value={stats.masteredThisMonth} tint="text-purple-500" />
              </div>

              <div className="glass-card space-y-4 rounded-3xl p-5">
                <ProgressBar label="Mastery %" value={stats.masteryPct} grad="bg-gradient-emerald" />
                <ProgressBar label="Revision Accuracy" value={stats.revisionAccuracy} grad="bg-gradient-exam" />
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PriorityChip({ label, count, dot }: { label: string; count: number; dot: string }) {
  return (
    <div className="glass-card flex items-center justify-center gap-2 rounded-2xl p-3">
      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
      <span className="text-lg font-bold">{count}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, tint }: { icon: any; label: string; value: number; tint: string }) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <Icon className={`h-5 w-5 ${tint}`} />
      <p className="mt-2 text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ProgressBar({ label, value, grad }: { label: string; value: number; grad: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-bold">{value}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${grad} transition-all`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="glass-card rounded-3xl p-10 text-center text-muted-foreground">
      <Brain className="mx-auto h-10 w-10 text-primary" />
      <p className="mt-3 font-semibold">No revision needed right now 🎉</p>
      <p className="mt-1 text-sm">Attempt any test — your wrong &amp; skipped questions will appear here automatically.</p>
    </div>
  );
}

function CmdCard({ icon: Icon, label, value, tint }: { icon: any; label: string; value: number; tint: string }) {
  return (
    <div className="glass-card rounded-2xl p-2.5 text-center">
      <Icon className={`mx-auto h-4 w-4 ${tint}`} />
      <p className="mt-1 text-lg font-bold leading-none">{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function FilterButton({
  icon: Icon, label, count, grad, onClick,
}: { icon: any; label: string; count: number; grad: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={count === 0}
      className={`btn-ripple rounded-2xl ${grad} p-3 text-left text-white shadow-md disabled:opacity-40`}
    >
      <div className="flex items-center justify-between">
        <Icon className="h-4 w-4" />
        <span className="text-lg font-bold">{count}</span>
      </div>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-white/90">{label}</p>
    </button>
  );
}
