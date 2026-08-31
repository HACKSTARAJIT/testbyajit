import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BookOpen, ChevronRight, FolderOpen, XCircle } from "lucide-react";
import { loadSubjectSummaries, loadOverallStats, type SubjectSummary, type OverallStats } from "@/lib/smartRevision";

/**
 * ❌ APP TEST MISTAKES — completely independent from Mock Mistakes.
 * Source of truth: public.wrong_questions (source_type = 'app_test').
 * Never reads mock_mistake_* tables.
 */
export default function AppTestMistakes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [stats, setStats] = useState<OverallStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user) { setLoading(false); return; }
      const [s, st] = await Promise.all([
        loadSubjectSummaries(user.id),
        loadOverallStats(user.id),
      ]);
      setSubjects(s);
      setStats(st);
      setLoading(false);
    })();
  }, [user]);

  const totalPending = subjects.reduce((a, s) => a + (s.pending ?? 0), 0);

  return (
    <div className="space-y-5 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Home
      </Button>

      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-600 via-red-600 to-orange-500 p-6 text-white shadow-lg">
        <XCircle className="absolute -right-6 -bottom-6 h-32 w-32 opacity-15" />
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/20 p-3 backdrop-blur-sm"><XCircle className="h-6 w-6" /></div>
          <div>
            <h1 className="font-display text-2xl font-bold">❌ App Test Mistakes</h1>
            <p className="text-sm text-white/85">
              सिर्फ PRACTICE WITH AJIT App Tests के wrong / skipped questions
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card rounded-2xl p-4 text-center">
          <p className="font-display text-2xl font-bold">{loading ? "—" : totalPending}</p>
          <p className="text-[11px] text-muted-foreground">Pending Mistakes</p>
        </div>
        <div className="glass-card rounded-2xl p-4 text-center">
          <p className="font-display text-2xl font-bold">{loading ? "—" : subjects.length}</p>
          <p className="text-[11px] text-muted-foreground">Subjects</p>
        </div>
        <div className="glass-card rounded-2xl p-4 text-center">
          <p className="font-display text-2xl font-bold">{loading ? "—" : (stats?.mastered ?? 0)}</p>
          <p className="text-[11px] text-muted-foreground">Mastered</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : subjects.length === 0 ? (
        <div className="glass-card rounded-3xl p-10 text-center text-muted-foreground">
          <FolderOpen className="mx-auto h-10 w-10" />
          <p className="mt-3 font-semibold">कोई App Test mistake नहीं</p>
          <p className="mt-1 text-sm">कोई App Test दें — गलत और छूटे हुए questions अपने आप यहाँ आ जाएंगे।</p>
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
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.pending} pending question{s.pending !== 1 ? "s" : ""}
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
