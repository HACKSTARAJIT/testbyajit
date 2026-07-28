import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ChevronRight, RotateCcw, CheckCircle2, XCircle, Eye, EyeOff } from "lucide-react";

type AutoTest = {
  id: string;
  kind: string;
  title: string;
  subject: string | null;
  chapter: string | null;
  topic: string | null;
  subtopic: string | null;
  items: any[];
  item_count: number;
  priority: string;
  difficulty_curve: string | null;
  meta: any;
  report_id: string;
};

/**
 * ImportedAutoTest — flashcard-style runner over items stored on an
 * imported_auto_tests row. Imported reports rarely contain full 4-option MCQs,
 * so we play back recall cards: show the question / concept, reveal the correct
 * concept + trick, self-mark got-it / need-more-work.
 */
export default function ImportedAutoTest() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [test, setTest] = useState<AutoTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [marks, setMarks] = useState<Record<number, "got" | "again">>({});

  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      const { data } = await supabase.from("imported_auto_tests").select("*").eq("id", id).maybeSingle();
      setTest(data as any);
      setLoading(false);
    })();
  }, [user, id]);

  const items = test?.items ?? [];
  const cur = items[idx];
  const done = idx >= items.length;
  const got = useMemo(() => Object.values(marks).filter((v) => v === "got").length, [marks]);
  const again = useMemo(() => Object.values(marks).filter((v) => v === "again").length, [marks]);

  function next(mark: "got" | "again") {
    setMarks((m) => ({ ...m, [idx]: mark }));
    setRevealed(false);
    setIdx((i) => i + 1);
  }
  function restart() { setIdx(0); setRevealed(false); setMarks({}); }

  if (loading) return <div className="space-y-3 p-4"><Skeleton className="h-40 rounded-3xl" /><Skeleton className="h-32 rounded-2xl" /></div>;
  if (!test) return <div className="p-6 text-center text-sm text-muted-foreground">Test not found.</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-3 sm:p-6">
      <Button variant="ghost" size="sm" onClick={() => nav(-1)}><ArrowLeft className="mr-1 h-4 w-4" />Back</Button>

      <Card className="border-primary/30 bg-card/70 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">{test.title}</CardTitle>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Badge variant="outline" className="text-[10px]">{test.kind.replace(/_/g, " ")}</Badge>
            <Badge variant={test.priority === "critical" ? "destructive" : "secondary"} className="text-[10px]">{test.priority}</Badge>
            {test.subject && <Badge variant="secondary" className="text-[10px]">{test.subject}</Badge>}
            {test.chapter && <Badge variant="outline" className="text-[10px]">{test.chapter}</Badge>}
            {test.topic && <Badge variant="outline" className="text-[10px]">{test.topic}</Badge>}
            <Badge variant="outline" className="text-[10px]">{test.item_count} cards</Badge>
          </div>
        </CardHeader>
      </Card>

      {done ? (
        <Card className="border-emerald-500/30">
          <CardContent className="space-y-3 p-6 text-center">
            <div className="text-3xl">🎉</div>
            <h3 className="text-lg font-semibold">Session complete</h3>
            <div className="flex justify-center gap-3 text-sm">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" />{got} got it</span>
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400"><XCircle className="h-4 w-4" />{again} to revisit</span>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <Button onClick={restart}><RotateCcw className="mr-1 h-4 w-4" />Restart</Button>
              <Button variant="secondary" onClick={() => nav(-1)}>Done</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Card {idx + 1} / {items.length}</span>
              <span>{Math.round(((idx) / items.length) * 100)}%</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {cur?.subject && <Badge variant="secondary" className="text-[10px]">{cur.subject}</Badge>}
                {cur?.chapter && <Badge variant="outline" className="text-[10px]">{cur.chapter}</Badge>}
                {cur?.topic && <Badge variant="outline" className="text-[10px]">{cur.topic}</Badge>}
                {cur?.type && <Badge variant="destructive" className="text-[10px]">{cur.type}</Badge>}
              </div>
              {cur?.question ? (
                <p className="rounded-lg border bg-muted/30 p-3 text-sm font-medium leading-relaxed">{cur.question}</p>
              ) : (
                <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground italic">
                  {cur?.topic ? `Recall the concept for: ${cur.topic}` : "Recall the concept in your own words."}
                </p>
              )}
            </div>

            {!revealed ? (
              <Button className="w-full" onClick={() => setRevealed(true)}>
                <Eye className="mr-1 h-4 w-4" />Reveal explanation
              </Button>
            ) : (
              <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                {cur?.why_wrong && <p><span className="text-destructive">❌ Why wrong: </span>{cur.why_wrong}</p>}
                {cur?.reason && <p><span className="text-amber-600 dark:text-amber-400">⏭ Skipped because: </span>{cur.reason}</p>}
                {cur?.correct_concept && <p><span className="text-emerald-600 dark:text-emerald-400">✅ Correct concept: </span>{cur.correct_concept}</p>}
                {cur?.recommendation && <p><span className="text-primary">👉 Recommendation: </span>{cur.recommendation}</p>}
                {cur?.trick && <p><span className="text-primary">💡 Trick: </span>{cur.trick}</p>}
                {!cur?.why_wrong && !cur?.correct_concept && !cur?.trick && !cur?.reason && !cur?.recommendation && (
                  <p className="text-muted-foreground italic">No explanation captured — study the topic in your notes and self-mark.</p>
                )}
              </div>
            )}

            {revealed && (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => next("again")} className="border-amber-500/40 text-amber-600 dark:text-amber-400">
                  <EyeOff className="mr-1 h-4 w-4" />Revisit
                </Button>
                <Button onClick={() => next("got")} className="bg-emerald-600 hover:bg-emerald-600/90">
                  <ChevronRight className="mr-1 h-4 w-4" />Got it
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
