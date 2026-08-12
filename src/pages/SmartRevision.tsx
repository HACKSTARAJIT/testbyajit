import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, ChevronRight, NotebookPen, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export default function SmartRevision() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [wrongCount, setWrongCount] = useState<number | null>(null);
  const [mockCount, setMockCount] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const [wq, mm] = await Promise.all([
        supabase
          .from("wrong_questions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "pending")
          .is("source_report_id", null),
        supabase
          .from("mock_mistake_questions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);
      setWrongCount(wq.count ?? 0);
      setMockCount(mm.count ?? 0);
    })();
  }, [user]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-royal p-6 text-white shadow-lg">
        <Brain className="absolute -right-4 -top-4 h-28 w-28 opacity-15" />
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/20 p-3 backdrop-blur-sm"><Brain className="h-7 w-7" /></div>
          <div>
            <h1 className="font-display text-2xl font-bold">🧠 Smart Revision</h1>
            <p className="text-sm text-white/85">दो अलग systems — App Test mistakes और Imported Mock mistakes</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          onClick={() => navigate("/smart-revision/wrong")}
          className="btn-ripple relative flex min-h-[190px] w-full flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br from-rose-600 via-red-600 to-orange-500 p-6 text-left text-white shadow-lg transition-transform hover:scale-[1.01]"
        >
          <XCircle className="absolute -right-6 -bottom-6 h-32 w-32 opacity-15" />
          <div>
            <p className="text-xl font-bold">❌ Wrong Questions</p>
            <p className="mt-1 text-xs text-white/85">
              PRACTICE WITH AJIT App Tests में जो questions wrong या skip हुए
            </p>
          </div>
          <div className="relative">
            <p className="font-display text-4xl font-extrabold">
              {wrongCount ?? "—"}
            </p>
            <p className="text-xs text-white/85">Active Questions</p>
          </div>
          <div className="relative flex items-center gap-1 text-sm font-semibold">
            OPEN <ChevronRight className="h-4 w-4" />
          </div>
        </button>

        <button
          onClick={() => navigate("/mock-mistakes")}
          className="btn-ripple relative flex min-h-[190px] w-full flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-6 text-left text-white shadow-lg transition-transform hover:scale-[1.01]"
        >
          <NotebookPen className="absolute -right-6 -bottom-6 h-32 w-32 opacity-15" />
          <div>
            <p className="text-xl font-bold">📝 Mock Mistakes</p>
            <p className="mt-1 text-xs text-white/85">
              External Mock Tests से manually imported questions
            </p>
          </div>
          <div className="relative">
            <p className="font-display text-4xl font-extrabold">
              {mockCount ?? "—"}
            </p>
            <p className="text-xs text-white/85">Imported Questions</p>
          </div>
          <div className="relative flex items-center gap-1 text-sm font-semibold">
            OPEN <ChevronRight className="h-4 w-4" />
          </div>
        </button>
      </div>
    </div>
  );
}
