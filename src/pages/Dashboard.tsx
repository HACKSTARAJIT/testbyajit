import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, ClipboardList, FileText, TrendingUp, ArrowRight, Trophy } from "lucide-react";

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState({ subjects: 0, tests: 0, pdfs: 0, attempts: 0, avg: 0 });
  const [name, setName] = useState("");

  useEffect(() => {
    (async () => {
      const [subs, tests, pdfs, results, profile] = await Promise.all([
        supabase.from("subjects").select("id", { count: "exact", head: true }),
        supabase.from("tests").select("id", { count: "exact", head: true }),
        supabase.from("pdfs").select("id", { count: "exact", head: true }),
        supabase.from("results").select("score,total_marks").eq("user_id", user!.id),
        supabase.from("profiles").select("display_name").eq("id", user!.id).maybeSingle(),
      ]);
      const attempts = results.data ?? [];
      const avg = attempts.length
        ? Math.round(attempts.reduce((a, r) => a + (r.total_marks ? (r.score / r.total_marks) * 100 : 0), 0) / attempts.length)
        : 0;
      setStats({
        subjects: subs.count ?? 0, tests: tests.count ?? 0, pdfs: pdfs.count ?? 0,
        attempts: attempts.length, avg,
      });
      setName(profile.data?.display_name ?? "");
    })();
  }, [user]);

  const cards = [
    { label: "Subjects / विषय", value: stats.subjects, icon: BookOpen, to: "/subjects" },
    { label: "Practice Tests", value: stats.tests, icon: ClipboardList, to: "/tests" },
    { label: "Study PDFs", value: stats.pdfs, icon: FileText, to: "/subjects" },
    { label: "My Attempts", value: stats.attempts, icon: TrendingUp, to: "/results" },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-hero p-6 text-primary-foreground shadow-md md:p-8">
        <h1 className="text-2xl font-bold md:text-3xl">नमस्ते {name || "Student"} 👋</h1>
        <p className="mt-1 text-primary-foreground/90">
          अपने अध्याय पढ़ें और अभ्यास टेस्ट दें / Study chapters & take practice tests.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild variant="secondary"><Link to="/subjects">Browse Subjects <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
          <Button asChild variant="outline" className="bg-transparent text-primary-foreground border-primary-foreground/40 hover:bg-primary-foreground/10">
            <Link to="/tests">Take a Test</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} to={c.to}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
                  <c.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{c.value}</div>
                  <div className="text-xs text-muted-foreground">{c.label}</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Trophy className="h-5 w-5 text-secondary" /> Your Average Score</CardTitle></CardHeader>
        <CardContent>
          <div className="text-4xl font-bold gradient-text">{stats.avg}%</div>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.attempts > 0 ? `Across ${stats.attempts} attempt(s)` : "No tests attempted yet. Start practicing!"}
          </p>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card className="border-secondary/40 bg-secondary/5">
          <CardContent className="flex items-center justify-between p-4">
            <div><p className="font-medium">You are an Admin</p><p className="text-sm text-muted-foreground">Manage subjects, materials and tests.</p></div>
            <Button asChild variant="secondary"><Link to="/admin">Open Admin</Link></Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
