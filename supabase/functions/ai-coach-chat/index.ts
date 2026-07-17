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

    // Build student context (only their own data)
    const [prof, latestReport, coach, wrongs, attempts, weakGoals, plan] = await Promise.all([
      admin.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
      admin.from("ai_mock_reports").select("exam_name, accuracy, readiness_score, overall_score, report, created_at")
        .eq("user_id", userId).eq("status", "completed").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("ai_coach_snapshots").select("focus, biggest_mistake, target_score, motivation, revision_goal, recommendations")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("wrong_questions").select("chapter_id, subject_id, priority, status, wrong_count, last_attempt_at, topic")
        .eq("user_id", userId).limit(200),
      admin.from("test_attempts").select("accuracy, marks_obtained, created_at")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(15),
      admin.from("smart_goals").select("title, target_value, current_value, unit, deadline, status")
        .eq("user_id", userId).eq("status", "active").limit(10),
      admin.from("study_plan_tasks").select("title, chapter, topic, priority, status, task_date")
        .eq("user_id", userId).gte("task_date", new Date().toISOString().slice(0, 10)).order("task_date").limit(20),
    ]);

    const firstName = (prof.data?.display_name ?? "Student").trim().split(/\s+/)[0] || "Student";
    const wrongsData = wrongs.data ?? [];
    const pendingCount = wrongsData.filter((w: any) => w.status === "pending").length;
    const masteredCount = wrongsData.filter((w: any) => w.status === "mastered").length;
    const criticalCount = wrongsData.filter((w: any) => w.priority === "critical" && w.status !== "mastered").length;

    const rep = latestReport.data?.report ?? {};
    const context = {
      student_name: firstName,
      latest_mock: latestReport.data ? {
        exam: latestReport.data.exam_name,
        accuracy: latestReport.data.accuracy,
        readiness: latestReport.data.readiness_score,
        score: latestReport.data.overall_score,
        weak_chapters: rep.priority_chapters ?? rep.weak_chapters ?? [],
        weak_topics: rep.priority_topics ?? rep.weak_topics ?? [],
        strong_subjects: rep.strong_subjects ?? [],
        biggest_weakness: rep.biggest_weakness,
        date: latestReport.data.created_at,
      } : null,
      coach_snapshot: coach.data ?? null,
      revision_stats: {
        pending_wrong_questions: pendingCount,
        mastered: masteredCount,
        critical_priority: criticalCount,
      },
      recent_attempts: (attempts.data ?? []).slice(0, 10),
      active_goals: weakGoals.data ?? [],
      upcoming_tasks: plan.data ?? [],
    };

    const systemPrompt = `You are ${firstName}'s Personal AI Exam Coach inside "Practice Book by Ajit". You know this student's full preparation journey through the CONTEXT below. You are NOT a generic chatbot — you are their personal mentor.

RULES:
- Address the student as "${firstName}" naturally.
- Answer ONLY using the student's own data in CONTEXT. Never invent numbers, chapters, topics, or history.
- If the data doesn't cover the question, say so honestly and suggest which action would generate that data (e.g. "upload a Mock Test", "attempt a Practice Test on Geometry").
- NEVER promise or predict selection.
- Language: natural mix of simple Hindi (Devanagari) + English technical terms — same tone as the AI Mock Analyzer reports. Keep words like Accuracy, Score, Revision, Chapter, Topic, Subject, Practice, Priority, Mock Test, Readiness, AI Coach in English inside Hindi sentences.
- Keep replies focused and actionable — short paragraphs, bullet points where useful, no filler.
- When recommending next steps, prefer things the student already has in Practice Book: Smart Revision, Practice Tests, PDF Notes, weak-chapter revision.
- Never leak raw JSON, IDs, or internal field names to the student.

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
