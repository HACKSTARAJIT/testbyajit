import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Play } from "lucide-react";
import { PracticeRunner } from "@/components/PracticeRunner";
import { PracticeHistory } from "@/components/PracticeHistory";
import {
  loadTopicPracticeQuestions, parseTopicRouteKey, topicSourceKey,
} from "@/lib/aiChapters";
import { loadAttempts, type AttemptRow, type PracticeQuestion } from "@/lib/revisionPractice";

export default function MockMistakesTopicTest() {
  const { subject = "", topicKey = "" } = useParams();
  const subjectName = decodeURIComponent(subject);
  const { chapter, topic } = parseTopicRouteKey(topicKey);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const autostart = Boolean((location.state as any)?.autostart);

  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(autostart);

  const sourceKey = topicSourceKey(subjectName, chapter, topic);

  const load = async () => {
    if (!user) { setLoading(false); return; }
    const [qs, at] = await Promise.all([
      loadTopicPracticeQuestions(user.id, subjectName, chapter, topic),
      loadAttempts(user.id, "mock_mistakes", sourceKey),
    ]);
    setQuestions(qs as PracticeQuestion[]);
    setAttempts(at);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user, subjectName, topicKey]);

  const back = () => navigate(`/mock-mistakes/${encodeURIComponent(subjectName)}`);

  if (loading) {
    return <div className="space-y-3"><Skeleton className="h-32 rounded-3xl" /><Skeleton className="h-48 rounded-2xl" /></div>;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={running ? () => setRunning(false) : back}>
        <ArrowLeft className="mr-1 h-4 w-4" /> {running ? "Topic" : subjectName}
      </Button>

      {!user || questions.length === 0 ? (
        <div className="glass-card rounded-3xl p-10 text-center text-muted-foreground">
          इस topic में अभी कोई classified question नहीं है।
        </div>
      ) : running ? (
        <PracticeRunner
          key={attempts.length}
          userId={user.id}
          source="mock_mistakes"
          sourceKey={sourceKey}
          title={`${chapter} · ${topic}`}
          subject={subjectName}
          chapter={chapter}
          questions={questions}
          onExit={() => { setRunning(false); load(); }}
          onFinished={load}
        />
      ) : (
        <>
          <div className="rounded-3xl bg-gradient-royal p-6 text-white shadow-lg">
            <p className="text-xs text-white/75">{subjectName} · {chapter}</p>
            <h1 className="font-display text-2xl font-bold">{topic}</h1>
            <p className="text-sm text-white/85">{questions.length} questions · Topic Practice Test</p>
          </div>
          <Button className="w-full rounded-2xl" onClick={() => setRunning(true)}>
            <Play className="mr-1 h-4 w-4" /> {attempts.length ? "Retake Practice" : "Start Practice"}
          </Button>
          <PracticeHistory attempts={attempts} />
        </>
      )}
    </div>
  );
}
