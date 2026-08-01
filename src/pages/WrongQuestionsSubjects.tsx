import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BookOpen, ChevronRight, FolderOpen, XCircle } from "lucide-react";
import { loadSubjectSummaries, type SubjectSummary } from "@/lib/smartRevision";

export default function WrongQuestionsSubjects() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user) { setLoading(false); return; }
      setSubjects(await loadSubjectSummaries(user.id));
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="space-y-5 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate("/smart-revision")}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Smart Revision
      </Button>

      <div className="rounded-3xl bg-gradient-to-br from-rose-600 via-red-600 to-orange-500 p-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/20 p-3"><XCircle className="h-6 w-6" /></div>
          <div>
            <h1 className="font-display text-2xl font-bold">❌ Wrong Questions</h1>
            <p className="text-sm text-white/85">AJIT 360 tests के Wrong / Skipped questions</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : subjects.length === 0 ? (
        <div className="glass-card rounded-3xl p-10 text-center text-muted-foreground">
          <FolderOpen className="mx-auto h-10 w-10" />
          <p className="mt-3 font-semibold">कोई pending mistake नहीं</p>
          <p className="mt-1 text-sm">कोई test दें — गलत और छूटे हुए questions अपने आप यहाँ आ जाएंगे।</p>
        </div>
      ) : (
        <div className="space-y-3">
          {subjects.map((s) => (
            <Link key={s.subject_id} to={`/smart-revision/subject/${s.subject_id}`}>
              <div className="btn-ripple glass-card flex items-center gap-4 rounded-2xl p-4 transition-transform hover:scale-[1.01]">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{s.name}</p>
                  {s.name_hi && <p className="truncate text-xs text-muted-foreground">{s.name_hi}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">{s.pending} pending question{s.pending !== 1 ? "s" : ""}</p>
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
