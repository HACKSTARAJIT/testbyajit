import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Brain, RefreshCw, AlertTriangle, Target, Zap, ListChecks } from "lucide-react";

type Bucket = { subject: string; chapter?: string; topic?: string; count: number; wrong: number; skipped: number };

type Payload = {
  empty: boolean;
  totals: { questions: number; mocks: number; skipped: number; wrong: number; last7?: number };
  subjects: Bucket[];
  chapters: Bucket[];
  topics: Bucket[];
  mistakeTypes: { type: string; count: number }[];
  repeated: { signature: string; times: number }[];
  commands: string[];
  answers: Record<string, string>;
  mentor?: string;
  generatedAt: string;
};

const QUESTIONS: { key: string; label: string }[] = [
  { key: "weakest_topic", label: "Which topic is my weakest?" },
  { key: "biggest_score_loss_chapter", label: "Which chapter is causing the biggest score loss?" },
  { key: "most_repeated_mistake", label: "Which mistakes repeat most often?" },
  { key: "revise_today", label: "What should I revise today?" },
  { key: "master_first", label: "What should I master first?" },
  { key: "fastest_marks_chapter", label: "Which chapter will increase my marks fastest?" },
  { key: "stop_doing", label: "What should I completely stop doing?" },
];

export default function RevisionIntelligence() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true); setError(null);
    const { data: res, error: err } = await supabase.functions.invoke("revision-intelligence", { body: {} });
    if (err) setError(err.message);
    else setData(res as Payload);
    setLoading(false);
  }, [user]);

  useEffect(() => { run(); }, [run]);

  const maxTopic = Math.max(1, ...(data?.topics ?? []).map((t) => t.count));

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/smart-revision")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Smart Revision
        </Button>
        <Button variant="outline" size="sm" className="rounded-xl" onClick={run} disabled={loading}>
          <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Re-analyze
        </Button>
      </div>

      <div className="rounded-3xl bg-gradient-royal p-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/20 p-3"><Brain className="h-6 w-6" /></div>
          <div>
            <h1 className="font-display text-2xl font-bold">🧠 Revision Intelligence</h1>
            <p className="text-sm text-white/85">Strict mentor trained only on your imported mock mistakes</p>
          </div>
        </div>
        {data && !data.empty && (
          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            {[
              ["Questions", data.totals.questions],
              ["Wrong", data.totals.wrong],
              ["Skipped", data.totals.skipped],
              ["Mocks", data.totals.mocks],
            ].map(([l, v]) => (
              <div key={String(l)} className="rounded-2xl bg-white/15 p-3">
                <p className="text-lg font-bold">{v as number}</p>
                <p className="text-[11px] text-white/80">{l as string}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading && <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>}

      {!loading && error && (
        <div className="glass-card rounded-2xl p-5 text-sm text-destructive">
          <AlertTriangle className="mb-2 h-5 w-5" /> {error}
        </div>
      )}

      {!loading && data?.empty && (
        <div className="glass-card space-y-3 rounded-3xl p-8 text-center">
          <p className="text-4xl">📝</p>
          <p className="font-semibold">No imported mock mistakes yet</p>
          <p className="text-sm text-muted-foreground">
            Import your wrong/skipped mock questions in Mock Mistakes — the AI learns only from them.
          </p>
          <Button className="rounded-2xl" onClick={() => navigate("/mock-mistakes")}>Go to Mock Mistakes</Button>
        </div>
      )}

      {!loading && data && !data.empty && (
        <>
          <section className="glass-card space-y-3 rounded-3xl p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Zap className="h-5 w-5 text-amber-500" /> Today's Orders</h2>
            <ul className="space-y-2">
              {data.commands.map((c, i) => (
                <li key={i} className="rounded-2xl border border-border bg-muted/40 p-3 text-sm font-medium">
                  {i + 1}. {c}
                </li>
              ))}
            </ul>
            {data.mentor && <p className="rounded-2xl bg-primary/10 p-3 text-sm text-primary">{data.mentor}</p>}
          </section>

          <section className="glass-card space-y-3 rounded-3xl p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold"><ListChecks className="h-5 w-5 text-primary" /> AI Answers</h2>
            <div className="space-y-2">
              {QUESTIONS.map((q) => (
                <div key={q.key} className="rounded-2xl border border-border p-3">
                  <p className="text-xs text-muted-foreground">{q.label}</p>
                  <p className="mt-1 text-sm font-semibold">{data.answers?.[q.key] ?? "Not enough imported data yet"}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="glass-card space-y-3 rounded-3xl p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Target className="h-5 w-5 text-destructive" /> Weakness Map</h2>

            <p className="text-xs font-semibold text-muted-foreground">WEAK SUBJECTS</p>
            <div className="flex flex-wrap gap-2">
              {data.subjects.map((s) => (
                <Badge key={s.subject} variant="secondary" className="rounded-xl">
                  {s.subject} · {s.count} ({s.skipped} skipped)
                </Badge>
              ))}
            </div>

            <p className="pt-2 text-xs font-semibold text-muted-foreground">WEAK CHAPTERS</p>
            <div className="space-y-1">
              {data.chapters.map((c) => (
                <div key={`${c.subject}-${c.chapter}`} className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-sm">
                  <span className="truncate">{c.chapter} <span className="text-xs text-muted-foreground">· {c.subject}</span></span>
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">{c.wrong}W / {c.skipped}S</span>
                </div>
              ))}
            </div>

            <p className="pt-2 text-xs font-semibold text-muted-foreground">WEAK TOPICS</p>
            <div className="space-y-2">
              {data.topics.map((t) => (
                <div key={`${t.subject}-${t.chapter}-${t.topic}`} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate font-medium">{t.topic}</span>
                    <span className="text-muted-foreground">{t.count}</span>
                  </div>
                  <Progress value={(t.count / maxTopic) * 100} className="h-1.5" />
                </div>
              ))}
            </div>
          </section>

          <section className="glass-card space-y-3 rounded-3xl p-5">
            <h2 className="font-display text-lg font-bold">🔁 Mistake Patterns</h2>
            <div className="grid grid-cols-2 gap-2">
              {data.mistakeTypes.map((m) => (
                <div key={m.type} className="rounded-2xl bg-muted/40 p-3 text-center">
                  <p className="text-lg font-bold">{m.count}</p>
                  <p className="text-[11px] text-muted-foreground">{m.type}</p>
                </div>
              ))}
            </div>
            {data.repeated.length > 0 && (
              <p className="text-xs text-muted-foreground">
                ⚠ {data.repeated.length} question{data.repeated.length > 1 ? "s" : ""} imported more than once — same mistake repeating.
              </p>
            )}
          </section>

          <Button className="w-full rounded-2xl" onClick={() => navigate("/mock-mistakes")}>
            Practise these mistakes now
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Updated {new Date(data.generatedAt).toLocaleString()}
          </p>
        </>
      )}
    </div>
  );
}
