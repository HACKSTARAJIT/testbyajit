import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/lib/storage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { FileText, ClipboardList, Download, ArrowLeft, BookOpen } from "lucide-react";
import { toast } from "sonner";

export default function SubjectDetail() {
  const { id } = useParams();
  const [subject, setSubject] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [pdfs, setPdfs] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [s, c, p, t] = await Promise.all([
        supabase.from("subjects").select("*").eq("id", id).maybeSingle(),
        supabase.from("chapters").select("*").eq("subject_id", id).order("sort_order"),
        supabase.from("pdfs").select("*").eq("subject_id", id).order("created_at", { ascending: false }),
        supabase.from("tests").select("*").eq("subject_id", id).order("created_at", { ascending: false }),
      ]);
      setSubject(s.data); setChapters(c.data ?? []); setPdfs(p.data ?? []); setTests(t.data ?? []);
    })();
  }, [id]);

  const openPdf = async (path: string) => {
    const url = await getSignedUrl(path);
    if (url) window.open(url, "_blank");
    else toast.error("Could not open file");
  };

  const chapterPdfs = (chId: string) => pdfs.filter((p) => p.chapter_id === chId);
  const chapterTests = (chId: string) => tests.filter((t) => t.chapter_id === chId);
  const generalPdfs = pdfs.filter((p) => !p.chapter_id);
  const generalTests = tests.filter((t) => !t.chapter_id);

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

      <Card>
        <CardHeader><CardTitle className="text-lg">अध्याय / Chapters</CardTitle></CardHeader>
        <CardContent>
          {chapters.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No chapters added yet.</p>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {chapters.map((ch) => (
                <AccordionItem key={ch.id} value={ch.id}>
                  <AccordionTrigger>
                    <span className="flex items-center gap-2 text-left">
                      {ch.name}
                      {ch.name_hi && <span className="text-sm text-muted-foreground">/ {ch.name_hi}</span>}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2">
                    <MaterialList pdfs={chapterPdfs(ch.id)} tests={chapterTests(ch.id)} onOpen={openPdf} />
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
          <CardContent><MaterialList pdfs={generalPdfs} tests={generalTests} onOpen={openPdf} /></CardContent>
        </Card>
      )}
    </div>
  );
}

function MaterialList({ pdfs, tests, onOpen }: { pdfs: any[]; tests: any[]; onOpen: (p: string) => void; }) {
  if (pdfs.length === 0 && tests.length === 0)
    return <p className="text-sm text-muted-foreground">No material for this section yet.</p>;
  return (
    <div className="space-y-2">
      {pdfs.map((p) => (
        <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 shrink-0 text-secondary" />
            <span className="truncate text-sm font-medium">{p.title}</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => onOpen(p.file_path)}><Download className="mr-1 h-3 w-3" /> View</Button>
        </div>
      ))}
      {tests.map((t) => (
        <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
          <div className="flex items-center gap-2 min-w-0">
            <ClipboardList className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate text-sm font-medium">{t.title}</span>
            <Badge variant="secondary">{t.duration_minutes}m</Badge>
          </div>
          <Button asChild size="sm"><Link to={`/test/${t.id}`}>Start</Link></Button>
        </div>
      ))}
    </div>
  );
}
