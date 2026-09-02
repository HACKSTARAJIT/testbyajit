import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BookOpen, ChevronRight, FolderOpen } from "lucide-react";
import { loadChapters, loadSubjectName, type ChapterNode } from "@/lib/appTestMistakes";

/** ❌ App Test Mistakes — level 2 (Chapters of one Subject). */
export default function AppTestMistakesSubject() {
  const { subjectId = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [chapters, setChapters] = useState<ChapterNode[]>([]);
  const [subjectName, setSubjectName] = useState("Subject");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user) { setLoading(false); return; }
      const [c, name] = await Promise.all([loadChapters(user.id, subjectId), loadSubjectName(subjectId)]);
      setChapters(c);
      setSubjectName(name);
      setLoading(false);
    })();
  }, [user, subjectId]);

  return (
    <div className="space-y-5 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate("/app-test-mistakes")}>
        <ArrowLeft className="mr-1 h-4 w-4" /> App Test Mistakes
      </Button>

      <div className="rounded-3xl bg-gradient-royal p-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/20 p-3"><BookOpen className="h-6 w-6" /></div>
          <div>
            <h1 className="font-display text-2xl font-bold">{subjectName}</h1>
            <p className="text-sm text-white/85">Chapters with active mistakes</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : chapters.length === 0 ? (
        <div className="glass-card rounded-3xl p-10 text-center text-muted-foreground">
          <FolderOpen className="mx-auto h-10 w-10" />
          <p className="mt-3 font-semibold">कोई active chapter नहीं</p>
          <p className="mt-1 text-sm">इस subject की सारी mistakes mastered हो चुकी हैं। 🎉</p>
        </div>
      ) : (
        <div className="space-y-3">
          {chapters.map((c) => (
            <Link key={c.chapter_id} to={`/app-test-mistakes/subject/${subjectId}/chapter/${c.chapter_id}`}>
              <div className="btn-ripple glass-card flex items-center gap-4 rounded-2xl p-4 transition-transform hover:scale-[1.01]">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.name}</p>
                  {c.name_hi && <p className="truncate text-xs text-muted-foreground">{c.name_hi}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.active} active mistake{c.active !== 1 ? "s" : ""} · {c.tests} test{c.tests !== 1 ? "s" : ""}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
