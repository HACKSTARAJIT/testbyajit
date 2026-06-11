import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TestTracker, attemptStats, type Attempt } from "@/components/TestTracker";

export default function Tests() {
  const { user } = useAuth();
  const [tests, setTests] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("all");
  const [loading, setLoading] = useState(true);

  const loadAttempts = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("test_attempts").select("*").eq("user_id", user.id);
    setAttempts((data as any) ?? []);
  }, [user]);

  useEffect(() => {
    (async () => {
      const [t, s] = await Promise.all([
        supabase.from("tests").select("*, subjects(name)").order("created_at", { ascending: false }),
        supabase.from("subjects").select("id,name").order("name"),
      ]);
      setTests((t.data ?? []).filter((row: any) => row.test_link));
      setSubjects(s.data ?? []);
      await loadAttempts();
      setLoading(false);
    })();
  }, [loadAttempts]);


  const filtered = tests.filter((t) =>
    (subject === "all" || t.subject_id === subject) &&
    [t.title, t.description].some((f) => f?.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">अभ्यास टेस्ट / Practice Tests</h1>
        <p className="text-muted-foreground">Attempt timed MCQ tests and track your scores.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search tests..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger className="sm:w-56"><SelectValue placeholder="All Subjects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">{[1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <ClipboardList className="h-10 w-10" /><p>No tests found.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((t) => (
            <Card key={t.id} className="flex flex-col transition-shadow hover:shadow-md">
              <CardContent className="flex flex-1 flex-col p-5">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary">
                    <ClipboardList className="h-4 w-4 text-primary-foreground" />
                  </div>
                  {t.subjects?.name && <Badge variant="secondary">{t.subjects.name}</Badge>}
                </div>
                <h3 className="font-semibold">{t.title}</h3>
                {t.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>}
                {(() => {
                  const mine = attempts.filter((a) => a.test_id === t.id);
                  const s = attemptStats(mine);
                  return (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Last Score: {s.last ?? "—"} · Best Score: {s.best ?? "—"} · Attempts: {s.count}
                    </p>
                  );
                })()}
                <TestTracker
                  test={{ id: t.id, title: t.title, test_link: t.test_link }}
                  attempts={attempts.filter((a) => a.test_id === t.id)}
                  onSaved={loadAttempts}
                  triggerClassName="mt-4 w-full"
                />
              </CardContent>
            </Card>

          ))}
        </div>
      )}
    </div>
  );
}
