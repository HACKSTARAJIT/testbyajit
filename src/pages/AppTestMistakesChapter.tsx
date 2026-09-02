import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ChevronRight, ClipboardList, FolderOpen } from "lucide-react";
import { loadTests, loadChapterName, type TestNode } from "@/lib/appTestMistakes";

/** ❌ App Test Mistakes — level 3 (Tests inside one Chapter). */
export default function AppTestMistakesChapter() {
  const { subjectId = "", chapterId = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tests, setTests] = useState<TestNode[]>([]);
  const [chapterName, setChapterName] = useState("Chapter");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user) { setLoading(false); return; }
      const [t, name] = await Promise.all([
        loadTests(user.id, subjectId, chapterId),
        loadChapterName(chapterId),
      ]);
      setTests(t);
      setChapterName(name);
      setLoading(false);
    })();
  }, [user, subjectId, chapterId]);

  return (
    <div className="space-y-5 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate(`/app-test-mistakes/subject/${subjectId}`)}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Chapters
      </Button>

      <div className="rounded-3xl bg-gradient-exam p-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/20 p-3"><ClipboardList className="h-6 w-6" /></div>
          <div>
            <h1 className="font-display text-2xl font-bold">{chapterName}</h1>
            <p className="text-sm text-white/85">Tests जिनसे ये mistakes आई हैं</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : tests.length === 0 ? (
        <div className="glass-card rounded-3xl p-10 text-center text-muted-foreground">
          <FolderOpen className="mx-auto h-10 w-10" />
          <p className="mt-3 font-semibold">इस chapter में कोई active mistake नहीं</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tests.map((t) => (
            <Link
              key={t.test_id}
              to={`/app-test-mistakes/subject/${subjectId}/chapter/${chapterId}/test/${t.test_id}`}
            >
              <div className="btn-ripple glass-card flex items-center gap-4 rounded-2xl p-4 transition-transform hover:scale-[1.01]">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{t.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.active} mistake{t.active !== 1 ? "s" : ""}
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
