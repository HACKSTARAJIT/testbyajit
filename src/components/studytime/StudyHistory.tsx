import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useConfirmDelete } from "@/hooks/useConfirmDelete";
import { ChevronRight, Pencil, Trash2, Loader2 } from "lucide-react";
import {
  StudyEntry, deleteEntry, formatDuration, prettyDate, splitDuration, toSeconds, totalsByDate, updateEntry,
} from "@/lib/studyTime";

export default function StudyHistory({
  entries, userId, onChanged,
}: { entries: StudyEntry[]; userId: string; onChanged: () => void }) {
  const { toast } = useToast();
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [editing, setEditing] = useState<StudyEntry | null>(null);
  const confirmDelete = useConfirmDelete();
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({ date: "", subject: "", h: "0", m: "0", s: "0" });

  const days = useMemo(() => {
    const map = totalsByDate(entries);
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [entries]);

  const dayRows = openDay ? entries.filter((e) => e.study_date === openDay) : [];

  const startEdit = (e: StudyEntry) => {
    const p = splitDuration(e.duration_seconds);
    setForm({ date: e.study_date, subject: e.subject_name, h: String(p.hours), m: String(p.minutes), s: String(p.seconds) });
    setEditing(e);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await updateEntry(editing.id, {
        study_date: form.date,
        subject: form.subject,
        duration_seconds: toSeconds(Number(form.h), Number(form.m), Number(form.s)),
      }, userId);
      toast({ title: "Entry updated" });
      setEditing(null);
      onChanged();
    } catch (err) {
      toast({ title: "Could not update", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally { setBusy(false); }
  };

  const askDelete = async (entry: StudyEntry) => {
    const ok = await confirmDelete({
      itemLabel: `${entry.subject_name} · ${formatDuration(entry.duration_seconds)} · ${prettyDate(entry.study_date)}`,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteEntry(entry.id, userId);
      toast({ title: "Entry deleted successfully" });
      onChanged();
    } catch (err) {
      toast({ title: "Could not delete", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur">
      <CardHeader className="pb-3"><CardTitle className="text-base">Study History</CardTitle></CardHeader>
      <CardContent className="grid gap-2">
        {days.length === 0 && <p className="text-sm text-muted-foreground">No study time recorded yet.</p>}
        {days.map(([date, seconds]) => (
          <button
            key={date}
            onClick={() => setOpenDay(date)}
            className="flex items-center justify-between rounded-xl border bg-background/40 px-3 py-3 text-left transition-colors hover:bg-muted/60"
          >
            <div>
              <p className="text-sm font-medium">{prettyDate(date)}</p>
              <p className="text-xs text-muted-foreground">
                {entries.filter((e) => e.study_date === date).length} subjects
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-primary">{formatDuration(seconds)}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </button>
        ))}

        {/* Day detail */}
        <Dialog open={!!openDay} onOpenChange={(v) => !v && setOpenDay(null)}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
            <DialogHeader><DialogTitle>{openDay ? prettyDate(openDay) : ""}</DialogTitle></DialogHeader>
            <div className="grid gap-2">
              {dayRows.map((e) => (
                <div key={e.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{e.subject_name}</p>
                      <p className="text-xs text-muted-foreground">{formatDuration(e.duration_seconds)} · {e.source}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(e)} aria-label="Edit entry">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => askDelete(e)} aria-label="Delete entry">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {e.needs_confirmation && (
                    <Badge variant="destructive" className="mt-2 text-[10px]">Needs confirmation</Badge>
                  )}
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit */}
        <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Edit study entry</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="h-11" />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Subject</Label>
                <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="h-11" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(["h", "m", "s"] as const).map((k) => (
                  <div key={k} className="grid gap-1">
                    <Label className="text-[11px] uppercase text-muted-foreground">
                      {k === "h" ? "Hours" : k === "m" ? "Minutes" : "Seconds"}
                    </Label>
                    <Input type="number" min={0} inputMode="numeric" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="h-11" />
                  </div>
                ))}
              </div>
              <Button className="h-11" disabled={busy} onClick={saveEdit}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </CardContent>
    </Card>
  );
}
