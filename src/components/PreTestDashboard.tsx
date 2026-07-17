import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Trophy, Target, TrendingUp, TrendingDown, Minus, History, Clock,
  Brain, Sparkles, AlertTriangle, BookOpen, Flame, Zap, CheckCircle2, Rocket,
} from "lucide-react";

type Props = {
  testId: string;
  userId?: string | null;
  totalMarks?: number | null;
  totalQuestions: number;
  userName?: string | null;
};

type Attempt = {
  id: string;
  marks_obtained: number | null;
  correct_count: number | null;
  incorrect_count: number | null;
  accuracy: number | null;
  time_taken_seconds: number | null;
  total_questions: number | null;
  status: string | null;
  created_at: string;
  updated_at: string | null;
  guesses: any;
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const day = 86400000;
  if (diff < day && new Date().getDate() === d.getDate()) return "Today";
  if (diff < 2 * day) return "Yesterday";
  const days = Math.floor(diff / day);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}
function fmtTime(sec?: number | null) {
  if (!sec || sec <= 0) return "—";
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
function accuracyOf(a: Attempt) {
  if (a.accuracy != null) return Math.round(Number(a.accuracy));
  const att = (a.correct_count || 0) + (a.incorrect_count || 0);
  return att > 0 ? Math.round(((a.correct_count || 0) / att) * 100) : 0;
}

export function PreTestDashboard({ testId, userId, totalMarks, totalQuestions, userName }: Props) {
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [mistake, setMistake] = useState<any | null>(null);
  const [wrongCount, setWrongCount] = useState(0);
  const [pendingRev, setPendingRev] = useState(0);
  const [doneRev, setDoneRev] = useState(0);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    (async () => {
      const [attRes, mistRes, wrongRes, revItemsRes] = await Promise.all([
        supabase.from("test_attempts").select("*")
          .eq("user_id", userId).eq("test_id", testId)
          .order("updated_at", { ascending: true }),
        supabase.from("test_mistake_analyses").select("*")
          .eq("user_id", userId).eq("test_id", testId)
          .order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("wrong_questions").select("id,status", { count: "exact", head: false })
          .eq("user_id", userId).eq("test_id", testId),
        supabase.from("wrong_questions").select("status")
          .eq("user_id", userId).eq("test_id", testId),
      ]);
      const done = (attRes.data as Attempt[] | null ?? []).filter((a) => {
        const hasData = (a.correct_count || 0) > 0 || (a.incorrect_count || 0) > 0 || Number(a.marks_obtained || 0) > 0;
        return a.status !== "in_progress" || hasData;
      });
      setAttempts(done);
      setMistake(mistRes.data ?? null);
      setWrongCount(wrongRes.count ?? (wrongRes.data?.length ?? 0));
      const items = revItemsRes.data ?? [];
      setPendingRev(items.filter((r: any) => r.status !== "mastered" && r.status !== "resolved").length);
      setDoneRev(items.filter((r: any) => r.status === "mastered" || r.status === "resolved").length);
      setLoading(false);
    })();
  }, [testId, userId]);

  if (!userId) return null;
  if (loading) return <Skeleton className="h-64 rounded-3xl" />;

  const denom = totalMarks ?? totalQuestions;
  const hasHistory = attempts.length > 0;
  const latest = hasHistory ? attempts[attempts.length - 1] : null;
  const prev = attempts.length > 1 ? attempts[attempts.length - 2] : null;
  const best = hasHistory
    ? attempts.reduce((b, a) => (Number(a.marks_obtained) > Number(b.marks_obtained) ? a : b), attempts[0])
    : null;

  const scores = attempts.map(a => Number(a.marks_obtained || 0));
  const times = attempts.map(a => a.time_taken_seconds || 0).filter(t => t > 0);
  const avgScore = scores.length ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length) : 0;
  const avgAcc = attempts.length ? Math.round(attempts.reduce((s, a) => s + accuracyOf(a), 0) / attempts.length) : 0;
  const highest = scores.length ? Math.max(...scores) : 0;
  const lowest = scores.length ? Math.min(...scores) : 0;
  const fastest = times.length ? Math.min(...times) : 0;

  const marksDiff = prev && latest ? Number(latest.marks_obtained) - Number(prev.marks_obtained) : 0;
  const accDiff = prev && latest ? accuracyOf(latest) - accuracyOf(prev) : 0;
  const timeDiff = prev && latest && prev.time_taken_seconds && latest.time_taken_seconds
    ? (prev.time_taken_seconds - latest.time_taken_seconds) : 0;

  // Target = min(denom, max(best+2, best*1.08))
  const bestMarks = best ? Number(best.marks_obtained) : 0;
  const target = hasHistory
    ? Math.min(denom, Math.max(bestMarks + 2, Math.ceil(bestMarks * 1.08)))
    : Math.round(denom * 0.85);
  const gap = Math.max(0, target - (latest ? Number(latest.marks_obtained) : 0));

  // Readiness: blend accuracy + attempts + revision completion
  const revTotal = pendingRev + doneRev;
  const revPct = revTotal > 0 ? Math.round((doneRev / revTotal) * 100) : 100;
  const readiness = hasHistory
    ? Math.min(99, Math.round(accuracyOf(latest!) * 0.6 + Math.min(attempts.length, 5) * 4 + revPct * 0.2))
    : 50;
  const confidence = Math.min(99, Math.round(readiness * 0.9 + (best ? 5 : 0)));
  const expected = latest
    ? Math.min(denom, Math.round((Number(latest.marks_obtained) + bestMarks) / 2 + (accDiff > 0 ? 2 : 0)))
    : Math.round(denom * 0.7);

  // Mistake distribution
  const dist: Record<string, number> = (mistake?.mistake_distribution as any) || {};
  const distEntries = Object.entries(dist)
    .map(([k, v]) => [k, Number(v) || 0] as [string, number])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const distTotal = distEntries.reduce((s, [, v]) => s + v, 0);

  // Guess metrics from latest attempt
  const guesses = (latest?.guesses as any) || {};
  const guessCount = Object.keys(guesses).length;

  // Data-driven mentor advice
  const advice: string[] = [];
  if (distEntries.length) {
    const [top] = distEntries;
    advice.push(`Sabse zyada mistakes "${top[0]}" mein hui thi — is baar wahan extra focus rakho.`);
  }
  if (pendingRev > 0) advice.push(`${pendingRev} smart-revision questions abhi bhi pending hain. Test se pehle 5-10 min revise karo.`);
  if (accDiff < 0) advice.push(`Pichli baar accuracy ${Math.abs(accDiff)}% gir gayi — is baar rush mat karo, calmly padho.`);
  if (guessCount > 0) advice.push(`Pichle attempt me ${guessCount} guess the — is baar sirf confident answer hi mark karo.`);
  if (marksDiff > 0) advice.push(`Momentum accha hai (+${marksDiff} marks last time). Same rhythm continue karo.`);
  if (!hasHistory) advice.push(`Pehla attempt — pehle poora paper padh lo, phir easy questions solve karke confidence build karo.`);
  if (!advice.length) advice.push(`Aap consistent perform kar rahe ho — is baar +${Math.max(2, gap)} marks ka goal rakho.`);

  const predictedImprovements: { label: string; marks: number }[] = [];
  if (distEntries.find(([k]) => /careless/i.test(k))) predictedImprovements.push({ label: "Reduce Careless Mistakes", marks: 4 });
  if (pendingRev > 0) predictedImprovements.push({ label: "Complete Pending Revision", marks: 3 });
  if (guessCount > 0) predictedImprovements.push({ label: "Avoid Guessing", marks: 2 });
  if (distEntries.find(([k]) => /time/i.test(k))) predictedImprovements.push({ label: "Better Time Management", marks: 2 });
  const potential = predictedImprovements.reduce((s, x) => s + x.marks, 0);

  const firstName = (userName || "Champ").split(" ")[0];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* MISSION */}
      <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-background to-purple-500/10 p-5 shadow-lg backdrop-blur">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <Rocket className="h-4 w-4" /> 🎯 Mission: {hasHistory ? "Beat Your Personal Best" : "Set Your First Benchmark"}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-background/60 p-2.5 backdrop-blur">
            <p className="text-[10px] uppercase text-muted-foreground">Previous Best</p>
            <p className="text-lg font-bold">{bestMarks}<span className="text-xs text-muted-foreground">/{denom}</span></p>
          </div>
          <div className="rounded-2xl bg-primary/15 p-2.5 ring-1 ring-primary/30">
            <p className="text-[10px] uppercase text-primary/80">Today's Target</p>
            <p className="text-lg font-bold text-primary">{target}<span className="text-xs">/{denom}</span></p>
          </div>
          <div className="rounded-2xl bg-background/60 p-2.5 backdrop-blur">
            <p className="text-[10px] uppercase text-muted-foreground">Confidence</p>
            <p className="text-lg font-bold text-emerald-500">{confidence}%</p>
          </div>
        </div>
        <div className="mt-3 rounded-2xl bg-background/50 p-3 text-xs">
          <p className="font-semibold text-primary flex items-center gap-1"><Sparkles className="h-3.5 w-3.5" /> AJIT AI Prediction</p>
          <p className="mt-1 text-muted-foreground leading-relaxed">
            {gap > 0
              ? `Aap sirf ${gap} marks door ho apne personal best se. Careless mistakes avoid karo aur calmly attempt karo — target achievable hai.`
              : `Aapka best strong hai. Is baar consistency maintain karke ${denom} me se ${target} score karne ki koshish karo.`}
          </p>
          <p className="mt-2 font-medium">Good Luck, {firstName}! 🚀</p>
        </div>
      </div>

      {/* QUICK CARDS */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <QuickCard icon={<History className="h-3.5 w-3.5" />} label="Last Score"
          value={latest ? `${Number(latest.marks_obtained)}/${denom}` : "—"} sub={latest ? fmtDate(latest.updated_at) : "First try"} />
        <QuickCard icon={<Trophy className="h-3.5 w-3.5 text-amber-500" />} label="Best"
          value={best ? `${bestMarks}/${denom}` : "—"} sub={best ? `${accuracyOf(best)}%` : "—"} accent="amber" />
        <QuickCard icon={<Zap className="h-3.5 w-3.5" />} label="Attempts" value={String(attempts.length)}
          sub={attempts.length ? `avg ${avgScore}` : "none"} />
        <QuickCard icon={<Target className="h-3.5 w-3.5" />} label="Accuracy" value={`${avgAcc}%`} sub="avg" />
        <QuickCard icon={<BookOpen className="h-3.5 w-3.5" />} label="Pending Revision" value={String(pendingRev)}
          sub={revTotal ? `${revPct}% done` : "none"} accent={pendingRev > 0 ? "orange" : undefined} />
      </div>

      {/* LAST vs BEST */}
      {hasHistory && (
        <div className="grid gap-3 sm:grid-cols-2">
          <SectionCard title="Last Attempt" icon={<Clock className="h-4 w-4" />}>
            <Row k="Date" v={fmtDate(latest!.updated_at)} />
            <Row k="Score" v={`${Number(latest!.marks_obtained)}/${denom}`} />
            <Row k="Accuracy" v={`${accuracyOf(latest!)}%`} />
            <Row k="Time Taken" v={fmtTime(latest!.time_taken_seconds)} />
            <Row k="Attempt #" v={String(attempts.length)} />
          </SectionCard>
          <SectionCard title="Best Performance" icon={<Trophy className="h-4 w-4 text-amber-500" />}>
            <Row k="Best Score" v={`${bestMarks}/${denom}`} />
            <Row k="Best Accuracy" v={`${accuracyOf(best!)}%`} />
            <Row k="Fastest Time" v={fmtTime(fastest)} />
            <Row k="Highest / Lowest" v={`${highest} / ${lowest}`} />
            <Row k="Average" v={`${avgScore} · ${avgAcc}%`} />
          </SectionCard>
        </div>
      )}

      {/* IMPROVEMENT */}
      {prev && latest && (
        <div className="rounded-2xl border bg-card/60 p-3 backdrop-blur">
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5" /> Change vs Previous Attempt
          </p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <DeltaChip label="Marks" delta={marksDiff} suffix="" />
            <DeltaChip label="Accuracy" delta={accDiff} suffix="%" />
            <DeltaChip label="Time" delta={Math.round(timeDiff / 60)} suffix="m" positiveIsGood />
          </div>
        </div>
      )}

      {/* MISTAKE SUMMARY + AI ANALYSIS */}
      {(distEntries.length > 0 || mistake?.coach_summary) && (
        <div className="rounded-2xl border border-orange-500/30 bg-orange-500/5 p-3">
          <p className="text-xs font-semibold uppercase text-orange-600 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Last AI Analysis
          </p>
          {mistake?.coach_summary && (
            <p className="mt-1.5 text-sm text-foreground/90 leading-relaxed">{mistake.coach_summary}</p>
          )}
          {distEntries.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {distEntries.map(([k, v]) => (
                <Badge key={k} variant="outline" className="border-orange-500/40 bg-background/60 text-[11px]">
                  {k}: {distTotal ? Math.round((v / distTotal) * 100) : 0}%
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {/* REVISION */}
      {revTotal > 0 && (
        <div className="rounded-2xl border bg-card/60 p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5" /> Smart Revision Status
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
            <Stat label="Pending" value={String(pendingRev)} tone={pendingRev > 0 ? "warn" : "ok"} />
            <Stat label="Completed" value={String(doneRev)} tone="ok" />
            <Stat label="% Done" value={`${revPct}%`} />
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${revPct}%` }} />
          </div>
        </div>
      )}

      {/* READINESS */}
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3">
        <p className="text-xs font-semibold uppercase text-emerald-600 flex items-center gap-1">
          <Flame className="h-3.5 w-3.5" /> Readiness Score
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <Stat label="Readiness" value={`${readiness}%`} tone="ok" />
          <Stat label="Confidence" value={`${confidence}%`} />
          <Stat label="Expected" value={`${expected}/${denom}`} />
        </div>
      </div>

      {/* MENTOR ADVICE */}
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3">
        <p className="text-xs font-semibold uppercase text-primary flex items-center gap-1">
          <Brain className="h-3.5 w-3.5" /> AJIT AI Pre-Test Mentor
        </p>
        <ul className="mt-2 space-y-1.5 text-sm">
          {advice.slice(0, 4).map((a, i) => (
            <li key={i} className="flex gap-2 leading-snug">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{a}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* PREDICTED IMPROVEMENT */}
      {predictedImprovements.length > 0 && (
        <div className="rounded-2xl border bg-card/60 p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5" /> Predicted Improvement
          </p>
          <div className="mt-2 space-y-1.5">
            {predictedImprovements.map((p) => (
              <div key={p.label} className="flex items-center justify-between text-sm">
                <span className="text-foreground/90">{p.label}</span>
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-600">+{p.marks} marks</Badge>
              </div>
            ))}
            <div className="mt-2 flex items-center justify-between border-t pt-2 text-sm font-semibold">
              <span>Potential Total</span>
              <span className="text-emerald-600">+{potential} marks</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuickCard({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent?: "amber" | "orange" }) {
  const tone = accent === "amber" ? "text-amber-600" : accent === "orange" ? "text-orange-600" : "text-foreground";
  return (
    <div className="rounded-xl border bg-card/60 p-2 backdrop-blur">
      <div className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">{icon}{label}</div>
      <p className={`mt-0.5 text-sm font-bold ${tone}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card/60 p-3 backdrop-blur">
      <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground">{icon}{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-semibold">{v}</span>
    </div>
  );
}
function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  const c = tone === "ok" ? "text-emerald-600" : tone === "warn" ? "text-orange-600" : "text-foreground";
  return (
    <div className="rounded-lg bg-background/60 p-1.5">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold ${c}`}>{value}</p>
    </div>
  );
}
function DeltaChip({ label, delta, suffix, positiveIsGood = true }: { label: string; delta: number; suffix: string; positiveIsGood?: boolean }) {
  const good = positiveIsGood ? delta > 0 : delta < 0;
  const bad = positiveIsGood ? delta < 0 : delta > 0;
  const Icon = delta === 0 ? Minus : good ? TrendingUp : TrendingDown;
  const color = delta === 0 ? "text-muted-foreground" : good ? "text-emerald-600" : bad ? "text-red-500" : "text-muted-foreground";
  const sign = delta > 0 ? "+" : "";
  return (
    <div className="rounded-lg bg-background/60 p-2">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className={`flex items-center justify-center gap-0.5 text-sm font-bold ${color}`}>
        <Icon className="h-3 w-3" />{sign}{delta}{suffix}
      </p>
    </div>
  );
}
