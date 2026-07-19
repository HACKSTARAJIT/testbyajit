import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchSyllabus, progressFor, logTimeline, openAllResources,
  STATUS_META, PRIORITY_META, RESOURCE_META,
  type SyllabusBundle, type SyllabusSubject, type SyllabusChapter, type SyllabusTopic,
  type SyllabusStatus, type SyllabusPriority, type TopicResource, type ResourceType,
} from "@/lib/syllabus";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  BookMarked, Plus, Search, Trash2, Pencil, Rocket, Sparkles, Loader2,
  ChevronRight, Calendar as CalendarIcon, Link as LinkIcon,
} from "lucide-react";

type Status = SyllabusStatus | "all";
type Prio = SyllabusPriority | "all";

const STATUS_OPTIONS: SyllabusStatus[] = ["not_started", "in_progress", "completed", "paused", "revision_pending"];
const PRIORITY_OPTIONS: SyllabusPriority[] = ["high", "medium", "low"];
const RESOURCE_TYPES: ResourceType[] = ["video", "pdf", "note", "practice_test", "smart_revision", "mock_hub", "ai_performance", "external"];

export default function SyllabusTracker() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [bundle, setBundle] = useState<SyllabusBundle>({ subjects: [], chapters: [], topics: [] });
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status>("all");
  const [prioFilter, setPrioFilter] = useState<Prio>("all");

  const [addSubjectOpen, setAddSubjectOpen] = useState(false);
  const [newSubject, setNewSubject] = useState("");

  const [chapterDialog, setChapterDialog] = useState<{ open: boolean; subjectId?: string; name: string }>({ open: false, name: "" });
  const [topicDialog, setTopicDialog] = useState<{ open: boolean; subjectId?: string; chapterId?: string; name: string }>({ open: false, name: "" });

  const [editingTopic, setEditingTopic] = useState<SyllabusTopic | null>(null);

  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState<any | null>(null);

  const reload = async () => {
    if (!user?.id) return;
    setLoading(true);
    setBundle(await fetchSyllabus(user.id));
    setLoading(false);
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [user?.id]);

  const overall = useMemo(() => progressFor(bundle.topics), [bundle.topics]);

  const filteredTopics = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return bundle.topics.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (prioFilter !== "all" && t.priority !== prioFilter) return false;
      if (!needle) return true;
      const chapter = bundle.chapters.find((c) => c.id === t.chapter_id);
      const subject = bundle.subjects.find((s) => s.id === t.subject_id);
      return [t.name, t.notes, chapter?.name, subject?.name].some((x) => (x ?? "").toLowerCase().includes(needle));
    });
  }, [bundle, q, statusFilter, prioFilter]);

  const visibleSubjectIds = new Set(filteredTopics.map((t) => t.subject_id));
  const showSubject = (s: SyllabusSubject) =>
    (q === "" && statusFilter === "all" && prioFilter === "all") || visibleSubjectIds.has(s.id);

  // -------- CRUD helpers --------
  async function addSubject() {
    if (!user?.id || !newSubject.trim()) return;
    const { error } = await supabase.from("syllabus_subjects").insert({ user_id: user.id, name: newSubject.trim() });
    if (error) return toast.error(error.message);
    setNewSubject(""); setAddSubjectOpen(false); toast.success("Subject added"); reload();
  }
  async function deleteSubject(s: SyllabusSubject) {
    if (!confirm(`Delete "${s.name}" and all its chapters & topics?`)) return;
    const { error } = await supabase.from("syllabus_subjects").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Subject deleted"); reload();
  }
  async function addChapter() {
    if (!user?.id || !chapterDialog.subjectId || !chapterDialog.name.trim()) return;
    const { error } = await supabase.from("syllabus_chapters").insert({
      user_id: user.id, subject_id: chapterDialog.subjectId, name: chapterDialog.name.trim(),
    });
    if (error) return toast.error(error.message);
    setChapterDialog({ open: false, name: "" }); toast.success("Chapter added"); reload();
  }
  async function deleteChapter(c: SyllabusChapter) {
    if (!confirm(`Delete chapter "${c.name}" and all its topics?`)) return;
    const { error } = await supabase.from("syllabus_chapters").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    reload();
  }
  async function addTopic() {
    if (!user?.id || !topicDialog.subjectId || !topicDialog.chapterId || !topicDialog.name.trim()) return;
    const { error } = await supabase.from("syllabus_topics").insert({
      user_id: user.id, subject_id: topicDialog.subjectId, chapter_id: topicDialog.chapterId, name: topicDialog.name.trim(),
    });
    if (error) return toast.error(error.message);
    setTopicDialog({ open: false, name: "" }); toast.success("Topic added"); reload();
  }
  async function deleteTopic(t: SyllabusTopic) {
    if (!confirm(`Delete topic "${t.name}"?`)) return;
    const { error } = await supabase.from("syllabus_topics").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    reload();
  }
  async function quickStatus(t: SyllabusTopic, status: SyllabusStatus) {
    const patch: any = { status, last_activity_at: new Date().toISOString() };
    if (status === "completed") patch.completed_at = new Date().toISOString();
    if (status === "revision_pending") patch.revision_count = (t.revision_count ?? 0) + 1;
    const { error } = await supabase.from("syllabus_topics").update(patch).eq("id", t.id);
    if (error) return toast.error(error.message);
    if (user?.id) await logTimeline(user.id, t, `status:${status}`);
    reload();
  }

  async function runAI() {
    if (!user?.id) return;
    setAiLoading(true); setAiOpen(true);
    const { data, error } = await supabase.functions.invoke("syllabus-ai", { body: { user_id: user.id } });
    setAiLoading(false);
    if (error) { toast.error(error.message); return; }
    setAiInsights(data);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-16">
      {/* Header */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/15 via-fuchsia-500/5 to-secondary/10">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/25">
                <BookMarked className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">📚 AI Syllabus Tracker</h1>
                <p className="text-xs text-muted-foreground">Your permanent preparation roadmap</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={runAI} className="gap-1">
                <Sparkles className="h-4 w-4" /> AJIT AI Insights
              </Button>
              <Dialog open={addSubjectOpen} onOpenChange={setAddSubjectOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-1"><Plus className="h-4 w-4" /> Subject</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add subject</DialogTitle></DialogHeader>
                  <Input placeholder="e.g. Maths, Reasoning, English"
                    value={newSubject} onChange={(e) => setNewSubject(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addSubject()} />
                  <DialogFooter><Button onClick={addSubject}>Add</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatBox label="Overall" value={`${overall.pct}%`} />
            <StatBox label="Completed" value={String(overall.completed)} />
            <StatBox label="In Progress" value={String(overall.in_progress)} />
            <StatBox label="Pending" value={String(overall.pending)} />
          </div>
          <Progress value={overall.pct} className="mt-4 h-2" />
        </CardContent>
      </Card>

      {/* Search + filters */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search subject, chapter, topic, notes…" className="pl-8" />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as Status)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_META[s].emoji} {STATUS_META[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={prioFilter} onValueChange={(v) => setPrioFilter(v as Prio)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p}>{PRIORITY_META[p].label}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Subjects */}
      {bundle.subjects.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <p className="text-muted-foreground">No subjects yet. Add your first subject to build your syllabus roadmap.</p>
            <Button className="mt-4 gap-1" onClick={() => setAddSubjectOpen(true)}>
              <Plus className="h-4 w-4" /> Add first subject
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {bundle.subjects.filter(showSubject).map((s) => (
            <SubjectCard
              key={s.id}
              subject={s}
              chapters={bundle.chapters.filter((c) => c.subject_id === s.id)}
              topics={filteredTopics.filter((t) => t.subject_id === s.id)}
              allTopics={bundle.topics.filter((t) => t.subject_id === s.id)}
              onAddChapter={() => setChapterDialog({ open: true, subjectId: s.id, name: "" })}
              onAddTopic={(chapterId) => setTopicDialog({ open: true, subjectId: s.id, chapterId, name: "" })}
              onDeleteSubject={() => deleteSubject(s)}
              onDeleteChapter={deleteChapter}
              onDeleteTopic={deleteTopic}
              onQuickStatus={quickStatus}
              onEditTopic={setEditingTopic}
            />
          ))}
        </div>
      )}

      {/* Chapter dialog */}
      <Dialog open={chapterDialog.open} onOpenChange={(open) => setChapterDialog((d) => ({ ...d, open }))}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add chapter</DialogTitle></DialogHeader>
          <Input placeholder="e.g. Arithmetic, Grammar" autoFocus
            value={chapterDialog.name}
            onChange={(e) => setChapterDialog((d) => ({ ...d, name: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && addChapter()} />
          <DialogFooter><Button onClick={addChapter}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Topic dialog */}
      <Dialog open={topicDialog.open} onOpenChange={(open) => setTopicDialog((d) => ({ ...d, open }))}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add topic</DialogTitle></DialogHeader>
          <Input placeholder="e.g. Synonyms 1–1700, Geometry Playlist" autoFocus
            value={topicDialog.name}
            onChange={(e) => setTopicDialog((d) => ({ ...d, name: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && addTopic()} />
          <DialogFooter><Button onClick={addTopic}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit topic */}
      <EditTopicDialog topic={editingTopic} onClose={() => setEditingTopic(null)} onSaved={reload} />

      {/* AI insights */}
      <AIInsightsDialog open={aiOpen} onOpenChange={setAiOpen} loading={aiLoading} data={aiInsights} />
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card/60 p-3 backdrop-blur">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function SubjectCard({
  subject, chapters, topics, allTopics,
  onAddChapter, onAddTopic, onDeleteSubject, onDeleteChapter, onDeleteTopic, onQuickStatus, onEditTopic,
}: {
  subject: SyllabusSubject;
  chapters: SyllabusChapter[];
  topics: SyllabusTopic[];
  allTopics: SyllabusTopic[];
  onAddChapter: () => void;
  onAddTopic: (chapterId: string) => void;
  onDeleteSubject: () => void;
  onDeleteChapter: (c: SyllabusChapter) => void;
  onDeleteTopic: (t: SyllabusTopic) => void;
  onQuickStatus: (t: SyllabusTopic, s: SyllabusStatus) => void;
  onEditTopic: (t: SyllabusTopic) => void;
}) {
  const p = progressFor(allTopics);
  return (
    <Card className="border-white/10 bg-card/60 backdrop-blur">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-bold">{subject.name}</h3>
            <p className="text-xs text-muted-foreground">
              {p.completed}/{p.total} topics • {p.in_progress} in progress • {p.pending} pending
            </p>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={onAddChapter} className="gap-1">
              <Plus className="h-4 w-4" /> Chapter
            </Button>
            <Button size="icon" variant="ghost" onClick={onDeleteSubject} aria-label="Delete subject">
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
        <Progress value={p.pct} className="mt-3 h-1.5" />

        {chapters.length === 0 ? (
          <p className="mt-4 text-center text-xs text-muted-foreground">No chapters yet.</p>
        ) : (
          <Accordion type="multiple" className="mt-3">
            {chapters.map((c) => {
              const cts = topics.filter((t) => t.chapter_id === c.id);
              const allCts = allTopics.filter((t) => t.chapter_id === c.id);
              const cp = progressFor(allCts);
              return (
                <AccordionItem key={c.id} value={c.id} className="border-white/10">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex flex-1 items-center justify-between pr-2">
                      <span className="text-sm font-medium">{c.name}</span>
                      <span className="text-xs text-muted-foreground">{cp.completed}/{cp.total} • {cp.pct}%</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-1.5">
                      {cts.length === 0 && (
                        <p className="text-xs text-muted-foreground">No matching topics.</p>
                      )}
                      {cts.map((t) => (
                        <TopicRow key={t.id} topic={t}
                          onQuickStatus={(s) => onQuickStatus(t, s)}
                          onEdit={() => onEditTopic(t)}
                          onDelete={() => onDeleteTopic(t)} />
                      ))}
                      <div className="flex justify-between pt-1">
                        <Button size="sm" variant="ghost" className="gap-1" onClick={() => onAddTopic(c.id)}>
                          <Plus className="h-3.5 w-3.5" /> Add topic
                        </Button>
                        <Button size="sm" variant="ghost" className="gap-1 text-muted-foreground"
                          onClick={() => onDeleteChapter(c)}>
                          <Trash2 className="h-3.5 w-3.5" /> Delete chapter
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}

function TopicRow({
  topic, onQuickStatus, onEdit, onDelete,
}: {
  topic: SyllabusTopic;
  onQuickStatus: (s: SyllabusStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const sm = STATUS_META[topic.status];
  const pm = PRIORITY_META[topic.priority];
  return (
    <div className="rounded-lg border border-white/5 bg-background/40 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{topic.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge className={sm.color} variant="outline">{sm.emoji} {sm.label}</Badge>
            <Badge className={pm.color} variant="outline">{pm.label}</Badge>
            {topic.target_date && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <CalendarIcon className="h-3 w-3" /> {topic.target_date}
              </span>
            )}
            {topic.resources.length > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <LinkIcon className="h-3 w-3" /> {topic.resources.length}
              </span>
            )}
          </div>
          {topic.notes && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">📝 {topic.notes}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          {topic.resources.length > 0 && (
            <Button size="icon" variant="ghost" onClick={() => openAllResources(topic.resources)} aria-label="Study now" title="Study now">
              <Rocket className="h-4 w-4 text-primary" />
            </Button>
          )}
          <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {STATUS_OPTIONS.map((s) => (
          <Button key={s} size="sm" variant={topic.status === s ? "default" : "outline"}
            className="h-6 px-2 text-[11px]" onClick={() => onQuickStatus(s)}>
            {STATUS_META[s].emoji}
          </Button>
        ))}
      </div>
    </div>
  );
}

function EditTopicDialog({
  topic, onClose, onSaved,
}: {
  topic: SyllabusTopic | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<SyllabusTopic | null>(topic);
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm(topic), [topic]);

  if (!form) return null;

  const setField = <K extends keyof SyllabusTopic>(k: K, v: SyllabusTopic[K]) => setForm({ ...form, [k]: v });

  async function save() {
    if (!form) return;
    setSaving(true);
    const patch: any = {
      name: form.name, status: form.status, priority: form.priority, notes: form.notes,
      target_date: form.target_date || null,
      estimated_hours: form.estimated_hours, estimated_classes: form.estimated_classes,
      estimated_pages: form.estimated_pages, estimated_revisions: form.estimated_revisions,
      resources: form.resources ?? [],
      last_activity_at: new Date().toISOString(),
    };
    if (form.status === "completed" && !form.completed_at) patch.completed_at = new Date().toISOString();
    const { error } = await supabase.from("syllabus_topics").update(patch).eq("id", form.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved"); onSaved(); onClose();
  }

  function addResource() {
    setForm({ ...form!, resources: [...(form!.resources ?? []), { id: crypto.randomUUID(), type: "video", label: "", url: "" }] });
  }
  function updateResource(id: string, patch: Partial<TopicResource>) {
    setForm({ ...form!, resources: form!.resources.map((r) => r.id === id ? { ...r, ...patch } : r) });
  }
  function removeResource(id: string) {
    setForm({ ...form!, resources: form!.resources.filter((r) => r.id !== id) });
  }

  return (
    <Dialog open={!!topic} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit topic</DialogTitle>
          <DialogDescription>Notes, targets, and linked study resources.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Name</label>
            <Input value={form.name} onChange={(e) => setField("name", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium">Status</label>
              <Select value={form.status} onValueChange={(v) => setField("status", v as SyllabusStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{STATUS_META[s].emoji} {STATUS_META[s].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Priority</label>
              <Select value={form.priority} onValueChange={(v) => setField("priority", v as SyllabusPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p}>{PRIORITY_META[p].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium">Notes</label>
            <Textarea rows={3} value={form.notes ?? ""} onChange={(e) => setField("notes", e.target.value)}
              placeholder="Watch again, weak topic, formula pending…" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium">Target date</label>
              <Input type="date" value={form.target_date ?? ""} onChange={(e) => setField("target_date", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium">Est. hours</label>
              <Input type="number" min={0} step={0.5} value={form.estimated_hours ?? ""} onChange={(e) => setField("estimated_hours", e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div>
              <label className="text-xs font-medium">Est. classes</label>
              <Input type="number" min={0} value={form.estimated_classes ?? ""} onChange={(e) => setField("estimated_classes", e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div>
              <label className="text-xs font-medium">Est. pages</label>
              <Input type="number" min={0} value={form.estimated_pages ?? ""} onChange={(e) => setField("estimated_pages", e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div>
              <label className="text-xs font-medium">Est. revisions</label>
              <Input type="number" min={0} value={form.estimated_revisions ?? ""} onChange={(e) => setField("estimated_revisions", e.target.value ? Number(e.target.value) : null)} />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium">🔗 Linked resources</label>
              <Button size="sm" variant="outline" onClick={addResource} className="gap-1"><Plus className="h-3 w-3" /> Add</Button>
            </div>
            <div className="space-y-2">
              {(form.resources ?? []).map((r) => (
                <div key={r.id} className="grid grid-cols-[110px_1fr_auto] gap-2">
                  <Select value={r.type} onValueChange={(v) => updateResource(r.id, { type: v as ResourceType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RESOURCE_TYPES.map((rt) => <SelectItem key={rt} value={rt}>{RESOURCE_META[rt].emoji} {RESOURCE_META[rt].label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-col gap-1">
                    <Input placeholder="Label" value={r.label} onChange={(e) => updateResource(r.id, { label: e.target.value })} />
                    <Input placeholder="URL or route (e.g. /smart-revision)" value={r.url} onChange={(e) => updateResource(r.id, { url: e.target.value })} />
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => removeResource(r.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              {(form.resources ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">No resources linked yet.</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AIInsightsDialog({
  open, onOpenChange, loading, data,
}: { open: boolean; onOpenChange: (b: boolean) => void; loading: boolean; data: any | null }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>🤖 AJIT AI • Syllabus Insights</DialogTitle>
          <DialogDescription>Gap detection, next study plan, readiness.</DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Analyzing your syllabus…
          </div>
        )}

        {!loading && data && (
          <div className="space-y-4 text-sm">
            {data.summary && <p className="rounded-lg bg-card/60 p-3">{data.summary}</p>}

            {Array.isArray(data.insights) && data.insights.length > 0 && (
              <Section title="📊 Insights">
                <ul className="space-y-1">{data.insights.map((x: string, i: number) => <li key={i}>• {x}</li>)}</ul>
              </Section>
            )}
            {Array.isArray(data.gaps) && data.gaps.length > 0 && (
              <Section title="⚠️ Gaps detected">
                <ul className="space-y-1">{data.gaps.map((x: string, i: number) => <li key={i}>• {x}</li>)}</ul>
              </Section>
            )}
            {Array.isArray(data.next_plan) && data.next_plan.length > 0 && (
              <Section title="🎯 Today's next study plan">
                <ol className="space-y-1">{data.next_plan.map((x: string, i: number) => <li key={i}>{i + 1}. {x}</li>)}</ol>
              </Section>
            )}
            {data.readiness && (
              <Section title="🚀 Readiness">
                <ul className="space-y-1">
                  <li>Syllabus completion: <b>{data.readiness.syllabus ?? 0}%</b></li>
                  <li>Subject readiness: <b>{data.readiness.subject ?? 0}%</b></li>
                  <li>Exam readiness: <b>{data.readiness.exam ?? 0}%</b></li>
                  <li>Selection readiness: <b>{data.readiness.selection ?? 0}%</b></li>
                </ul>
              </Section>
            )}
            {data.estimated && (
              <Section title="📅 Estimated completion">
                <p>{data.estimated.days_remaining ?? "—"} days • {data.estimated.weeks_remaining ?? "—"} weeks
                  {data.estimated.expected_date ? ` • by ${data.estimated.expected_date}` : ""}</p>
              </Section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/5 bg-card/60 p-3">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}
