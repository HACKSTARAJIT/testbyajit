import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BookOpen, ChevronRight, FolderOpen, XCircle } from "lucide-react";
import { loadSubjects, loadOverviewCounts, type SubjectNode } from "@/lib/appTestMistakes";

/**
 * ❌ APP TEST MISTAKES — level 1 (Subjects).
 * Hierarchy: Subject → Chapter → Test → Question.
 * Only active mistakes are listed; mastered questions stay as a statistic.
 */
export default function AppTestMistakes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<SubjectNode[]>([]);
  const [counts, setCounts] = useState({ active: 0, mastered: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user) { setLoading(false); return; }
      const [s, c] = await Promise.all([loadSubjects(user.id), loadOverviewCounts(user.id)]);
      setSubjects(s);
      setCounts(c);
      setLoading(false);
    })();
  }, [user]);

  const activeSubjects = subjects.filter((s) => s.active > 0);

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
              Subject → Chapter → Test → Question · 2 बार सही ⇒ Mastered
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card rounded-2xl p-4 text-center">
          <p className="font-display text-2xl font-bold">{loading ? "—" : counts.active}</p>
          <p className="text-[11px] text-muted-foreground">Active Mistakes</p>
        </div>
        <div className="glass-card rounded-2xl p-4 text-center">
          <p className="font-display text-2xl font-bold">{loading ? "—" : activeSubjects.length}</p>
          <p className="text-[11px] text-muted-foreground">Subjects</p>
        </div>
        <div className="glass-card rounded-2xl p-4 text-center">
          <p className="font-display text-2xl font-bold text-emerald-500">{loading ? "—" : counts.mastered}</p>
          <p className="text-[11px] text-muted-foreground">Mastered</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : activeSubjects.length === 0 ? (
        <div className="glass-card rounded-3xl p-10 text-center text-muted-foreground">
          <FolderOpen className="mx-auto h-10 w-10" />
          <p className="mt-3 font-semibold">कोई active App Test mistake नहीं</p>
          <p className="mt-1 text-sm">कोई App Test दें — गलत और छूटे हुए questions अपने आप यहाँ आ जाएंगे।</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeSubjects.map((s) => (
            <Link key={s.subject_id} to={`/app-test-mistakes/subject/${s.subject_id}`}>
              <div className="btn-ripple glass-card flex items-center gap-4 rounded-2xl p-4 transition-transform hover:scale-[1.01]">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{s.name}</p>
                  {s.name_hi && <p className="truncate text-xs text-muted-foreground">{s.name_hi}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.active} active mistake{s.active !== 1 ? "s" : ""} · {s.chapters} chapter{s.chapters !== 1 ? "s" : ""}
                    {s.mastered > 0 && <span className="text-emerald-500"> · {s.mastered} mastered</span>}
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
