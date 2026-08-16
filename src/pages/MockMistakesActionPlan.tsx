import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, ArrowRight, Brain, CheckCircle2, RefreshCw, Sparkles, Square, Target, TrendingUp,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  ACTION_LABEL, findAction, loadActionPlan, loadCompletions, markActionCompleted,
  priorityOf, unmarkActionCompleted, type ActionItem, type ActionPlan,
} from "@/lib/mockActionPlan";

export default function MockMistakesActionPlan() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!user) { setLoading(false); return; }
      const [row, comp] = await Promise.all([loadActionPlan(user.id), loadCompletions(user.id)]);
      if (row) {
        setPlan(row.plan ?? null);
        setGeneratedAt(row.generated_at ?? null);
        if (row.status === "error") setError(row.error ?? null);
      }
      setDone(comp);
      setLoading(false);
    })();
  }, [user]);

  const generate = async () => {
    setRunning(true);
    setError(null);
    const { data, error: fnError } = await supabase.functions.invoke("mock-mistakes-action-plan", { body: {} });
    setRunning(false);
    if (fnError || (data as any)?.error) {
      const msg = (data as any)?.message ?? (data as any)?.error ?? fnError?.message ?? "Action Plan नहीं बन सका";
      setError(msg);
      toast({ title: "Action Plan नहीं बना", description: msg, variant: "destructive" });
      return;
    }
    setPlan((data as any).plan);
    setGeneratedAt((data as any).generated_at ?? new Date().toISOString());
    toast({ title: "🎯 Action Plan तैयार है", description: "आपकी असली Mock Mistakes के आधार पर अगला कदम तय हुआ है।" });
  };

  const toggle = async (a: ActionItem) => {
    if (!user) return;
    if (done[a.action_key]) {
      await unmarkActionCompleted(user.id, a.action_key);
      setDone((d) => { const n = { ...d }; delete n[a.action_key]; return n; });
    } else {
      await markActionCompleted(user.id, a);
      setDone((d) => ({ ...d, [a.action_key]: new Date().toISOString() }));
    }
  };

  const Item = ({ a }: { a: ActionItem }) => {
    const p = priorityOf(a.priority);
    const completed = Boolean(done[a.action_key]);
    return (
      <div className={`glass-card space-y-3 rounded-2xl p-4 ${completed ? "opacity-70" : ""}`}>
        <div className="flex items-start gap-3">
          <button onClick={() => toggle(a)} className="mt-0.5 shrink-0" aria-label="mark done">
            {completed
              ? <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              : <Square className="h-5 w-5 text-muted-foreground" />}
          </button>
          <div className="min-w-0 flex-1 space-y-1">
            <p className={`text-xs font-medium ${p.cls}`}>{p.dot} {p.label} · {ACTION_LABEL[a.action_type] ?? "अभ्यास"}</p>
            <p className={`font-semibold leading-snug ${completed ? "line-through" : ""}`}>{a.title}</p>
            <p className="text-xs text-muted-foreground">
              {a.subject} · {a.chapter} → {a.topic} · {a.question_count} प्रश्न
              {a.stats.repeat_wrong > 0 ? ` · ${a.stats.repeat_wrong} बार-बार गलत` : ""}
            </p>
          </div>
        </div>

        {a.why && (
          <div className="rounded-xl bg-muted/40 p-3 text-sm">
            <p className="mb-1 text-xs font-semibold text-muted-foreground">क्यों?</p>
            <p className="leading-relaxed">{a.why}</p>
          </div>
        )}
        {a.how && <p className="text-sm leading-relaxed text-muted-foreground">{a.how}</p>}

        <Button
          className="w-full rounded-2xl"
          variant={completed ? "secondary" : "default"}
          onClick={() => navigate(`/mock-mistakes/action-plan/${encodeURIComponent(a.action_key)}`)}
        >
          अभ्यास करें ({a.question_count}) <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    );
  };

  const t = plan?.totals;
  const hasActions = (plan?.today?.length ?? 0) + (plan?.next?.length ?? 0) > 0;

  return (
    <div className="space-y-5 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate("/mock-mistakes")}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Mock Mistakes
      </Button>

      <div className="rounded-3xl bg-gradient-royal p-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/20 p-3"><Target className="h-6 w-6" /></div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold">🎯 ACTION PLAN</h1>
            <p className="text-sm text-white/85">आपकी असली Mock Mistakes से बना अगला कदम</p>
          </div>
        </div>
        {t && (
          <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs text-white/90">
            <div className="rounded-xl bg-white/10 p-2"><b className="block text-base">{t.questions}</b>प्रश्न</div>
            <div className="rounded-xl bg-white/10 p-2"><b className="block text-base">{t.mocks}</b>Mocks</div>
            <div className="rounded-xl bg-white/10 p-2"><b className="block text-base">{t.unresolved}</b>बाकी</div>
            <div className="rounded-xl bg-white/10 p-2"><b className="block text-base">{t.resolved}</b>सुलझे</div>
          </div>
        )}
      </div>

      <button
        onClick={() => navigate("/mock-mistakes/intelligence")}
        className="btn-ripple glass-card flex w-full items-center gap-3 rounded-2xl p-3 text-left"
      >
        <Brain className="h-5 w-5 text-primary" />
        <p className="min-w-0 flex-1 truncate text-sm">
          <b>🧠 AJIT AI Intelligence</b> — पहले विश्लेषण देखें
        </p>
      </button>

      <Button onClick={generate} disabled={running} className="w-full rounded-2xl">
        {running ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
        {running ? "AJIT AI आपका Action Plan बना रहा है..." : plan ? "Action Plan अपडेट करें" : "Action Plan बनाएँ"}
      </Button>

      {generatedAt && (
        <p className="text-center text-xs text-muted-foreground">
          अंतिम अपडेट: {new Date(generatedAt).toLocaleString("hi-IN")}
        </p>
      )}

      {error && (
        <div className="glass-card rounded-2xl border border-destructive/40 p-4 text-sm text-destructive">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>
      ) : !plan ? (
        <div className="glass-card rounded-3xl p-8 text-center text-sm text-muted-foreground">
          अभी कोई Action Plan नहीं बना है। ऊपर बटन दबाकर अपनी imported Mock Mistakes से आज का प्लान बनवाएँ।
        </div>
      ) : plan.insufficient_data || !hasActions ? (
        <div className="glass-card rounded-3xl p-8 text-center text-sm text-muted-foreground">
          {plan.overview || "अभी पर्याप्त Mock Mistakes data नहीं है। नए प्रश्न जुड़ने पर Action Plan अधिक सटीक होगा।"}
        </div>
      ) : (
        <div className="space-y-5">
          {plan.overview && (
            <div className="glass-card rounded-2xl p-4 text-sm leading-relaxed">{plan.overview}</div>
          )}

          {(plan.today?.length ?? 0) > 0 && (
            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold">🔥 आज का मुख्य फोकस</h2>
              {plan.today!.map((a) => <Item key={a.action_key} a={a} />)}
            </section>
          )}

          {(plan.next?.length ?? 0) > 0 && (
            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold">➡️ इसके बाद</h2>
              {plan.next!.map((a) => <Item key={a.action_key} a={a} />)}
            </section>
          )}

          {plan.improvement && (
            <section className="glass-card space-y-2 rounded-2xl p-4">
              <p className="flex items-center gap-2 font-semibold">
                <TrendingUp className="h-4 w-4 text-emerald-400" /> 📈 हाल का सुधार
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">{plan.improvement}</p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
