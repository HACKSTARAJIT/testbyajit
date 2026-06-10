import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadFile, getSignedUrl, BUCKET } from "@/lib/storage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, BookOpen, Layers, FileText, ClipboardList, Loader2, Pencil, BarChart3, Smartphone } from "lucide-react";
import { toast } from "sonner";

export default function Admin() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [pdfs, setPdfs] = useState<any[]>([]);
  const [performance, setPerformance] = useState<any[]>([]);

  const load = async () => {
    const [s, c, t, p, perf] = await Promise.all([
      supabase.from("subjects").select("*").order("name"),
      supabase.from("chapters").select("*, subjects(name)").order("created_at"),
      supabase.from("tests").select("*, subjects(name)").order("created_at"),
      supabase.from("pdfs").select("*, subjects(name)").order("created_at"),
      supabase.from("performance").select("*, subjects(name)").order("created_at"),
    ]);
    setSubjects(s.data ?? []); setChapters(c.data ?? []); setTests(t.data ?? []); setPdfs(p.data ?? []); setPerformance(perf.data ?? []);
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
          <TabsTrigger value="performance"><BarChart3 className="mr-1 h-4 w-4" /> Results</TabsTrigger>
          <TabsTrigger value="app"><Smartphone className="mr-1 h-4 w-4" /> App (APK)</TabsTrigger>
        </TabsList>

        <TabsContent value="subjects" className="pt-4"><SubjectsTab subjects={subjects} reload={load} del={del} /></TabsContent>
        <TabsContent value="chapters" className="pt-4"><ChaptersTab subjects={subjects} chapters={chapters} reload={load} del={del} /></TabsContent>
        <TabsContent value="pdfs" className="pt-4"><PdfsTab subjects={subjects} chapters={chapters} pdfs={pdfs} reload={load} del={del} /></TabsContent>
        <TabsContent value="tests" className="pt-4"><TestsTab subjects={subjects} chapters={chapters} tests={tests} reload={load} del={del} /></TabsContent>
        <TabsContent value="performance" className="pt-4"><PerformanceTab subjects={subjects} chapters={chapters} performance={performance} reload={load} del={del} /></TabsContent>
        <TabsContent value="app" className="pt-4"><AppTab /></TabsContent>
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
  const [cover, setCover] = useState<File | null>(null);
  const [pinned, setPinned] = useState(false); const [popular, setPopular] = useState(false);
  const [busy, setBusy] = useState(false);
  const reset = () => { setName(""); setNameHi(""); setDesc(""); setCover(null); setPinned(false); setPopular(false); };
  const save = async () => {
    if (!name.trim()) return toast.error("Name required");
    setBusy(true);
    try {
      let coverUrl: string | null = null;
      if (cover) {
        const path = await uploadFile(cover, "covers");
        const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 3650);
        coverUrl = data?.signedUrl ?? null;
      }
      const { error } = await supabase.from("subjects").insert({
        name, name_hi: nameHi || null, description: desc || null,
        cover_image: coverUrl, is_pinned: pinned, is_popular: popular,
      } as any);
      if (error) throw error;
      toast.success("Added"); reset(); setOpen(false); reload();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const toggle = async (s: any, field: string) => {
    const { error } = await supabase.from("subjects").update({ [field]: !s[field] } as any).eq("id", s.id);
    if (error) toast.error(error.message); else reload();
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
            <div><Label>Cover Image (optional)</Label><Input type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] ?? null)} /></div>
            <div className="flex items-center justify-between rounded-lg border p-3"><Label>Pin to top</Label><Switch checked={pinned} onCheckedChange={setPinned} /></div>
            <div className="flex items-center justify-between rounded-lg border p-3"><Label>Mark as Popular</Label><Switch checked={popular} onCheckedChange={setPopular} /></div>
          </div>
          <DialogFooter><Button onClick={save} disabled={busy}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Save</Button></DialogFooter>
        </DialogContent></Dialog>
    </CardHeader>
    <CardContent className="space-y-2">
      {subjects.length === 0 && <p className="text-sm text-muted-foreground">No subjects yet.</p>}
      {subjects.map((s: any) => (
        <Row key={s.id} title={s.name} sub={s.name_hi} onDelete={() => del("subjects", s.id)}>
          <Button size="sm" variant={s.is_pinned ? "default" : "outline"} onClick={() => toggle(s, "is_pinned")}>Pin</Button>
          <Button size="sm" variant={s.is_popular ? "secondary" : "outline"} onClick={() => toggle(s, "is_popular")}>Popular</Button>
        </Row>
      ))}
    </CardContent></Card>
  );
}

function AppTab() {
  const [release, setRelease] = useState<any | null>(null);
  const [version, setVersion] = useState("1.0.0");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("app_release").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (data) { setRelease(data); setVersion(data.version ?? "1.0.0"); setNotes(data.notes ?? ""); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!version.trim()) return toast.error("Version required");
    setBusy(true);
    try {
      let file_path = release?.file_path ?? null;
      let file_size = release?.file_size ?? null;
      if (file) {
        file_path = await uploadFile(file, "apk", "app-releases");
        file_size = file.size;
      }
      const payload = { version, notes: notes || null, file_path, file_size } as any;
      const { error } = release
        ? await supabase.from("app_release").update(payload).eq("id", release.id)
        : await supabase.from("app_release").insert(payload);
      if (error) throw error;
      toast.success("App release updated"); setFile(null); load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Card><CardHeader><CardTitle className="text-lg">Android App (APK)</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div><Label>Version</Label><Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0.0" /></div>
        <div><Label>Release Notes (optional)</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div><Label>APK File {release?.file_path && "(upload to replace)"}</Label><Input type="file" accept=".apk,application/vnd.android.package-archive" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
        {release?.file_path && (
          <p className="text-xs text-muted-foreground">
            Current: {release.file_size ? `${(release.file_size / 1048576).toFixed(1)} MB` : "uploaded"} • Updated {new Date(release.updated_at).toLocaleString()}
          </p>
        )}
        <Button onClick={save} disabled={busy}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Save Release</Button>
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
      {pdfs.map((p: any) => (
        <Row key={p.id} title={p.title} sub={p.subjects?.name} onDelete={() => del("pdfs", p.id)}>
          <EditPdfDialog pdf={p} subjects={subjects} chapters={chapters} reload={reload} />
        </Row>
      ))}
    </CardContent></Card>
  );
}

function TestsTab({ subjects, chapters, tests, reload, del }: any) {
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState(""); const [chapterId, setChapterId] = useState("");
  const [parts, setParts] = useState<{ title: string; link: string }[]>([{ title: "Part 1", link: "" }]);
  const [busy, setBusy] = useState(false);
  const subjChapters = chapters.filter((c: any) => c.subject_id === subjectId);

  const setPart = (i: number, field: "title" | "link", value: string) =>
    setParts((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  const addPart = () => setParts((prev) => [...prev, { title: `Part ${prev.length + 1}`, link: "" }]);
  const removePart = (i: number) => setParts((prev) => prev.filter((_, idx) => idx !== i));
  const resetForm = () => { setParts([{ title: "Part 1", link: "" }]); setSubjectId(""); setChapterId(""); };

  const save = async () => {
    if (!subjectId) return toast.error("Subject required");
    const valid = parts.filter((p) => p.title.trim() && p.link.trim());
    if (valid.length === 0) return toast.error("Add at least one part with a title & link");
    setBusy(true);
    try {
      const { error } = await supabase.from("tests").insert(
        valid.map((p) => ({
          subject_id: subjectId, chapter_id: chapterId || null,
          title: p.title.trim(), test_link: p.link.trim(),
        }))
      );
      if (error) throw error;
      toast.success(`${valid.length} test part(s) added`);
      resetForm(); setOpen(false); reload();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Card><CardHeader className="flex-row items-center justify-between">
      <CardTitle className="text-lg">Practice Tests</CardTitle>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}><DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Add</Button></DialogTrigger>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto"><DialogHeader><DialogTitle>Add Test Parts</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Subject</Label><SubjectSelect subjects={subjects} value={subjectId} onChange={(v: string) => { setSubjectId(v); setChapterId(""); }} /></div>
            <div><Label>Chapter / Topic (optional)</Label>
              <Select value={chapterId} onValueChange={setChapterId}><SelectTrigger><SelectValue placeholder="General" /></SelectTrigger>
                <SelectContent>{subjChapters.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-3">
              <Label>Test Parts</Label>
              {parts.map((p, i) => (
                <div key={i} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Input className="flex-1" placeholder={`Part ${i + 1}`} value={p.title} onChange={(e) => setPart(i, "title", e.target.value)} />
                    {parts.length > 1 && (
                      <Button size="icon" variant="ghost" onClick={() => removePart(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    )}
                  </div>
                  <Input type="url" placeholder="https://... test link" value={p.link} onChange={(e) => setPart(i, "link", e.target.value)} />
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={addPart}><Plus className="mr-1 h-4 w-4" /> Add Part</Button>
            </div>
          </div>
          <DialogFooter><Button onClick={save} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button></DialogFooter>
        </DialogContent></Dialog>
    </CardHeader>
    <CardContent className="space-y-2">
      {tests.length === 0 && <p className="text-sm text-muted-foreground">No tests yet.</p>}
      {tests.map((t: any) => (
        <Row key={t.id} title={t.title} sub={t.subjects?.name} onDelete={() => del("tests", t.id)}>
          <EditTestDialog test={t} subjects={subjects} chapters={chapters} reload={reload} />
        </Row>
      ))}
    </CardContent></Card>
  );
}

function EditPdfDialog({ pdf, subjects, chapters, reload }: any) {
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState(pdf.subject_id ?? "");
  const [chapterId, setChapterId] = useState(pdf.chapter_id ?? "");
  const [title, setTitle] = useState(pdf.title);
  const [busy, setBusy] = useState(false);
  const subjChapters = chapters.filter((c: any) => c.subject_id === subjectId);
  const save = async () => {
    if (!subjectId || !title.trim()) return toast.error("Subject & title required");
    setBusy(true);
    const { error } = await supabase.from("pdfs").update({ subject_id: subjectId, chapter_id: chapterId || null, title }).eq("id", pdf.id);
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Updated"); setOpen(false); reload(); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent><DialogHeader><DialogTitle>Edit PDF</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Subject</Label><SubjectSelect subjects={subjects} value={subjectId} onChange={(v: string) => { setSubjectId(v); setChapterId(""); }} /></div>
          <div><Label>Chapter (optional)</Label>
            <Select value={chapterId} onValueChange={setChapterId}><SelectTrigger><SelectValue placeholder="General" /></SelectTrigger>
              <SelectContent>{subjChapters.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <p className="text-xs text-muted-foreground">To replace the file itself, delete and re-upload.</p>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditTestDialog({ test, subjects, chapters, reload }: any) {
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState(test.subject_id ?? "");
  const [chapterId, setChapterId] = useState(test.chapter_id ?? "");
  const [title, setTitle] = useState(test.title);
  const [testLink, setTestLink] = useState(test.test_link ?? "");
  const [desc, setDesc] = useState(test.description ?? "");
  const [busy, setBusy] = useState(false);
  const subjChapters = chapters.filter((c: any) => c.subject_id === subjectId);
  const save = async () => {
    if (!subjectId || !title.trim()) return toast.error("Subject & title required");
    if (!testLink.trim()) return toast.error("Test link required");
    setBusy(true);
    const { error } = await supabase.from("tests").update({
      subject_id: subjectId, chapter_id: chapterId || null, title,
      description: desc || null, test_link: testLink.trim(),
    }).eq("id", test.id);
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Updated"); setOpen(false); reload(); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent><DialogHeader><DialogTitle>Edit Test</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Subject</Label><SubjectSelect subjects={subjects} value={subjectId} onChange={(v: string) => { setSubjectId(v); setChapterId(""); }} /></div>
          <div><Label>Chapter / Topic (optional)</Label>
            <Select value={chapterId} onValueChange={setChapterId}><SelectTrigger><SelectValue placeholder="General" /></SelectTrigger>
              <SelectContent>{subjChapters.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>Test Link</Label><Input type="url" placeholder="https://..." value={testLink} onChange={(e) => setTestLink(e.target.value)} /></div>
          <div><Label>Description</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PerformanceForm({ subjects, chapters, subjectId, setSubjectId, chapterId, setChapterId, title, setTitle, text, setText, file, setFile, existingImage }: any) {
  const subjChapters = chapters.filter((c: any) => c.subject_id === subjectId);
  return (
    <div className="space-y-3">
      <div><Label>Subject</Label><SubjectSelect subjects={subjects} value={subjectId} onChange={(v: string) => { setSubjectId(v); setChapterId(""); }} /></div>
      <div><Label>Chapter / Topic (optional)</Label>
        <Select value={chapterId} onValueChange={setChapterId}><SelectTrigger><SelectValue placeholder="General (whole subject)" /></SelectTrigger>
          <SelectContent>{subjChapters.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
      </div>
      <div><Label>Title (optional)</Label><Input placeholder="e.g. Exam Performance 2025" value={title} onChange={(e: any) => setTitle(e.target.value)} /></div>
      <div><Label>Performance Text (optional)</Label>
        <Textarea rows={6} placeholder={"SSC MTS 2025 - 92%\nSSC CPO 2025 - 78%\nDelhi Police 2025 - 80%"} value={text} onChange={(e: any) => setText(e.target.value)} /></div>
      <div><Label>Result Image (optional)</Label>
        <Input type="file" accept="image/png,image/jpeg" onChange={(e: any) => setFile(e.target.files?.[0] ?? null)} />
        {existingImage && !file && <p className="mt-1 text-xs text-muted-foreground">An image is already attached. Choose a file to replace it.</p>}
      </div>
      <p className="text-xs text-muted-foreground">Add text, an image, or both.</p>
    </div>
  );
}

function PerformanceTab({ subjects, chapters, performance, reload, del }: any) {
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState(""); const [chapterId, setChapterId] = useState("");
  const [title, setTitle] = useState(""); const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false);
  const reset = () => { setSubjectId(""); setChapterId(""); setTitle(""); setText(""); setFile(null); };
  const save = async () => {
    if (!subjectId) return toast.error("Subject required");
    if (!text.trim() && !file) return toast.error("Add performance text or an image");
    setBusy(true);
    try {
      let imagePath: string | null = null;
      if (file) imagePath = await uploadFile(file, "performance");
      const { error } = await supabase.from("performance").insert({
        subject_id: subjectId, chapter_id: chapterId || null,
        title: title.trim() || null, text_content: text.trim() || null, image_path: imagePath,
      });
      if (error) throw error;
      toast.success("Added"); reset(); setOpen(false); reload();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <Card><CardHeader className="flex-row items-center justify-between">
      <CardTitle className="text-lg">Performance & Results</CardTitle>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}><DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Add</Button></DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Add Performance & Results</DialogTitle></DialogHeader>
          <PerformanceForm subjects={subjects} chapters={chapters} subjectId={subjectId} setSubjectId={setSubjectId} chapterId={chapterId} setChapterId={setChapterId} title={title} setTitle={setTitle} text={text} setText={setText} file={file} setFile={setFile} />
          <DialogFooter><Button onClick={save} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button></DialogFooter>
        </DialogContent></Dialog>
    </CardHeader>
    <CardContent className="space-y-2">
      {performance.length === 0 && <p className="text-sm text-muted-foreground">No performance entries yet.</p>}
      {performance.map((p: any) => (
        <Row key={p.id} title={p.title || (p.text_content ? p.text_content.split("\n")[0] : "Result image")} sub={p.subjects?.name} onDelete={() => del("performance", p.id)}>
          <EditPerformanceDialog item={p} subjects={subjects} chapters={chapters} reload={reload} />
        </Row>
      ))}
    </CardContent></Card>
  );
}

function EditPerformanceDialog({ item, subjects, chapters, reload }: any) {
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState(item.subject_id ?? "");
  const [chapterId, setChapterId] = useState(item.chapter_id ?? "");
  const [title, setTitle] = useState(item.title ?? "");
  const [text, setText] = useState(item.text_content ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!subjectId) return toast.error("Subject required");
    setBusy(true);
    try {
      let imagePath = item.image_path;
      if (file) imagePath = await uploadFile(file, "performance");
      const { error } = await supabase.from("performance").update({
        subject_id: subjectId, chapter_id: chapterId || null,
        title: title.trim() || null, text_content: text.trim() || null, image_path: imagePath,
      }).eq("id", item.id);
      if (error) throw error;
      toast.success("Updated"); setOpen(false); reload();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Edit Performance</DialogTitle></DialogHeader>
        <PerformanceForm subjects={subjects} chapters={chapters} subjectId={subjectId} setSubjectId={setSubjectId} chapterId={chapterId} setChapterId={setChapterId} title={title} setTitle={setTitle} text={text} setText={setText} file={file} setFile={setFile} existingImage={item.image_path} />
        <DialogFooter><Button onClick={save} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubjectSelect({ subjects, value, onChange }: any) {
  return (
    <Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
      <SelectContent>{subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
  );
}
