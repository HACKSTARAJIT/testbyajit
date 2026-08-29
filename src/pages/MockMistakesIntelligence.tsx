import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Brain, Flame, RefreshCw, Sparkles, Target, TrendingUp } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Area = {
  area?: string;
  condition?: string;
  pattern?: string;
  cause?: string;
  advice?: string;
  evidence?: string;
};
type Section = { subject?: string; condition?: string; headline?: string; areas?: Area[] };
type Report = {
  overview?: string;
  insufficient_data?: boolean;
  sections?: Section[];
  repeat_patterns?: { pattern?: string; evidence?: string }[];
  improvements?: { area?: string; detail?: string }[];
  what_changed?: string[];
  priorities?: { now?: { area?: string; reason?: string }[]; next?: { area?: string; reason?: string }[] };
  stop_doing?: string[];
  selection_focus?: string[];
  repeated_questions?: {
    id: string;
    subject: string;
    chapter: string;
    topic: string;
    question_text: string;
    attempts: number;
    correct: number;
    wrong: number;
    status: string;
  }[];
  totals?: { questions: number; mocks: number; practiced: number; improved: number };
};

const CONDITION: Record<string, { label: string; dot: string; cls: string }> = {
  critical: { label: "Critical Attention Required", dot: "🔴", cls: "text-destructive" },
  high: { label: "High Priority", dot: "🟠", cls: "text-orange-400" },
  medium: { label: "Needs Improvement", dot: "🟡", cls: "text-yellow-400" },
  improving: { label: "Improving", dot: "🔵", cls: "text-sky-400" },
  insufficient: { label: "Insufficient Evidence", dot: "⚪", cls: "text-muted-foreground" },
};

function cond(v?: string) {
  return CONDITION[(v ?? "").toLowerCase()] ?? CONDITION.insufficient;
}

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="glass-card space-y-3 rounded-2xl p-4">
      <p className="flex items-center gap-2 font-semibold">{icon}{title}</p>
      {children}
    </div>
  );
}

export default function MockMistakesIntelligence() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [analyzed, setAnalyzed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from("mock_mistake_intelligence")
        .select("report, generated_at, questions_analyzed, status, error")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setReport((data as any).report ?? null);
        setGeneratedAt((data as any).generated_at ?? null);
        setAnalyzed((data as any).questions_analyzed ?? 0);
        if ((data as any).status === "error") setError((data as any).error ?? null);
      }
      setLoading(false);
    })();
  }, [user]);

  const run = async () => {
    setRunning(true);
    setError(null);
    const { data, error: fnError } = await supabase.functions.invoke("mock-mistakes-intelligence", { body: {} });
    setRunning(false);
    if (fnError || (data as any)?.error) {
      // functions.invoke hides the body of non-2xx responses — read it back so the
      // student sees the real reason instead of "non-2xx status code".
      let detail: string | null = (data as any)?.message ?? (data as any)?.error ?? null;
      const ctx = (fnError as any)?.context;
      if (!detail && ctx && typeof ctx.json === "function") {
        try {
          const body = await ctx.json();
          detail = body?.error ?? body?.message ?? null;
          if (body?.stage) detail = `[${body.stage}] ${detail}`;
        } catch { /* keep fallback message */ }
      }
      const msg = detail ?? fnError?.message ?? "Analysis failed";
      setError(msg);
      toast({ title: "AJIT AI विश्लेषण नहीं हो सका", description: msg, variant: "destructive" });
      return;
    }

    setReport((data as any).report);
    setGeneratedAt((data as any).generated_at ?? new Date().toISOString());
    setAnalyzed((data as any).report?.totals?.questions ?? 0);
    toast({ title: "🧠 विश्लेषण तैयार है", description: "आपकी असली Mock Mistakes के आधार पर नई सलाह बन गई है।" });
  };

  const t = report?.totals;

  return (
    <div className="space-y-5 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate("/mock-mistakes")}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Mock Mistakes
      </Button>

      <div className="rounded-3xl bg-gradient-royal p-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/20 p-3"><Brain className="h-6 w-6" /></div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold">🧠 AJIT AI Intelligence</h1>
            <p className="text-sm text-white/85">सिर्फ आपके imported Mock Mistakes से बनी व्यक्तिगत सलाह</p>
          </div>
        </div>
        {t && (
          <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs text-white/90">
            <div className="rounded-xl bg-white/10 p-2"><b className="block text-base">{t.questions}</b>प्रश्न</div>
            <div className="rounded-xl bg-white/10 p-2"><b className="block text-base">{t.mocks}</b>Mocks</div>
            <div className="rounded-xl bg-white/10 p-2"><b className="block text-base">{t.practiced}</b>Practiced</div>
            <div className="rounded-xl bg-white/10 p-2"><b className="block text-base">{t.improved}</b>सुधरे</div>
          </div>
        )}
      </div>

      <Button onClick={run} disabled={running} className="w-full rounded-2xl">
        {running ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
        {running ? "AJIT AI आपकी गलतियाँ पढ़ रहा है..." : report ? "फिर से विश्लेषण करें" : "AJIT AI विश्लेषण शुरू करें"}
      </Button>

      {generatedAt && (
        <p className="text-center text-xs text-muted-foreground">
          अंतिम विश्लेषण: {new Date(generatedAt).toLocaleString()} · {analyzed} imported प्रश्न
        </p>
      )}

      {error && <p className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : !report ? (
        <div className="glass-card rounded-3xl p-10 text-center text-muted-foreground">
          <Brain className="mx-auto h-10 w-10" />
          <p className="mt-3 font-semibold">अभी कोई विश्लेषण नहीं है</p>
          <p className="mt-1 text-sm">ऊपर बटन दबाइए — AJIT AI आपके imported Wrong/Skipped प्रश्नों को पढ़कर बताएगा कि गलती क्यों हो रही है और अब क्या करना है।</p>
        </div>
      ) : (
        <div className="space-y-4">
          {report.overview && (
            <Card title="AJIT AI की समझ" icon={<Brain className="h-4 w-4" />}>
              <p className="text-sm leading-relaxed text-muted-foreground">{report.overview}</p>
            </Card>
          )}

          {(report.priorities?.now?.length || report.priorities?.next?.length) ? (
            <Card title="प्राथमिकता क्रम" icon={<Target className="h-4 w-4" />}>
              {report.priorities?.now?.length ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-destructive">🔴 अभी सबसे पहले</p>
                  {report.priorities.now.map((p, i) => (
                    <div key={i} className="rounded-xl bg-muted/40 p-3">
                      <p className="text-sm font-medium">{p.area}</p>
                      {p.reason && <p className="text-xs text-muted-foreground">{p.reason}</p>}
                    </div>
                  ))}
                </div>
              ) : null}
              {report.priorities?.next?.length ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-orange-400">🟠 उसके बाद</p>
                  {report.priorities.next.map((p, i) => (
                    <div key={i} className="rounded-xl bg-muted/40 p-3">
                      <p className="text-sm font-medium">{p.area}</p>
                      {p.reason && <p className="text-xs text-muted-foreground">{p.reason}</p>}
                    </div>
                  ))}
                </div>
              ) : null}
            </Card>
          ) : null}

          {report.sections?.map((s, i) => {
            const c = cond(s.condition);
            return (
              <Card key={i} title={`${s.subject ?? "Section"}`} icon={<span>{c.dot}</span>}>
                <p className={`text-xs font-medium ${c.cls}`}>{c.label}</p>
                {s.headline && <p className="text-sm text-muted-foreground">{s.headline}</p>}
                <div className="space-y-3">
                  {(s.areas ?? []).map((a, k) => {
                    const ac = cond(a.condition);
                    return (
                      <div key={k} className="rounded-2xl bg-muted/40 p-4">
                        <p className="font-semibold">{ac.dot} {a.area}</p>
                        <p className={`text-xs ${ac.cls}`}>{ac.label}</p>
                        {a.pattern && <p className="mt-2 text-sm"><b>पैटर्न: </b>{a.pattern}</p>}
                        {a.cause && <p className="mt-1 text-sm"><b>संभावित कारण: </b>{a.cause}</p>}
                        {a.evidence && <p className="mt-1 text-xs text-muted-foreground">प्रमाण: {a.evidence}</p>}
                        {a.advice && (
                          <p className="mt-2 rounded-xl bg-primary/10 p-3 text-sm leading-relaxed">💡 {a.advice}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}

          {report.repeat_patterns?.length ? (
            <Card title="बार-बार दिखाई देने वाले पैटर्न" icon={<Flame className="h-4 w-4 text-orange-400" />}>
              <ul className="space-y-2 text-sm">
                {report.repeat_patterns.map((r, i) => (
                  <li key={i} className="rounded-xl bg-muted/40 p-3">
                    <p className="font-medium">{r.pattern}</p>
                    {r.evidence && <p className="text-xs text-muted-foreground">{r.evidence}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {report.repeated_questions?.length ? (
            <Card title="🔥 Repeated Mistake (वही imported प्रश्न)" icon={null}>
              <div className="space-y-2">
                {report.repeated_questions.map((q) => (
                  <div key={q.id} className="rounded-xl bg-muted/40 p-3">
                    <p className="text-sm">{q.question_text}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {q.subject} · {q.chapter} → {q.topic} · प्रयास: <b>{q.attempts}</b> · सही: <b>{q.correct}</b> · गलत: <b>{q.wrong}</b> ·{" "}
                      {q.status === "mastered" ? "🟢 सुधर गया" : "🔴 अब भी गलत"}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {report.improvements?.length ? (
            <Card title="🟢 Improvement Detected" icon={<TrendingUp className="h-4 w-4 text-emerald-400" />}>
              <ul className="space-y-2 text-sm">
                {report.improvements.map((im, i) => (
                  <li key={i} className="rounded-xl bg-muted/40 p-3">
                    <b>{im.area}</b>
                    {im.detail && <p className="text-xs text-muted-foreground">{im.detail}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {report.what_changed?.length ? (
            <Card title="🔄 क्या बदला?" icon={null}>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {report.what_changed.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </Card>
          ) : null}

          {report.stop_doing?.length ? (
            <Card title="यह करना बंद करें" icon={null}>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {report.stop_doing.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </Card>
          ) : null}

          {report.selection_focus?.length ? (
            <div className="rounded-3xl bg-gradient-royal p-5 text-white shadow-lg">
              <p className="font-display text-lg font-bold">🎯 SELECTION FOCUS</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/90">
                {report.selection_focus.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
