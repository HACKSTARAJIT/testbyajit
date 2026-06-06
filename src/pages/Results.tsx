import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, Trophy, Clock, Repeat } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Results() {
  const { user } = useAuth();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("results")
        .select("*, tests(title)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      setResults(data ?? []);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">परिणाम इतिहास / Result History</h1>
        <p className="text-muted-foreground">Review all your past test attempts.</p>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : results.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <History className="h-10 w-10" /><p>No attempts yet.</p>
          <Button asChild className="mt-2"><Link to="/tests">Take a Test</Link></Button>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {results.map((r) => {
            const pct = r.total_marks ? Math.round((r.score / r.total_marks) * 100) : 0;
            const good = pct >= 60;
            return (
              <Card key={r.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${good ? "bg-success/15" : "bg-warning/15"}`}>
                      <Trophy className={`h-6 w-6 ${good ? "text-success" : "text-warning"}`} />
                    </div>
                    <div>
                      <p className="font-semibold">{r.tests?.title ?? "Test"}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {Math.floor((r.time_taken_seconds ?? 0) / 60)}m {(r.time_taken_seconds ?? 0) % 60}s</span>
                        <span>{r.correct_count}/{r.total_questions} correct</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-2xl font-bold">{pct}%</div>
                      <Badge variant={good ? "default" : "secondary"}>{r.score}/{r.total_marks}</Badge>
                    </div>
                    <Button asChild size="sm" variant="outline"><Link to={`/test/${r.test_id}`}><Repeat className="h-4 w-4" /></Link></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
