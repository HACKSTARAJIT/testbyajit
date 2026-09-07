import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Timer, Flame, Target, Loader2, Trophy, BookOpen } from "lucide-react";
import AddStudyTimeDialog from "@/components/studytime/AddStudyTimeDialog";
import StudyCalendar from "@/components/studytime/StudyCalendar";
import StudyAnalytics from "@/components/studytime/StudyAnalytics";
import StudyHistory from "@/components/studytime/StudyHistory";
import {
  StudyEntry, StudyGoals, StudySubject, formatDuration, formatShort, loadEntries, loadGoals,
  loadSubjects, prettyDate, saveGoals, splitDuration, streaks, todayISO, toSeconds, totalsBySubject,
} from "@/lib/studyTime";

export default function StudyTime() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<StudyEntry[]>([]);
  const [subjects, setSubjects] = useState<StudySubject[]>([]);
  const [goals, setGoals] = useState<StudyGoals>({ daily_goal_seconds: null, weekly_goal_seconds: null, monthly_goal_seconds: null });
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalHours, setGoalHours] = useState("8");
  const [savingGoal, setSavingGoal] = useState(false);

  const reload = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [e, s, g] = await Promise.all([loadEntries(user.id), loadSubjects(user.id), loadGoals(user.id)]);
      setEntries(e); setSubjects(s); setGoals(g);
      if (g.daily_goal_seconds) setGoalHours(String(+(g.daily_goal_seconds / 3600).toFixed(2)));
    } catch (err) {
      toast({ title: "Could not load study time", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => { reload(); }, [reload]);

  const today = todayISO();
  const todayEntries = useMemo(() => entries.filter((e) => e.study_date === today), [entries, today]);
  const todayTotal = todayEntries.reduce((s, e) => s + e.duration_seconds, 0);
  const todaySubjects = useMemo(() => totalsBySubject(todayEntries), [todayEntries]);
  const { current, longest } = useMemo(() => streaks(entries), [entries]);
  const goalPct = goals.daily_goal_seconds ? Math.min(100, Math.round((todayTotal / goals.daily_goal_seconds) * 100)) : null;

  const saveDailyGoal = async () => {
    if (!user?.id) return;
    setSavingGoal(true);
    try {
      const secs = Math.round(Number(goalHours) * 3600);
      await saveGoals(user.id, { ...goals, daily_goal_seconds: secs > 0 ? secs : null });
      setGoals((g) => ({ ...g, daily_goal_seconds: secs > 0 ? secs : null }));
      setGoalOpen(false);
      toast({ title: "Daily goal saved" });
    } catch (err) {
      toast({ title: "Could not save goal", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally { setSavingGoal(false); }
  };

  if (loading && entries.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl pb-24">
      <header className="mb-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Timer className="h-6 w-6 text-primary" /> Study Time
        </h1>
        <p className="text-sm text-muted-foreground">Track how long you actually study, every day.</p>
      </header>

      {/* Sticky today summary */}
      <Card className="sticky top-16 z-20 mb-4 border-border/60 bg-card/80 backdrop-blur">
        <CardContent className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Today · {prettyDate(today)}</p>
          <p className="mt-1 text-3xl font-bold text-primary">{formatDuration(todayTotal)}</p>
          {goalPct !== null && (
            <>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${goalPct}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Goal {formatShort(goals.daily_goal_seconds!)} · {goalPct}%
              </p>
            </>
          )}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Mini icon={<BookOpen className="h-3.5 w-3.5" />} label="Subjects" value={String(todaySubjects.length)} />
            <Mini icon={<Trophy className="h-3.5 w-3.5" />} label="Longest" value={todaySubjects[0] ? formatShort(todaySubjects[0].seconds) : "—"} />
            <Mini icon={<Flame className="h-3.5 w-3.5" />} label="Streak" value={`${current}d`} />
          </div>
        </CardContent>
      </Card>

      <div className="mb-4 flex gap-2">
        <Button size="lg" className="h-12 flex-1 gap-2" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Add Today's Study Time
        </Button>
        <Dialog open={goalOpen} onOpenChange={setGoalOpen}>
          <DialogTrigger asChild>
            <Button size="lg" variant="outline" className="h-12 gap-2" aria-label="Set daily goal">
              <Target className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xs">
            <DialogHeader><DialogTitle>Daily goal (optional)</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1">
                <Label className="text-xs">Hours per day</Label>
                <Input type="number" min={0} step="0.5" value={goalHours} onChange={(e) => setGoalHours(e.target.value)} className="h-11" />
              </div>
              <Button className="h-11" disabled={savingGoal} onClick={saveDailyGoal}>
                {savingGoal && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save goal
              </Button>
              <p className="text-[11px] text-muted-foreground">Set 0 to remove the goal. Goals never block anything.</p>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="today">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-4 grid gap-3">
          <Card className="border-border/60 bg-card/60 backdrop-blur">
            <CardHeader className="pb-3"><CardTitle className="text-base">Subjects studied today</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              {todaySubjects.length === 0 && (
                <p className="text-sm text-muted-foreground">Nothing logged yet today. Tap “Add Today's Study Time”.</p>
              )}
              {todaySubjects.map((s) => (
                <div key={s.key} className="flex items-center justify-between rounded-xl border bg-background/40 px-3 py-3">
                  <span className="text-sm font-medium">{s.name}</span>
                  <span className="text-sm font-semibold text-primary">{formatDuration(s.seconds)}</span>
                </div>
              ))}
              {todayEntries.some((e) => e.needs_confirmation) && (
                <Badge variant="destructive" className="w-fit text-[10px]">Some durations need confirmation</Badge>
              )}
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-card/60 backdrop-blur">
            <CardContent className="grid grid-cols-2 gap-2 p-4">
              <Mini icon={<Flame className="h-3.5 w-3.5" />} label="Current streak" value={`${current} days`} />
              <Mini icon={<Trophy className="h-3.5 w-3.5" />} label="Longest streak" value={`${longest} days`} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <StudyCalendar entries={entries} />
        </TabsContent>

        <TabsContent value="analysis" className="mt-4">
          <StudyAnalytics entries={entries} />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {user?.id && <StudyHistory entries={entries} userId={user.id} onChanged={reload} />}
        </TabsContent>
      </Tabs>

      {user?.id && (
        <AddStudyTimeDialog
          open={adding}
          onOpenChange={setAdding}
          userId={user.id}
          subjects={subjects}
          onSaved={reload}
        />
      )}
    </div>
  );
}

function Mini({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-2 py-2">
      <p className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}
