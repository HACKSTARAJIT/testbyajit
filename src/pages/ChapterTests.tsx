import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { TestTracker, attemptStats, type Attempt } from "@/components/TestTracker";

export default function ChapterTests() {
  const { id = "", chapterId = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tests, setTests] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [chapterName, setChapterName] = useState("Chapter");
  const [loading, setLoading] = useState(true);

  const loadAttempts = async () => {
    if (!user) return;
    const { data } = await supabase.from("test_attempts").select("*").eq("user_id", user.id);
    setAttempts((data as any) ?? []);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      let query = supabase.from("tests").select("*").eq("subject_id", id).order("created_at", { ascending: true });
      query = chapterId === "general" ? query.is("chapter_id", null) : query.eq("chapter_id", chapterId);
      const [t, c] = await Promise.all([
        query,
        chapterId === "general"
          ? Promise.resolve({ data: null } as any)
          : supabase.from("chapters").select("name").eq("id", chapterId).maybeSingle(),
      ]);
      setTests(t.data ?? []);
      setChapterName((c as any)?.data?.name ?? "General");
      await loadAttempts();
      setLoading(false);
    })();
  }, [id, chapterId, user]);

  return (
    <div className="space-y-5 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate(`/subjects/${id}/chapter/${chapterId}`)}>
        <ArrowLeft className="mr-1 h-4 w-4" /> {chapterName}
      </Button>

      <h1 className="text-2xl font-bold">Tests</h1>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : tests.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <ClipboardList className="h-10 w-10" />
          <p>No tests in this chapter yet.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {tests.map((t) => {
            const mine = attempts.filter((a) => a.test_id === t.id);
            const s = attemptStats(mine);
            return (
              <Card key={t.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-primary">
                      <ClipboardList className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{t.title}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t.total_questions ? `${t.total_questions} Questions` : "Test"}
                        {s.count > 0 && <> · Last {s.last} · Best {s.best}</>}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 sm:w-40">
                    {t.test_link ? (
                      <TestTracker
                        test={{ id: t.id, title: t.title, test_link: t.test_link, subject_id: t.subject_id, chapter_id: t.chapter_id }}
                        attempts={mine}
                        onSaved={loadAttempts}
                        triggerClassName="w-full"
                      />
                    ) : (
                      <Button size="sm" className="w-full" asChild>
                        <Link to={`/test/${t.id}`}>{s.count > 0 ? "Retake" : "Start"}</Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
