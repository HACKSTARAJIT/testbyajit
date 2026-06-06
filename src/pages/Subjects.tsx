import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Search, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Subject { id: string; name: string; name_hi: string | null; description: string | null; }

export default function Subjects() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("subjects").select("*").order("name");
      setSubjects(data ?? []);
      const { data: chapters } = await supabase.from("chapters").select("subject_id");
      const map: Record<string, number> = {};
      (chapters ?? []).forEach((c: any) => { map[c.subject_id] = (map[c.subject_id] ?? 0) + 1; });
      setCounts(map);
      setLoading(false);
    })();
  }, []);

  const filtered = subjects.filter((s) =>
    [s.name, s.name_hi, s.description].some((f) => f?.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">विषय / Subjects</h1>
        <p className="text-muted-foreground">Choose a subject to view chapters, notes & tests.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search subjects... / विषय खोजें" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <Link key={s.id} to={`/subjects/${s.id}`}>
              <Card className="group h-full transition-shadow hover:shadow-md">
                <CardContent className="flex items-start gap-3 p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-primary">
                    <BookOpen className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="truncate font-semibold">{s.name}</h3>
                      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                    </div>
                    {s.name_hi && <p className="text-sm text-muted-foreground">{s.name_hi}</p>}
                    {s.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>}
                    <Badge variant="secondary" className="mt-2">{counts[s.id] ?? 0} chapters</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
      <BookOpen className="h-10 w-10" />
      <p>No subjects yet. Please check back soon!</p>
    </CardContent></Card>
  );
}
