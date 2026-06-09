import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getSignedUrl } from "@/lib/storage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { FileText, ClipboardList, Download, Eye, ArrowLeft, BookOpen, Search, BarChart3 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function SubjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [subject, setSubject] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [pdfs, setPdfs] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [performance, setPerformance] = useState<any[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const [s, c, p, t, perf] = await Promise.all([
        supabase.from("subjects").select("*").eq("id", id).maybeSingle(),
        supabase.from("chapters").select("*").eq("subject_id", id).order("sort_order"),
        supabase.from("pdfs").select("*").eq("subject_id", id).order("created_at", { ascending: false }),
        supabase.from("tests").select("*").eq("subject_id", id).order("created_at", { ascending: false }),
        supabase.from("performance").select("*").eq("subject_id", id).order("created_at"),
      ]);
      setSubject(s.data); setChapters(c.data ?? []); setPdfs(p.data ?? []); setTests(t.data ?? []); setPerformance(perf.data ?? []);
    })();
  }, [id]);

  const recordView = async (chapterId: string) => {
    if (!user || !chapterId) return;
    await supabase.from("chapter_views").upsert(
      { user_id: user.id, chapter_id: chapterId, viewed_at: new Date().toISOString() },
      { onConflict: "user_id,chapter_id" }
    );
  };

  const openPdf = async (path: string) => {
    const url = await getSignedUrl(path);
    if (url) window.open(url, "_blank");
    else toast.error("Could not open file");
  };

  const downloadPdf = async (path: string, title: string) => {
    const url = await getSignedUrl(path);
    if (!url) return toast.error("Could not download file");
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${title}.${path.split(".").pop()}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, "_blank");
    }
  };

  const chapterPdfs = (chId: string) => pdfs.filter((p) => p.chapter_id === chId);
  const chapterTests = (chId: string) => tests.filter((t) => t.chapter_id === chId);
  const chapterPerformance = (chId: string) => performance.filter((p) => p.chapter_id === chId);
  const generalPdfs = pdfs.filter((p) => !p.chapter_id);
  const generalTests = tests.filter((t) => !t.chapter_id);
  const generalPerformance = performance.filter((p) => !p.chapter_id);

  const filteredChapters = chapters.filter((c) =>
    [c.name, c.name_hi].some((f) => f?.toLowerCase().includes(q.toLowerCase()))
  );

  if (!subject) return null;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm"><Link to="/subjects"><ArrowLeft className="mr-1 h-4 w-4" /> Subjects</Link></Button>

      <div className="rounded-2xl bg-gradient-primary p-6 text-primary-foreground shadow-md">
        <div className="flex items-center gap-3">
          <BookOpen className="h-8 w-8" />
          <div>
            <h1 className="text-2xl font-bold">{subject.name}</h1>
            {subject.name_hi && <p className="text-primary-foreground/90">{subject.name_hi}</p>}
          </div>
        </div>
        {subject.description && <p className="mt-2 text-sm text-primary-foreground/90">{subject.description}</p>}
      </div>

      {generalPerformance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><BarChart3 className="h-5 w-5 text-primary" /> Performance & Results</CardTitle>
          </CardHeader>
          <CardContent><PerformanceList items={generalPerformance} /></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="gap-3">
          <CardTitle className="text-lg">अध्याय / Chapters</CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search chapter... / अध्याय खोजें" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {filteredChapters.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No chapters found.</p>
          ) : (
            <Accordion type="single" collapsible className="w-full" onValueChange={(v) => v && recordView(v)}>
              {filteredChapters.map((ch) => (
                <AccordionItem key={ch.id} value={ch.id}>
                  <AccordionTrigger>
                    <span className="flex items-center gap-2 text-left">
                      {ch.name}
                      {ch.name_hi && <span className="text-sm text-muted-foreground">/ {ch.name_hi}</span>}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    {chapterPerformance(ch.id).length > 0 && (
                      <div className="space-y-2 rounded-lg bg-muted/40 p-3">
                        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><BarChart3 className="h-3.5 w-3.5" /> Performance & Results</p>
                        <PerformanceList items={chapterPerformance(ch.id)} />
                      </div>
                    )}
                    <MaterialList pdfs={chapterPdfs(ch.id)} tests={chapterTests(ch.id)} onOpen={openPdf} onDownload={downloadPdf} />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {(generalPdfs.length > 0 || generalTests.length > 0) && (
        <Card>
          <CardHeader><CardTitle className="text-lg">General Material</CardTitle></CardHeader>
          <CardContent><MaterialList pdfs={generalPdfs} tests={generalTests} onOpen={openPdf} onDownload={downloadPdf} /></CardContent>
        </Card>
      )}
    </div>
  );
}

function MaterialList({ pdfs, tests, onOpen, onDownload }: {
  pdfs: any[]; tests: any[]; onOpen: (p: string) => void; onDownload: (p: string, title: string) => void;
}) {
  if (pdfs.length === 0 && tests.length === 0)
    return <p className="text-sm text-muted-foreground">No material for this section yet.</p>;
  return (
    <div className="space-y-2">
      {pdfs.map((p) => (
        <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 shrink-0 text-secondary" />
            <span className="truncate text-sm font-medium">{p.title}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => onOpen(p.file_path)}><Eye className="mr-1 h-3 w-3" /> View</Button>
            <Button size="sm" variant="outline" onClick={() => onDownload(p.file_path, p.title)}><Download className="mr-1 h-3 w-3" /> Download</Button>
          </div>
        </div>
      ))}
      {tests.filter((t) => t.test_link).length > 0 && (
        <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Test Parts</p>
      )}
      {tests.filter((t) => t.test_link).map((t) => (
        <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
          <div className="flex items-center gap-2 min-w-0">
            <ClipboardList className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate text-sm font-medium">{t.title}</span>
          </div>
          <Button asChild size="sm">
            <a href={t.test_link} target="_blank" rel="noopener noreferrer">Start Test</a>
          </Button>
        </div>
      ))}
    </div>
  );
}

function PerformanceList({ items }: { items: any[] }) {
  return (
    <div className="space-y-3">
      {items.map((p) => (
        <PerformanceItem key={p.id} item={p} />
      ))}
    </div>
  );
}

function PerformanceItem({ item }: { item: any }) {
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (item.image_path) getSignedUrl(item.image_path).then(setUrl);
  }, [item.image_path]);

  return (
    <div className="rounded-lg border p-3">
      {item.title && <p className="mb-2 font-semibold">{item.title}</p>}
      {item.text_content && (
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">{item.text_content}</pre>
      )}
      {url && (
        <button type="button" onClick={() => setOpen(true)} className="mt-2 block w-full">
          <img src={url} alt={item.title || "Performance result"} className="w-full rounded-md border transition hover:opacity-90" loading="lazy" />
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] border-0 bg-transparent p-0 shadow-none sm:max-w-4xl">
          {url && <img src={url} alt={item.title || "Performance result"} className="max-h-[90vh] w-full rounded-md object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
