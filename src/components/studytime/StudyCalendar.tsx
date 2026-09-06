import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { StudyEntry, formatDuration, formatShort, isoOf, prettyDate, totalsByDate, totalsBySubject } from "@/lib/studyTime";

export default function StudyCalendar({ entries }: { entries: StudyEntry[] }) {
  const now = new Date();
  const [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selected, setSelected] = useState<string | null>(null);

  const byDate = useMemo(() => totalsByDate(entries), [entries]);
  const max = useMemo(() => Math.max(1, ...[...byDate.values()]), [byDate]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const offset = (firstDay.getDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<string | null> = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => isoOf(new Date(year, month, i + 1))),
  ];

  const dayEntries = selected ? entries.filter((e) => e.study_date === selected) : [];
  const daySubjects = totalsBySubject(dayEntries);
  const dayTotal = dayEntries.reduce((s, e) => s + e.duration_seconds, 0);

  const intensity = (secs: number) => {
    if (!secs) return "bg-muted/40 text-muted-foreground";
    const r = secs / max;
    if (r > 0.75) return "bg-primary text-primary-foreground";
    if (r > 0.5) return "bg-primary/70 text-primary-foreground";
    if (r > 0.25) return "bg-primary/45 text-foreground";
    return "bg-primary/20 text-foreground";
  };

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">
          {cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
        </CardTitle>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div key={i}>{d}</div>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((iso, i) =>
            iso === null ? (
              <div key={`e${i}`} />
            ) : (
              <button
                key={iso}
                onClick={() => setSelected(iso)}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center rounded-lg text-[11px] font-medium transition-transform active:scale-95",
                  intensity(byDate.get(iso) ?? 0),
                )}
              >
                <span>{Number(iso.slice(-2))}</span>
                {(byDate.get(iso) ?? 0) > 0 && (
                  <span className="text-[9px] opacity-90">{formatShort(byDate.get(iso)!)}</span>
                )}
              </button>
            ),
          )}
        </div>

        <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Study Summary — {selected ? prettyDate(selected) : ""}</DialogTitle>
            </DialogHeader>
            <p className="text-2xl font-bold text-primary">{formatDuration(dayTotal)}</p>
            {daySubjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No study time recorded on this day.</p>
            ) : (
              <div className="grid gap-2">
                {daySubjects.map((s) => (
                  <div key={s.key} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <span>{s.name}</span>
                    <span className="font-medium">{formatDuration(s.seconds)}</span>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
