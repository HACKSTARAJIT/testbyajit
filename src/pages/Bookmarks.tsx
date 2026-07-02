import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fetchBookmarks } from "@/lib/study";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BookMarked, BookOpen, FileText, ClipboardList, ChevronRight } from "lucide-react";

type Item = { id: string; item_type: string; item_id: string; subject_id: string | null };

export default function Bookmarks() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      const [bm, chapters, pdfs, tests] = await Promise.all([
        fetchBookmarks(user.id),
        supabase.from("chapters").select("id, name, name_hi"),
        supabase.from("pdfs").select("id, title"),
        supabase.from("tests").select("id, title"),
      ]);
      const map: Record<string, string> = {};
      (chapters.data ?? []).forEach((c: any) => (map[c.id] = c.name ?? c.name_hi ?? "Chapter"));
      (pdfs.data ?? []).forEach((p: any) => (map[p.id] = p.title ?? "PDF"));
      (tests.data ?? []).forEach((t: any) => (map[t.id] = t.title ?? "Test"));
      setLabels(map);
      setItems((bm as Item[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>;

  const icon = (t: string) => (t === "pdf" ? FileText : t === "test" ? ClipboardList : BookOpen);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BookMarked className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Bookmarks / बुकमार्क</h1>
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <BookMarked className="h-10 w-10" /><p>No bookmarks yet. Tap the bookmark icon on any chapter, PDF, or test.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {items.map((it) => {
            const Icon = icon(it.item_type);
            const to = it.subject_id ? `/subjects/${it.subject_id}` : "/subjects";
            return (
              <Link key={it.id} to={to}>
                <Card className="transition-all hover:shadow-md">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
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
