import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CheckCircle2, FolderOpen, ListChecks, Play } from "lucide-react";
import { PracticeRunner } from "@/components/PracticeRunner";
import {
  APP_TEST_MASTERY_TARGET, loadTestQuestions, loadTestPracticeQuestions,
  loadChapterName, loadSubjectName, loadTestTitle,
  type MistakeQuestion,
} from "@/lib/appTestMistakes";
import type { PracticeQuestion } from "@/lib/revisionPractice";

/** ❌ App Test Mistakes — level 4 (Questions of one Test) + Practice. */
export default function AppTestMistakesTest() {
  const { subjectId = "", chapterId = "", testId = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<MistakeQuestion[]>([]);
  const [practiceQs, setPracticeQs] = useState<PracticeQuestion[]>([]);
  const [names, setNames] = useState({ subject: "", chapter: "Chapter", test: "App Test" });
  const [loading, setLoading] = useState(true);
  const [practising, setPractising] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const [qs, pqs, subject, chapter, test] = await Promise.all([
      loadTestQuestions(user.id, subjectId, chapterId, testId),
      loadTestPracticeQuestions(user.id, subjectId, chapterId, testId),
      loadSubjectName(subjectId),
      loadChapterName(chapterId),
      loadTestTitle(testId),
    ]);
    setRows(qs);
    setPracticeQs(pqs);
    setNames({ subject, chapter, test });
    setLoading(false);
  }, [user, subjectId, chapterId, testId]);

  useEffect(() => { load(); }, [load]);

  const back = () => navigate(`/app-test-mistakes/subject/${subjectId}/chapter/${chapterId}`);

  if (loading) {
    return <div className="space-y-3"><Skeleton className="h-32 rounded-3xl" /><Skeleton className="h-40 rounded-2xl" /></div>;
  }

  if (practising && user && practiceQs.length > 0) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => { setPractising(false); load(); }}>
          <ArrowLeft className="mr-1 h-4 w-4" /> {names.test}
        </Button>
        <PracticeRunner
          userId={user.id}
          source="wrong_questions"
          sourceKey={`${subjectId}:${chapterId}:${testId}`}
          title={`${names.test} — Mistake Practice`}
          subject={names.subject}
          chapter={names.chapter}
          questions={practiceQs}
          onExit={() => { setPractising(false); load(); }}
          onFinished={load}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={back}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Tests
      </Button>

      <div className="rounded-3xl bg-gradient-exam p-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/20 p-3"><ListChecks className="h-6 w-6" /></div>
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-bold">{names.test}</h1>
            <p className="text-sm text-white/85">
              {names.subject} → {names.chapter} · {rows.length} active question{rows.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      <Button
        className="w-full rounded-2xl"
        disabled={practiceQs.length === 0}
        onClick={() => setPractising(true)}
      >
        <Play className="mr-2 h-4 w-4" /> Start Practice ({practiceQs.length})
      </Button>

      {rows.length === 0 ? (
        <div className="glass-card rounded-3xl p-10 text-center text-muted-foreground">
          <FolderOpen className="mx-auto h-10 w-10" />
          <p className="mt-3 font-semibold">सारे questions mastered हो चुके हैं 🎉</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((q, i) => (
            <div key={q.id} className="glass-card space-y-2 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold">Question {i + 1}</p>
                <div className="flex shrink-0 items-center gap-1.5">
                  {q.is_skipped && <Badge variant="outline" className="text-[10px]">Skipped</Badge>}
                  <Badge variant="secondary" className="text-[10px]">
                    Correct practice: {q.practice_correct_count}/{APP_TEST_MASTERY_TARGET}
                  </Badge>
                </div>
              </div>
              {q.question_text && <p className="text-sm leading-relaxed">{q.question_text}</p>}
              <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                <p>आपका जवाब: <span className="font-medium text-red-500">{q.selected_option ?? "—"}</span></p>
                <p>सही जवाब: <span className="font-medium text-emerald-500">{q.correct_option ?? "—"}</span></p>
              </div>
              {q.explanation && (
                <p className="rounded-xl bg-muted/40 p-2 text-xs text-muted-foreground">{q.explanation}</p>
              )}
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5" /> Status: Active · {q.practice_attempts} practice attempt{q.practice_attempts !== 1 ? "s" : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
