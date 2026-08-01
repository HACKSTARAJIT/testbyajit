import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ListChecks, Play } from "lucide-react";
import { PracticeHistory } from "@/components/PracticeHistory";
import { loadAttempts, loadWrongQuestionPractice, type AttemptRow } from "@/lib/revisionPractice";

export default function SmartRevisionChapter() {
  const { subjectId = "", chapterId = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [chapterName, setChapterName] = useState("Chapter");
  const [count, setCount] = useState(0);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user) { setLoading(false); return; }
      const [chap, qs, att] = await Promise.all([
        chapterId === "none"
          ? Promise.resolve({ data: null })
          : supabase.from("chapters").select("name").eq("id", chapterId).maybeSingle(),
        loadWrongQuestionPractice(user.id, subjectId, chapterId),
        loadAttempts(user.id, "wrong_questions", `${subjectId}:${chapterId}`),
      ]);
      if ((chap as any)?.data?.name) setChapterName((chap as any).data.name);
      else if (chapterId === "none") setChapterName("General");
      setCount(qs.length);
      setAttempts(att);
      setLoading(false);
    })();
  }, [user, subjectId, chapterId]);

  if (loading) return <div className="space-y-3"><Skeleton className="h-32 rounded-3xl" /><Skeleton className="h-40 rounded-2xl" /></div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate(`/smart-revision/subject/${subjectId}`)}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Chapters
      </Button>

      <div className="rounded-3xl bg-gradient-exam p-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/20 p-3"><ListChecks className="h-6 w-6" /></div>
          <div>
            <h1 className="font-display text-2xl font-bold">{chapterName}</h1>
            <p className="text-sm text-white/85">{count} question{count !== 1 ? "s" : ""} · Practice Mode</p>
          </div>
        </div>
      </div>

      <Button
        className="w-full rounded-2xl"
        disabled={count === 0}
        onClick={() => navigate(`/smart-revision/subject/${subjectId}/chapter/${chapterId}/practice`)}
      >
        <Play className="mr-2 h-4 w-4" /> Start Practice Test
      </Button>
      {count === 0 && (
        <p className="text-center text-xs text-muted-foreground">इस chapter में अभी कोई pending mistake नहीं है।</p>
      )}

      <PracticeHistory attempts={attempts} />
    </div>
  );
}
