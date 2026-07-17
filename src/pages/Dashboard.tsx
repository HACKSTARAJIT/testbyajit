import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/lib/storage";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen, Search, ChevronRight, Download, Smartphone,
  Sparkles, Pin, Flame, Layers, FileText, ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import brandLogo from "@/assets/ajit360-logo.png";
import { useAuth } from "@/hooks/useAuth";
import { fetchActivity } from "@/lib/study";

interface Subject {
  id: string;
  name: string;
  name_hi: string | null;
  description: string | null;
  cover_image: string | null;
  is_pinned: boolean;
  is_popular: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface Counts { chapters: number; pdfs: number; tests: number }

const fmtSize = (bytes?: number | null) => {
  if (!bytes) return null;
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const isNew = (iso: string) => Date.now() - new Date(iso).getTime() < 7 * 864e5;

export default function Dashboard() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [counts, setCounts] = useState<Record<string, Counts>>({});
  const [release, setRelease] = useState<any | null>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [revision, setRevision] = useState({ total: 0, high: 0, medium: 0, low: 0 });
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      const [subs, chapters, pdfs, tests, rel] = await Promise.all([
        supabase.from("subjects").select("*").order("is_pinned", { ascending: false }).order("sort_order").order("name"),
        supabase.from("chapters").select("subject_id"),
        supabase.from("pdfs").select("subject_id"),
        supabase.from("tests").select("subject_id"),
        supabase.from("app_release").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      const map: Record<string, Counts> = {};
      const bump = (id: string | null, key: keyof Counts) => {
        if (!id) return;
        map[id] = map[id] ?? { chapters: 0, pdfs: 0, tests: 0 };
        map[id][key] += 1;
      };
      (chapters.data ?? []).forEach((r: any) => bump(r.subject_id, "chapters"));
      (pdfs.data ?? []).forEach((r: any) => bump(r.subject_id, "pdfs"));
      (tests.data ?? []).forEach((r: any) => bump(r.subject_id, "tests"));
      setSubjects((subs.data as Subject[]) ?? []);
      setCounts(map);
      setRelease(rel.data ?? null);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!user) { setActivity([]); setRevision({ total: 0, high: 0, medium: 0, low: 0 }); return; }
    fetchActivity(user.id).then((a) => setActivity(a.slice(0, 8)));
    supabase.from("wrong_questions").select("priority").eq("user_id", user.id).eq("status", "pending")
      .then(({ data }) => {
        const r = { total: 0, high: 0, medium: 0, low: 0 };
        (data ?? []).forEach((row: any) => { r.total++; if (row.priority in r) (r as any)[row.priority]++; });
        setRevision(r);
      });
  }, [user]);


  const filtered = useMemo(
    () => subjects.filter((s) =>
      [s.name, s.name_hi, s.description].some((f) => f?.toLowerCase().includes(q.toLowerCase()))
    ),
    [subjects, q]
  );

  const handleDownload = async () => {
    if (!release?.file_path) {
      toast.error("APK अभी उपलब्ध नहीं है / App not available yet");
      return;
    }
    setDownloading(true);
    const url = await getSignedUrl(release.file_path, "app-releases");
    setDownloading(false);
    if (!url) { toast.error("Download failed, try again"); return; }
    const a = document.createElement("a");
    a.href = url;
    a.download = `practice-book-by-ajit-${release.version ?? "app"}.apk`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-hero p-6 text-primary-foreground shadow-lg md:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-primary-foreground/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-secondary/30 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <img src={brandLogo} alt="AJIT 360 app logo" width={56} height={56} className="h-14 w-14 rounded-2xl bg-primary-foreground/15 p-1 backdrop-blur" />
          <div>
            <h1 className="text-2xl font-bold leading-tight md:text-3xl">AJIT 360</h1>
            <p className="text-sm text-primary-foreground/85">प्रीमियम स्टडी लाइब्रेरी — सभी विषय एक जगह</p>
          </div>
        </div>
      </section>

      {/* APK download section */}
      <Card className="border-secondary/30 bg-gradient-to-br from-secondary/10 to-primary/5">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-warm text-secondary-foreground shadow-md">
              <Smartphone className="h-6 w-6" />
            </div>
            <div>
              <p className="flex items-center gap-2 font-semibold">📱 AJIT 360 App</p>
              <p className="text-xs text-muted-foreground">
                Version {release?.version ?? "1.0.0"}
                {fmtSize(release?.file_size) && ` • ${fmtSize(release?.file_size)}`}
                {release?.updated_at && ` • Updated ${new Date(release.updated_at).toLocaleDateString()}`}
              </p>
            </div>
          </div>
          <Button onClick={handleDownload} disabled={downloading} size="lg" className="w-full bg-gradient-warm shadow-md hover:opacity-90 sm:w-auto">
            <Download className="mr-1 h-5 w-5" /> {downloading ? "Preparing..." : "Download Android App"}
          </Button>
        </CardContent>
      </Card>

      {/* Sticky search + count */}
      <div className="sticky top-16 z-30 -mx-1 space-y-3 bg-background/80 px-1 py-2 backdrop-blur-lg">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-11 rounded-2xl pl-9 shadow-sm" placeholder="Search subjects... / विषय खोजें" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-2xl border bg-card px-4 py-2 shadow-sm">
            <BookOpen className="h-4 w-4 text-primary" />
            <div className="leading-none">
              <div className="text-lg font-bold">{subjects.length}</div>
              <div className="text-[10px] text-muted-foreground">Subjects</div>
            </div>
          </div>
        </div>
      </div>

      {/* Continue Studying + Recently Opened (signed-in users) */}
      {user && activity.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <ChevronRight className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Continue Studying / जारी रखें</h2>
          </div>
          <Link to={activity[0].subject_id ? `/subjects/${activity[0].subject_id}` : "/subjects"}>
            <Card className="border-primary/30 bg-primary/5 transition-all hover:shadow-md">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground capitalize">Last opened {activity[0].item_type}</p>
                  <p className="truncate font-medium">{activity[0].title ?? "Continue"}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>

          {activity.length > 1 && (
            <>
              <h2 className="text-sm font-semibold">Recently Opened / हाल ही में</h2>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {activity.slice(1).map((a) => (
                  <Link key={a.id} to={a.subject_id ? `/subjects/${a.subject_id}` : "/subjects"} className="shrink-0">
                    <div className="flex w-40 items-center gap-2 rounded-2xl border bg-card px-3 py-2.5 shadow-sm">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-xs font-medium">{a.title ?? a.item_type}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* Today's Revision */}
      {user && revision.total > 0 && (
        <section className="animate-fade-in overflow-hidden rounded-3xl bg-gradient-royal p-5 text-white shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-white/80">Today's Revision</p>
              <p className="text-2xl font-bold">{revision.total} pending question{revision.total !== 1 ? "s" : ""}</p>
            </div>
            <Link to="/revise">
              <Button className="btn-ripple bg-white text-primary hover:bg-white/90">
                <Flame className="mr-1 h-4 w-4" /> Start Revision
              </Button>
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white/15 p-2"><p className="text-lg font-bold">🔴 {revision.high}</p><p className="text-[11px] text-white/80">High</p></div>
            <div className="rounded-xl bg-white/15 p-2"><p className="text-lg font-bold">🟠 {revision.medium}</p><p className="text-[11px] text-white/80">Medium</p></div>
            <div className="rounded-xl bg-white/15 p-2"><p className="text-lg font-bold">🟢 {revision.low}</p><p className="text-[11px] text-white/80">Low</p></div>
          </div>
        </section>
      )}




      {/* Subjects grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-36 rounded-3xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-14 text-center text-muted-foreground">
          <BookOpen className="h-10 w-10" />
          <p>{q ? "कोई विषय नहीं मिला / No matching subjects" : "No subjects yet. Please check back soon!"}</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => {
            const c = counts[s.id] ?? { chapters: 0, pdfs: 0, tests: 0 };
            return (
              <Link key={s.id} to={`/subjects/${s.id}`} className="group animate-fade-in">
                <Card className="h-full overflow-hidden rounded-3xl border bg-card/70 backdrop-blur transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                  <CardContent className="flex h-full flex-col gap-3 p-5">
                    <div className="flex items-start gap-3">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-gradient-primary shadow-md">
                        {s.cover_image ? (
                          <img src={s.cover_image} alt={s.name} loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <BookOpen className="h-6 w-6 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap gap-1">
                          {s.is_pinned && <Badge className="gap-1 bg-primary/15 text-primary"><Pin className="h-3 w-3" /> Pinned</Badge>}
                          {s.is_popular && <Badge className="gap-1 bg-secondary/15 text-secondary"><Flame className="h-3 w-3" /> Popular</Badge>}
                          {isNew(s.created_at) && <Badge className="gap-1 bg-accent/15 text-accent"><Sparkles className="h-3 w-3" /> New</Badge>}
                        </div>
                        <h3 className="truncate font-semibold leading-tight">{s.name}</h3>
                        {s.name_hi && <p className="truncate text-sm text-muted-foreground">{s.name_hi}</p>}
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                    </div>

                    <div className="mt-auto grid grid-cols-3 gap-2 border-t pt-3 text-center">
                      <Stat icon={Layers} value={c.chapters} label="Chapters" />
                      <Stat icon={FileText} value={c.pdfs} label="PDFs" />
                      <Stat icon={ClipboardList} value={c.tests} label="Tests" />
                    </div>
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

function Stat({ icon: Icon, value, label }: { icon: any; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-bold">{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
