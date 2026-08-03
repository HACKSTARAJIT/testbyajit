import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BookOpen, ChevronRight } from "lucide-react";

type Chapter = { id: string; name: string; name_hi?: string | null };

export default function SubjectDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [subject, setSubject] = useState<any>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [testCounts, setTestCounts] = useState<Record<string, number>>({});
  const [pdfCounts, setPdfCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [s, c, t, p] = await Promise.all([
        supabase.from("subjects").select("*").eq("id", id).maybeSingle(),
        supabase.from("chapters").select("id,name,name_hi").eq("subject_id", id).order("sort_order"),
        supabase.from("tests").select("chapter_id").eq("subject_id", id),
        supabase.from("pdfs").select("chapter_id").eq("subject_id", id),
      ]);
      setSubject(s.data);
      setChapters((c.data as any) ?? []);
      const tc: Record<string, number> = {};
      (t.data ?? []).forEach((x: any) => { const k = x.chapter_id ?? "general"; tc[k] = (tc[k] ?? 0) + 1; });
      const pc: Record<string, number> = {};
      (p.data ?? []).forEach((x: any) => { const k = x.chapter_id ?? "general"; pc[k] = (pc[k] ?? 0) + 1; });
      setTestCounts(tc);
      setPdfCounts(pc);
      setLoading(false);
    })();
  }, [id]);

  const items: Chapter[] = [
    ...chapters,
    ...((testCounts.general ?? 0) + (pdfCounts.general ?? 0) > 0
      ? [{ id: "general", name: "General", name_hi: "सामान्य" } as Chapter]
      : []),
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate("/subjects")}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Subjects
      </Button>

      <div>
        <h1 className="text-2xl font-bold">{subject?.name ?? "Subject"}</h1>
        {subject?.name_hi && <p className="text-muted-foreground">{subject.name_hi}</p>}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <BookOpen className="h-10 w-10" />
          <p>No chapters yet. Please check back soon!</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((ch) => (
            <Link key={ch.id} to={`/subjects/${id}/chapter/${ch.id}`}>
              <Card className="group h-full transition-shadow hover:shadow-md">
                <CardContent className="flex items-start gap-3 p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-primary">
                    <BookOpen className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="truncate font-semibold">{ch.name}</h3>
                      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                    </div>
                    {ch.name_hi && <p className="text-sm text-muted-foreground">{ch.name_hi}</p>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="secondary">{testCounts[ch.id] ?? 0} Tests</Badge>
                      <Badge variant="secondary">{pdfCounts[ch.id] ?? 0} PDFs</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
