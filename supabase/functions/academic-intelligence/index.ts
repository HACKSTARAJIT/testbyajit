// Academic Intelligence Engine — aggregates EVERY learning signal into one
// permanent academic memory and calls Gemini for a mentor letter.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Trend = "improving" | "declining" | "stable";
function trendOf(series: number[]): { trend: Trend; delta: number } {
  if (series.length < 2) return { trend: "stable", delta: 0 };
  const half = Math.max(1, Math.floor(series.length / 2));
  const first = series.slice(0, half);
  const last = series.slice(-half);
  const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const delta = Math.round((avg(last) - avg(first)) * 10) / 10;
  if (delta >= 3) return { trend: "improving", delta };
  if (delta <= -3) return { trend: "declining", delta };
  return { trend: "stable", delta };
}
const avg = (xs: number[]) =>
  xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authErr } = await userClient.auth.getClaims(token);
    if (authErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ------------- pull EVERY data source in parallel ---------------
    const [
      prof, mocksR, attemptsR, wrongsR, revItemsR, revTestsR,
      dnaR, targetsR, reviewsR, mistakesR, viewsR, subjectsR, chaptersR,
    ] = await Promise.all([
      admin.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
      admin.from("ai_mock_reports")
        .select("id,title,created_at,accuracy,readiness_score,overall_score,report_type,detected_subject,detected_chapter,detected_topic,report")
        .eq("user_id", userId).eq("status", "completed")
        .order("created_at", { ascending: true }).limit(80),
      admin.from("test_attempts")
        .select("id,test_id,accuracy,marks_obtained,total_questions,correct_count,incorrect_count,unattempted_count,time_taken,guesses,created_at,status")
        .eq("user_id", userId).eq("status", "completed")
        .order("created_at", { ascending: true }).limit(300),
      admin.from("wrong_questions")
        .select("id,status,priority,chapter_id,subject_id,topic,wrong_count,created_at,mastered_at")
        .eq("user_id", userId),
      admin.from("revision_items")
        .select("id,status,scheduled_for,created_at").eq("user_id", userId).limit(500),
      admin.from("revision_tests")
        .select("id,accuracy,marks_obtained,total_questions,created_at,status")
        .eq("user_id", userId).limit(200),
      admin.from("mistake_dna").select("*").eq("user_id", userId).maybeSingle(),
      admin.from("daily_targets")
        .select("id,status,target_date,priority,created_at")
        .eq("user_id", userId).order("target_date", { ascending: false }).limit(200),
      admin.from("daily_reviews")
        .select("review_date,consistency_score,career_seriousness,completed_count,total_count")
        .eq("user_id", userId).order("review_date", { ascending: false }).limit(60),
      admin.from("test_mistake_analyses")
        .select("category,subject,chapter,topic,created_at").eq("user_id", userId).limit(500),
      admin.from("chapter_views").select("chapter_id,created_at").eq("user_id", userId).limit(500),
      admin.from("subjects").select("id,name"),
      admin.from("chapters").select("id,name,subject_id"),
    ]);

    const mocks = mocksR.data ?? [];
    const attempts = attemptsR.data ?? [];
    const wrongs = wrongsR.data ?? [];
    const revItems = revItemsR.data ?? [];
    const revTests = revTestsR.data ?? [];
    const dna = dnaR.data ?? null;
    const targets = targetsR.data ?? [];
    const reviews = reviewsR.data ?? [];
    const mistakes = mistakesR.data ?? [];
    const views = viewsR.data ?? [];
    const subjectMap = new Map((subjectsR.data ?? []).map((s: any) => [s.id, s.name]));
    const chapterMap = new Map((chaptersR.data ?? []).map((c: any) => [c.id, { name: c.name, subject_id: c.subject_id }]));

    const firstName = (prof.data?.display_name ?? "Student").trim().split(/\s+/)[0] || "Student";

    // ------------- SUBJECT / CHAPTER / TOPIC intelligence -------------
    type Bucket = { name: string; scores: number[]; wrongs: number; mistakes: number };
    const subjectBuckets = new Map<string, Bucket>();
    const chapterBuckets = new Map<string, Bucket>();
    const topicBuckets = new Map<string, Bucket>();

    const push = (m: Map<string, Bucket>, key: string, score: number | null) => {
      if (!key) return;
      const b = m.get(key) ?? { name: key, scores: [], wrongs: 0, mistakes: 0 };
      if (typeof score === "number") b.scores.push(score);
      m.set(key, b);
    };

    // from mock reports
    for (const m of mocks) {
      const r = (m as any).report ?? {};
      for (const s of r?.subject_analysis ?? []) push(subjectBuckets, s.subject, s.accuracy);
      for (const c of r?.chapter_analysis ?? []) push(chapterBuckets, c.chapter, c.accuracy);
      for (const t of r?.topic_analysis ?? []) push(topicBuckets, t.topic, t.accuracy);
      for (const w of r?.weak_subjects ?? []) push(subjectBuckets, typeof w === "string" ? w : w.subject, null);
      for (const w of r?.weak_chapters ?? []) push(chapterBuckets, typeof w === "string" ? w : w.chapter, null);
      for (const w of r?.weak_topics ?? []) push(topicBuckets, typeof w === "string" ? w : w.topic, null);
    }
    // from wrong questions
    for (const w of wrongs as any[]) {
      const s = subjectMap.get(w.subject_id);
      const c = chapterMap.get(w.chapter_id);
      if (s) { const b = subjectBuckets.get(s) ?? { name: s, scores: [], wrongs: 0, mistakes: 0 }; b.wrongs += w.wrong_count ?? 1; subjectBuckets.set(s, b); }
      if (c) { const b = chapterBuckets.get(c.name) ?? { name: c.name, scores: [], wrongs: 0, mistakes: 0 }; b.wrongs += w.wrong_count ?? 1; chapterBuckets.set(c.name, b); }
      if (w.topic) { const b = topicBuckets.get(w.topic) ?? { name: w.topic, scores: [], wrongs: 0, mistakes: 0 }; b.wrongs += w.wrong_count ?? 1; topicBuckets.set(w.topic, b); }
    }
    // from mistake analyses
    for (const m of mistakes as any[]) {
      if (m.subject) { const b = subjectBuckets.get(m.subject) ?? { name: m.subject, scores: [], wrongs: 0, mistakes: 0 }; b.mistakes++; subjectBuckets.set(m.subject, b); }
      if (m.chapter) { const b = chapterBuckets.get(m.chapter) ?? { name: m.chapter, scores: [], wrongs: 0, mistakes: 0 }; b.mistakes++; chapterBuckets.set(m.chapter, b); }
      if (m.topic) { const b = topicBuckets.get(m.topic) ?? { name: m.topic, scores: [], wrongs: 0, mistakes: 0 }; b.mistakes++; topicBuckets.set(m.topic, b); }
    }

    const summarize = (m: Map<string, Bucket>) =>
      Array.from(m.values()).map(b => {
        const { trend, delta } = trendOf(b.scores);
        const mastery = avg(b.scores);
        const expected_gain = Math.max(0, Math.min(15, Math.round((100 - mastery) * 0.15 + b.wrongs * 0.4)));
        return {
          name: b.name,
          mastery,
          samples: b.scores.length,
          wrongs: b.wrongs,
          mistakes: b.mistakes,
          trend, delta, expected_gain,
        };
      }).sort((a, b) => a.mastery - b.mastery);

    const subjectsSum = summarize(subjectBuckets);
    const chaptersSum = summarize(chapterBuckets);
    const topicsSum = summarize(topicBuckets);

    // ------------- overall metrics -------------
    const mockAcc = mocks.map((m: any) => m.accuracy ?? 0).filter((x: number) => x > 0);
    const attemptAcc = attempts.map((a: any) => a.accuracy ?? 0).filter((x: number) => x > 0);
    const readiness = mocks.map((m: any) => m.readiness_score ?? 0).filter((x: number) => x > 0);
    const readinessTrend = trendOf(readiness);
    const accuracyTrend = trendOf([...mockAcc, ...attemptAcc]);

    // guess behaviour
    let guessTotal = 0, guessCorrect = 0, guessWrong = 0;
    for (const a of attempts as any[]) {
      const g = a.guesses ?? {};
      if (g && typeof g === "object") {
        const keys = Object.keys(g);
        guessTotal += keys.length;
      }
    }

    // consistency
    const consistency = reviews.length
      ? avg(reviews.map((r: any) => r.consistency_score ?? 0).filter((x: number) => x > 0))
      : 0;
    const targetCompleted = targets.filter((t: any) => t.status === "done").length;
    const targetTotal = targets.length;
    const completionRate = targetTotal ? Math.round((targetCompleted / targetTotal) * 100) : 0;

    // revision
    const revPending = revItems.filter((r: any) => r.status === "pending").length;
    const revMastered = revItems.filter((r: any) => r.status === "mastered" || r.status === "done").length;
    const revAcc = avg(revTests.map((r: any) => r.accuracy ?? 0).filter((x: number) => x > 0));

    const currentLevel = avg([
      avg(mockAcc), avg(attemptAcc), avg(readiness), consistency, completionRate,
    ].filter(x => x > 0));
    const targetLevel = 85;
    const gap = Math.max(0, targetLevel - currentLevel);

    // learning speed (attempts per week over last 30d)
    const now = Date.now();
    const last30 = attempts.filter((a: any) => now - new Date(a.created_at).getTime() < 30 * 864e5);
    const attemptsPerWeek = Math.round((last30.length / 30) * 7 * 10) / 10;

    // ------------- timeline (last 60 events, newest first) -------------
    const timeline: { date: string; type: string; label: string; value?: any }[] = [];
    for (const m of mocks) timeline.push({ date: (m as any).created_at, type: "mock", label: (m as any).title, value: { accuracy: (m as any).accuracy, readiness: (m as any).readiness_score } });
    for (const a of attempts.slice(-100)) timeline.push({ date: (a as any).created_at, type: "practice", label: "Practice Test", value: { accuracy: (a as any).accuracy, marks: (a as any).marks_obtained } });
    for (const r of revTests.slice(-40)) timeline.push({ date: (r as any).created_at, type: "revision", label: "Revision Test", value: { accuracy: (r as any).accuracy } });
    for (const t of targets.slice(0, 40)) timeline.push({ date: (t as any).target_date ?? (t as any).created_at, type: "target", label: `Daily target: ${(t as any).status}` });
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const trimmedTimeline = timeline.slice(0, 60);

    const totals = {
      mocks: mocks.length,
      practice_tests: attempts.length,
      revision_tests: revTests.length,
      wrong_questions: wrongs.length,
      revision_pending: revPending,
      revision_mastered: revMastered,
      chapter_views: views.length,
      daily_targets: targetTotal,
      target_completed: targetCompleted,
      completion_rate: completionRate,
      consistency,
      current_level: currentLevel,
      target_level: targetLevel,
      gap,
      guess_total: guessTotal,
      guess_correct: guessCorrect,
      guess_wrong: guessWrong,
      attempts_per_week: attemptsPerWeek,
      avg_mock_accuracy: avg(mockAcc),
      avg_practice_accuracy: avg(attemptAcc),
      avg_readiness: avg(readiness),
      revision_test_accuracy: revAcc,
      accuracy_trend: accuracyTrend,
      readiness_trend: readinessTrend,
    };

    const strongSubjects = subjectsSum.filter(s => s.mastery >= 75).slice(-6).reverse();
    const weakSubjects = subjectsSum.filter(s => s.mastery < 60 || s.wrongs > 5).slice(0, 6);
    const strongChapters = chaptersSum.filter(s => s.mastery >= 75).slice(-8).reverse();
    const weakChapters = chaptersSum.filter(s => s.mastery < 60 || s.wrongs > 4).slice(0, 10);
    const strongTopics = topicsSum.filter(s => s.mastery >= 75).slice(-8).reverse();
    const weakTopics = topicsSum.filter(s => s.mastery < 60 || s.mistakes > 2).slice(0, 12);

    // ------------- AI mentor letter -------------
    let mentor = "";
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (apiKey && (mocks.length + attempts.length) > 0) {
      const digest = {
        student: firstName,
        totals,
        strong_subjects: strongSubjects.slice(0, 5),
        weak_subjects: weakSubjects.slice(0, 5),
        strong_chapters: strongChapters.slice(0, 6),
        weak_chapters: weakChapters.slice(0, 8),
        weak_topics: weakTopics.slice(0, 10),
        mistake_dna: dna,
        recent_reviews: reviews.slice(0, 10),
        recent_mocks: mocks.slice(-6).map((m: any) => ({
          date: (m.created_at ?? "").slice(0, 10),
          score: m.overall_score, accuracy: m.accuracy, readiness: m.readiness_score,
        })),
      };
      const prompt = `You are ${firstName}'s permanent AJIT AI academic mentor. You REMEMBER the entire preparation journey — every mock, practice test, revision, wrong question, daily target and AI report. NEVER treat only the latest test.

Write a Hinglish mentor letter (Devanagari + English tech terms, 180-260 words) that:
1. Opens with "मैंने आपकी पूरी preparation journey analyse की है — ${totals.mocks} Mocks, ${totals.practice_tests} Practice Tests, ${totals.revision_tests} Revision Tests…"
2. Cites 2-3 improvements with numbers (subject/chapter/topic + % gain).
3. Cites 1-2 repeated weaknesses that persist across months.
4. Comments on revision behaviour, consistency (${totals.consistency}/100) and guess habit.
5. States current level ${Math.round(totals.current_level)} → target 85, gap ${Math.round(totals.gap)}.
6. Ends with ONE concrete next step (specific chapter/topic + action).

Return ONLY the letter text, no JSON, no headings.

ACADEMIC MEMORY:
${JSON.stringify(digest)}`;

      const res = await fetch(LOVABLE_AI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.4,
        }),
      });
      if (res.ok) {
        const j = await res.json();
        mentor = j?.choices?.[0]?.message?.content?.trim() ?? "";
      }
    }
    if (!mentor) {
      mentor = `${firstName}, अभी तक AI के पास analyse करने के लिए बहुत कम data है — कुछ Practice Tests और एक Full Mock upload करते ही Academic Intelligence full activate हो जायेगी।`;
    }

    return json({
      totals,
      subjects: subjectsSum,
      chapters: chaptersSum,
      topics: topicsSum,
      strong_subjects: strongSubjects,
      weak_subjects: weakSubjects,
      strong_chapters: strongChapters,
      weak_chapters: weakChapters,
      strong_topics: strongTopics,
      weak_topics: weakTopics,
      mistake_dna: dna,
      timeline: trimmedTimeline,
      mentor,
    });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
