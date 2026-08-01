import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { PracticeRunner } from "@/components/PracticeRunner";
import { loadMockMistakePractice, type PracticeQuestion } from "@/lib/revisionPractice";

export default function MockMistakesTest() {
  const { subject = "", mockId = "" } = useParams();
  const subjectName = decodeURIComponent(subject);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [mockName, setMockName] = useState("Mock");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user) { setLoading(false); return; }
      const [{ data: mock }, qs] = await Promise.all([
        supabase.from("mock_mistake_mocks").select("name").eq("id", mockId).maybeSingle(),
        loadMockMistakePractice(mockId),
      ]);
      setMockName((mock as any)?.name ?? "Mock");
      setQuestions(qs);
      setLoading(false);
    })();
  }, [user, mockId]);

  const back = () => navigate(`/mock-mistakes/${encodeURIComponent(subjectName)}/${mockId}`);

  if (loading) return <div className="space-y-3"><Skeleton className="h-32 rounded-3xl" /><Skeleton className="h-48 rounded-2xl" /></div>;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={back}><ArrowLeft className="mr-1 h-4 w-4" /> {mockName}</Button>
      {!user || questions.length === 0 ? (
        <div className="glass-card rounded-3xl p-10 text-center text-muted-foreground">No questions imported yet.</div>
      ) : (
        <PracticeRunner
          userId={user.id}
          source="mock_mistakes"
          sourceKey={mockId}
          title={`${mockName} Practice`}
          subject={subjectName}
          questions={questions}
          onExit={back}
        />
      )}
    </div>
  );
}
