import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const avg = (xs: number[]) => xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0;

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

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const [prof, reports, attempts, wrongs, activity, goals, revItems, revTests, perf, plan] = await Promise.all([
      admin.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
      admin.from("ai_mock_reports").select("title, report_type, detected_subject, detected_chapter, detected_topic, accuracy, readiness_score, overall_score, report, created_at")
        .eq("user_id", userId).eq("status", "completed").eq("analysis_status", "verified").order("created_at", { ascending: true }).limit(50),
      admin.from("test_attempts").select("accuracy, marks_obtained, total_questions, correct_count, incorrect_count, created_at")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
      admin.from("wrong_questions").select("chapter_id, subject_id, topic, priority, status, wrong_count").eq("user_id", userId).limit(500),
      admin.from("study_activity").select("opened_at").eq("user_id", userId).order("opened_at", { ascending: false }).limit(90),
      admin.from("smart_goals").select("title, target_value, current_value, unit, deadline, status")
        .eq("user_id", userId).eq("status", "active").limit(10),
      admin.from("revision_items").select("id, item_type, subject_id, created_at").eq("user_id", userId),
      admin.from("revision_tests").select("id, created_at").eq("user_id", userId),
      admin.from("performance").select("*").eq("user_id", userId),
      admin.from("study_plan_tasks").select("status, task_date").eq("user_id", userId).gte("task_date", new Date().toISOString().slice(0, 10)),
    ]);

    const firstName = (prof.data?.display_name ?? "Student").trim().split(/\s+/)[0] || "Student";
    const reps = reports.data ?? [];
    const atts = attempts.data ?? [];
    const wrs  = wrongs.data ?? [];

    // ---------- Deterministic metrics ----------
    const mockAcc = reps.map(r => r.accuracy ?? 0).filter(x => x > 0);
    const attAcc  = atts.map(a => a.accuracy ?? 0).filter(x => x > 0);
    const overallAccuracy = avg([...mockAcc, ...attAcc]);
    const readiness = avg(reps.map(r => r.readiness_score ?? 0).filter(x => x > 0));
    const totalW = wrs.length;
    const mastered = wrs.filter(w => w.status === "mastered").length;
    const pending  = wrs.filter(w => w.status === "pending").length;
    const progress = totalW > 0 ? Math.round((mastered / totalW) * 100) : Math.min(100, reps.length * 8 + atts.length * 2);
    // Preparation score = weighted composite
    const preparation = Math.round(
      overallAccuracy * 0.4 + readiness * 0.35 + progress * 0.15 + Math.min(100, atts.length * 2) * 0.1
    );

    // Streak from study_activity
    const days = new Set((activity.data ?? []).map((r: any) => (r.opened_at ?? "").slice(0, 10)));
    let streak = 0;
    for (let i = 0; i < 90; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      if (days.has(d.toISOString().slice(0, 10))) streak++; else break;
    }

    // Targets
    const todayStr = new Date().toISOString().slice(0, 10);
    const weekAgo  = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
    const monthAgo = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
    const attemptsToday = atts.filter(a => (a.created_at ?? "").slice(0, 10) === todayStr).length;
    const attemptsWeek  = atts.filter(a => (a.created_at ?? "") >= weekAgo).length;
    const attemptsMonth = atts.filter(a => (a.created_at ?? "") >= monthAgo).length;
    const targets = {
      today:   { done: attemptsToday, goal: 3,  label: "Practice Tests today" },
      week:    { done: attemptsWeek,  goal: 15, label: "Practice Tests this week" },
      month:   { done: attemptsMonth, goal: 60, label: "Practice Tests this month" },
      pending_revision: pending,
    };

    // Subject / chapter / topic ranking from reports (chronological)
    type Bucket = { name: string; accSum: number; n: number; first?: number; last?: number };
    const bucketize = (getPairs: (r: any) => Array<[string, number]>) => {
      const map = new Map<string, Bucket>();
      for (const r of reps) {
        for (const [nm, ac] of getPairs(r)) {
          if (!nm || typeof ac !== "number") continue;
          const b = map.get(nm) ?? { name: nm, accSum: 0, n: 0 };
          b.accSum += ac; b.n += 1;
          if (b.first === undefined) b.first = ac;
          b.last = ac;
          map.set(nm, b);
        }
      }
      return [...map.values()].map(b => ({
        name: b.name,
        avg: Math.round(b.accSum / b.n),
        delta: (b.first !== undefined && b.last !== undefined) ? b.last - b.first : 0,
        samples: b.n,
      }));
    };

    const subjectsArr = bucketize(r => (r.report?.subject_analysis ?? []).map((s: any) => [s.subject, s.accuracy]));
    const chaptersArr = bucketize(r => (r.report?.chapter_analysis ?? []).map((c: any) => [c.chapter, c.accuracy]));
    const topicsArr   = bucketize(r => {
      const arr: Array<[string, number]> = [];
      (r.report?.topic_analysis ?? []).forEach((t: any) => t?.topic && typeof t.accuracy === "number" && arr.push([t.topic, t.accuracy]));
      return arr;
    });

    const pickMinBy = <T,>(arr: T[], k: (t: T) => number) => arr.length ? arr.reduce((a, b) => k(a) < k(b) ? a : b) : null;
    const pickMaxBy = <T,>(arr: T[], k: (t: T) => number) => arr.length ? arr.reduce((a, b) => k(a) > k(b) ? a : b) : null;

    const subjectPick = {
      strongest:      pickMaxBy(subjectsArr.filter(s => s.samples >= 1), s => s.avg),
      weakest:        pickMinBy(subjectsArr.filter(s => s.samples >= 1), s => s.avg),
      most_improved:  pickMaxBy(subjectsArr.filter(s => s.samples >= 2), s => s.delta),
    };
    const chapterPick = {
      weakest:       pickMinBy(chaptersArr, c => c.avg),
      most_improved: pickMaxBy(chaptersArr.filter(c => c.samples >= 2), c => c.delta),
    };
    const topicPick = {
      weakest:       pickMinBy(topicsArr, t => t.avg),
      most_improved: pickMaxBy(topicsArr.filter(t => t.samples >= 2), t => t.delta),
    };

    // ---------- AI-generated fields ----------
    const aiContext = {
      student_name: firstName,
      preparation, overallAccuracy, readiness, progress, streak,
      totals: {
        reports: reps.length, practice_tests: atts.length,
        pending_wrongs: pending, mastered_wrongs: mastered,
        revision_items: (revItems.data ?? []).length,
        revision_tests: (revTests.data ?? []).length,
      },
      subject_stats: subjectsArr,
      chapter_stats: chaptersArr.slice(0, 30),
      topic_stats: topicsArr.slice(0, 30),
      recent_reports: reps.slice(-6).reverse().map(r => ({
        title: r.title, type: r.report_type, accuracy: r.accuracy,
        readiness: r.readiness_score, date: r.created_at,
        weak_chapters: r.report?.priority_chapters ?? r.report?.weak_chapters ?? [],
        weak_topics:   r.report?.priority_topics   ?? r.report?.weak_topics   ?? [],
        biggest_weakness: r.report?.biggest_weakness,
        frequent_mistakes: r.report?.ai_coach?.frequent_mistakes ?? r.report?.frequent_mistakes,
      })),
      active_goals: goals.data ?? [],
      recent_attempts: atts.slice(0, 15),
    };

    let aiOut: any = {};
    const aiKey = Deno.env.get("LOVABLE_API_KEY");
    if (aiKey && reps.length + atts.length > 0) {
      try {
        const aiRes = await fetch(LOVABLE_AI_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiKey}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: `You are the "Preparation 360°" brain for student "${firstName}" inside AJIT 360. Look at the DATA (JSON of their full preparation) and return a STRICT JSON object with these keys ONLY:
{
 "insights": string[],              // 4-6 data-backed one-liners. Every sentence MUST cite a real number/name from DATA (e.g. "Geometry accuracy last 3 mocks: 62%→71%→78% — clear improvement"). NEVER generic advice.
 "current_recommendation": string,  // single most important next action, 1 sentence.
 "common_mistake": string,          // most repeated mistake pattern seen across reports.
 "recommendations": [ { "label": string, "type": "practice"|"revision"|"pdf"|"chapter"|"topic"|"planner", "reason": string } ]  // 3-6 actionable items.
}
Language: natural mix of simple Hindi (Devanagari) + English technical terms (Accuracy, Score, Revision, Chapter, Topic, Practice, Priority, Mock Test, Readiness). Keys stay English. Never invent numbers/chapters/topics that are not in DATA. If DATA is too thin, say so honestly in insights.` },
              { role: "user", content: `DATA:\n${JSON.stringify(aiContext)}` },
            ],
          }),
        });
        if (aiRes.ok) {
          const j = await aiRes.json();
          const raw = j.choices?.[0]?.message?.content ?? "{}";
          try { aiOut = JSON.parse(raw); } catch { aiOut = {}; }
        }
      } catch (e) { console.error("prep360 ai error", e); }
    }

    const result = {
      student_name: firstName,
      scores: {
        preparation, accuracy: overallAccuracy, readiness, progress,
      },
      streak,
      targets,
      subjects: subjectPick,
      chapters: chapterPick,
      topics:   topicPick,
      common_mistake: aiOut.common_mistake ?? null,
      current_recommendation: aiOut.current_recommendation ?? null,
      insights: Array.isArray(aiOut.insights) ? aiOut.insights : [],
      recommendations: Array.isArray(aiOut.recommendations) ? aiOut.recommendations : [],
      totals: aiContext.totals,
      generated_at: new Date().toISOString(),
    };

    // Persist snapshot
    try {
      await admin.from("ai_coach_snapshots").insert({
        user_id: userId,
        focus: result.current_recommendation ?? "",
        biggest_mistake: result.common_mistake ?? "",
        target_score: `${preparation}`,
        motivation: result.insights?.[0] ?? "",
        revision_goal: `${pending} pending revision items`,
        recommendations: result.recommendations ?? [],
        sync_summary: result,
      });
    } catch (_) { /* ignore */ }

    return json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("preparation-360 error", msg);
    return json({ error: msg }, 500);
  }
});
