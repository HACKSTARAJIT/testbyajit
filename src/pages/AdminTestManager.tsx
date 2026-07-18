import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, ArrowUp, ArrowDown, BarChart3, ChevronRight, Copy, Download,
  Eye, FileText, History, Loader2, Pencil, Plus, Search, Sparkles, Trash2,
  ClipboardList, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

// ============================================================
//  Types
// ============================================================

type Test = {
  id: string; title: string; description: string | null;
  subject_id: string | null; chapter_id: string | null;
  duration_minutes: number; total_marks: number | null; total_questions: number | null;
  is_published: boolean; created_at: string; updated_at: string;
  subjects?: { name: string } | null; chapters?: { name: string } | null;
};

type Question = {
  id: string; test_id: string; sort_order: number;
  question_text: string;
  option_a: string; option_b: string; option_c: string; option_d: string;
  correct_option: string;
  explanation: string | null;
  marks: number; negative_marks: number | null;
  topic: string | null; subtopic: string | null; difficulty: string | null;
  chapter_id: string | null;
  question_image_url: string | null;
  attachments: any;
};

type Subject = { id: string; name: string };
type Chapter = { id: string; name: string; subject_id: string };

// ============================================================
//  Root — decides list vs detail
// ============================================================

export default function AdminTestManager() {
  const { testId } = useParams();
  return testId ? <TestEditor testId={testId} /> : <TestList />;
}

// ============================================================
//  LIST VIEW
// ============================================================

type ListRow = Test & {
  attempts_count: number;
  avg_score: number | null;
  question_count: number;
};

function TestList() {
  const [rows, setRows] = useState<ListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: tests }, { data: subs }, { data: qCounts }, { data: attempts }] = await Promise.all([
      supabase.from("tests")
        .select("id,title,description,subject_id,chapter_id,duration_minutes,total_marks,total_questions,is_published,created_at,updated_at,subjects(name),chapters(name)")
        .order("updated_at", { ascending: false }),
      supabase.from("subjects").select("id,name").order("name"),
      supabase.from("questions").select("test_id"),
      supabase.from("test_attempts").select("test_id,marks_obtained,total_marks,status").eq("status", "completed"),
    ]);

    const qMap = new Map<string, number>();
    (qCounts ?? []).forEach((q: any) => qMap.set(q.test_id, (qMap.get(q.test_id) ?? 0) + 1));

    const aMap = new Map<string, { count: number; sum: number; totalSum: number }>();
    (attempts ?? []).forEach((a: any) => {
      const cur = aMap.get(a.test_id) ?? { count: 0, sum: 0, totalSum: 0 };
      cur.count += 1;
      cur.sum += Number(a.marks_obtained ?? 0);
      cur.totalSum += Number(a.total_marks ?? 0);
      aMap.set(a.test_id, cur);
    });

    setSubjects((subs as any) ?? []);
    setRows(((tests as any[]) ?? []).map((t) => {
      const a = aMap.get(t.id);
      return {
        ...t,
        question_count: qMap.get(t.id) ?? t.total_questions ?? 0,
        attempts_count: a?.count ?? 0,
        avg_score: a && a.totalSum > 0 ? Math.round((a.sum / a.totalSum) * 100) : null,
      };
    }));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (subjectFilter !== "all" && r.subject_id !== subjectFilter) return false;
      if (statusFilter === "published" && !r.is_published) return false;
      if (statusFilter === "draft" && r.is_published) return false;
      if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [rows, search, subjectFilter, statusFilter]);

  async function duplicateTest(t: Test) {
    const { data: srcQ } = await supabase.from("questions").select("*").eq("test_id", t.id).order("sort_order");
    const { data: newTest, error } = await supabase.from("tests").insert({
      title: `${t.title} (Copy)`, description: t.description,
      subject_id: t.subject_id, chapter_id: t.chapter_id,
      duration_minutes: t.duration_minutes, total_marks: t.total_marks,
      total_questions: t.total_questions, is_published: false,
    }).select("id").single();
    if (error || !newTest) { toast.error(error?.message ?? "Duplicate failed"); return; }
    if (srcQ && srcQ.length) {
      const rows = srcQ.map(({ id, created_at, updated_at, embedding, embedded_at, ...q }: any) => ({
        ...q, test_id: newTest.id,
      }));
      await supabase.from("questions").insert(rows);
    }
    toast.success("Test duplicated");
    load();
  }

  async function deleteTest(t: Test) {
    if (!confirm(`Delete "${t.title}" and all its questions? This cannot be undone.`)) return;
    const { error } = await supabase.from("tests").delete().eq("id", t.id);
    if (error) toast.error(error.message);
    else { toast.success("Test deleted"); load(); }
  }

  async function togglePublish(t: Test) {
    const { error } = await supabase.from("tests").update({ is_published: !t.is_published }).eq("id", t.id);
    if (error) toast.error(error.message);
    else load();
  }

  async function exportTest(t: Test) {
    const { data: qs } = await supabase.from("questions").select("*").eq("test_id", t.id).order("sort_order");
    const header = ["S.No","Question","Option A","Option B","Option C","Option D","Correct","Marks","Neg","Topic","Difficulty","Explanation"];
    const rows = (qs ?? []).map((q: any, i: number) => [
      i + 1, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
      q.correct_option, q.marks, q.negative_marks ?? 0, q.topic ?? "", q.difficulty ?? "", q.explanation ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) =>
      `"${String(c ?? "").replace(/"/g, '""').replace(/\n/g, " ")}"`
    ).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${t.title.replace(/[^\w-]+/g, "_")}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-2">
        <Link to="/admin"><Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" /> Admin</Button></Link>
      </div>

      <div className="rounded-3xl bg-gradient-royal p-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/20 p-3"><ClipboardList className="h-6 w-6" /></div>
          <div>
            <h1 className="text-2xl font-bold font-display">🧪 Test Management</h1>
            <p className="text-sm text-white/85">Edit, maintain and improve every published online test.</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search test name…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={subjectFilter} onValueChange={setSubjectFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" className="ml-auto">{filtered.length} tests</Badge>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-3xl p-10 text-center text-muted-foreground">No tests match your filters.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <div key={t.id} className="glass-card rounded-2xl p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{t.title}</p>
                    <Badge variant={t.is_published ? "default" : "secondary"} className="text-[10px]">
                      {t.is_published ? "Published" : "Draft"}
                    </Badge>
                    {t.subjects?.name && <Badge variant="outline" className="text-[10px]">{t.subjects.name}</Badge>}
                    {t.chapters?.name && <Badge variant="outline" className="text-[10px]">{t.chapters.name}</Badge>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>❓ {t.question_count} Qs</span>
                    <span>🎯 {t.total_marks ?? "—"} marks</span>
                    <span>⏱ {t.duration_minutes} min</span>
                    <span>👥 {t.attempts_count} attempts</span>
                    <span>📈 Avg {t.avg_score != null ? `${t.avg_score}%` : "—"}</span>
                    <span>📅 {new Date(t.created_at).toLocaleDateString()}</span>
                    <span>🔄 {new Date(t.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Link to={`/test/${t.id}`}><Button size="sm" variant="outline" title="Preview as student"><Eye className="h-4 w-4" /></Button></Link>
                  <Link to={`/admin/tests/${t.id}`}><Button size="sm" title="Edit"><Pencil className="mr-1 h-4 w-4" />Edit</Button></Link>
                  <Link to="/admin/analytics"><Button size="sm" variant="outline" title="Analytics"><BarChart3 className="h-4 w-4" /></Button></Link>
                  <Button size="sm" variant="outline" title="Duplicate" onClick={() => duplicateTest(t)}><Copy className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" title="Export CSV" onClick={() => exportTest(t)}><Download className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" title={t.is_published ? "Unpublish" : "Publish"} onClick={() => togglePublish(t)}>
                    {t.is_published ? "🔒" : "🚀"}
                  </Button>
                  <Button size="sm" variant="ghost" title="Delete" onClick={() => deleteTest(t)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
//  EDITOR VIEW
// ============================================================

function TestEditor({ testId }: { testId: string }) {
  const { user } = useAuth();
  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [diffFilter, setDiffFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewQ, setPreviewQ] = useState<Question | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: t }, { data: qs }, { data: subs }, { data: chaps }] = await Promise.all([
      supabase.from("tests").select("*,subjects(name),chapters(name)").eq("id", testId).maybeSingle(),
      supabase.from("questions").select("*").eq("test_id", testId).order("sort_order"),
      supabase.from("subjects").select("id,name").order("name"),
      supabase.from("chapters").select("id,name,subject_id").order("name"),
    ]);
    setTest(t as any); setQuestions((qs as any) ?? []);
    setSubjects((subs as any) ?? []); setChapters((chaps as any) ?? []);
    setLoading(false);
  }, [testId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return questions.filter((q, i) => {
      if (diffFilter !== "all" && (q.difficulty ?? "").toLowerCase() !== diffFilter) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      if (String(i + 1) === s) return true;
      return [q.question_text, q.topic, q.subtopic, q.difficulty, q.explanation]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(s));
    });
  }, [questions, search, diffFilter]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function selectAll() {
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((q) => q.id)));
  }

  async function logHistory(action: string, question_id: string | null, changed_fields: string[], diff: any) {
    if (!user) return;
    await supabase.from("test_edit_history").insert({
      test_id: testId, question_id, edited_by: user.id, action, changed_fields, diff,
    });
  }

  async function saveQuestion(orig: Question, updated: Partial<Question>) {
    const validation = validateQuestion({ ...orig, ...updated });
    if (validation.blocking.length) {
      toast.error(validation.blocking.join(" • "));
      return false;
    }
    if (validation.warnings.length) {
      if (!confirm(`AI found issues:\n\n• ${validation.warnings.join("\n• ")}\n\nSave anyway?`)) return false;
    }
    const changed: string[] = [];
    const diff: any = {};
    (Object.keys(updated) as (keyof Question)[]).forEach((k) => {
      if ((orig as any)[k] !== (updated as any)[k]) {
        changed.push(k as string);
        diff[k] = { from: (orig as any)[k], to: (updated as any)[k] };
      }
    });
    if (!changed.length) { setEditingId(null); return true; }
    const { error } = await supabase.from("questions").update(updated as any).eq("id", orig.id);
    if (error) { toast.error(error.message); return false; }
    await logHistory("update", orig.id, changed, diff);
    toast.success("Question updated");
    setEditingId(null); await load();
    return true;
  }

  async function addQuestion() {
    const nextOrder = questions.length ? Math.max(...questions.map((q) => q.sort_order)) + 1 : 0;
    const { data, error } = await supabase.from("questions").insert({
      test_id: testId,
      question_text: "New question — click edit to fill in.",
      option_a: "A", option_b: "B", option_c: "C", option_d: "D",
      correct_option: "A", marks: 1, sort_order: nextOrder,
    }).select("id").single();
    if (error || !data) { toast.error(error?.message ?? "Add failed"); return; }
    await logHistory("create", data.id, [], {});
    toast.success("Question added");
    load(); setEditingId(data.id);
  }

  async function deleteQuestion(q: Question) {
    if (!confirm("Delete this question?")) return;
    await supabase.from("questions").delete().eq("id", q.id);
    await logHistory("delete", q.id, [], { question_text: q.question_text });
    toast.success("Deleted"); load();
  }

  async function duplicateQuestion(q: Question) {
    const nextOrder = (q.sort_order ?? 0) + 0.5;
    const { id, created_at, updated_at, embedding, embedded_at, ...rest }: any = q;
    const { data, error } = await supabase.from("questions").insert({
      ...rest, sort_order: nextOrder,
    }).select("id").single();
    if (error) { toast.error(error.message); return; }
    await logHistory("duplicate", data?.id ?? null, [], { source: q.id });
    await renumber();
    toast.success("Duplicated");
  }

  async function moveQuestion(q: Question, dir: -1 | 1) {
    const idx = questions.findIndex((x) => x.id === q.id);
    const swap = questions[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("questions").update({ sort_order: swap.sort_order }).eq("id", q.id),
      supabase.from("questions").update({ sort_order: q.sort_order }).eq("id", swap.id),
    ]);
    await logHistory("reorder", q.id, ["sort_order"], { from: q.sort_order, to: swap.sort_order });
    load();
  }

  async function renumber() {
    const sorted = [...questions].sort((a, b) => a.sort_order - b.sort_order);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].sort_order !== i) {
        await supabase.from("questions").update({ sort_order: i }).eq("id", sorted[i].id);
      }
    }
    load();
  }

  async function bulkDelete() {
    if (!selected.size) return;
    if (!confirm(`Delete ${selected.size} question(s)?`)) return;
    await supabase.from("questions").delete().in("id", [...selected]);
    await logHistory("bulk_delete", null, [], { count: selected.size, ids: [...selected] });
    setSelected(new Set()); toast.success("Deleted"); load();
  }
  async function bulkSet(field: "chapter_id" | "topic" | "difficulty", value: string) {
    if (!selected.size) return;
    await supabase.from("questions").update({ [field]: value || null } as any).in("id", [...selected]);
    await logHistory("bulk_update", null, [field], { count: selected.size, field, value });
    setSelected(new Set()); toast.success("Updated"); load();
  }

  async function runAIValidation() {
    setAiRunning(true);
    try {
      const { error } = await supabase.functions.invoke("analyze-test-questions", { body: { test_id: testId } });
      if (error) throw error;
      toast.success("AI validation started — refresh in a moment");
      setTimeout(load, 4000);
    } catch (e: any) { toast.error(e.message); } finally { setAiRunning(false); }
  }

  if (loading) return <div className="space-y-3"><Skeleton className="h-24 rounded-3xl" /><Skeleton className="h-40 rounded-2xl" /></div>;
  if (!test) return <div className="glass-card rounded-2xl p-6">Test not found.</div>;

  const subjChapters = chapters.filter((c) => c.subject_id === test.subject_id);

  return (
    <div className="space-y-5 animate-fade-in">
      <Link to="/admin/tests"><Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" /> All Tests</Button></Link>

      {/* Test header + metadata edit */}
      <TestHeaderCard test={test} subjects={subjects} chapters={chapters}
        onSaved={async (fields, diff) => { await logHistory("test_update", null, fields, diff); load(); }}
      />

      {/* Toolbar */}
      <div className="glass-card rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search # or keyword…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={diffFilter} onValueChange={setDiffFilter}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Difficulty</SelectItem>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={addQuestion}><Plus className="mr-1 h-4 w-4" />Add</Button>
          <Button size="sm" variant="outline" onClick={runAIValidation} disabled={aiRunning}>
            {aiRunning ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
            AI Validate
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowHistory(true)}><History className="mr-1 h-4 w-4" />History</Button>
        </div>

        {/* Bulk bar */}
        {selected.size > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 p-2">
            <Badge>{selected.size} selected</Badge>
            <Select onValueChange={(v) => bulkSet("chapter_id", v)}>
              <SelectTrigger className="h-8 w-[150px]"><SelectValue placeholder="Set chapter" /></SelectTrigger>
              <SelectContent>
                {subjChapters.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select onValueChange={(v) => bulkSet("difficulty", v)}>
              <SelectTrigger className="h-8 w-[140px]"><SelectValue placeholder="Set difficulty" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
            <BulkTopicInput onSubmit={(v) => bulkSet("topic", v)} />
            <Button size="sm" variant="destructive" onClick={bulkDelete}><Trash2 className="mr-1 h-4 w-4" />Delete</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
        <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={selectAll} />
        <span>Select all ({filtered.length} shown / {questions.length} total)</span>
      </div>

      {/* Questions list */}
      <div className="space-y-2">
        {filtered.map((q, i) => (
          <QuestionRow key={q.id} q={q} index={questions.indexOf(q)} totalCount={questions.length}
            selected={selected.has(q.id)}
            onToggleSelect={() => toggleSelect(q.id)}
            editing={editingId === q.id}
            onEdit={() => setEditingId(q.id)}
            onCancel={() => setEditingId(null)}
            onSave={(updated) => saveQuestion(q, updated)}
            onDelete={() => deleteQuestion(q)}
            onDuplicate={() => duplicateQuestion(q)}
            onMoveUp={() => moveQuestion(q, -1)}
            onMoveDown={() => moveQuestion(q, +1)}
            onPreview={() => setPreviewQ(q)}
            subjChapters={subjChapters}
          />
        ))}
      </div>

      {previewQ && <QuestionPreviewDialog q={previewQ} onClose={() => setPreviewQ(null)} />}
      {showHistory && <HistoryDialog testId={testId} onClose={() => setShowHistory(false)} />}

      <div className="glass-card rounded-2xl p-3 text-xs text-muted-foreground">
        <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          Live update: edits apply to all <strong className="mx-1">new</strong> attempts. Past attempt reports remain unchanged.
        </p>
      </div>
    </div>
  );
}

// ============================================================
//  Test header card
// ============================================================

function TestHeaderCard({
  test, subjects, chapters, onSaved,
}: {
  test: Test; subjects: Subject[]; chapters: Chapter[];
  onSaved: (fields: string[], diff: any) => void;
}) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({
    title: test.title, description: test.description ?? "",
    subject_id: test.subject_id ?? "", chapter_id: test.chapter_id ?? "",
    duration_minutes: test.duration_minutes, total_marks: test.total_marks ?? 0,
    is_published: test.is_published,
  });
  const subjChapters = chapters.filter((c) => c.subject_id === form.subject_id);

  async function save() {
    const payload = {
      title: form.title.trim(),
      description: form.description || null,
      subject_id: form.subject_id || null,
      chapter_id: form.chapter_id || null,
      duration_minutes: Number(form.duration_minutes) || 30,
      total_marks: Number(form.total_marks) || null,
      is_published: form.is_published,
    };
    const changed: string[] = []; const diff: any = {};
    Object.entries(payload).forEach(([k, v]) => {
      if ((test as any)[k] !== v) { changed.push(k); diff[k] = { from: (test as any)[k], to: v }; }
    });
    const { error } = await supabase.from("tests").update(payload).eq("id", test.id);
    if (error) return toast.error(error.message);
    toast.success("Test updated"); setEdit(false); onSaved(changed, diff);
  }

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="min-w-0">
          <CardTitle className="text-lg">{test.title}</CardTitle>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant={test.is_published ? "default" : "secondary"} className="text-[10px]">
              {test.is_published ? "Published" : "Draft"}
            </Badge>
            {test.subjects?.name && <span>📚 {test.subjects.name}</span>}
            {test.chapters?.name && <span>📖 {test.chapters.name}</span>}
            <span>⏱ {test.duration_minutes} min</span>
            <span>🎯 {test.total_marks ?? "—"} marks</span>
            <span>🔄 {new Date(test.updated_at).toLocaleString()}</span>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEdit((v) => !v)}>
          <Pencil className="mr-1 h-4 w-4" />{edit ? "Close" : "Edit"}
        </Button>
      </CardHeader>
      {edit && (
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <Label>Subject</Label>
            <Select value={form.subject_id} onValueChange={(v) => setForm({ ...form, subject_id: v, chapter_id: "" })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Chapter</Label>
            <Select value={form.chapter_id} onValueChange={(v) => setForm({ ...form, chapter_id: v })}>
              <SelectTrigger><SelectValue placeholder="General" /></SelectTrigger>
              <SelectContent>{subjChapters.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Duration (min)</Label>
            <Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: +e.target.value })} />
          </div>
          <div><Label>Total marks</Label>
            <Input type="number" value={form.total_marks} onChange={(e) => setForm({ ...form, total_marks: +e.target.value })} />
          </div>
          <div className="sm:col-span-2"><Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={form.is_published} onCheckedChange={(v) => setForm({ ...form, is_published: !!v })} />
            <span className="text-sm">Published</span>
          </div>
          <div className="flex justify-end sm:col-span-2"><Button size="sm" onClick={save}>Save</Button></div>
        </CardContent>
      )}
    </Card>
  );
}

// ============================================================
//  Question row (view + inline edit)
// ============================================================

function QuestionRow({
  q, index, totalCount, selected, editing, subjChapters,
  onToggleSelect, onEdit, onCancel, onSave, onDelete, onDuplicate, onMoveUp, onMoveDown, onPreview,
}: {
  q: Question; index: number; totalCount: number; selected: boolean; editing: boolean;
  subjChapters: Chapter[];
  onToggleSelect: () => void; onEdit: () => void; onCancel: () => void;
  onSave: (updated: Partial<Question>) => Promise<boolean>;
  onDelete: () => void; onDuplicate: () => void; onMoveUp: () => void; onMoveDown: () => void; onPreview: () => void;
}) {
  const [form, setForm] = useState<Question>({ ...q });
  useEffect(() => { setForm({ ...q }); }, [q, editing]);

  const issues = validateQuestion(form);

  return (
    <div className={`glass-card rounded-2xl p-3 ${selected ? "ring-2 ring-primary" : ""}`}>
      <div className="flex items-start gap-2">
        <Checkbox checked={selected} onCheckedChange={onToggleSelect} className="mt-1" />
        <Badge variant="outline" className="mt-0.5 shrink-0 text-[10px]">Q{index + 1}</Badge>
        <div className="min-w-0 flex-1">
          {!editing ? (
            <>
              <p className="line-clamp-2 text-sm font-medium">{q.question_text}</p>
              <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                <Badge variant="secondary">✓ {q.correct_option?.toUpperCase()}</Badge>
                {q.difficulty && <Badge variant="outline">{q.difficulty}</Badge>}
                {q.topic && <Badge variant="outline">{q.topic}</Badge>}
                <Badge variant="outline">+{q.marks} / −{q.negative_marks ?? 0}</Badge>
                {issues.blocking.length > 0 && (
                  <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{issues.blocking.length} error{issues.blocking.length > 1 ? "s" : ""}</Badge>
                )}
                {issues.warnings.length > 0 && (
                  <Badge className="gap-1 bg-amber-500 text-white"><AlertTriangle className="h-3 w-3" />{issues.warnings.length} warn</Badge>
                )}
              </div>
            </>
          ) : (
            <QuestionEditForm form={form} setForm={setForm} subjChapters={subjChapters} issues={issues} />
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap justify-end gap-1">
        {editing ? (
          <>
            <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button size="sm" onClick={() => onSave(form)}>Save</Button>
          </>
        ) : (
          <>
            <Button size="icon" variant="ghost" title="Move up" disabled={index === 0} onClick={onMoveUp}><ArrowUp className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" title="Move down" disabled={index === totalCount - 1} onClick={onMoveDown}><ArrowDown className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" title="Preview" onClick={onPreview}><Eye className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" title="Duplicate" onClick={onDuplicate}><Copy className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" title="Edit" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" title="Delete" onClick={onDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </>
        )}
      </div>
    </div>
  );
}

function QuestionEditForm({
  form, setForm, subjChapters, issues,
}: {
  form: Question; setForm: (q: Question) => void; subjChapters: Chapter[];
  issues: { blocking: string[]; warnings: string[] };
}) {
  return (
    <div className="space-y-2">
      <div><Label>Question</Label><Textarea rows={3} value={form.question_text} onChange={(e) => setForm({ ...form, question_text: e.target.value })} /></div>
      <div className="grid gap-2 sm:grid-cols-2">
        {(["a", "b", "c", "d"] as const).map((k) => (
          <div key={k}>
            <Label className="text-xs">Option {k.toUpperCase()}</Label>
            <Input value={(form as any)[`option_${k}`] ?? ""}
              onChange={(e) => setForm({ ...form, [`option_${k}`]: e.target.value } as any)} />
          </div>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        <div><Label className="text-xs">Correct</Label>
          <Select value={form.correct_option?.toLowerCase() ?? "a"} onValueChange={(v) => setForm({ ...form, correct_option: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["a", "b", "c", "d"].map((o) => <SelectItem key={o} value={o}>{o.toUpperCase()}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Marks</Label>
          <Input type="number" value={form.marks} onChange={(e) => setForm({ ...form, marks: +e.target.value })} />
        </div>
        <div><Label className="text-xs">Negative</Label>
          <Input type="number" step="0.25" value={form.negative_marks ?? 0} onChange={(e) => setForm({ ...form, negative_marks: +e.target.value })} />
        </div>
        <div><Label className="text-xs">Difficulty</Label>
          <Select value={form.difficulty ?? ""} onValueChange={(v) => setForm({ ...form, difficulty: v })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <div><Label className="text-xs">Chapter</Label>
          <Select value={form.chapter_id ?? ""} onValueChange={(v) => setForm({ ...form, chapter_id: v })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{subjChapters.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Topic</Label>
          <Input value={form.topic ?? ""} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
        </div>
        <div><Label className="text-xs">Subtopic</Label>
          <Input value={form.subtopic ?? ""} onChange={(e) => setForm({ ...form, subtopic: e.target.value })} />
        </div>
      </div>
      <div><Label className="text-xs">Explanation</Label>
        <Textarea rows={2} value={form.explanation ?? ""} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div><Label className="text-xs">Question image URL</Label>
          <Input value={form.question_image_url ?? ""} onChange={(e) => setForm({ ...form, question_image_url: e.target.value })} placeholder="https://…" />
        </div>
        <div><Label className="text-xs">Attachment URLs (comma-separated)</Label>
          <Input value={Array.isArray(form.attachments) ? form.attachments.join(", ") : ""} onChange={(e) => setForm({ ...form, attachments: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
        </div>
      </div>
      {(issues.blocking.length > 0 || issues.warnings.length > 0) && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2 text-xs">
          <div className="mb-1 flex items-center gap-1 font-semibold text-amber-600"><Sparkles className="h-3 w-3" /> AI Validation</div>
          <ul className="space-y-0.5">
            {issues.blocking.map((m, i) => <li key={`b${i}`} className="text-destructive">🚫 {m}</li>)}
            {issues.warnings.map((m, i) => <li key={`w${i}`}>⚠ {m}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================
//  Preview dialog
// ============================================================

function QuestionPreviewDialog({ q, onClose }: { q: Question; onClose: () => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Student Preview</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {q.question_image_url && <img src={q.question_image_url} alt="Question" className="w-full rounded-lg" />}
          <p className="whitespace-pre-wrap text-sm font-medium">{q.question_text}</p>
          <div className="space-y-2">
            {(["a", "b", "c", "d"] as const).map((k) => {
              const val = (q as any)[`option_${k}`];
              const isCorrect = q.correct_option?.toLowerCase() === k;
              const isPicked = picked === k;
              return (
                <button key={k} onClick={() => setPicked(k)}
                  className={`flex w-full items-start gap-2 rounded-xl border-2 p-3 text-left text-sm transition-colors ${
                    picked ? (isCorrect ? "border-emerald-500 bg-emerald-500/10" : isPicked ? "border-destructive bg-destructive/10" : "border-border")
                           : "border-border hover:border-primary"}`}>
                  <Badge variant="outline" className="text-xs">{k.toUpperCase()}</Badge>
                  <span className="flex-1">{val}</span>
                </button>
              );
            })}
          </div>
          {picked && q.explanation && (
            <div className="rounded-xl bg-muted p-3 text-sm">
              <p className="mb-1 font-semibold">Explanation</p>
              <p className="whitespace-pre-wrap">{q.explanation}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
//  History dialog
// ============================================================

function HistoryDialog({ testId, onClose }: { testId: string; onClose: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [emailMap, setEmailMap] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("test_edit_history")
        .select("*").eq("test_id", testId).order("created_at", { ascending: false }).limit(100);
      setRows(data ?? []);
      const userIds = [...new Set((data ?? []).map((r: any) => r.edited_by).filter(Boolean))];
      if (userIds.length) {
        try {
          const { data: emails } = await supabase.rpc("admin_get_user_emails", { _user_ids: userIds });
          const m: Record<string, string> = {};
          (emails ?? []).forEach((e: any) => { m[e.user_id] = e.email; });
          setEmailMap(m);
        } catch {}
      }
    })();
  }, [testId]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Edit History</DialogTitle></DialogHeader>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No edits recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="rounded-xl border p-3 text-xs">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{r.action}</Badge>
                  <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-muted-foreground">
                  by {emailMap[r.edited_by] ?? r.edited_by?.slice(0, 8) ?? "—"}
                  {r.question_id && <span> · Q{r.question_id.slice(0, 6)}</span>}
                </p>
                {r.changed_fields?.length > 0 && <p className="mt-1"><strong>Fields:</strong> {r.changed_fields.join(", ")}</p>}
                {r.diff && Object.keys(r.diff).length > 0 && (
                  <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-[10px]">{JSON.stringify(r.diff, null, 2)}</pre>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
//  AI Validation (client-side heuristics)
// ============================================================

function validateQuestion(q: Question): { blocking: string[]; warnings: string[] } {
  const blocking: string[] = []; const warnings: string[] = [];
  const opts = { a: q.option_a, b: q.option_b, c: q.option_c, d: q.option_d } as Record<string, string>;

  if (!q.question_text?.trim()) blocking.push("Question text missing");
  const correct = (q.correct_option ?? "").toLowerCase();
  if (!["a", "b", "c", "d"].includes(correct)) blocking.push("Correct answer must be A/B/C/D");
  Object.entries(opts).forEach(([k, v]) => { if (!v?.trim()) blocking.push(`Option ${k.toUpperCase()} missing`); });

  const trimmed = Object.entries(opts).map(([k, v]) => [k, (v ?? "").trim().toLowerCase()]);
  const seen = new Map<string, string>();
  for (const [k, v] of trimmed) {
    if (v && seen.has(v)) warnings.push(`Duplicate option: ${seen.get(v)?.toUpperCase()} = ${k.toUpperCase()}`);
    else if (v) seen.set(v, k);
  }
  if (correct && !opts[correct]?.trim()) blocking.push("Correct option is empty");

  if (q.question_text && /\?\?|�|\uFFFD/.test(q.question_text)) warnings.push("Possible OCR error in question text");
  if (q.question_text && q.question_text.length < 8) warnings.push("Question is very short");
  Object.entries(opts).forEach(([k, v]) => {
    if (v && /�|\uFFFD/.test(v)) warnings.push(`OCR error in option ${k.toUpperCase()}`);
  });
  if (/\[image\]|\bimg\b|\bfigure\b/i.test(q.question_text ?? "") && !q.question_image_url) {
    warnings.push("Question references an image but none attached");
  }
  if ((q.marks ?? 1) <= 0) warnings.push("Marks should be > 0");
  return { blocking, warnings };
}

// ============================================================
//  Small helpers
// ============================================================

function BulkTopicInput({ onSubmit }: { onSubmit: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="flex items-center gap-1">
      <Input className="h-8 w-[140px]" placeholder="Set topic" value={v} onChange={(e) => setV(e.target.value)} />
      <Button size="sm" variant="outline" onClick={() => { if (v.trim()) { onSubmit(v.trim()); setV(""); } }}>Apply</Button>
    </div>
  );
}
