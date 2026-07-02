import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fetchActivity, fetchBookmarks, fetchNotes } from "@/lib/study";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LayoutGrid, BookMarked, StickyNote, BookOpen, ClipboardList,
  AlertTriangle, Clock, ChevronRight, FileText,
} from "lucide-react";

export default function RevisionDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ wrongPending: 0, bookmarkPdfs: 0, notes: 0 });
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      const [wq, bm, nt, act] = await Promise.all([
        supabase.from("wrong_questions").select("id, status").eq("user_id", user.id),
        fetchBookmarks(user.id),
        fetchNotes(user.id),
        fetchActivity(user.id),
      ]);
      setStats({
        wrongPending: (wq.data ?? []).filter((w: any) => w.status !== "mastered").length,
        bookmarkPdfs: (bm ?? []).filter((b: any) => b.item_type === "pdf").length,
        notes: (nt ?? []).filter((n: any) => (n.content ?? "").trim().length > 0).length,
      });
      setActivity(act.slice(0, 8));
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="grid gap-4 sm:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;

  const lastPdf = activity.find((a) => a.item_type === "pdf");
  const lastTest = activity.find((a) => a.item_type === "test");

  const iconFor = (t: string) => (t === "pdf" ? FileText : t === "test" ? ClipboardList : t === "chapter" ? BookOpen : LayoutGrid);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <LayoutGrid className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Revision Dashboard</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <QuickCard to="/wrong-questions" icon={AlertTriangle} label="Wrong Questions Pending" value={stats.wrongPending} />
        <QuickCard to="/bookmarks" icon={BookMarked} label="Bookmarked PDFs" value={stats.bookmarkPdfs} />
        <QuickCard to="/subjects" icon={StickyNote} label="Chapter Notes" value={stats.notes} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ContinueCard title="Continue Reading" item={lastPdf} icon={FileText} />
        <ContinueCard title="Continue Last Test" item={lastTest} icon={ClipboardList} />
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Clock className="h-5 w-5 text-primary" /> Recently Opened</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {activity.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Nothing opened yet.</p>
          ) : activity.map((a) => {
            const Icon = iconFor(a.item_type);
            const to = a.subject_id ? `/subjects/${a.subject_id}` : "/subjects";
            return (
              <Link key={a.id} to={to} className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{a.title ?? a.item_type}</span>
                <span className="shrink-0 text-xs capitalize text-muted-foreground">{a.item_type}</span>
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function QuickCard({ to, icon: Icon, label, value }: { to: string; icon: any; label: string; value: number }) {
  return (
    <Link to={to}>
      <Card className="transition-all hover:-translate-y-0.5 hover:shadow-md">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
          <div>
            <p className="text-2xl font-bold leading-none">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{label}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ContinueCard({ title, item, icon: Icon }: { title: string; item: any; icon: any }) {
  const to = item?.subject_id ? `/subjects/${item.subject_id}` : "/subjects";
  return (
    <Link to={to}>
      <Card className="h-full transition-all hover:shadow-md">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary/15 text-secondary"><Icon className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="truncate font-medium">{item?.title ?? "Nothing yet"}</p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}
