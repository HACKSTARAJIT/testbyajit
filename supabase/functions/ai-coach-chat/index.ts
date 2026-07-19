import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

    const { threadId, message } = await req.json();
    if (!threadId || typeof message !== "string" || !message.trim()) {
      return json({ error: "threadId and message required" }, 400);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify thread ownership
    const { data: thread } = await admin
      .from("ai_chat_threads").select("id, user_id, title").eq("id", threadId).maybeSingle();
    if (!thread || thread.user_id !== userId) return json({ error: "Thread not found" }, 404);

    // Save user message
    await admin.from("ai_chat_messages").insert({
      thread_id: threadId, user_id: userId, role: "user", content: message,
    });

    // Load thread history
    const { data: history } = await admin
      .from("ai_chat_messages").select("role, content")
      .eq("thread_id", threadId).order("created_at").limit(40);

    // Build FULL student context — never rely on a single upload.
    const [prof, reports, coach, wrongs, attempts, weakGoals, plan, revItems, revTests, activity, perf] = await Promise.all([
      admin.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
      admin.from("ai_mock_reports").select("title, exam_name, report_type, detected_subject, detected_chapter, detected_topic, accuracy, readiness_score, overall_score, report, created_at")
        .eq("user_id", userId).eq("status", "completed").order("created_at", { ascending: false }).limit(8),
      admin.from("ai_coach_snapshots").select("focus, biggest_mistake, target_score, motivation, revision_goal, recommendations")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("wrong_questions").select("chapter_id, subject_id, priority, status, wrong_count, last_attempt_at, topic")
        .eq("user_id", userId).limit(400),
      admin.from("test_attempts").select("accuracy, marks_obtained, total_questions, correct_count, incorrect_count, created_at")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      admin.from("smart_goals").select("title, target_value, current_value, unit, deadline, status")
        .eq("user_id", userId).eq("status", "active").limit(10),
      admin.from("study_plan_tasks").select("title, chapter, topic, priority, status, task_date")
        .eq("user_id", userId).gte("task_date", new Date().toISOString().slice(0, 10)).order("task_date").limit(20),
      admin.from("revision_items").select("item_type, subject_id, created_at").eq("user_id", userId).limit(200),
      admin.from("revision_tests").select("title, question_count, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
      admin.from("study_activity").select("opened_at").eq("user_id", userId).order("opened_at", { ascending: false }).limit(60),
      admin.from("performance").select("*").eq("user_id", userId).limit(50),
    ]);

    const firstName = (prof.data?.display_name ?? "Student").trim().split(/\s+/)[0] || "Student";
    const wrongsData = wrongs.data ?? [];
    const pendingCount = wrongsData.filter((w: any) => w.status === "pending").length;
    const masteredCount = wrongsData.filter((w: any) => w.status === "mastered").length;
    const criticalCount = wrongsData.filter((w: any) => w.priority === "critical" && w.status !== "mastered").length;

    // Study streak from study_activity (distinct days)
    const days = new Set((activity.data ?? []).map((r: any) => (r.opened_at ?? "").slice(0, 10)));
    let streak = 0;
    for (let i = 0; i < 60; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      if (days.has(d.toISOString().slice(0, 10))) streak++; else break;
    }

    const reportSummaries = (reports.data ?? []).map((r: any) => ({
      title: r.title, type: r.report_type, subject: r.detected_subject, chapter: r.detected_chapter, topic: r.detected_topic,
      accuracy: r.accuracy, readiness: r.readiness_score, score: r.overall_score,
      weak_chapters: r.report?.priority_chapters ?? r.report?.weak_chapters ?? [],
      weak_topics: r.report?.priority_topics ?? r.report?.weak_topics ?? [],
      strong_subjects: r.report?.strong_subjects ?? [],
      biggest_weakness: r.report?.biggest_weakness,
      date: r.created_at,
    }));

    const context = {
      student_name: firstName,
      preparation_summary: {
        total_ai_reports: reportSummaries.length,
        total_practice_tests: (attempts.data ?? []).length,
        study_streak_days: streak,
        pending_revision: pendingCount,
        mastered_wrong_questions: masteredCount,
        critical_wrong_questions: criticalCount,
        revision_items_saved: (revItems.data ?? []).length,
        revision_tests_taken: (revTests.data ?? []).length,
      },
      all_reports_recent_first: reportSummaries,
      coach_snapshot: coach.data ?? null,
      recent_practice_attempts: (attempts.data ?? []).slice(0, 20),
      subject_performance: perf.data ?? [],
      active_goals: weakGoals.data ?? [],
      upcoming_tasks: plan.data ?? [],
    };


    const systemPrompt = `You are ${firstName}'s Personal AI Exam Coach inside "AJIT 360". You know this student's FULL preparation journey — every AI report, every Practice Test attempt, every Wrong Question, every Smart Revision item, every active goal — through the CONTEXT below.

CRITICAL RULES:
- NEVER answer based only on the latest uploaded mock. Always reason across the student's COMPLETE preparation history in CONTEXT (all_reports_recent_first, recent_practice_attempts, subject_performance, preparation_summary, coach_snapshot, active_goals, upcoming_tasks).
- Address the student as "${firstName}" naturally.
- Every claim (numbers, chapters, trends, improvements, declines) MUST come from CONTEXT. Never invent a chapter/topic/number/history that isn't there.
- Prefer comparisons across reports/attempts ("पिछले 3 mocks में Trigonometry accuracy 62% → 71% → 78% — clear improvement").
- If the data doesn't cover the question, say so honestly and suggest which action would generate that data.
- NEVER promise or predict selection.
- Language: natural mix of simple Hindi (Devanagari) + English technical terms. Keep Accuracy, Score, Revision, Chapter, Topic, Subject, Practice, Priority, Mock Test, Readiness, AI Coach, Streak in English inside Hindi sentences.
- Keep replies focused and actionable — short paragraphs, bullets where useful, no filler.
- Recommend things already inside AJIT 360: Smart Revision, Practice Tests, PDF Notes, weak-chapter revision, Study Planner.
- Never leak raw JSON, IDs, or internal field names.

STUDENT CONTEXT (JSON):
${JSON.stringify(context)}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(history ?? []).map((m: any) => ({ role: m.role, content: m.content })),
    ];

    const aiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!aiKey) throw new Error("LOVABLE_API_KEY missing");

    const aiRes = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      const status = aiRes.status;
      if (status === 429) return json({ error: "Rate limit — please wait a moment and try again." }, 429);
      if (status === 402) return json({ error: "AI credits exhausted — please add credits." }, 402);
      throw new Error(`AI ${status}: ${errText.slice(0, 400)}`);
    }
    const data = await aiRes.json();
    const reply = data.choices?.[0]?.message?.content ?? "मुझे इस समय जवाब नहीं मिल पाया।";

    // Save assistant message + bump thread
    await admin.from("ai_chat_messages").insert({
      thread_id: threadId, user_id: userId, role: "assistant", content: reply,
    });
    // Auto-title from first user message if still default
    const patch: any = { last_message_at: new Date().toISOString() };
    if (thread.title === "New chat") patch.title = message.slice(0, 60);
    await admin.from("ai_chat_threads").update(patch).eq("id", threadId);

    return json({ reply });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("ai-coach-chat error", msg);
    return json({ error: msg }, 500);
  }
});
