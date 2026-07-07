import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ListChecks, Play, FolderOpen } from "lucide-react";
import { loadChapterRevisionTests, type RevisionTestRow } from "@/lib/smartRevision";

const GRADS = ["bg-gradient-royal", "bg-gradient-exam", "bg-gradient-warm", "bg-gradient-emerald", "bg-gradient-practice"];

export default function SmartRevisionChapter() {
  const { subjectId = "", chapterId = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tests, setTests] = useState<RevisionTestRow[]>([]);
  const [chapterName, setChapterName] = useState("Chapter");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user) { setLoading(false); return; }
      const [rt, chap] = await Promise.all([
        loadChapterRevisionTests(user.id, subjectId, chapterId),
        chapterId === "none"
          ? Promise.resolve({ data: null })
          : supabase.from("chapters").select("name").eq("id", chapterId).maybeSingle(),
      ]);
      setTests(rt);
      if ((chap as any)?.data?.name) setChapterName((chap as any).data.name);
      else if (chapterId === "none") setChapterName("General");
      setLoading(false);
    })();
  }, [user, subjectId, chapterId]);

  return (
    <div className="space-y-5 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate(`/smart-revision/subject/${subjectId}`)}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Chapters
      </Button>

      <div className="rounded-3xl bg-gradient-exam p-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/20 p-3"><ListChecks className="h-6 w-6" /></div>
          <div>
            <h1 className="text-2xl font-bold font-display">{chapterName}</h1>
            <p className="text-sm text-white/85">Auto-generated revision tests</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : tests.length === 0 ? (
        <div className="glass-card rounded-3xl p-10 text-center text-muted-foreground">
          <FolderOpen className="mx-auto h-10 w-10" />
          <p className="mt-3 font-semibold">No revision tests here</p>
          <p className="mt-1 text-sm">Attempt a test in this chapter to auto-generate one.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {tests.map((t, i) => (
            <div key={t.id} className={`relative overflow-hidden rounded-3xl ${GRADS[i % GRADS.length]} p-5 text-white shadow-md`}>
              <ListChecks className="absolute -right-3 -bottom-3 h-20 w-20 opacity-15" />
              <p className="text-xs font-medium uppercase tracking-wide text-white/80">Revision Test {i + 1}</p>
              <h3 className="mt-1 text-lg font-bold leading-tight">{t.title}</h3>
              <p className="mt-2 text-sm text-white/85">{t.question_count} question{t.question_count !== 1 ? "s" : ""}</p>
              <Button
                onClick={() => navigate(`/revise/${t.test_id}`)}
                className="btn-ripple mt-4 w-full bg-white/20 text-white hover:bg-white/30"
              >
                <Play className="mr-1 h-4 w-4" /> Attempt
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
