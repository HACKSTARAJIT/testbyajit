import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Play } from "lucide-react";
import { PracticeRunner } from "@/components/PracticeRunner";
import { PracticeHistory } from "@/components/PracticeHistory";
import { loadAttempts, type AttemptRow, type PracticeQuestion } from "@/lib/revisionPractice";
import {
  ACTION_LABEL, findAction, loadActionPlan, loadActionQuestions, markActionCompleted,
  priorityOf, type ActionItem,
} from "@/lib/mockActionPlan";

export default function MockMistakesActionPractice() {
  const { actionKey = "" } = useParams();
  const key = decodeURIComponent(actionKey);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [action, setAction] = useState<ActionItem | null>(null);
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const sourceKey = `action:${key}`;

  const load = async () => {
    if (!user) { setLoading(false); return; }
    const row = await loadActionPlan(user.id);
    const item = findAction(row?.plan ?? null, key);
    setAction(item);
    const [qs, at] = await Promise.all([
      loadActionQuestions(item?.question_ids ?? []),
      loadAttempts(user.id, "mock_mistakes", sourceKey),
    ]);
    setQuestions(qs);
    setAttempts(at);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user, key]);

  if (loading) {
    return <div className="space-y-3"><Skeleton className="h-32 rounded-3xl" /><Skeleton className="h-48 rounded-2xl" /></div>;
  }

  const p = priorityOf(action?.priority);

  return (
    <div className="space-y-4 animate-fade-in">
      <Button
        variant="ghost"
        size="sm"
        onClick={running ? () => setRunning(false) : () => navigate("/mock-mistakes/action-plan")}
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> {running ? "Action" : "Action Plan"}
      </Button>

      {!user || !action || questions.length === 0 ? (
        <div className="glass-card rounded-3xl p-10 text-center text-muted-foreground">
          इस action के प्रश्न अभी उपलब्ध नहीं हैं। Action Plan दोबारा बनाएँ।
        </div>
      ) : running ? (
        <PracticeRunner
          key={attempts.length}
          userId={user.id}
          source="mock_mistakes"
          sourceKey={sourceKey}
          title={action.title}
          subject={action.subject}
          chapter={action.chapter}
          questions={questions}
          onExit={() => { setRunning(false); load(); }}
          onFinished={async () => { await markActionCompleted(user.id, action); load(); }}
        />
      ) : (
        <>
          <div className="rounded-3xl bg-gradient-royal p-6 text-white shadow-lg">
            <p className="text-xs text-white/75">
              {p.dot} {action.subject} · {action.chapter} → {action.topic}
            </p>
            <h1 className="font-display text-xl font-bold">{action.title}</h1>
            <p className="text-sm text-white/85">
              {questions.length} imported प्रश्न · {ACTION_LABEL[action.action_type] ?? "अभ्यास"}
            </p>
          </div>

          {action.why && (
            <div className="glass-card rounded-2xl p-4 text-sm">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">क्यों?</p>
              <p className="leading-relaxed">{action.why}</p>
            </div>
          )}

          <Button className="w-full rounded-2xl" onClick={() => setRunning(true)}>
            <Play className="mr-1 h-4 w-4" /> {attempts.length ? "फिर से अभ्यास करें" : "अभ्यास शुरू करें"}
          </Button>

          <PracticeHistory attempts={attempts} />
        </>
      )}
    </div>
  );
}
