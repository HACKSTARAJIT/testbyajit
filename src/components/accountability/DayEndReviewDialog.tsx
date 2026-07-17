import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Sparkles, Trophy } from "lucide-react";

interface Task { id: string; title: string; completed: boolean; }

const istToday = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const DISMISS_KEY = (uid: string, d: string) => `dayEndDismissed:${uid}:${d}`;

export default function DayEndReviewDialog({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<any>(null);
  const date = istToday();

  useEffect(() => {
    (async () => {
      // trigger only after 8 PM IST
      const nowIST = new Date(Date.now() + 5.5 * 3600 * 1000);
      const hour = nowIST.getUTCHours();
      if (hour < 20) return;
      if (localStorage.getItem(DISMISS_KEY(userId, date))) return;

      const [{ data: targets }, { data: existing }] = await Promise.all([
        supabase.from("daily_targets").select("id,title,completed").eq("user_id", userId).eq("target_date", date),
        supabase.from("daily_reviews").select("*").eq("user_id", userId).eq("review_date", date).maybeSingle(),
      ]);
      if (!targets || targets.length === 0) return;   // nothing to review
      if (existing) return;                            // already reviewed today
      setTasks(targets as Task[]);
      setOpen(true);
    })();
  }, [userId, date]);

  const toggle = (id: string) => setTasks(ts => ts.map(t => t.id === id ? { ...t, completed: !t.completed } : t));

  const submit = async () => {
    setLoading(true);
    // Persist updates
    await Promise.all(tasks.map(t =>
      supabase.from("daily_targets").update({
        completed: t.completed,
        completed_at: t.completed ? new Date().toISOString() : null,
      }).eq("id", t.id)
    ));
    // Ask AI for daily analysis
    const { data, error } = await supabase.functions.invoke("daily-accountability", { body: { action: "daily", date } });
    setLoading(false);
    if (error) { setOpen(false); return; }
    setReview((data as any)?.review ?? null);
  };

  const close = () => {
    localStorage.setItem(DISMISS_KEY(userId, date), "1");
    setOpen(false);
    setReview(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-md rounded-2xl">
        {!review ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Day End Review
              </DialogTitle>
              <p className="text-sm text-muted-foreground">Aaj ke targets ka honest status mark karo.</p>
            </DialogHeader>
            <ul className="max-h-72 space-y-2 overflow-y-auto py-2">
              {tasks.map(t => (
                <li key={t.id} className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/30 p-3">
                  <Checkbox checked={t.completed} onCheckedChange={() => toggle(t.id)} />
                  <span className={t.completed ? "flex-1 line-through" : "flex-1"}>{t.title}</span>
                </li>
              ))}
            </ul>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={close}>Later</Button>
              <Button onClick={submit} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Analysis
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                {review.consistency_label} — {review.consistency_score}/100
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-1">
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">AI Analysis</p>
                <p className="mt-1 text-sm">{review.analysis}</p>
              </div>
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                <p className="text-xs font-semibold uppercase text-primary">AJIT AI Mentor</p>
                <p className="mt-1 text-sm">{review.mentor_message}</p>
              </div>
              {review.seriousness_level && (
                <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3 text-sm">
                  <span className="text-muted-foreground">Career Seriousness</span>
                  <span className="font-semibold">{review.seriousness_level}</span>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
