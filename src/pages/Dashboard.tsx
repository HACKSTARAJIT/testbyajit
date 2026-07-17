import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen, Search, ChevronRight, Sparkles, Pin, Flame,
  Layers, FileText, ClipboardList, Clock, PlayCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useHomeData } from "@/components/home/useHomeData";
import FloatingAIButton from "@/components/home/FloatingAIButton";
import TodayTargetCard from "@/components/accountability/TodayTargetCard";
import DayEndReviewDialog from "@/components/accountability/DayEndReviewDialog";

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

const isNew = (iso: string) => Date.now() - new Date(iso).getTime() < 7 * 864e5;

// Distinct color themes per subject card (cycles by index)
const CARD_THEMES = [
  { grad: "from-fuchsia-500/25 via-purple-500/15 to-indigo-500/10", ring: "ring-fuchsia-400/30", icon: "from-fuchsia-500 to-purple-600", bar: "bg-fuchsia-500" },
  { grad: "from-sky-500/25 via-cyan-500/15 to-blue-500/10", ring: "ring-cyan-400/30", icon: "from-sky-500 to-blue-600", bar: "bg-cyan-500" },
  { grad: "from-emerald-500/25 via-teal-500/15 to-green-500/10", ring: "ring-emerald-400/30", icon: "from-emerald-500 to-teal-600", bar: "bg-emerald-500" },
  { grad: "from-amber-500/25 via-orange-500/15 to-red-500/10", ring: "ring-amber-400/30", icon: "from-amber-500 to-orange-600", bar: "bg-amber-500" },
  { grad: "from-rose-500/25 via-pink-500/15 to-red-500/10", ring: "ring-rose-400/30", icon: "from-rose-500 to-pink-600", bar: "bg-rose-500" },
  { grad: "from-violet-500/25 via-indigo-500/15 to-blue-500/10", ring: "ring-violet-400/30", icon: "from-violet-500 to-indigo-600", bar: "bg-violet-500" },
  { grad: "from-lime-500/25 via-green-500/15 to-emerald-500/10", ring: "ring-lime-400/30", icon: "from-lime-500 to-green-600", bar: "bg-lime-500" },
  { grad: "from-yellow-500/25 via-amber-500/15 to-orange-500/10", ring: "ring-yellow-400/30", icon: "from-yellow-500 to-amber-600", bar: "bg-yellow-500" },
];

export default function Dashboard() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [counts, setCounts] = useState<Record<string, Counts>>({});
  const [pdfsBySubject, setPdfsBySubject] = useState<Record<string, string[]>>({});
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const home = useHomeData(user?.id);

  useEffect(() => {
    (async () => {
      const [subs, chapters, pdfs, tests] = await Promise.all([
        supabase.from("subjects").select("*").order("is_pinned", { ascending: false }).order("sort_order").order("name"),
        supabase.from("chapters").select("subject_id"),
        supabase.from("pdfs").select("id,subject_id"),
        supabase.from("tests").select("subject_id"),
      ]);
      const map: Record<string, Counts> = {};
      const bySub: Record<string, string[]> = {};
      const bump = (id: string | null, key: keyof Counts) => {
        if (!id) return;
        map[id] = map[id] ?? { chapters: 0, pdfs: 0, tests: 0 };
        map[id][key] += 1;
      };
      (chapters.data ?? []).forEach((r: any) => bump(r.subject_id, "chapters"));
      (pdfs.data ?? []).forEach((r: any) => {
        bump(r.subject_id, "pdfs");
        if (r.subject_id) (bySub[r.subject_id] ??= []).push(r.id);
      });
      (tests.data ?? []).forEach((r: any) => bump(r.subject_id, "tests"));
      setSubjects((subs.data as Subject[]) ?? []);
      setCounts(map);
      setPdfsBySubject(bySub);
      setLoading(false);
    })();
  }, []);

  const [pdfProgress, setPdfProgress] = useState<any[]>([]);
  useEffect(() => {
    if (!user) { setPdfProgress([]); return; }
    supabase.from("pdf_progress").select("pdf_id,status").eq("user_id", user.id)
      .then(({ data }) => setPdfProgress(data ?? []));
  }, [user]);

  const subjectStats = useMemo(() => {
    const stats: Record<string, { lastOpened?: string; completionPct: number }> = {};
    home.activity.forEach((a: any) => {
      if (!a.subject_id) return;
      const s = stats[a.subject_id] = stats[a.subject_id] ?? { completionPct: 0 };
      if (!s.lastOpened || new Date(a.opened_at) > new Date(s.lastOpened)) s.lastOpened = a.opened_at;
    });
    Object.keys(pdfsBySubject).forEach((sid) => {
      const ids = new Set(pdfsBySubject[sid]);
      const done = pdfProgress.filter((p: any) => p.status === "completed" && ids.has(p.pdf_id)).length;
      const total = ids.size || 1;
      const s = stats[sid] = stats[sid] ?? { completionPct: 0 };
      s.completionPct = Math.round((done / total) * 100);
    });
    return stats;
  }, [home.activity, pdfsBySubject, pdfProgress]);

  const continueLearning = useMemo(() => {
    const a = home.activity[0];
    if (!a) return null;
    const subj = subjects.find((s) => s.id === a.subject_id);
    return {
      path: a.subject_id ? `/subjects/${a.subject_id}` : "/subjects",
      subject: subj?.name ?? "Study",
      title: a.title ?? a.item_type ?? "Continue",
    };
  }, [home.activity, subjects]);

  const filtered = useMemo(
    () => subjects.filter((s) =>
      [s.name, s.name_hi, s.description].some((f) => f?.toLowerCase().includes(q.toLowerCase()))
    ),
    [subjects, q]
  );

  return (
    <div className="space-y-5 pb-24">
      {/* Sticky search */}
      <div className="sticky top-16 z-30 -mx-1 space-y-3 bg-background/70 px-1 py-2 backdrop-blur-xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-12 rounded-2xl border-border/60 bg-card/60 pl-9 shadow-sm backdrop-blur"
            placeholder="Search subjects, chapters, PDFs, tests..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {/* Today's Target — Daily Accountability */}
      {user && <TodayTargetCard userId={user.id} />}

      {/* Continue Learning — compact */}
      {user && continueLearning && (
        <Link to={continueLearning.path} className="block animate-fade-in">
          <Card className="overflow-hidden rounded-2xl border-primary/20 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent backdrop-blur">
            <CardContent className="flex items-center gap-3 p-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow">
                <PlayCircle className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Continue Learning</p>
                <p className="truncate text-sm font-semibold">{continueLearning.subject}</p>
                <p className="truncate text-xs text-muted-foreground">{continueLearning.title}</p>
              </div>
              <Button size="sm" className="shrink-0 rounded-full">Continue</Button>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Subjects grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">All Subjects / सभी विषय</h2>
          </div>
          <span className="text-xs text-muted-foreground">{filtered.length} subjects</span>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-52 rounded-3xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-14 text-center text-muted-foreground">
              <BookOpen className="h-10 w-10" />
              <p>{q ? "कोई विषय नहीं मिला / No matching subjects" : "No subjects yet."}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s, i) => {
              const c = counts[s.id] ?? { chapters: 0, pdfs: 0, tests: 0 };
              const st = subjectStats[s.id] ?? { completionPct: 0, lastOpened: undefined as string | undefined };
              const t = CARD_THEMES[i % CARD_THEMES.length];
              return (
                <Link key={s.id} to={`/subjects/${s.id}`} className="group animate-fade-in">
                  <Card className={`relative h-full overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-br ${t.grad} backdrop-blur-xl ring-1 ${t.ring} transition-all duration-200 hover:-translate-y-1 hover:shadow-xl`}>
                    <CardContent className="flex h-full flex-col gap-3 p-5">
                      <div className="flex items-start gap-3">
                        <div className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br ${t.icon} shadow-md`}>
                          {s.cover_image ? (
                            <img src={s.cover_image} alt={s.name} loading="lazy" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <BookOpen className="h-6 w-6 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap gap-1">
                            {s.is_pinned && <Badge className="gap-1 bg-primary/20 text-primary"><Pin className="h-3 w-3" /> Pinned</Badge>}
                            {s.is_popular && <Badge className="gap-1 bg-secondary/20 text-secondary"><Flame className="h-3 w-3" /> Popular</Badge>}
                            {isNew(s.created_at) && <Badge className="gap-1 bg-accent/20 text-accent"><Sparkles className="h-3 w-3" /> New</Badge>}
                          </div>
                          <h3 className="truncate font-semibold leading-tight">{s.name}</h3>
                          {s.name_hi && <p className="truncate text-xs text-muted-foreground">{s.name_hi}</p>}
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <Stat icon={Layers} value={c.chapters} label="Chapters" />
                        <Stat icon={FileText} value={c.pdfs} label="PDFs" />
                        <Stat icon={ClipboardList} value={c.tests} label="Tests" />
                      </div>

                      {user && (
                        <div className="mt-auto space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground">Completion</span>
                            <span className="font-semibold tabular-nums">{st.completionPct}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                            <div className={`h-full ${t.bar} transition-all`} style={{ width: `${st.completionPct}%` }} />
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              {st.lastOpened ? (<><Clock className="h-3 w-3" />{new Date(st.lastOpened).toLocaleDateString()}</>) : "Not started"}
                            </span>
                            <Button size="sm" variant="secondary" className="h-7 rounded-full px-3 text-[11px]">Continue</Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {user && <FloatingAIButton />}
    </div>
  );
}

function Stat({ icon: Icon, value, label }: { icon: any; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl bg-background/40 py-1.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-sm font-bold tabular-nums">{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
