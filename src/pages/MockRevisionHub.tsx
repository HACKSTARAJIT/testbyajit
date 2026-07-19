import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Brain, Sparkles, ArrowLeft, ChevronRight, XCircle, SkipForward, Dice5,
  Repeat, ShieldAlert, Flame, Trophy, BookOpen, Layers, Target,
  FileText, TrendingDown, BookMarked,
} from "lucide-react";

/**
 * 🧠 Mock Revision Hub — dedicated page.
 *
 * Reads from the existing wrong_questions bank (auto-populated by recordAttempt()
 * after every Practice Test / Full Mock) and joins to questions/subjects/chapters
 * to expose Subject / Chapter / Topic / Source-Mock / Special-Collection views.
 * No new tables — pure aggregation surface.
 */

type Row = {
  id: string;
  question_id: string | null;
  status: string;
  priority: string | null;
  wrong_count: number | null;
  correct_revision_count: number | null;
  is_guess: boolean | null;
  is_skipped: boolean | null;
  is_marked: boolean | null;
  test_id: string | null;
  subject_id: string | null;
  chapter_id: string | null;
  last_attempt_at: string | null;
  topic?: string | null;
};

type Bucket = {
  key: string;
  label: string;
  hindi?: string | null;
  pending: number;
  mastered: number;
  wrong: number;
  skipped: number;
  guess: number;
  repeated: number;
  critical: number;
  neverCorrect: number;
};

export default function MockRevisionHubPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [subjects, setSubjects] = useState<Record<string, { name: string; name_hi?: string | null }>>({});
  const [chapters, setChapters] = useState<Record<string, { name: string; subject_id: string }>>({});
  const [tests, setTests] = useState<Record<string, { title: string; test_part: string | null }>>({});
  const [mocks, setMocks] = useState<Array<{
    id: string; title: string; created_at: string;
    detected_subject: string | null; detected_chapter: string | null;
    detected_topic: string | null; report_type: string | null;
    autoTotal: number; autoWrong: number; autoSkipped: number;
  }>>([]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      // Fetch wrong_questions bank
      const { data: wq } = await supabase
        .from("wrong_questions")
        .select("id, question_id, status, priority, wrong_count, correct_revision_count, is_guess, is_skipped, is_marked, test_id, subject_id, chapter_id, last_attempt_at")
        .eq("user_id", user.id);

      const list = (wq as any[]) ?? [];

      // Join topic from questions
      const qIds = [...new Set(list.map((r) => r.question_id).filter(Boolean))] as string[];
      let topicMap: Record<string, string | null> = {};
      if (qIds.length) {
        const chunks: string[][] = [];
        for (let i = 0; i < qIds.length; i += 300) chunks.push(qIds.slice(i, i + 300));
        const results = await Promise.all(
          chunks.map((c) =>
            supabase.from("questions").select("id, topic, chapter_id, subject_id").in("id", c),
          ),
        );
        results.forEach(({ data }) => {
          (data ?? []).forEach((q: any) => {
            topicMap[q.id] = q.topic ?? null;
            // Backfill missing chapter/subject on the row for accurate grouping
            const row = list.find((r) => r.question_id === q.id);
            if (row) {
              if (!row.subject_id && q.subject_id) row.subject_id = q.subject_id;
              if (!row.chapter_id && q.chapter_id) row.chapter_id = q.chapter_id;
            }
          });
        });
      }
      const enriched: Row[] = list.map((r) => ({ ...r, topic: r.question_id ? topicMap[r.question_id] ?? null : null }));

      const subjectIds = [...new Set(enriched.map((r) => r.subject_id).filter(Boolean))] as string[];
      const chapterIds = [...new Set(enriched.map((r) => r.chapter_id).filter(Boolean))] as string[];
      const testIds = [...new Set(enriched.map((r) => r.test_id).filter(Boolean))] as string[];

      const [{ data: subs }, { data: chs }, { data: tst }, { data: reports }] = await Promise.all([
        subjectIds.length
          ? supabase.from("subjects").select("id, name, name_hi").in("id", subjectIds)
          : Promise.resolve({ data: [] as any }),
        chapterIds.length
          ? supabase.from("chapters").select("id, name, subject_id").in("id", chapterIds)
          : Promise.resolve({ data: [] as any }),
        testIds.length
          ? supabase.from("tests").select("id, title, test_part").in("id", testIds)
          : Promise.resolve({ data: [] as any }),
        supabase
          .from("ai_mock_reports")
          .select("id, title, exam_name, created_at, detected_subject, detected_chapter, detected_topic, report_type")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);

      const sMap: any = {}; (subs ?? []).forEach((s: any) => (sMap[s.id] = { name: s.name, name_hi: s.name_hi }));
      const cMap: any = {}; (chs ?? []).forEach((c: any) => (cMap[c.id] = { name: c.name, subject_id: c.subject_id }));
      const tMap: any = {}; (tst ?? []).forEach((t: any) => (tMap[t.id] = { title: t.title, test_part: t.test_part }));

      const reportIds = (reports ?? []).map((r: any) => r.id);
      let autoMap: Record<string, { total: number; wrong: number; skipped: number }> = {};
      if (reportIds.length) {
        const { data: gen } = await supabase
          .from("mock_generated_questions")
          .select("report_id, original_status")
          .in("report_id", reportIds);
        (gen ?? []).forEach((g: any) => {
          const m = autoMap[g.report_id] ?? { total: 0, wrong: 0, skipped: 0 };
          m.total++;
          if (g.original_status === "wrong") m.wrong++;
          else if (g.original_status === "skipped") m.skipped++;
          autoMap[g.report_id] = m;
        });
      }

      const mockList = (reports ?? []).map((r: any, i: number) => ({
        id: r.id,
        title: r.title || r.exam_name || `Mock ${(reports?.length ?? 0) - i}`,
        created_at: r.created_at,
        detected_subject: r.detected_subject as string | null,
        detected_chapter: r.detected_chapter as string | null,
        detected_topic: r.detected_topic as string | null,
        report_type: r.report_type as string | null,
        autoTotal: autoMap[r.id]?.total ?? 0,
        autoWrong: autoMap[r.id]?.wrong ?? 0,
        autoSkipped: autoMap[r.id]?.skipped ?? 0,
      }));

      setRows(enriched);
      setSubjects(sMap);
      setChapters(cMap);
      setTests(tMap);
      setMocks(mockList);
      setLoading(false);
    })();
  }, [user]);

  const stats = useMemo(() => aggregate(rows, () => "all"), [rows]);
  const subjectBuckets = useMemo(
    () => group(rows, (r) => r.subject_id, (id) => subjects[id!]?.name ?? "Unknown Subject", (id) => subjects[id!]?.name_hi),
    [rows, subjects],
  );
  const chapterBuckets = useMemo(
    () => group(rows, (r) => r.chapter_id, (id) => chapters[id!]?.name ?? "Unknown Chapter"),
    [rows, chapters],
  );
  const topicBuckets = useMemo(
    () => group(rows, (r) => (r.topic ? r.topic : null), (id) => id ?? "Untagged"),
    [rows],
  );
  const testBuckets = useMemo(
    () => group(rows, (r) => r.test_id, (id) => tests[id!]?.title ?? "Untitled Test"),
    [rows, tests],
  );

  /** Per source-test AI insight: top wrong subject / chapter / topic + counts. */
  const sourceTestCards = useMemo(() => {
    const map = new Map<string, {
      testId: string; title: string; test_part: string | null;
      pending: number; wrong: number; skipped: number; guess: number;
      critical: number; repeated: number; mastered: number;
      subjects: Map<string, number>; chapters: Map<string, number>; topics: Map<string, number>;
      lastAttempt: string | null;
    }>();
    for (const r of rows) {
      if (!r.test_id) continue;
      const t = tests[r.test_id];
      if (!t) continue;
      const g = map.get(r.test_id) ?? {
        testId: r.test_id, title: t.title, test_part: t.test_part,
        pending: 0, wrong: 0, skipped: 0, guess: 0, critical: 0, repeated: 0, mastered: 0,
        subjects: new Map(), chapters: new Map(), topics: new Map(), lastAttempt: null,
      };
      if (r.status === "mastered") g.mastered++;
      else {
        g.pending++;
        if ((r.wrong_count ?? 0) >= 1 && !r.is_skipped) g.wrong++;
        if (r.is_skipped) g.skipped++;
        if (r.is_guess) g.guess++;
        if (r.priority === "critical") g.critical++;
        if ((r.wrong_count ?? 0) >= 2) g.repeated++;
        if (r.subject_id) g.subjects.set(r.subject_id, (g.subjects.get(r.subject_id) ?? 0) + 1);
        if (r.chapter_id) g.chapters.set(r.chapter_id, (g.chapters.get(r.chapter_id) ?? 0) + 1);
        if (r.topic) g.topics.set(r.topic, (g.topics.get(r.topic) ?? 0) + 1);
      }
      if (r.last_attempt_at && (!g.lastAttempt || r.last_attempt_at > g.lastAttempt)) g.lastAttempt = r.last_attempt_at;
      map.set(r.test_id, g);
    }
    return [...map.values()]
      .filter((g) => g.pending + g.mastered > 0)
      .sort((a, b) => (b.pending - a.pending) || ((b.lastAttempt ?? "").localeCompare(a.lastAttempt ?? "")));
  }, [rows, tests]);

  if (!user) return null;
  if (loading)
    return (
      <div className="space-y-4 animate-fade-in">
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    );

  const totalActivity = stats.pending + stats.mastered;

  return (
    <div className="space-y-5 animate-fade-in pb-16">
      <Button variant="ghost" size="sm" onClick={() => navigate("/smart-revision")} className="gap-1 -ml-2">
        <ArrowLeft className="h-4 w-4" /> Smart Revision
      </Button>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-fuchsia-600 via-purple-600 to-indigo-700 p-6 text-white shadow-lg">
        <Sparkles className="absolute -right-4 -top-4 h-28 w-28 opacity-15" />
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/20 p-3 backdrop-blur-sm"><Brain className="h-7 w-7" /></div>
          <div>
            <h1 className="text-2xl font-bold font-display">🧠 Mock Revision Hub</h1>
            <p className="text-sm text-white/85">
              Automatically generated revision tests from your Full Mocks & Practice Tests.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          <MiniStat label="Pending" value={stats.pending} />
          <MiniStat label="Mastered" value={stats.mastered} />
          <MiniStat label="Critical" value={stats.critical} />
          <MiniStat label="Mocks" value={mocks.length} />
        </div>
      </div>

      {totalActivity === 0 ? (
        <div className="glass-card rounded-3xl p-10 text-center text-muted-foreground">
          <BookMarked className="mx-auto h-10 w-10 opacity-60" />
          <p className="mt-3 font-semibold">Nothing to revise yet</p>
          <p className="mt-1 text-sm">
            Complete any Practice Test or upload a Full Mock — the Hub will build itself automatically.
          </p>
        </div>
      ) : (
        <Tabs defaultValue="subjects" className="w-full">
          <TabsList className="grid w-full grid-cols-5 rounded-2xl">
            <TabsTrigger value="subjects" className="rounded-xl text-[11px] sm:text-sm">📚 Subject</TabsTrigger>
            <TabsTrigger value="chapters" className="rounded-xl text-[11px] sm:text-sm">📖 Chapter</TabsTrigger>
            <TabsTrigger value="topics" className="rounded-xl text-[11px] sm:text-sm">🎯 Topic</TabsTrigger>
            <TabsTrigger value="mocks" className="rounded-xl text-[11px] sm:text-sm">📄 Mock</TabsTrigger>
            <TabsTrigger value="special" className="rounded-xl text-[11px] sm:text-sm">🔥 Special</TabsTrigger>
          </TabsList>

          {/* Subject Wise */}
          <TabsContent value="subjects" className="mt-5 space-y-3">
            {subjectBuckets.length === 0 ? (
              <EmptySection icon={Layers} text="No subject-tagged revisions yet." />
            ) : subjectBuckets.map((b) => (
              <BucketCard key={b.key} b={b} icon={BookOpen}
                onOpen={() => navigate(`/revise?filter=subject&subjectId=${b.key}&limit=60`)} />
            ))}
          </TabsContent>

          {/* Chapter Wise */}
          <TabsContent value="chapters" className="mt-5 space-y-3">
            {chapterBuckets.length === 0 ? (
              <EmptySection icon={BookOpen} text="No chapter-tagged revisions yet." />
            ) : chapterBuckets.map((b) => (
              <BucketCard key={b.key} b={b} icon={BookOpen}
                subtitle={chapters[b.key]?.subject_id ? subjects[chapters[b.key].subject_id]?.name : undefined}
                onOpen={() => navigate(`/revise?filter=chapter&chapterId=${b.key}&limit=60`)} />
            ))}
          </TabsContent>

          {/* Topic Wise */}
          <TabsContent value="topics" className="mt-5 space-y-3">
            {topicBuckets.length === 0 ? (
              <EmptySection icon={Target} text="Topics will appear once questions are AI-tagged." />
            ) : topicBuckets.map((b) => (
              <BucketCard key={b.key} b={b} icon={Target}
                onOpen={() => navigate(`/revise?filter=topic&topic=${encodeURIComponent(b.key)}&limit=60`)} />
            ))}
          </TabsContent>

          {/* Source Mock — every attempted Practice Test / Full Mock + uploaded PDF mocks */}
          <TabsContent value="mocks" className="mt-5 space-y-4">
            {sourceTestCards.length === 0 && mocks.length === 0 && (
              <EmptySection icon={FileText} text="Attempt a Practice Test or upload a Full Mock — auto revision tests will appear here." />
            )}

            {sourceTestCards.map((g) => {
              const topSubjectId = topKey(g.subjects);
              const topChapterId = topKey(g.chapters);
              const topTopic = topKey(g.topics);
              const topSubjectName = topSubjectId ? subjects[topSubjectId]?.name : null;
              const topChapterName = topChapterId ? chapters[topChapterId]?.name : null;
              const subjectChips = [...g.subjects.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
              const chapterChips = [...g.chapters.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
              const topicChips = [...g.topics.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
              const base = `/revise?scopeTestId=${g.testId}&limit=60`;
              return (
                <div key={g.testId} className="rounded-2xl border bg-card p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-fuchsia-500/15 p-2 text-fuchsia-500 shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-bold">{g.title}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {g.test_part && <Badge variant="outline" className="rounded-md px-1.5 py-0 text-[10px]">{g.test_part}</Badge>}
                        <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[10px]">{g.pending} pending</Badge>
                        {g.mastered > 0 && <Badge className="rounded-md bg-emerald-500/15 px-1.5 py-0 text-[10px] text-emerald-500">{g.mastered} mastered</Badge>}
                        {g.critical > 0 && <Badge className="rounded-md bg-red-500/15 px-1.5 py-0 text-[10px] text-red-500">{g.critical} critical</Badge>}
                      </div>
                    </div>
                  </div>

                  {/* AI Insight */}
                  {g.pending > 0 && (topSubjectName || topChapterName || topTopic) && (
                    <div className="rounded-xl bg-gradient-to-br from-purple-500/10 to-fuchsia-500/10 p-2.5 text-[11px] leading-snug">
                      <span className="font-semibold text-purple-600 dark:text-purple-400">🧠 AI Insight · </span>
                      <span className="text-muted-foreground">
                        Wrong <b>{g.wrong}</b> · Skipped <b>{g.skipped}</b> · Guess <b>{g.guess}</b>
                        {topSubjectName && <> · Top Subject <b>{topSubjectName}</b></>}
                        {topChapterName && <> · Top Chapter <b>{topChapterName}</b></>}
                        {topTopic && <> · Top Topic <b>{topTopic}</b></>}
                      </span>
                    </div>
                  )}

                  {/* Quick action buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <QuickAction label="❌ Wrong" count={g.wrong} tint="bg-red-500/10 text-red-600 border-red-500/30"
                      onClick={() => navigate(`${base}&filter=wrong`)} />
                    <QuickAction label="⏭ Skipped" count={g.skipped} tint="bg-amber-500/10 text-amber-600 border-amber-500/30"
                      onClick={() => navigate(`${base}&filter=skipped`)} />
                    <QuickAction label="🧠 Wrong + Skipped" count={g.pending} tint="bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/30"
                      onClick={() => navigate(base)} />
                    <QuickAction label="🎯 Guess Wrong" count={g.guess} tint="bg-orange-500/10 text-orange-600 border-orange-500/30"
                      onClick={() => navigate(`${base}&filter=guess`)} />
                  </div>

                  {/* Subject / Chapter / Topic quick chips */}
                  {subjectChips.length > 0 && (
                    <ChipRow icon="📚" label="Subject" items={subjectChips.map(([id, n]) => ({
                      label: subjects[id]?.name ?? "—", count: n,
                      onClick: () => navigate(`${base}&subjectId=${id}`),
                    }))} />
                  )}
                  {chapterChips.length > 0 && (
                    <ChipRow icon="📖" label="Chapter" items={chapterChips.map(([id, n]) => ({
                      label: chapters[id]?.name ?? "—", count: n,
                      onClick: () => navigate(`${base}&chapterId=${id}`),
                    }))} />
                  )}
                  {topicChips.length > 0 && (
                    <ChipRow icon="🎯" label="Topic" items={topicChips.map(([t, n]) => ({
                      label: t, count: n,
                      onClick: () => navigate(`${base}&filter=topic&topic=${encodeURIComponent(t)}`),
                    }))} />
                  )}

                  {/* Open analysis */}
                  <button
                    onClick={() => navigate(`/tests/${g.testId}`)}
                    className="btn-ripple flex w-full items-center justify-center gap-2 rounded-xl border bg-background/50 py-2 text-xs font-semibold hover:bg-accent/40"
                  >
                    📊 Open Test / Analysis <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}

            {/* Uploaded PDF mocks (AI Mock Analyzer) */}
            {mocks.map((m) => {
              const params = new URLSearchParams();
              let scope = "";
              if (m.detected_topic) { params.set("filter", "topic"); params.set("topic", m.detected_topic); scope = m.detected_topic; }
              else if (m.detected_chapter) {
                const chId = Object.keys(chapters).find((cid) => chapters[cid]?.name?.toLowerCase() === m.detected_chapter!.toLowerCase());
                if (chId) { params.set("filter", "chapter"); params.set("chapterId", chId); scope = m.detected_chapter; }
              } else if (m.detected_subject) {
                const sId = Object.keys(subjects).find((sid) => subjects[sid]?.name?.toLowerCase() === m.detected_subject!.toLowerCase());
                if (sId) { params.set("filter", "subject"); params.set("subjectId", sId); scope = m.detected_subject; }
              }
              params.set("limit", "60");
              const canRevise = params.has("filter");
              const date = new Date(m.created_at).toLocaleDateString();
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    if (canRevise) navigate(`/revise?${params.toString()}`);
                    else navigate(`/ai-mock-analyzer?report=${m.id}`);
                  }}
                  className="btn-ripple flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left transition hover:bg-accent/40"
                >
                  <div className="rounded-xl bg-indigo-500/15 p-2 text-indigo-500"><FileText className="h-5 w-5" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold">{m.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">📄 Uploaded · {date}{m.report_type ? ` · ${m.report_type}` : ""}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {scope && <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[10px]">Revise · {scope}</Badge>}
                      {!canRevise && <Badge variant="outline" className="rounded-md px-1.5 py-0 text-[10px]">Open report</Badge>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
          </TabsContent>

          {/* Special Collections */}
          <TabsContent value="special" className="mt-5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <SpecialCard label="Wrong" count={stats.wrong} grad="bg-gradient-warm" icon={XCircle}
                onClick={() => navigate("/revise")} />
              <SpecialCard label="Skipped" count={stats.skipped} grad="bg-gradient-exam" icon={SkipForward}
                onClick={() => navigate("/revise?filter=skipped")} />
              <SpecialCard label="Guess Wrong" count={stats.guess} grad="bg-gradient-royal" icon={Dice5}
                onClick={() => navigate("/revise?filter=guess")} />
              <SpecialCard label="Repeated Wrong" count={stats.repeated} grad="bg-gradient-practice" icon={Repeat}
                onClick={() => navigate("/revise?filter=repeated")} />
              <SpecialCard label="Never Solved" count={stats.neverCorrect} grad="bg-gradient-emerald" icon={TrendingDown}
                onClick={() => navigate("/revise?filter=never-correct")} />
              <SpecialCard label="Critical" count={stats.critical} grad="bg-gradient-to-br from-red-600 to-orange-500" icon={ShieldAlert}
                onClick={() => navigate("/revise?filter=critical")} />
              <SpecialCard label="High Priority" count={stats.high} grad="bg-gradient-to-br from-rose-500 to-pink-500" icon={Flame}
                onClick={() => navigate("/revise?filter=high")} />
              <SpecialCard label="Mastered" count={stats.mastered} grad="bg-gradient-to-br from-emerald-500 to-teal-500" icon={Trophy}
                onClick={() => navigate("/smart-revision")} />
            </div>

            {/* Final Exam Revision */}
            <button
              onClick={() => navigate("/revise?mode2=final&limit=60")}
              disabled={stats.critical + stats.repeated + stats.neverCorrect === 0}
              className="btn-ripple mt-5 w-full overflow-hidden rounded-3xl bg-gradient-to-br from-purple-700 via-fuchsia-600 to-red-500 p-5 text-left text-white shadow-lg disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white/20 p-3"><Brain className="h-6 w-6" /></div>
                <div className="flex-1">
                  <p className="text-lg font-bold">🎯 Final Exam Revision</p>
                  <p className="text-xs text-white/85">Critical · repeated · never-solved — auto compiled.</p>
                </div>
                <ChevronRight className="h-5 w-5" />
              </div>
            </button>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ------------- helpers -------------

function aggregate(rows: Row[], _key: (r: Row) => string | null) {
  let pending = 0, mastered = 0, wrong = 0, skipped = 0, guess = 0,
      repeated = 0, critical = 0, high = 0, neverCorrect = 0;
  for (const r of rows) {
    if (r.status === "mastered") { mastered++; continue; }
    pending++;
    if ((r.wrong_count ?? 0) >= 1) wrong++;
    if (r.is_skipped) skipped++;
    if (r.is_guess) guess++;
    if ((r.wrong_count ?? 0) >= 2) repeated++;
    if (r.priority === "critical") critical++;
    if (r.priority === "high") high++;
    if ((r.correct_revision_count ?? 0) === 0) neverCorrect++;
  }
  return { pending, mastered, wrong, skipped, guess, repeated, critical, high, neverCorrect };
}

function group(
  rows: Row[],
  keyFn: (r: Row) => string | null | undefined,
  labelFn: (id: string) => string,
  hindiFn?: (id: string) => string | null | undefined,
): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const r of rows) {
    const k = keyFn(r);
    if (!k) continue;
    const b = map.get(k) ?? {
      key: k, label: labelFn(k), hindi: hindiFn?.(k) ?? null,
      pending: 0, mastered: 0, wrong: 0, skipped: 0, guess: 0,
      repeated: 0, critical: 0, neverCorrect: 0,
    };
    if (r.status === "mastered") b.mastered++;
    else {
      b.pending++;
      if ((r.wrong_count ?? 0) >= 1) b.wrong++;
      if (r.is_skipped) b.skipped++;
      if (r.is_guess) b.guess++;
      if ((r.wrong_count ?? 0) >= 2) b.repeated++;
      if (r.priority === "critical") b.critical++;
      if ((r.correct_revision_count ?? 0) === 0) b.neverCorrect++;
    }
    map.set(k, b);
  }
  return [...map.values()]
    .sort((a, b) => (b.critical - a.critical) || (b.pending - a.pending))
    .slice(0, 60);
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/15 py-2 backdrop-blur-sm">
      <p className="text-lg font-bold leading-none">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-white/80">{label}</p>
    </div>
  );
}

function BucketCard({
  b, icon: Icon, subtitle, onOpen,
}: {
  b: Bucket; icon: any; subtitle?: string; onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      disabled={b.pending === 0}
      className="btn-ripple flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left transition hover:bg-accent/40 disabled:opacity-60"
    >
      <div className="rounded-xl bg-primary/15 p-2 text-primary"><Icon className="h-5 w-5" /></div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-semibold">{b.label}</p>
        {(subtitle || b.hindi) && (
          <p className="truncate text-[11px] text-muted-foreground">{subtitle ?? b.hindi}</p>
        )}
        <div className="mt-1 flex flex-wrap gap-1">
          {b.pending > 0 && <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[10px]">{b.pending} pending</Badge>}
          {b.mastered > 0 && <Badge className="rounded-md bg-emerald-500/15 px-1.5 py-0 text-[10px] text-emerald-500">{b.mastered} mastered</Badge>}
          {b.critical > 0 && <Badge className="rounded-md bg-red-500/15 px-1.5 py-0 text-[10px] text-red-500">{b.critical} critical</Badge>}
          {b.repeated > 0 && <Badge className="rounded-md bg-rose-500/15 px-1.5 py-0 text-[10px] text-rose-500">{b.repeated} repeated</Badge>}
          {b.skipped > 0 && <Badge className="rounded-md bg-amber-500/15 px-1.5 py-0 text-[10px] text-amber-600">{b.skipped} skipped</Badge>}
          {b.guess > 0 && <Badge className="rounded-md bg-orange-500/15 px-1.5 py-0 text-[10px] text-orange-500">{b.guess} guess</Badge>}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function SpecialCard({ label, count, grad, icon: Icon, onClick }: {
  label: string; count: number; grad: string; icon: any; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={count === 0}
      className={`btn-ripple rounded-2xl ${grad} p-3 text-left text-white shadow-md disabled:opacity-40`}
    >
      <Icon className="h-5 w-5" />
      <p className="mt-1 text-2xl font-bold leading-none">{count}</p>
      <p className="mt-1 text-[11px] font-medium">{label}</p>
    </button>
  );
}

function EmptySection({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="glass-card rounded-2xl p-8 text-center text-sm text-muted-foreground">
      <Icon className="mx-auto h-8 w-8 opacity-60" />
      <p className="mt-2">{text}</p>
    </div>
  );
}

function topKey<T>(m: Map<T, number>): T | null {
  let best: T | null = null; let n = 0;
  m.forEach((v, k) => { if (v > n) { n = v; best = k; } });
  return best;
}

function QuickAction({ label, count, tint, onClick }: {
  label: string; count: number; tint: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={count === 0}
      className={`btn-ripple rounded-xl border ${tint} p-2.5 text-left transition disabled:opacity-40`}
    >
      <p className="text-xs font-semibold leading-tight">{label}</p>
      <p className="mt-0.5 text-lg font-bold leading-none">{count}</p>
    </button>
  );
}

function ChipRow({ icon, label, items }: {
  icon: string; label: string;
  items: Array<{ label: string; count: number; onClick: () => void }>;
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{icon} {label} Wise</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it, i) => (
          <button
            key={i}
            onClick={it.onClick}
            className="btn-ripple rounded-lg border bg-background/50 px-2 py-1 text-[11px] font-medium hover:bg-accent/40"
          >
            {it.label} <span className="ml-1 text-muted-foreground">· {it.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
