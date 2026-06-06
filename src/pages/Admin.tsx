import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadFile } from "@/lib/storage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, BookOpen, Layers, FileText, ClipboardList, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

export default function Admin() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [pdfs, setPdfs] = useState<any[]>([]);

  const load = async () => {
    const [s, c, t, p] = await Promise.all([
      supabase.from("subjects").select("*").order("name"),
      supabase.from("chapters").select("*, subjects(name)").order("created_at"),
      supabase.from("tests").select("*, subjects(name)").order("created_at"),
      supabase.from("pdfs").select("*, subjects(name)").order("created_at"),
    ]);
    setSubjects(s.data ?? []); setChapters(c.data ?? []); setTests(t.data ?? []); setPdfs(p.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const del = async (table: string, id: string) => {
    const { error } = await supabase.from(table as any).delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage subjects, chapters, study material & tests.</p>
      </div>

      <Tabs defaultValue="subjects">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="subjects"><BookOpen className="mr-1 h-4 w-4" /> Subjects</TabsTrigger>
          <TabsTrigger value="chapters"><Layers className="mr-1 h-4 w-4" /> Chapters</TabsTrigger>
          <TabsTrigger value="pdfs"><FileText className="mr-1 h-4 w-4" /> PDFs</TabsTrigger>
          <TabsTrigger value="tests"><ClipboardList className="mr-1 h-4 w-4" /> Tests</TabsTrigger>
        </TabsList>

        <TabsContent value="subjects" className="pt-4"><SubjectsTab subjects={subjects} reload={load} del={del} /></TabsContent>
        <TabsContent value="chapters" className="pt-4"><ChaptersTab subjects={subjects} chapters={chapters} reload={load} del={del} /></TabsContent>
        <TabsContent value="pdfs" className="pt-4"><PdfsTab subjects={subjects} chapters={chapters} pdfs={pdfs} reload={load} del={del} /></TabsContent>
        <TabsContent value="tests" className="pt-4"><TestsTab subjects={subjects} chapters={chapters} tests={tests} reload={load} del={del} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ title, sub, onDelete, children }: any) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{title}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
      <div className="flex items-center gap-2">
        {children}
        <Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </div>
    </div>
  );
}

function SubjectsTab({ subjects, reload, del }: any) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [nameHi, setNameHi] = useState(""); const [desc, setDesc] = useState("");
  const save = async () => {
    if (!name.trim()) return toast.error("Name required");
    const { error } = await supabase.from("subjects").insert({ name, name_hi: nameHi || null, description: desc || null });
    if (error) toast.error(error.message); else { toast.success("Added"); setName(""); setNameHi(""); setDesc(""); setOpen(false); reload(); }
  };
  return (
    <Card><CardHeader className="flex-row items-center justify-between">
      <CardTitle className="text-lg">Subjects</CardTitle>
      <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Add</Button></DialogTrigger>
        <DialogContent><DialogHeader><DialogTitle>New Subject</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name (English)</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>Name (Hindi)</Label><Input value={nameHi} onChange={(e) => setNameHi(e.target.value)} /></div>
            <div><Label>Description</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          </div>
          <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent></Dialog>
    </CardHeader>
    <CardContent className="space-y-2">
      {subjects.length === 0 && <p className="text-sm text-muted-foreground">No subjects yet.</p>}
      {subjects.map((s: any) => <Row key={s.id} title={s.name} sub={s.name_hi} onDelete={() => del("subjects", s.id)} />)}
    </CardContent></Card>
  );
}

function ChaptersTab({ subjects, chapters, reload, del }: any) {
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState(""); const [name, setName] = useState(""); const [nameHi, setNameHi] = useState("");
  const save = async () => {
    if (!subjectId || !name.trim()) return toast.error("Subject & name required");
    const { error } = await supabase.from("chapters").insert({ subject_id: subjectId, name, name_hi: nameHi || null });
    if (error) toast.error(error.message); else { toast.success("Added"); setName(""); setNameHi(""); setOpen(false); reload(); }
  };
  return (
    <Card><CardHeader className="flex-row items-center justify-between">
      <CardTitle className="text-lg">Chapters</CardTitle>
      <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Add</Button></DialogTrigger>
        <DialogContent><DialogHeader><DialogTitle>New Chapter</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Subject</Label><SubjectSelect subjects={subjects} value={subjectId} onChange={setSubjectId} /></div>
            <div><Label>Name (English)</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>Name (Hindi)</Label><Input value={nameHi} onChange={(e) => setNameHi(e.target.value)} /></div>
          </div>
          <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent></Dialog>
    </CardHeader>
    <CardContent className="space-y-2">
      {chapters.length === 0 && <p className="text-sm text-muted-foreground">No chapters yet.</p>}
      {chapters.map((c: any) => <Row key={c.id} title={c.name} sub={c.subjects?.name} onDelete={() => del("chapters", c.id)} />)}
    </CardContent></Card>
  );
}

function PdfsTab({ subjects, chapters, pdfs, reload, del }: any) {
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState(""); const [chapterId, setChapterId] = useState("");
  const [title, setTitle] = useState(""); const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false);
  const subjChapters = chapters.filter((c: any) => c.subject_id === subjectId);
  const save = async () => {
    if (!subjectId || !title.trim() || !file) return toast.error("Subject, title & file required");
    setBusy(true);
    try {
      const path = await uploadFile(file);
      const { error } = await supabase.from("pdfs").insert({ subject_id: subjectId, chapter_id: chapterId || null, title, file_path: path });
      if (error) throw error;
      toast.success("Uploaded"); setTitle(""); setFile(null); setOpen(false); reload();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <Card><CardHeader className="flex-row items-center justify-between">
      <CardTitle className="text-lg">Study PDFs</CardTitle>
      <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Upload</Button></DialogTrigger>
        <DialogContent><DialogHeader><DialogTitle>Upload PDF / Notes</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Subject</Label><SubjectSelect subjects={subjects} value={subjectId} onChange={(v: string) => { setSubjectId(v); setChapterId(""); }} /></div>
            <div><Label>Chapter (optional)</Label>
              <Select value={chapterId} onValueChange={setChapterId}><SelectTrigger><SelectValue placeholder="General" /></SelectTrigger>
                <SelectContent>{subjChapters.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div><Label>File</Label><Input type="file" accept=".pdf,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
          </div>
          <DialogFooter><Button onClick={save} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Upload</Button></DialogFooter>
        </DialogContent></Dialog>
    </CardHeader>
    <CardContent className="space-y-2">
      {pdfs.length === 0 && <p className="text-sm text-muted-foreground">No PDFs yet.</p>}
      {pdfs.map((p: any) => <Row key={p.id} title={p.title} sub={p.subjects?.name} onDelete={() => del("pdfs", p.id)} />)}
    </CardContent></Card>
  );
}

function TestsTab({ subjects, chapters, tests, reload, del }: any) {
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState(""); const [chapterId, setChapterId] = useState("");
  const [title, setTitle] = useState(""); const [duration, setDuration] = useState("30"); const [desc, setDesc] = useState("");
  const [questions, setQuestions] = useState<any[]>([emptyQ()]);
  const [busy, setBusy] = useState(false);
  const subjChapters = chapters.filter((c: any) => c.subject_id === subjectId);

  function emptyQ() { return { question_text: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_option: "a", marks: 1 }; }
  const updateQ = (i: number, k: string, v: any) => setQuestions((qs) => qs.map((q, idx) => idx === i ? { ...q, [k]: v } : q));

  const save = async () => {
    if (!subjectId || !title.trim()) return toast.error("Subject & title required");
    const valid = questions.filter((q) => q.question_text.trim() && q.option_a && q.option_b);
    if (valid.length === 0) return toast.error("Add at least one complete question");
    setBusy(true);
    try {
      const { data, error } = await supabase.from("tests").insert({
        subject_id: subjectId, chapter_id: chapterId || null, title, description: desc || null, duration_minutes: Number(duration),
      }).select().single();
      if (error) throw error;
      const rows = valid.map((q, i) => ({ ...q, marks: Number(q.marks), test_id: data.id, sort_order: i }));
      const { error: qErr } = await supabase.from("questions").insert(rows);
      if (qErr) throw qErr;
      toast.success("Test created");
      setTitle(""); setDesc(""); setQuestions([emptyQ()]); setOpen(false); reload();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Card><CardHeader className="flex-row items-center justify-between">
      <CardTitle className="text-lg">Practice Tests</CardTitle>
      <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Create</Button></DialogTrigger>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Create Test with MCQs</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Subject</Label><SubjectSelect subjects={subjects} value={subjectId} onChange={(v: string) => { setSubjectId(v); setChapterId(""); }} /></div>
              <div><Label>Chapter (optional)</Label>
                <Select value={chapterId} onValueChange={setChapterId}><SelectTrigger><SelectValue placeholder="General" /></SelectTrigger>
                  <SelectContent>{subjChapters.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div><Label>Duration (min)</Label><Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
            </div>
            <div><Label>Description</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} /></div>

            <div className="space-y-3">
              <Label>Questions</Label>
              {questions.map((q, i) => (
                <div key={i} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">Q{i + 1}</Badge>
                    {questions.length > 1 && <Button size="icon" variant="ghost" onClick={() => setQuestions((qs) => qs.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </div>
                  <Textarea placeholder="Question text" value={q.question_text} onChange={(e) => updateQ(i, "question_text", e.target.value)} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    {["a", "b", "c", "d"].map((opt) => (
                      <Input key={opt} placeholder={`Option ${opt.toUpperCase()}`} value={q[`option_${opt}`]} onChange={(e) => updateQ(i, `option_${opt}`, e.target.value)} />
                    ))}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div><Label className="text-xs">Correct</Label>
                      <Select value={q.correct_option} onValueChange={(v) => updateQ(i, "correct_option", v)}><SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{["a", "b", "c", "d"].map((o) => <SelectItem key={o} value={o}>Option {o.toUpperCase()}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div><Label className="text-xs">Marks</Label><Input type="number" value={q.marks} onChange={(e) => updateQ(i, "marks", e.target.value)} /></div>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setQuestions((qs) => [...qs, emptyQ()])}><Plus className="mr-1 h-4 w-4" /> Add Question</Button>
            </div>
          </div>
          <DialogFooter><Button onClick={save} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create Test</Button></DialogFooter>
        </DialogContent></Dialog>
    </CardHeader>
    <CardContent className="space-y-2">
      {tests.length === 0 && <p className="text-sm text-muted-foreground">No tests yet.</p>}
      {tests.map((t: any) => <Row key={t.id} title={t.title} sub={`${t.subjects?.name ?? ""} • ${t.duration_minutes}m`} onDelete={() => del("tests", t.id)} />)}
    </CardContent></Card>
  );
}

function SubjectSelect({ subjects, value, onChange }: any) {
  return (
    <Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
      <SelectContent>{subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
  );
}
