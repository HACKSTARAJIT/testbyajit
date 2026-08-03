import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/lib/storage";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FileText, Eye, BookOpen } from "lucide-react";
import { toast } from "sonner";

export default function ChapterPdfs() {
  const { id = "", chapterId = "" } = useParams();
  const navigate = useNavigate();
  const [pdfs, setPdfs] = useState<any[]>([]);
  const [chapterName, setChapterName] = useState("Chapter");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let query = supabase.from("pdfs").select("*").eq("subject_id", id).order("created_at", { ascending: true });
      query = chapterId === "general" ? query.is("chapter_id", null) : query.eq("chapter_id", chapterId);
      const [p, c] = await Promise.all([
        query,
        chapterId === "general"
          ? Promise.resolve({ data: null } as any)
          : supabase.from("chapters").select("name").eq("id", chapterId).maybeSingle(),
      ]);
      setPdfs(p.data ?? []);
      setChapterName((c as any)?.data?.name ?? "General");
      setLoading(false);
    })();
  }, [id, chapterId]);

  const open = async (path: string) => {
    const url = await getSignedUrl(path);
    if (url) window.open(url, "_blank");
    else toast.error("Could not open file");
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate(`/subjects/${id}/chapter/${chapterId}`)}>
        <ArrowLeft className="mr-1 h-4 w-4" /> {chapterName}
      </Button>

      <h1 className="text-2xl font-bold">PDFs</h1>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : pdfs.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <FileText className="h-10 w-10" />
          <p>No PDFs in this chapter yet.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {pdfs.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-warm">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="truncate font-semibold">{p.title}</h3>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => open(p.file_path)}>
                    <Eye className="mr-1 h-4 w-4" /> Open
                  </Button>
                  <Button size="sm" onClick={() => open(p.file_path)}>
                    <BookOpen className="mr-1 h-4 w-4" /> Read
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
