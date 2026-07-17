import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, BarChart3, Download, FileSpreadsheet, FileText, Search, Users } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Test = { id: string; title: string; total_marks: number | null; total_questions: number | null; subjects: { name: string } | null };
type Attempt = {
  id: string; user_id: string; test_id: string; created_at: string;
  correct_count: number; incorrect_count: number; skipped_count: number; unattempted_count: number;
  marks_obtained: number; accuracy: number; total_questions: number; time_taken_seconds: number | null;
  answers: Record<string, string> | null; status: string;
};
type Question = { id: string; sort_order: number; question_text: string; correct_option: string };

const fmtTime = (s: number | null | undefined) => {
  if (!s) return "-";
  const m = Math.floor(s / 60); const sec = s % 60;
  return `${m}m ${sec}s`;
};
const fmtDate = (s: string) => new Date(s).toLocaleString();

export default function AdminAnalytics() {
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("tests")
        .select("id, title, total_marks, total_questions, subjects(name)")
        .order("created_at", { ascending: false });
      setTests((data as any) ?? []);
      setLoading(false);
    })();
  }, []);

  const grouped = useMemo(() => {
    const filtered = tests.filter(t =>
      !search || t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.subjects?.name.toLowerCase().includes(search.toLowerCase())
    );
    const map = new Map<string, Test[]>();
    filtered.forEach(t => {
      const key = t.subjects?.name ?? "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [tests, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link to="/admin" aria-label="Back to Admin"><Button variant="ghost" size="icon" aria-label="Back"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Test Analytics</h1>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search subject or test..." className="pl-9" />
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([subject, list]) => (
            <div key={subject}>
              <h2 className="mb-2 text-lg font-semibold">{subject}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map(t => (
                  <Card key={t.id} onClick={() => setSelectedTest(t)} className="cursor-pointer transition hover:border-primary hover:shadow-md">
                    <CardContent className="p-4">
                      <p className="font-medium">{t.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{t.total_questions ?? 0} questions · {t.total_marks ?? 0} marks</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
          {grouped.length === 0 && <p className="text-center text-muted-foreground">No tests found.</p>}
        </div>
      )}

      <Dialog open={!!selectedTest} onOpenChange={o => !o && setSelectedTest(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          {selectedTest && <TestAnalyticsPanel test={selectedTest} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TestAnalyticsPanel({ test }: { test: Test }) {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"score_desc" | "score_asc" | "latest" | "fastest">("score_desc");
  const [userDetail, setUserDetail] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [aRes, qRes] = await Promise.all([
        supabase.from("test_attempts").select("*").eq("test_id", test.id).eq("status", "completed"),
        supabase.from("questions").select("id, sort_order, question_text, correct_option").eq("test_id", test.id).order("sort_order"),
      ]);
      const atts = (aRes.data as any as Attempt[]) ?? [];
      setAttempts(atts);
      setQuestions((qRes.data as any) ?? []);

      const uids = [...new Set(atts.map(a => a.user_id))];
      if (uids.length) {
        const [emRes, prRes] = await Promise.all([
          supabase.functions.invoke("admin-get-user-emails", { body: { user_ids: uids } }),
          supabase.from("profiles").select("id, display_name").in("id", uids),
        ]);
        const em: Record<string, string> = {};
        ((emRes.data as any)?.data as any[] | undefined)?.forEach(r => (em[r.user_id] = r.email));
        setEmails(em);
        const nm: Record<string, string> = {};
        (prRes.data as any[])?.forEach(r => (nm[r.id] = r.display_name || ""));
        setNames(nm);
      }
      setLoading(false);
    })();
  }, [test.id]);

  const stats = useMemo(() => {
    if (!attempts.length) return null;
    const marks = attempts.map(a => Number(a.marks_obtained) || 0);
    const acc = attempts.map(a => Number(a.accuracy) || 0);
    const times = attempts.filter(a => a.time_taken_seconds).map(a => a.time_taken_seconds!);
    const passMark = (test.total_marks ?? questions.length) * 0.4;
    const pass = marks.filter(m => m >= passMark).length;
    return {
      total: attempts.length,
      unique: new Set(attempts.map(a => a.user_id)).size,
      avg: (marks.reduce((a,b)=>a+b,0) / marks.length).toFixed(1),
      high: Math.max(...marks),
      low: Math.min(...marks),
      accuracy: (acc.reduce((a,b)=>a+b,0) / acc.length).toFixed(1),
      time: times.length ? Math.round(times.reduce((a,b)=>a+b,0)/times.length) : 0,
      pass: ((pass/attempts.length)*100).toFixed(1),
      fail: (((attempts.length-pass)/attempts.length)*100).toFixed(1),
    };
  }, [attempts, questions.length, test.total_marks]);

  const participants = useMemo(() => {
    const perUser = new Map<string, number>();
    const sorted = [...attempts].sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const withNum = sorted.map(a => {
      const n = (perUser.get(a.user_id) ?? 0) + 1;
      perUser.set(a.user_id, n);
      return { ...a, attempt_no: n };
    });
    const cmp: Record<string, (a: any, b: any) => number> = {
      score_desc: (a,b) => Number(b.marks_obtained) - Number(a.marks_obtained),
      score_asc: (a,b) => Number(a.marks_obtained) - Number(b.marks_obtained),
      latest: (a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      fastest: (a,b) => (a.time_taken_seconds ?? Infinity) - (b.time_taken_seconds ?? Infinity),
    };
    return withNum.sort(cmp[sortBy]);
  }, [attempts, sortBy]);

  const questionAnalytics = useMemo(() => {
    return questions.map(q => {
      let correct=0, wrong=0, skipped=0;
      const optCount: Record<string, number> = { A:0,B:0,C:0,D:0 };
      attempts.forEach(a => {
        const ans = a.answers?.[q.id];
        if (!ans) { skipped++; return; }
        optCount[ans] = (optCount[ans] ?? 0) + 1;
        if (ans === q.correct_option) correct++; else wrong++;
      });
      const total = attempts.length || 1;
      const correctPct = (correct/total)*100;
      const most = Object.entries(optCount).sort((a,b) => b[1]-a[1])[0][0];
      const difficulty = correctPct >= 70 ? "Easy" : correctPct >= 40 ? "Medium" : "Hard";
      return {
        q_no: q.sort_order, text: q.question_text,
        correct_pct: correctPct.toFixed(0),
        wrong_pct: ((wrong/total)*100).toFixed(0),
        skipped_pct: ((skipped/total)*100).toFixed(0),
        most, difficulty,
      };
    });
  }, [questions, attempts]);

  const exportRows = () => participants.map(a => ({
    Name: names[a.user_id] || "-",
    Email: emails[a.user_id] || "-",
    Attempt_No: a.attempt_no,
    Date: fmtDate(a.created_at),
    Score: Number(a.marks_obtained),
    Correct: a.correct_count,
    Incorrect: a.incorrect_count,
    Skipped: a.skipped_count ?? a.unattempted_count,
    Accuracy: `${a.accuracy}%`,
    Time: fmtTime(a.time_taken_seconds),
  }));

  const exportCSV = () => {
    const rows = exportRows();
    const headers = Object.keys(rows[0] ?? {});
    const csv = [headers.join(","), ...rows.map(r => headers.map(h => JSON.stringify((r as any)[h] ?? "")).join(","))].join("\n");
    downloadBlob(new Blob([csv], { type: "text/csv" }), `${test.title}-analytics.csv`);
  };
  const exportXLSX = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportRows()), "Participants");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(questionAnalytics), "Questions");
    XLSX.writeFile(wb, `${test.title}-analytics.xlsx`);
  };
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text(`${test.title} — Analytics`, 14, 14);
    const rows = exportRows();
    const headers = Object.keys(rows[0] ?? {});
    autoTable(doc, {
      head: [headers],
      body: rows.map(r => headers.map(h => String((r as any)[h] ?? ""))),
      startY: 20, styles: { fontSize: 7 },
    });
    doc.save(`${test.title}-analytics.pdf`);
  };

  if (loading) return <div className="space-y-3"><Skeleton className="h-8 w-64" /><Skeleton className="h-40" /></div>;

  return (
    <div className="space-y-5">
      <DialogHeader>
        <DialogTitle>{test.title}</DialogTitle>
        <p className="text-xs text-muted-foreground">{test.subjects?.name}</p>
      </DialogHeader>

      {!attempts.length ? (
        <p className="py-8 text-center text-muted-foreground">No attempts yet for this test.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="Total Attempts" value={stats!.total} />
            <Stat label="Unique Users" value={stats!.unique} />
            <Stat label="Average Score" value={stats!.avg} />
            <Stat label="Highest" value={stats!.high} />
            <Stat label="Lowest" value={stats!.low} />
            <Stat label="Avg Accuracy" value={`${stats!.accuracy}%`} />
            <Stat label="Avg Time" value={fmtTime(stats!.time)} />
            <Stat label="Pass %" value={`${stats!.pass}%`} />
            <Stat label="Fail %" value={`${stats!.fail}%`} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={exportCSV}><Download className="mr-1 h-4 w-4" />CSV</Button>
            <Button size="sm" variant="outline" onClick={exportXLSX}><FileSpreadsheet className="mr-1 h-4 w-4" />Excel</Button>
            <Button size="sm" variant="outline" onClick={exportPDF}><FileText className="mr-1 h-4 w-4" />PDF</Button>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 py-3">
              <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" /> Participants ({participants.length})</CardTitle>
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="score_desc">Highest Score</SelectItem>
                  <SelectItem value="score_asc">Lowest Score</SelectItem>
                  <SelectItem value="latest">Latest Attempt</SelectItem>
                  <SelectItem value="fastest">Fastest Time</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">User</th><th className="p-2 text-left">Date</th>
                    <th className="p-2">#</th><th className="p-2">Score</th><th className="p-2">C</th>
                    <th className="p-2">I</th><th className="p-2">S</th><th className="p-2">Acc</th><th className="p-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map(a => (
                    <tr key={a.id} onClick={() => setUserDetail(a.user_id)} className="cursor-pointer border-t hover:bg-muted/30">
                      <td className="p-2">
                        <p className="font-medium">{names[a.user_id] || "-"}</p>
                        <p className="text-xs text-muted-foreground">{emails[a.user_id] || "-"}</p>
                      </td>
                      <td className="p-2 text-xs">{fmtDate(a.created_at)}</td>
                      <td className="p-2 text-center">{a.attempt_no}</td>
                      <td className="p-2 text-center font-semibold">{Number(a.marks_obtained)}</td>
                      <td className="p-2 text-center text-green-600">{a.correct_count}</td>
                      <td className="p-2 text-center text-red-600">{a.incorrect_count}</td>
                      <td className="p-2 text-center text-muted-foreground">{a.skipped_count ?? a.unattempted_count}</td>
                      <td className="p-2 text-center">{a.accuracy}%</td>
                      <td className="p-2 text-center text-xs">{fmtTime(a.time_taken_seconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3"><CardTitle className="text-base">Question Analytics</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2">Q#</th><th className="p-2 text-left">Question</th>
                    <th className="p-2">Correct%</th><th className="p-2">Wrong%</th><th className="p-2">Skip%</th>
                    <th className="p-2">Most</th><th className="p-2">Difficulty</th>
                  </tr>
                </thead>
                <tbody>
                  {questionAnalytics.map(q => (
                    <tr key={q.q_no} className="border-t">
                      <td className="p-2 text-center">{q.q_no}</td>
                      <td className="p-2"><span className="line-clamp-2">{q.text}</span></td>
                      <td className="p-2 text-center text-green-600">{q.correct_pct}%</td>
                      <td className="p-2 text-center text-red-600">{q.wrong_pct}%</td>
                      <td className="p-2 text-center text-muted-foreground">{q.skipped_pct}%</td>
                      <td className="p-2 text-center">{q.most}</td>
                      <td className="p-2 text-center">
                        <Badge variant={q.difficulty === "Easy" ? "secondary" : q.difficulty === "Medium" ? "default" : "destructive"}>
                          {q.difficulty}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={!!userDetail} onOpenChange={o => !o && setUserDetail(null)}>
        <DialogContent className="max-w-2xl">
          {userDetail && (
            <UserHistoryPanel
              attempts={attempts.filter(a => a.user_id === userDetail)}
              name={names[userDetail] || "-"}
              email={emails[userDetail] || "-"}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UserHistoryPanel({ attempts, name, email }: { attempts: Attempt[]; name: string; email: string }) {
  const sorted = [...attempts].sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const marks = sorted.map(a => Number(a.marks_obtained));
  const avg = marks.length ? (marks.reduce((a,b)=>a+b,0)/marks.length).toFixed(1) : "0";
  const best = marks.length ? Math.max(...marks) : 0;
  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>{name}</DialogTitle>
        <p className="text-xs text-muted-foreground">{email}</p>
      </DialogHeader>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Attempts" value={sorted.length} />
        <Stat label="Average" value={avg} />
        <Stat label="Best" value={best} />
      </div>
      <div className="max-h-80 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr><th className="p-2">#</th><th className="p-2 text-left">Date</th><th className="p-2">Score</th><th className="p-2">Acc</th><th className="p-2">Time</th></tr>
          </thead>
          <tbody>
            {sorted.map((a, i) => (
              <tr key={a.id} className="border-t">
                <td className="p-2 text-center">{i+1}</td>
                <td className="p-2 text-xs">{fmtDate(a.created_at)}</td>
                <td className="p-2 text-center font-medium">{Number(a.marks_obtained)}</td>
                <td className="p-2 text-center">{a.accuracy}%</td>
                <td className="p-2 text-center text-xs">{fmtTime(a.time_taken_seconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className="text-xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
