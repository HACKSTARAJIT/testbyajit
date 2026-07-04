import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getSignedUrl } from "@/lib/storage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { BookMarked, CheckCircle2, Trophy, Trash2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

type WQ = {
  id: string;
  test_id: string | null;
  subject_id: string | null;
  chapter_id: string | null;
  image_path: string | null;
  note: string | null;
  explanation: string | null;
  question_text: string | null;
  selected_option: string | null;
  correct_option: string | null;
  priority: "high" | "medium" | "low";
  status: "pending" | "revised" | "mastered";
  created_at: string;
  tests: { title: string } | null;
  subjects: { name: string } | null;
  chapters: { name: string } | null;
};

const PRIORITY_META: Record<string, { label: string; dot: string; rank: number }> = {
  high: { label: "🔴 High", dot: "bg-red-500", rank: 0 },
  medium: { label: "🟠 Medium", dot: "bg-orange-500", rank: 1 },
  low: { label: "🟢 Low", dot: "bg-green-500", rank: 2 },
};

export default function WrongQuestions() {
  const { user } = useAuth();
  const [rows, setRows] = useState<WQ[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState<string | null>(null);

  const [fSubject, setFSubject] = useState("all");
  const [fChapter, setFChapter] = useState("all");
  const [fPriority, setFPriority] = useState("all");
  const [fDate, setFDate] = useState("all");

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("wrong_questions")
      .select("*, tests(title), subjects(name), chapters(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    const list = (data as any as WQ[]) ?? [];
    setRows(list);
    setLoading(false);
    const entries = await Promise.all(
      list.filter((r) => r.image_path).map(async (r) => [r.image_path!, (await getSignedUrl(r.image_path!)) ?? ""] as const)
    );
    setUrls(Object.fromEntries(entries));
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: WQ["status"]) => {
    const { error } = await supabase.from("wrong_questions").update({ status }).eq("id", id);
    if (error) return toast.error("Could not update");
    toast.success(status === "mastered" ? "Marked as mastered!" : "Marked as revised!");
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("wrong_questions").delete().eq("id", id);
    if (error) return toast.error("Could not delete");
    setRows((rs) => rs.filter((r) => r.id !== id));
  };

  const subjects = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => r.subject_id && m.set(r.subject_id, r.subjects?.name ?? "Subject"));
    return [...m.entries()];
  }, [rows]);

  const chapters = useMemo(() => {
    const m = new Map<string, string>();
    rows.filter((r) => fSubject === "all" || r.subject_id === fSubject)
      .forEach((r) => r.chapter_id && m.set(r.chapter_id, r.chapters?.name ?? "Chapter"));
    return [...m.entries()];
  }, [rows, fSubject]);

  const now = Date.now();
  const dateOk = (r: WQ) => {
    if (fDate === "all") return true;
    const diff = now - +new Date(r.created_at);
    const day = 86400000;
    if (fDate === "7") return diff <= 7 * day;
    if (fDate === "30") return diff <= 30 * day;
    return true;
  };

  const applyFilters = (r: WQ) =>
    (fSubject === "all" || r.subject_id === fSubject) &&
    (fChapter === "all" || r.chapter_id === fChapter) &&
    (fPriority === "all" || r.priority === fPriority) &&
    dateOk(r);

  const active = rows.filter((r) => r.status !== "mastered");
  const mastered = rows.filter((r) => r.status === "mastered");

  const stats = {
    total: rows.length,
    pending: rows.filter((r) => r.status === "pending").length,
    mastered: mastered.length,
    high: active.filter((r) => r.priority === "high").length,
  };
  const counts = {
    high: active.filter((r) => r.priority === "high").length,
    medium: active.filter((r) => r.priority === "medium").length,
    low: active.filter((r) => r.priority === "low").length,
  };

  const revisionList = active
    .filter(applyFilters)
    .sort((a, b) => PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank);

  // Organization: subject -> chapter -> test
  const grouped = useMemo(() => {
    const tree: Record<string, { name: string; chapters: Record<string, { name: string; items: WQ[] }> }> = {};
    active.filter(applyFilters).forEach((r) => {
      const sKey = r.subject_id ?? "none";
      const sName = r.subjects?.name ?? "Unsorted";
      const cKey = r.chapter_id ?? "none";
      const cName = r.chapters?.name ?? r.tests?.title ?? "General";
      tree[sKey] ??= { name: sName, chapters: {} };
      tree[sKey].chapters[cKey] ??= { name: cName, items: [] };
      tree[sKey].chapters[cKey].items.push(r);
    });
    return tree;
  }, [active, fSubject, fChapter, fPriority, fDate]);

  if (loading) return <div className="grid gap-4 sm:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;

  const renderCard = (r: WQ) => (
    <Card key={r.id} className="overflow-hidden">
      {urls[r.image_path] ? (
        <button onClick={() => setZoom(urls[r.image_path])} className="block w-full">
          <img src={urls[r.image_path]} alt="wrong question" className="max-h-56 w-full object-contain bg-muted" />
        </button>
      ) : (
        <div className="flex h-40 items-center justify-center bg-muted"><ImageIcon className="h-8 w-8 text-muted-foreground" /></div>
      )}
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <span className={`h-2 w-2 rounded-full ${PRIORITY_META[r.priority].dot}`} />
            {PRIORITY_META[r.priority].label}
          </Badge>
          {r.subjects?.name && <Badge variant="secondary">{r.subjects.name}</Badge>}
          {r.tests?.title && <Badge variant="secondary">{r.tests.title}</Badge>}
          {r.status === "revised" && <Badge>Revised</Badge>}
          {r.status === "mastered" && <Badge className="bg-green-600">Mastered</Badge>}
        </div>
        {r.note && <p className="text-sm"><span className="font-medium">Note: </span>{r.note}</p>}
        {r.explanation && <p className="text-sm text-muted-foreground"><span className="font-medium">Explanation: </span>{r.explanation}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          {r.status !== "mastered" && (
            <>
              <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "revised")}>
                <CheckCircle2 className="mr-1 h-4 w-4" /> Mark as Revised
              </Button>
              <Button size="sm" onClick={() => updateStatus(r.id, "mastered")}>
                <Trophy className="mr-1 h-4 w-4" /> Mark as Mastered
              </Button>
            </>
          )}
          {r.status === "mastered" && (
            <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "pending")}>Move back to revision</Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BookMarked className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Wrong Questions Notebook</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total Saved" value={stats.total} />
        <Stat label="Pending Revision" value={stats.pending} />
        <Stat label="Mastered" value={stats.mastered} />
        <Stat label="High Priority" value={stats.high} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Quick Revision</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border p-3"><p className="text-xl font-bold">🔴 {counts.high}</p><p className="text-xs text-muted-foreground">High Priority</p></div>
          <div className="rounded-lg border p-3"><p className="text-xl font-bold">🟠 {counts.medium}</p><p className="text-xs text-muted-foreground">Medium Priority</p></div>
          <div className="rounded-lg border p-3"><p className="text-xl font-bold">🟢 {counts.low}</p><p className="text-xs text-muted-foreground">Low Priority</p></div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Select value={fSubject} onValueChange={(v) => { setFSubject(v); setFChapter("all"); }}>
          <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {subjects.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fChapter} onValueChange={setFChapter}>
          <SelectTrigger><SelectValue placeholder="Chapter" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Chapters</SelectItem>
            {chapters.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fPriority} onValueChange={setFPriority}>
          <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="high">🔴 High</SelectItem>
            <SelectItem value="medium">🟠 Medium</SelectItem>
            <SelectItem value="low">🟢 Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fDate} onValueChange={setFDate}>
          <SelectTrigger><SelectValue placeholder="Date" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="notebook">
        <TabsList>
          <TabsTrigger value="notebook">Notebook</TabsTrigger>
          <TabsTrigger value="revision">Revision Mode</TabsTrigger>
          <TabsTrigger value="mastered">Mastered ({mastered.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="notebook" className="mt-4 space-y-6">
          {Object.keys(grouped).length === 0 ? (
            <Empty />
          ) : (
            Object.entries(grouped).map(([sKey, s]) => (
              <div key={sKey} className="space-y-3">
                <h2 className="text-lg font-semibold">{s.name}</h2>
                {Object.entries(s.chapters).map(([cKey, c]) => (
                  <div key={cKey} className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      {c.name} → {c.items.length} Wrong Question{c.items.length !== 1 ? "s" : ""}
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{c.items.map(renderCard)}</div>
                  </div>
                ))}
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="revision" className="mt-4">
          {revisionList.length === 0 ? <Empty /> : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{revisionList.map(renderCard)}</div>
          )}
        </TabsContent>

        <TabsContent value="mastered" className="mt-4">
          {mastered.length === 0 ? <Empty text="No mastered questions yet." /> : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{mastered.map(renderCard)}</div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!zoom} onOpenChange={(o) => !o && setZoom(null)}>
        <DialogContent className="max-w-3xl p-2">
          {zoom && <img src={zoom} alt="question" className="max-h-[80vh] w-full object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className="text-2xl font-bold leading-none">{value}</p>
      <p className="mt-1.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Empty({ text = "No wrong questions saved yet. Save them from any test result." }: { text?: string }) {
  return (
    <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
      <BookMarked className="h-10 w-10" /><p>{text}</p>
    </CardContent></Card>
  );
}
