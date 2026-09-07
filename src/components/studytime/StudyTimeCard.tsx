import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { Timer, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDuration, formatShort, loadGoals, todayISO } from "@/lib/studyTime";

/** Compact dashboard card: today's study total + goal progress. */
export function StudyTimeCard() {
  const { user } = useAuth();
  const [seconds, setSeconds] = useState(0);
  const [goal, setGoal] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      const [{ data }, goals] = await Promise.all([
        supabase
          .from("study_time_entries")
          .select("duration_seconds")
          .eq("user_id", user.id)
          .eq("study_date", todayISO()),
        loadGoals(user.id),
      ]);
      if (!alive) return;
      setSeconds((data ?? []).reduce((s: number, r: any) => s + (r.duration_seconds ?? 0), 0));
      setGoal(goals.daily_goal_seconds);
    })();
    return () => { alive = false; };
  }, [user?.id]);

  const pct = goal ? Math.min(100, Math.round((seconds / goal) * 100)) : null;

  return (
    <Link to="/study-time" className="block">
      <Card className="border-border/60 bg-card/60 backdrop-blur transition-transform active:scale-[0.99]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Timer className="h-4 w-4 text-primary" /> Today's Study
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-2xl font-bold text-primary">{formatDuration(seconds)}</p>
          {goal ? (
            <>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Goal {formatShort(goal)} · {pct}%</p>
            </>
          ) : (
            <p className="mt-1 text-[11px] text-muted-foreground">Tap to log your study time</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export default StudyTimeCard;
