import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from "recharts";
import {
  StudyEntry, formatDuration, formatShort, monthKey, monthlySummary, prettyDate, prettyMonth,
  rangeFor, subjectMonthMatrix, totalsByDate, totalsBySubject, todayISO,
} from "@/lib/studyTime";

const PRESETS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "last-month", label: "Last Month" },
  { value: "custom", label: "Custom Range" },
  { value: "all", label: "All Time" },
];

export default function StudyAnalytics({ entries }: { entries: StudyEntry[] }) {
  const months = useMemo(
    () => [...new Set(entries.map((e) => monthKey(e.study_date)))].sort().reverse(),
    [entries],
  );
  const [month, setMonth] = useState(months[0] ?? todayISO().slice(0, 7));
  const [preset, setPreset] = useState("month");
  const [customFrom, setCustomFrom] = useState(todayISO());
  const [customTo, setCustomTo] = useState(todayISO());

  const summary = useMemo(() => monthlySummary(entries, month), [entries, month]);

  const filtered = useMemo(() => {
    if (preset === "custom") {
      return entries.filter((e) => e.study_date >= customFrom && e.study_date <= customTo);
    }
    const { from, to } = rangeFor(preset);
    return entries.filter((e) => (!from || e.study_date >= from) && (!to || e.study_date <= to));
  }, [entries, preset, customFrom, customTo]);

  const filteredSubjects = useMemo(() => totalsBySubject(filtered), [filtered]);
  const filteredDays = useMemo(() => [...totalsByDate(filtered).keys()].length, [filtered]);
  const filteredTotal = filtered.reduce((s, e) => s + e.duration_seconds, 0);

  const dailyChart = useMemo(() => {
    const map = totalsByDate(summary.entries);
    return [...map.entries()].sort().map(([d, s]) => ({ day: Number(d.slice(-2)), hours: +(s / 3600).toFixed(2), seconds: s }));
  }, [summary.entries]);

  const monthChart = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) map.set(monthKey(e.study_date), (map.get(monthKey(e.study_date)) ?? 0) + e.duration_seconds);
    return [...map.entries()].sort().map(([m, s]) => ({ month: prettyMonth(m).slice(0, 3), hours: +(s / 3600).toFixed(2), seconds: s }));
  }, [entries]);

  const matrix = useMemo(() => subjectMonthMatrix(entries), [entries]);

  const tip = (v: any, n: string) => [n === "hours" ? `${v} h` : v, "Study time"];

  return (
    <div className="grid gap-4">
      {/* Monthly summary */}
      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Monthly Summary</CardTitle>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(months.length ? months : [month]).map((m) => (
                <SelectItem key={m} value={m}>{prettyMonth(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Total" value={formatShort(summary.total)} />
            <Stat label="Average / day" value={formatShort(summary.average)} />
            <Stat label="Days studied" value={String(summary.daysStudied)} />
            <Stat label="Longest day" value={summary.bestDay ? `${formatShort(summary.bestDay[1])}` : "—"} sub={summary.bestDay ? prettyDate(summary.bestDay[0]) : undefined} />
            <Stat label="Shortest day" value={summary.worstDay ? `${formatShort(summary.worstDay[1])}` : "—"} sub={summary.worstDay ? prettyDate(summary.worstDay[0]) : undefined} />
            <Stat label="Top subject" value={summary.topSubject?.name ?? "—"} sub={summary.topSubject ? formatShort(summary.topSubject.seconds) : undefined} />
          </div>

          {dailyChart.length > 0 && (
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyChart} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="h" />
                  <Tooltip formatter={tip} labelFormatter={(l) => `Day ${l}`} />
                  <Bar dataKey="hours" radius={[6, 6, 0, 0]} className="fill-primary" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subject analysis */}
      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Subject Analysis</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Select value={preset} onValueChange={setPreset}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRESETS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>

          {preset === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1">
                <Label className="text-xs">From</Label>
                <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-10" />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">To</Label>
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-10" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Stat label="Total" value={formatShort(filteredTotal)} />
            <Stat label="Average / day" value={formatShort(filteredDays ? Math.round(filteredTotal / filteredDays) : 0)} />
          </div>

          {filteredSubjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No study time in this range.</p>
          ) : (
            <div className="grid gap-2">
              {filteredSubjects.map((s) => {
                const pct = filteredTotal ? Math.round((s.seconds / filteredTotal) * 100) : 0;
                return (
                  <div key={s.key} className="rounded-lg border bg-background/40 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{s.name}</span>
                      <span>{formatDuration(s.seconds)}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{pct}% of this range</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly trend */}
      {monthChart.length > 1 && (
        <Card className="border-border/60 bg-card/60 backdrop-blur">
          <CardHeader className="pb-3"><CardTitle className="text-base">Monthly Trend</CardTitle></CardHeader>
          <CardContent>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthChart} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="h" />
                  <Tooltip formatter={tip} />
                  <Line type="monotone" dataKey="hours" strokeWidth={2} dot className="stroke-primary" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subject × Month matrix */}
      {matrix.rows.length > 0 && (
        <Card className="border-border/60 bg-card/60 backdrop-blur">
          <CardHeader className="pb-3"><CardTitle className="text-base">Subject × Month</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Subject</th>
                  {matrix.months.map((m) => (
                    <th key={m} className="py-2 pr-3 font-medium whitespace-nowrap">{prettyMonth(m).slice(0, 3)} {m.slice(2, 4)}</th>
                  ))}
                  <th className="py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {matrix.rows.map((r) => (
                  <tr key={r.name} className="border-t border-border/50">
                    <td className="py-2 pr-3 font-medium whitespace-nowrap">{r.name}</td>
                    {matrix.months.map((m) => (
                      <td key={m} className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                        {r.byMonth[m] ? formatShort(r.byMonth[m]) : "—"}
                      </td>
                    ))}
                    <td className="py-2 font-semibold whitespace-nowrap">{formatShort(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-background/40 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
