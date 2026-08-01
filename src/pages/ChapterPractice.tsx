import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { PracticeRunner } from "@/components/PracticeRunner";
import { loadWrongQuestionPractice, type PracticeQuestion } from "@/lib/revisionPractice";

export default function ChapterPractice() {
  const { subjectId = "", chapterId = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [chapterName, setChapterName] = useState("Chapter");
  const [subjectName, setSubjectName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user) { setLoading(false); return; }
      const [qs, chap, subj] = await Promise.all([
        loadWrongQuestionPractice(user.id, subjectId, chapterId),
        chapterId === "none"
          ? Promise.resolve({ data: null })
          : supabase.from("chapters").select("name").eq("id", chapterId).maybeSingle(),
        subjectId === "none"
          ? Promise.resolve({ data: null })
          : supabase.from("subjects").select("name").eq("id", subjectId).maybeSingle(),
      ]);
      setQuestions(qs);
      setChapterName((chap as any)?.data?.name ?? "General");
      setSubjectName((subj as any)?.data?.name ?? null);
      setLoading(false);
    })();
  }, [user, subjectId, chapterId]);

  const back = () => navigate(`/smart-revision/subject/${subjectId}/chapter/${chapterId}`);

  if (loading) return <div className="space-y-3"><Skeleton className="h-32 rounded-3xl" /><Skeleton className="h-48 rounded-2xl" /></div>;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={back}><ArrowLeft className="mr-1 h-4 w-4" /> {chapterName}</Button>
      {!user || questions.length === 0 ? (
        <div className="glass-card rounded-3xl p-10 text-center text-muted-foreground">
          इस chapter में practice के लिए कोई question नहीं है।
        </div>
      ) : (
        <PracticeRunner
          userId={user.id}
          source="wrong_questions"
          sourceKey={`${subjectId}:${chapterId}`}
          title={`${chapterName} Practice`}
          subject={subjectName}
          chapter={chapterName}
          questions={questions}
          onExit={back}
        />
      )}
    </div>
  );
}
