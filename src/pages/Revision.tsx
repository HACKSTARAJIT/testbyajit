import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fetchRevision } from "@/lib/study";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, BookOpen, ClipboardList, ChevronRight } from "lucide-react";

type Item = { id: string; item_type: string; item_id: string; subject_id: string | null };

export default function Revision() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      const [rv, chapters, tests] = await Promise.all([
        fetchRevision(user.id),
        supabase.from("chapters").select("id, name, name_hi"),
        supabase.from("tests").select("id, title"),
      ]);
      const map: Record<string, string> = {};
      (chapters.data ?? []).forEach((c: any) => (map[c.id] = c.name ?? c.name_hi ?? "Chapter"));
      (tests.data ?? []).forEach((t: any) => (map[t.id] = t.title ?? "Test"));
      setLabels(map);
      setItems((rv as Item[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Star className="h-6 w-6 text-secondary" />
        <h1 className="text-2xl font-bold">Revision List / रिवीजन</h1>
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <Star className="h-10 w-10" /><p>Nothing marked for revision yet. Tap the ⭐ on any chapter or test.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {items.map((it) => {
            const Icon = it.item_type === "test" ? ClipboardList : BookOpen;
            const to = it.subject_id ? `/subjects/${it.subject_id}` : "/subjects";
            return (
              <Link key={it.id} to={to}>
                <Card className="transition-all hover:shadow-md">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/15 text-secondary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{labels[it.item_id] ?? "Saved item"}</p>
                      <p className="text-xs capitalize text-muted-foreground">{it.item_type}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
