import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ChevronRight, NotebookPen } from "lucide-react";
import { MOCK_MISTAKE_SUBJECTS } from "@/lib/mockMistakes";

export default function MockMistakes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from("mock_mistake_mocks")
        .select("subject")
        .eq("user_id", user.id);
      const acc: Record<string, number> = {};
      (data ?? []).forEach((r: any) => { acc[r.subject] = (acc[r.subject] ?? 0) + 1; });
      setCounts(acc);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="space-y-5 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate("/smart-revision")}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Smart Revision
      </Button>

      <div className="rounded-3xl bg-gradient-royal p-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/20 p-3"><NotebookPen className="h-6 w-6" /></div>
          <div>
            <h1 className="font-display text-2xl font-bold">📝 Mock Mistakes</h1>
            <p className="text-sm text-white/85">Your private mistake notebook with mock tests</p>
          </div>
        </div>
      </div>

      <button
        onClick={() => navigate("/mock-mistakes/intelligence")}
        className="btn-ripple glass-card flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-transform hover:scale-[1.01]"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary text-2xl">🧠</div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">AJIT AI Intelligence</p>
          <p className="text-xs text-muted-foreground">
            आपकी असली गलतियों का गहरा विश्लेषण + व्यक्तिगत सलाह
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </button>

      <button
        onClick={() => navigate("/mock-mistakes/action-plan")}
        className="btn-ripple glass-card -mt-1 flex w-full items-center gap-4 rounded-2xl border border-primary/25 p-4 text-left transition-transform hover:scale-[1.01]"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary text-2xl">🎯</div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">ACTION PLAN</p>
          <p className="text-xs text-muted-foreground">
            अब मुझे क्या करना चाहिए? — आपकी गलतियों से बना अगला कदम
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </button>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : (
        <div className="space-y-3">
          {MOCK_MISTAKE_SUBJECTS.map((s) => (
            <button
              key={s.key}
              onClick={() => navigate(`/mock-mistakes/${encodeURIComponent(s.key)}`)}
              className="btn-ripple glass-card flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-transform hover:scale-[1.01]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary text-2xl">
                {s.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{s.key}</p>
                <p className="text-xs text-muted-foreground">
                  {counts[s.key] ?? 0} mock{(counts[s.key] ?? 0) !== 1 ? "s" : ""}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
