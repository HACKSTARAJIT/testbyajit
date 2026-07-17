import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import {
  Flame, Target, TrendingUp, Sparkles, ChevronRight, Play, Trophy, Award,
  BookOpen, ClipboardList, Brain, Timer, FileText, AlertTriangle, CheckCircle2,
  Zap, Rocket, Gauge, Crown, Star, LineChart as LineIcon,
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { useMemo } from "react";
import type { HomeData } from "./useHomeData";

const greet = () => {
  const h = new Date().getHours();
  if (h < 5) return { en: "Late night grind", hi: "देर रात की तैयारी" };
  if (h < 12) return { en: "Good morning", hi: "सुप्रभात" };
  if (h < 17) return { en: "Good afternoon", hi: "नमस्कार" };
  if (h < 21) return { en: "Good evening", hi: "शुभ संध्या" };
  return { en: "Good night", hi: "शुभ रात्रि" };
};

const fmtMin = (m: number) => m >= 60 ? `${(m / 60).toFixed(1)}h` : `${m}m`;

export function HomeHero({ data, continueTo }: { data: HomeData; continueTo: { path: string; label: string } | null }) {
  const g = greet();
  const name = data.displayName?.split(" ")[0] || "Student";
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-hero p-5 text-primary-foreground shadow-xl md:p-7 animate-fade-in">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-secondary/30 blur-3xl" />

      <div className="relative">
        <p className="text-xs font-medium uppercase tracking-widest text-primary-foreground/70">{g.en} • {g.hi}</p>
        <h1 className="mt-1 text-2xl font-bold leading-tight md:text-3xl">
          {name} <span className="inline-block animate-fade-in">👋</span>
        </h1>
        <p className="mt-1 text-sm text-primary-foreground/85">Let's make today count on AJIT 360.</p>

        <div className="mt-5 grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <GlassStat icon={Flame} label="Streak" value={`${data.streak}d`} sub={data.streak >= 3 ? "🔥 On fire" : "Keep going"} />
          <GlassStat icon={Gauge} label="Prep score" value={`${data.prepScore}`} sub="/ 100" />
          <GlassStat icon={Target} label="Readiness" value={`${data.readiness}%`} sub="Exam ready" />
          <GlassStat icon={TrendingUp} label="Accuracy" value={`${data.accuracy}%`} sub={data.accuracy >= 70 ? "Strong" : "Improving"} />
        </div>

        {continueTo && (
          <Link to={continueTo.path} className="mt-5 block">
            <Button size="lg" className="btn-ripple w-full bg-white text-primary shadow-lg hover:bg-white/95 sm:w-auto">
              <Play className="mr-2 h-4 w-4" /> Continue: {continueTo.label}
            </Button>
          </Link>
        )}
      </div>
    </section>
  );
}

function GlassStat({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-md">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-primary-foreground/75">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-1 text-xl font-bold leading-none">{value}</div>
      {sub && <div className="mt-1 text-[10px] text-primary-foreground/70">{sub}</div>}
    </div>
  );
}

// ---------- Today's Mission ----------
interface Mission { key: string; title: string; icon: any; target: number; current: number; unit: string; to: string }

export function TodaysMission({ data }: { data: HomeData }) {
  const missions = useMemo<Mission[]>(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayAttempts = data.attempts.filter((a: any) => a.created_at?.slice(0, 10) === today);
    const qToday = todayAttempts.reduce((s: number, a: any) => s + (a.total_questions ?? 0), 0);
    const testsToday = todayAttempts.length;
    const accs = todayAttempts.map((a: any) => a.accuracy ?? 0).filter((x: number) => x > 0);
    const accToday = accs.length ? Math.round(accs.reduce((s, x) => s + x, 0) / accs.length) : 0;
    const pdfsToday = data.activity.filter((a: any) => a.item_type === "pdf" && a.opened_at?.slice(0, 10) === today).length;
    const revisedToday = data.wrongs.filter((w: any) => w.mastered_at?.slice(0, 10) === today).length;
    return [
      { key: "q", title: "Solve 50 questions", icon: Brain, target: 50, current: qToday, unit: "Q", to: "/tests" },
      { key: "t", title: "Complete 1 practice test", icon: ClipboardList, target: 1, current: testsToday, unit: "test", to: "/tests" },
      { key: "p", title: "Read 2 PDFs", icon: FileText, target: 2, current: pdfsToday, unit: "pdf", to: "/subjects" },
      { key: "r", title: "Revise 10 wrong Qs", icon: Zap, target: 10, current: revisedToday, unit: "Q", to: "/revise" },
      { key: "a", title: "Hit 80% accuracy", icon: Target, target: 80, current: accToday, unit: "%", to: "/tests" },
    ];
  }, [data]);

  const done = missions.filter(m => m.current >= m.target).length;
  const pct = Math.round((done / missions.length) * 100);

  return (
    <section className="animate-fade-in">
      <Header icon={Rocket} title="Today's Mission" hi="आज का लक्ष्य" right={<Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" />{done}/{missions.length}</Badge>} />
      <Card className="mt-3 overflow-hidden border-primary/10">
        <CardContent className="space-y-3 p-4">
          <Progress value={pct} className="h-2" />
          <div className="grid gap-2 sm:grid-cols-2">
            {missions.map(m => {
              const p = Math.min(100, Math.round((m.current / m.target) * 100));
              const done = m.current >= m.target;
              return (
                <Link key={m.key} to={m.to} className={`group flex items-center gap-3 rounded-xl border p-3 transition-all hover:shadow-sm ${done ? "border-primary/30 bg-primary/5" : "bg-card"}`}>
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${done ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {done ? <CheckCircle2 className="h-4 w-4" /> : <m.icon className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.title}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Progress value={p} className="h-1 flex-1" />
                      <span className="text-[10px] tabular-nums text-muted-foreground">{m.current}/{m.target}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

// ---------- Quick Stats ----------
export function QuickStats({ data }: { data: HomeData }) {
  const items = [
    { icon: ClipboardList, label: "Tests done", value: data.testsCompleted, tint: "text-blue-600" },
    { icon: Brain, label: "Questions", value: data.questionsSolved, tint: "text-purple-600" },
    { icon: Target, label: "Accuracy", value: `${data.accuracy}%`, tint: "text-emerald-600" },
    { icon: Timer, label: "Study time", value: fmtMin(data.studyMinutes), tint: "text-amber-600" },
    { icon: FileText, label: "PDFs done", value: data.pdfsCompleted, tint: "text-cyan-600" },
    { icon: AlertTriangle, label: "To revise", value: data.pendingRevision, tint: "text-orange-600" },
    { icon: Zap, label: "Wrong Qs", value: data.wrongTotal, tint: "text-rose-600" },
    { icon: Flame, label: "Streak", value: `${data.streak}d`, tint: "text-red-600" },
  ];
  return (
    <section className="animate-fade-in">
      <Header icon={LineIcon} title="Quick Stats" hi="त्वरित आँकड़े" />
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {items.map((s, i) => (
          <Card key={i} className="border-border/60 transition-all hover:-translate-y-0.5 hover:shadow-md">
            <CardContent className="flex items-center gap-3 p-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-muted ${s.tint}`}>
                <s.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-bold leading-none tabular-nums">{s.value}</div>
                <div className="mt-1 truncate text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

// ---------- AI Recommendation ----------
export function AIRecommendation({ data }: { data: HomeData }) {
  const insights = useMemo(() => {
    const out: { tone: "warn" | "good" | "info"; text: string }[] = [];
    const attempts = data.attempts;
    if (attempts.length >= 4) {
      const recent = attempts.slice(0, Math.min(5, Math.floor(attempts.length / 2)));
      const prev = attempts.slice(recent.length, recent.length * 2);
      const avg = (xs: any[]) => xs.length ? xs.reduce((s, a) => s + (a.accuracy ?? 0), 0) / xs.length : 0;
      const r = avg(recent), p = avg(prev);
      const delta = Math.round(r - p);
      if (delta <= -4) out.push({ tone: "warn", text: `Accuracy dropped ${Math.abs(delta)}% in your last ${recent.length} tests — review mistakes before the next attempt.` });
      else if (delta >= 4) out.push({ tone: "good", text: `Accuracy up ${delta}% recently — momentum is building, keep the volume steady.` });
    }
    // subject with most pending revisions
    const bySub: Record<string, number> = {};
    data.wrongs.filter((w: any) => w.status === "pending").forEach((w: any) => { if (w.subject_id) bySub[w.subject_id] = (bySub[w.subject_id] ?? 0) + 1; });
    const top = Object.entries(bySub).sort((a, b) => b[1] - a[1])[0];
    if (top) {
      const name = data.subjects.find((s: any) => s.id === top[0])?.name ?? "One subject";
      out.push({ tone: "warn", text: `${name} has ${top[1]} pending revision questions — clear these first for the biggest score jump.` });
    }
    if (data.readiness && data.readiness < 60) out.push({ tone: "info", text: `Exam readiness at ${data.readiness}% — target 75%+ by attempting 2 full mocks this week.` });
    if (data.streak >= 7) out.push({ tone: "good", text: `${data.streak}-day streak — consistency is your biggest edge, don't break the chain today.` });
    if (out.length === 0) out.push({ tone: "info", text: "Attempt your first practice test so AJIT AI can start personalising your plan." });
    return out.slice(0, 3);
  }, [data]);

  const toneCls = { warn: "border-orange-500/40 bg-orange-500/5", good: "border-emerald-500/40 bg-emerald-500/5", info: "border-primary/30 bg-primary/5" };

  return (
    <section className="animate-fade-in">
      <Header icon={Sparkles} title="AJIT AI Recommendation" hi="AI सुझाव" right={<Link to="/ai-coach" className="text-xs font-medium text-primary hover:underline">Ask AI →</Link>} />
      <Card className="mt-3 overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5">
        <CardContent className="space-y-2 p-4">
          {insights.map((i, idx) => (
            <div key={idx} className={`flex items-start gap-2.5 rounded-xl border p-3 ${toneCls[i.tone]}`}>
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-sm leading-relaxed">{i.text}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}

// ---------- Weekly Progress Chart ----------
export function WeeklyProgress({ data }: { data: HomeData }) {
  const total = data.weeklyBuckets.reduce((s, b) => s + b.questions, 0);
  return (
    <section className="animate-fade-in">
      <Header icon={LineIcon} title="Weekly Progress" hi="साप्ताहिक प्रगति" right={<span className="text-xs text-muted-foreground">{total} Qs this week</span>} />
      <Card className="mt-3">
        <CardContent className="p-4">
          <div className="h-40 w-full">
            <ResponsiveContainer>
              <AreaChart data={data.weeklyBuckets} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gQ" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="questions" name="Questions" stroke="hsl(var(--primary))" fill="url(#gQ)" strokeWidth={2} />
                <Area type="monotone" dataKey="minutes" name="Minutes" stroke="hsl(var(--secondary))" fill="transparent" strokeWidth={2} strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2 text-center">
            <MiniStat label="Tests" value={data.weeklyBuckets.reduce((s, b) => s + b.tests, 0)} />
            <MiniStat label="Questions" value={total} />
            <MiniStat label="Minutes" value={data.weeklyBuckets.reduce((s, b) => s + b.minutes, 0)} />
            <MiniStat label="Revised" value={data.weeklyBuckets.reduce((s, b) => s + b.revised, 0)} />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2">
      <div className="text-sm font-bold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

// ---------- Achievements ----------
export function AchievementsRow({ data }: { data: HomeData }) {
  const badges = [
    { code: "streak_7", label: "7-Day Streak", icon: Flame, unlocked: data.streak >= 7 },
    { code: "q_1000", label: "1000 Questions", icon: Brain, unlocked: data.questionsSolved >= 1000 },
    { code: "acc_90", label: "90% Accuracy", icon: Target, unlocked: data.accuracy >= 90 },
    { code: "rev_master", label: "Revision Master", icon: Zap, unlocked: data.wrongTotal > 0 && data.pendingRevision === 0 },
    { code: "practice_champ", label: "Practice Champ", icon: Trophy, unlocked: data.testsCompleted >= 25 },
    { code: "perfect_test", label: "Perfect Test", icon: Crown, unlocked: data.attempts.some((a: any) => (a.accuracy ?? 0) === 100) },
  ];
  return (
    <section className="animate-fade-in">
      <Header icon={Award} title="Achievements" hi="उपलब्धियाँ" />
      <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1">
        {badges.map(b => (
          <div key={b.code} className={`flex w-28 shrink-0 flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition-all ${b.unlocked ? "border-primary/40 bg-gradient-to-br from-primary/10 to-secondary/10 shadow-sm" : "opacity-50"}`}>
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${b.unlocked ? "bg-gradient-primary text-primary-foreground" : "bg-muted"}`}>
              <b.icon className="h-5 w-5" />
            </div>
            <div className="text-[11px] font-semibold leading-tight">{b.label}</div>
            {b.unlocked ? <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> : <span className="text-[9px] text-muted-foreground">Locked</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- Daily Challenge ----------
export function DailyChallenge({ data }: { data: HomeData }) {
  const bySub: Record<string, number> = {};
  data.wrongs.filter((w: any) => w.status === "pending").forEach((w: any) => { if (w.subject_id) bySub[w.subject_id] = (bySub[w.subject_id] ?? 0) + 1; });
  const top = Object.entries(bySub).sort((a, b) => b[1] - a[1])[0];
  const subjectName = top ? data.subjects.find((s: any) => s.id === top[0])?.name : null;
  const title = subjectName ? `Revise ${Math.min(10, top![1])} ${subjectName} questions` : "Complete 25 practice questions";
  const to = subjectName ? "/revise" : "/tests";
  return (
    <Card className="animate-fade-in overflow-hidden border-secondary/30 bg-gradient-warm text-secondary-foreground shadow-lg">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/25 backdrop-blur">
          <Trophy className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest opacity-80">Daily Challenge</p>
          <p className="truncate text-sm font-bold">{title}</p>
          <p className="text-[11px] opacity-80">Reward: +50 XP • Badge unlock</p>
        </div>
        <Link to={to}><Button size="sm" variant="secondary" className="shrink-0">Start <ChevronRight className="ml-1 h-3 w-3" /></Button></Link>
      </CardContent>
    </Card>
  );
}

// ---------- Quick Actions ----------
export function QuickActions() {
  const actions = [
    { to: "/tests", icon: ClipboardList, label: "Practice Test" },
    { to: "/smart-revision", icon: Brain, label: "Smart Revision" },
    { to: "/wrong-questions", icon: AlertTriangle, label: "Wrong Qs" },
    { to: "/ai-coach", icon: Sparkles, label: "AJIT AI" },
    { to: "/performance", icon: Gauge, label: "Performance" },
    { to: "/ai-performance", icon: LineIcon, label: "Study Plan" },
  ];
  return (
    <section className="animate-fade-in">
      <Header icon={Zap} title="Quick Actions" hi="त्वरित क्रियाएँ" />
      <div className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-6">
        {actions.map(a => (
          <Link key={a.to} to={a.to} className="group flex flex-col items-center gap-1.5 rounded-2xl border bg-card p-3 text-center transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-sm">
              <a.icon className="h-4 w-4" />
            </div>
            <span className="text-[11px] font-medium leading-tight">{a.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---------- Goals ----------
export function GoalsPanel({ data }: { data: HomeData }) {
  const g = data.goals ?? {} as any;
  const items = [
    { label: "Today", target: 50, current: data.weeklyBuckets[6]?.questions ?? 0, unit: "Q", hint: "questions" },
    { label: "Weekly", target: 350, current: data.weeklyBuckets.reduce((s, b) => s + b.questions, 0), unit: "Q", hint: "questions" },
    { label: "Accuracy", target: g?.target_accuracy ?? 80, current: data.accuracy, unit: "%", hint: "goal" },
    { label: "Readiness", target: g?.target_readiness ?? 75, current: data.readiness, unit: "%", hint: "exam" },
  ];
  return (
    <section className="animate-fade-in">
      <Header icon={Target} title="Your Goals" hi="आपके लक्ष्य" right={<Link to="/performance" className="text-xs font-medium text-primary hover:underline">Edit →</Link>} />
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it, i) => {
          const pct = Math.min(100, Math.round((it.current / (it.target || 1)) * 100));
          return (
            <Card key={i}>
              <CardContent className="space-y-2 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{it.label}</span>
                  <span className="text-[10px] text-muted-foreground">{it.hint}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold tabular-nums">{it.current}{it.unit}</span>
                  <span className="text-xs text-muted-foreground">/ {it.target}{it.unit}</span>
                </div>
                <Progress value={pct} className="h-1.5" />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

// ---------- Recent Activity ----------
export function RecentActivity({ data }: { data: HomeData }) {
  const rows = data.activity.slice(0, 6);
  if (rows.length === 0) return null;
  const iconFor = (t: string) => t === "test" ? ClipboardList : t === "pdf" ? FileText : t === "chapter" ? BookOpen : Sparkles;
  return (
    <section className="animate-fade-in">
      <Header icon={Timer} title="Recent Activity" hi="हाल की गतिविधि" />
      <Card className="mt-3">
        <CardContent className="divide-y p-0">
          {rows.map((a: any) => {
            const Ico = iconFor(a.item_type);
            const to = a.subject_id ? `/subjects/${a.subject_id}` : "/subjects";
            return (
              <Link key={a.id} to={to} className="flex items-center gap-3 p-3 transition-colors hover:bg-muted/50">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted"><Ico className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.title ?? a.item_type}</p>
                  <p className="text-[11px] capitalize text-muted-foreground">{a.item_type} • {timeAgo(a.opened_at)}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}

// ---------- Empty state for new users ----------
export function OnboardingCards() {
  const steps = [
    { to: "/tests", icon: ClipboardList, title: "Attempt your first test", desc: "Baseline your level in under 10 minutes." },
    { to: "/subjects", icon: FileText, title: "Read a subject PDF", desc: "Build concepts with curated study material." },
    { to: "/ai-performance", icon: Sparkles, title: "Generate a study plan", desc: "Let AJIT AI plan your week based on your data." },
  ];
  return (
    <section className="animate-fade-in">
      <Header icon={Rocket} title="Start your journey" hi="शुरुआत करें" />
      <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
        {steps.map(s => (
          <Link key={s.to} to={s.to}>
            <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
              <CardContent className="space-y-2 p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground">
                  <s.icon className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---------- Shared header ----------
function Header({ icon: Icon, title, hi, right }: { icon: any; title: string; hi?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">{title}{hi && <span className="ml-1 text-muted-foreground font-normal">/ {hi}</span>}</h2>
      </div>
      {right}
    </div>
  );
}

// ---------- helpers ----------
function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function HomeSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-56 rounded-3xl" />
      <Skeleton className="h-40 rounded-2xl" />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  );
}
