import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { BookMarked, ChevronRight, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { fetchSyllabus, progressFor, SyllabusTopic } from "@/lib/syllabus";

export default function SyllabusWidget() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ total: 0, completed: 0, pending: 0, pct: 0 });
  const [focus, setFocus] = useState<SyllabusTopic[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const b = await fetchSyllabus(user.id);
      setTotals(progressFor(b.topics));
      const inProg = b.topics.filter((t) => t.status === "in_progress");
      const highPending = b.topics.filter((t) => t.status !== "completed" && t.priority === "high");
      const revision = b.topics.filter((t) => t.status === "revision_pending");
      setFocus([...revision, ...inProg, ...highPending].slice(0, 3));
      setLoading(false);
    })();
  }, [user?.id]);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-fuchsia-500/5 to-secondary/10">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
              <BookMarked className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold">📚 Syllabus Progress</p>
              <p className="text-xs text-muted-foreground">Your permanent preparation roadmap</p>
            </div>
          </div>
          <Link to="/syllabus">
            <Button variant="ghost" size="sm" className="gap-1">Open <ChevronRight className="h-4 w-4" /></Button>
          </Link>
        </div>

        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold">{totals.pct}%</span>
            <span className="text-xs text-muted-foreground">
              {totals.completed} completed • {totals.pending} pending
            </span>
          </div>
          <Progress value={totals.pct} className="mt-2 h-2" />
        </div>

        {!loading && totals.total === 0 && (
          <Link to="/syllabus">
            <Button size="sm" className="mt-4 w-full gap-1">
              <Sparkles className="h-4 w-4" /> Build my syllabus roadmap
            </Button>
          </Link>
        )}

        {focus.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">🎯 Today's Focus</p>
            <ul className="space-y-1.5">
              {focus.map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-lg bg-card/60 px-3 py-2 text-sm">
                  <span className="truncate">{t.name}</span>
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground capitalize">
                    {t.status.replace("_", " ")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
