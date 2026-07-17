import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Target, Plus, Trash2, ArrowUp, ArrowDown, ChevronRight, Flame } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Task { id: string; title: string; priority: string; completed: boolean; sort_order: number; }

const istToday = () => {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
};

export default function TodayTargetCard({ userId }: { userId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [busy, setBusy] = useState(false);
  const date = useMemo(istToday, []);

  const load = async () => {
    const { data } = await supabase
      .from("daily_targets")
      .select("id,title,priority,completed,sort_order")
      .eq("user_id", userId)
      .eq("target_date", date)
      .order("sort_order")
      .order("created_at");
    setTasks((data ?? []) as Task[]);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userId, date]);

  const add = async () => {
    const t = newTitle.trim();
    if (!t) return;
    setBusy(true);
    const nextOrder = tasks.length ? Math.max(...tasks.map(x => x.sort_order)) + 1 : 0;
    const { error } = await supabase.from("daily_targets").insert({
      user_id: userId, title: t, priority, target_date: date, sort_order: nextOrder,
    });
    setBusy(false);
    if (error) return toast({ title: "Failed to add", description: error.message, variant: "destructive" });
    setNewTitle("");
    load();
  };

  const toggle = async (task: Task) => {
    const next = !task.completed;
    setTasks(ts => ts.map(x => x.id === task.id ? { ...x, completed: next } : x));
    await supabase.from("daily_targets")
      .update({ completed: next, completed_at: next ? new Date().toISOString() : null })
      .eq("id", task.id);
  };

  const remove = async (id: string) => {
    setTasks(ts => ts.filter(x => x.id !== id));
    await supabase.from("daily_targets").delete().eq("id", id);
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= tasks.length) return;
    const a = tasks[idx], b = tasks[j];
    const copy = [...tasks];
    copy[idx] = b; copy[j] = a;
    setTasks(copy);
    await Promise.all([
      supabase.from("daily_targets").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("daily_targets").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
  };

  const done = tasks.filter(t => t.completed).length;
  const total = tasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <Card className="overflow-hidden rounded-3xl border-emerald-400/30 bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-cyan-500/5 backdrop-blur-xl">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow">
            <Target className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-500">Today's Target</p>
            <p className="text-sm font-semibold">{done} / {total} Completed</p>
          </div>
          <Link to="/accountability" className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline">
            Review <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {total > 0 && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        )}

        {tasks.length === 0 ? (
          <p className="rounded-xl bg-background/40 p-3 text-center text-xs text-muted-foreground">
            Aaj ke liye 2-3 chhote targets set karo — consistency isi se banti hai.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {tasks.map((t, i) => (
              <li key={t.id} className={cn(
                "flex items-center gap-2 rounded-xl bg-background/50 p-2 transition-all",
                t.completed && "opacity-60"
              )}>
                <Checkbox checked={t.completed} onCheckedChange={() => toggle(t)} aria-label={`Toggle ${t.title}`} />
                <span className={cn("flex-1 truncate text-sm", t.completed && "line-through")}>{t.title}</span>
                {t.priority === "high" && <Badge className="h-5 gap-0.5 bg-rose-500/20 px-1.5 text-[10px] text-rose-500"><Flame className="h-2.5 w-2.5" />High</Badge>}
                <button onClick={() => move(i, -1)} aria-label="Move up" className="rounded p-1 text-muted-foreground hover:bg-muted"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button onClick={() => move(i, 1)} aria-label="Move down" className="rounded p-1 text-muted-foreground hover:bg-muted"><ArrowDown className="h-3.5 w-3.5" /></button>
                <button onClick={() => remove(t.id)} aria-label="Delete" className="rounded p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-2">
          <Input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === "Enter" && add()}
            placeholder="Add a target (e.g. Solve 100 questions)"
            className="h-9 flex-1 rounded-xl bg-background/60 text-sm"
          />
          <select
            value={priority}
            onChange={e => setPriority(e.target.value as any)}
            className="h-9 rounded-xl border border-border/60 bg-background/60 px-2 text-xs"
            aria-label="Priority"
          >
            <option value="high">High</option>
            <option value="medium">Med</option>
            <option value="low">Low</option>
          </select>
          <Button size="sm" onClick={add} disabled={busy || !newTitle.trim()} className="h-9 rounded-xl">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
