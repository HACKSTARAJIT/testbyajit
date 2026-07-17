import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, Search, RefreshCw, Download, Activity, Users, Trophy, Sparkles, Home, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

async function callAdmin(action: string, extra: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke("admin-intelligence", {
    body: { action, ...extra },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}

function toCsv(rows: any[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: any) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map(r => cols.map(c => esc(r[c])).join(","))].join("\n");
}
function downloadCsv(filename: string, rows: any[]) {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}
function fmtDate(v?: string) {
  if (!v) return "—";
  try { return new Date(v).toLocaleString(); } catch { return "—"; }
}

export default function AdminIntelligence() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/admin" className="inline-flex items-center gap-1 hover:text-foreground"><Home className="h-3 w-3" /> Admin</Link>
        <ChevronRight className="h-3 w-3" />
        <span>Intelligence Center</span>
      </div>
      <div>
        <h1 className="text-2xl font-bold">Admin Intelligence Center</h1>
        <p className="text-muted-foreground">Live view of every student's preparation journey.</p>
      </div>
      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="overview"><Sparkles className="mr-1 h-4 w-4" /> Overview</TabsTrigger>
          <TabsTrigger value="live"><Activity className="mr-1 h-4 w-4" /> Live Activity</TabsTrigger>
          <TabsTrigger value="students"><Users className="mr-1 h-4 w-4" /> Students</TabsTrigger>
          <TabsTrigger value="leaderboard"><Trophy className="mr-1 h-4 w-4" /> Leaderboard</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="pt-4"><OverviewTab /></TabsContent>
        <TabsContent value="live" className="pt-4"><LiveTab /></TabsContent>
        <TabsContent value="students" className="pt-4"><StudentsTab /></TabsContent>
        <TabsContent value="leaderboard" className="pt-4"><LeaderboardTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function OverviewTab() {
  const [data, setData] = useState<any>(null);
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      const [o, ins] = await Promise.all([callAdmin("overview"), callAdmin("insights")]);
      setData(o); setInsights(ins);
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  if (!data) return <Loader2 className="mx-auto h-6 w-6 animate-spin" />;
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button size="sm" variant="outline" onClick={load} disabled={loading}><RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</Button></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total Students" value={data.total_students} />
        <Stat label="Online Now" value={data.online_now} />
        <Stat label="Active Today" value={data.active_today} />
        <Stat label="Active This Week" value={data.active_week} />
        <Stat label="New (7d)" value={data.new_registrations} />
        <Stat label="Premium" value="—" />
        <Stat label="Guest" value="—" />
        <Stat label="Avg Accuracy" value={`${insights?.stats?.avg_accuracy ?? 0}%`} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">AI Insights</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(insights?.insights ?? []).map((s: string, i: number) => (
            <div key={i} className="rounded-md border p-3 text-sm">{s}</div>
          ))}
          {!(insights?.insights ?? []).length && <p className="text-sm text-muted-foreground">No insights available yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function LiveTab() {
  const [data, setData] = useState<any>({ activity: [], tests: [] });
  const [loading, setLoading] = useState(false);
  const load = async () => { setLoading(true); try { setData(await callAdmin("live_activity")); } catch (e: any) { toast.error(e.message); } setLoading(false); };
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button size="sm" variant="outline" onClick={load} disabled={loading}><RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</Button></div>
      <Card>
        <CardHeader><CardTitle className="text-base">Currently Studying</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.activity.length === 0 && <p className="text-sm text-muted-foreground">No recent activity.</p>}
          {data.activity.slice(0, 20).map((a: any, i: number) => (
            <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium truncate">{a.name}</div>
                <div className="text-xs text-muted-foreground truncate">{a.email}</div>
              </div>
              <div className="flex-1 min-w-0 text-xs">
                <Badge variant="outline" className="mr-2">{a.item_type}</Badge>
                {a.subject && <span className="mr-2">{a.subject}</span>}
                <span className="text-muted-foreground truncate">{a.title}</span>
              </div>
              <div className="text-xs text-muted-foreground">{fmtDate(a.opened_at)}</div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Recent Test Attempts</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.tests.slice(0, 20).map((t: any, i: number) => (
            <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium truncate">{t.name}</div>
                <div className="text-xs text-muted-foreground truncate">{t.test} • {t.subject}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={t.status === "completed" ? "default" : "outline"}>{t.status}</Badge>
                <span className="text-sm font-semibold">{Number(t.accuracy).toFixed(0)}%</span>
                <span className="text-xs text-muted-foreground">{fmtDate(t.at)}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StudentsTab() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [minAcc, setMinAcc] = useState<number | "">("");
  const [minStreak, setMinStreak] = useState<number | "">("");
  const [selected, setSelected] = useState<string | null>(null);

  const load = async () => { setLoading(true); try { const d = await callAdmin("students_list"); setStudents((d as any).students); } catch (e: any) { toast.error(e.message); } setLoading(false); };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return students.filter(s => {
      if (search) {
        const q = search.toLowerCase();
        if (!(`${s.name} ${s.email} ${s.user_id}`.toLowerCase().includes(q))) return false;
      }
      if (minAcc !== "" && s.accuracy < Number(minAcc)) return false;
      if (minStreak !== "" && s.streak < Number(minStreak)) return false;
      return true;
    });
  }, [students, search, minAcc, minStreak]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search name, email, id" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Input type="number" placeholder="Min Acc %" className="w-28" value={minAcc} onChange={e => setMinAcc(e.target.value ? +e.target.value : "")} />
        <Input type="number" placeholder="Min Streak" className="w-28" value={minStreak} onChange={e => setMinStreak(e.target.value ? +e.target.value : "")} />
        <Button size="sm" variant="outline" onClick={load} disabled={loading}><RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button>
        <Button size="sm" variant="outline" onClick={() => downloadCsv("students.csv", filtered)}><Download className="mr-1 h-4 w-4" /> CSV</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase">
            <tr>
              <th className="p-2">Name</th><th className="p-2">Email</th><th className="p-2">Reg</th>
              <th className="p-2">Last</th><th className="p-2">Acc</th><th className="p-2">Score</th>
              <th className="p-2">Q Solved</th><th className="p-2">Wrong</th>
              <th className="p-2">Rev ✓/⏳</th><th className="p-2">Streak</th><th className="p-2">Readiness</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.user_id} className="cursor-pointer border-t hover:bg-muted/30" onClick={() => setSelected(s.user_id)}>
                <td className="p-2 font-medium">{s.name}</td>
                <td className="p-2 text-xs text-muted-foreground">{s.email}</td>
                <td className="p-2 text-xs">{s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}</td>
                <td className="p-2 text-xs">{s.last_login ? new Date(s.last_login).toLocaleDateString() : "—"}</td>
                <td className="p-2">{s.accuracy}%</td>
                <td className="p-2">{s.score}</td>
                <td className="p-2">{s.questions_solved}</td>
                <td className="p-2">{s.wrong_count}</td>
                <td className="p-2 text-xs">{s.revision_done}/{s.revision_pending}</td>
                <td className="p-2">{s.streak}d</td>
                <td className="p-2">{s.readiness}%</td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={11} className="p-4 text-center text-muted-foreground">No students match.</td></tr>}
          </tbody>
        </table>
      </div>
      <StudentDetailDrawer userId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function StudentDetailDrawer({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!userId) { setData(null); return; }
    setLoading(true);
    callAdmin("student_detail", { user_id: userId })
      .then(setData).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  }, [userId]);
  return (
    <Sheet open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full max-w-2xl overflow-y-auto sm:max-w-2xl">
        <SheetHeader><SheetTitle>Student Profile</SheetTitle></SheetHeader>
        {loading && <Loader2 className="mx-auto mt-8 h-6 w-6 animate-spin" />}
        {data && (
          <div className="mt-4 space-y-4 text-sm">
            <Card><CardContent className="p-4">
              <div className="text-lg font-bold">{data.profile.name}</div>
              <div className="text-xs text-muted-foreground">{data.profile.email}</div>
              <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                <div><div className="text-xs text-muted-foreground">Accuracy</div><div className="font-bold">{data.overall.accuracy}%</div></div>
                <div><div className="text-xs text-muted-foreground">Readiness</div><div className="font-bold">{data.overall.readiness}%</div></div>
                <div><div className="text-xs text-muted-foreground">Score</div><div className="font-bold">{Math.round(data.overall.score)}</div></div>
                <div><div className="text-xs text-muted-foreground">Tests</div><div className="font-bold">{data.overall.tests_taken}</div></div>
              </div>
            </CardContent></Card>

            <Card><CardHeader><CardTitle className="text-sm">Subject-wise Accuracy</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {data.subject_accuracy.map((s: any) => (
                  <div key={s.name} className="flex justify-between text-xs"><span>{s.name}</span><span className="font-medium">{s.accuracy}% ({s.total} Q)</span></div>
                ))}
                {!data.subject_accuracy.length && <p className="text-xs text-muted-foreground">No data</p>}
              </CardContent></Card>

            <Card><CardHeader><CardTitle className="text-sm">Weak Chapters</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {data.weak_chapters.map((c: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs"><span>{c.subject} • {c.name}</span><span className="text-destructive">{c.accuracy}%</span></div>
                ))}
                {!data.weak_chapters.length && <p className="text-xs text-muted-foreground">None</p>}
              </CardContent></Card>

            <Card><CardHeader><CardTitle className="text-sm">Test History</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {data.test_history.slice(0, 15).map((t: any) => (
                  <div key={t.id} className="flex flex-wrap justify-between gap-1 border-b pb-1 text-xs">
                    <span className="min-w-0 truncate">{t.test} <span className="text-muted-foreground">({t.subject})</span></span>
                    <span>{Number(t.accuracy).toFixed(0)}% • {t.correct}/{t.correct + t.wrong + t.skipped}</span>
                  </div>
                ))}
                {!data.test_history.length && <p className="text-xs text-muted-foreground">No tests yet</p>}
                {data.test_history.length > 0 && (
                  <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => downloadCsv(`${data.profile.name}-tests.csv`, data.test_history)}>
                    <Download className="mr-1 h-3 w-3" /> Export CSV
                  </Button>
                )}
              </CardContent></Card>

            <Card><CardHeader><CardTitle className="text-sm">AI Mock Reports ({data.mock_reports.length})</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {data.mock_reports.slice(0, 10).map((r: any) => (
                  <div key={r.id} className="flex justify-between border-b pb-1 text-xs">
                    <span className="min-w-0 truncate">{r.title} <Badge variant="outline" className="ml-1">{r.report_type}</Badge></span>
                    <span>{r.overall_score ? `${Math.round(r.overall_score)}%` : r.status}</span>
                  </div>
                ))}
                {!data.mock_reports.length && <p className="text-xs text-muted-foreground">No AI reports</p>}
              </CardContent></Card>

            <Card><CardHeader><CardTitle className="text-sm">Smart Revision</CardTitle></CardHeader>
              <CardContent className="text-xs">
                <div>Items: {data.revision_items.length}</div>
                <div>Revision Tests: {data.revision_tests.length}</div>
              </CardContent></Card>

            <Card><CardHeader><CardTitle className="text-sm">Study Plan ({data.study_plan.length})</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {data.study_plan.slice(0, 10).map((t: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs"><span className="truncate">{t.title || t.task || "Task"}</span><span>{t.status || "—"}</span></div>
                ))}
                {!data.study_plan.length && <p className="text-xs text-muted-foreground">No plan</p>}
              </CardContent></Card>

            <Card><CardHeader><CardTitle className="text-sm">AI Coach Threads</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {data.coach_threads.slice(0, 10).map((th: any) => (
                  <div key={th.id} className="text-xs">{th.title || "Untitled"} <span className="text-muted-foreground">• {fmtDate(th.created_at)}</span></div>
                ))}
                {!data.coach_threads.length && <p className="text-xs text-muted-foreground">No coach chats</p>}
              </CardContent></Card>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function LeaderboardTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const load = async () => { setLoading(true); try { setData(await callAdmin("leaderboard")); } catch (e: any) { toast.error(e.message); } setLoading(false); };
  useEffect(() => { load(); }, []);
  if (!data) return <Loader2 className="mx-auto h-6 w-6 animate-spin" />;
  const Section = ({ title, rows, valueKey, unit }: any) => (
    <Card><CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-1">
        {rows.map((r: any, i: number) => (
          <div key={r.user_id + i} className="flex justify-between text-xs">
            <span>{i + 1}. {r.name}</span><span className="font-semibold">{r[valueKey]}{unit}</span>
          </div>
        ))}
        {!rows.length && <p className="text-xs text-muted-foreground">—</p>}
      </CardContent></Card>
  );
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button size="sm" variant="outline" onClick={load} disabled={loading}><RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button></div>
      <div className="grid gap-3 md:grid-cols-2">
        <Section title="Top Accuracy" rows={data.top_accuracy} valueKey="accuracy" unit="%" />
        <Section title="Top Score" rows={data.top_score} valueKey="score" unit="" />
        <Section title="Most Active" rows={data.most_active} valueKey="questions_solved" unit=" Q" />
        <Section title="Longest Streak" rows={data.longest_streak} valueKey="streak" unit="d" />
        <Section title="Highest Revision" rows={data.highest_revision} valueKey="revision_done" unit="" />
      </div>
    </div>
  );
}
