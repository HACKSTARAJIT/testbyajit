// deno-lint-ignore-file no-explicit-any
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const [subs, chaps, tops, attempts, reports, wrongs, targets] = await Promise.all([
      admin.from("syllabus_subjects").select("id,name").eq("user_id", userId),
      admin.from("syllabus_chapters").select("id,subject_id,name").eq("user_id", userId),
      admin.from("syllabus_topics").select("*").eq("user_id", userId),
      admin.from("test_attempts").select("accuracy,created_at,status").eq("user_id", userId).eq("status", "completed").order("created_at", { ascending: false }).limit(30),
      admin.from("ai_mock_reports").select("accuracy,readiness_score,report_type,created_at,status,analysis_status").eq("user_id", userId).eq("status", "completed").eq("analysis_status", "verified").order("created_at", { ascending: false }).limit(15),
      admin.from("wrong_questions").select("status,subject_id").eq("user_id", userId),
      admin.from("daily_targets").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(14),
    ]);

    const topics = (tops.data as any[]) ?? [];
    const subjects = (subs.data as any[]) ?? [];
    const chapters = (chaps.data as any[]) ?? [];
    const total = topics.length;
    const completed = topics.filter((t) => t.status === "completed").length;
    const syllabusPct = total ? Math.round((completed / total) * 100) : 0;
    const remaining = total - completed;

    const twoWeeksAgo = Date.now() - 14 * 86400_000;
    const completedRecent = topics.filter((t: any) => t.completed_at && new Date(t.completed_at).getTime() > twoWeeksAgo).length;
    const perDay = completedRecent / 14;
    const daysRemaining = perDay > 0 ? Math.ceil(remaining / perDay) : null;
    const weeksRemaining = daysRemaining !== null ? Math.ceil(daysRemaining / 7) : null;
    const expected = daysRemaining !== null ? new Date(Date.now() + daysRemaining * 86400_000).toISOString().slice(0, 10) : null;

    const subjectSummary = subjects.map((s) => {
      const st = topics.filter((t: any) => t.subject_id === s.id);
      const c = st.filter((t: any) => t.status === "completed").length;
      return { name: s.name, total: st.length, completed: c, pct: st.length ? Math.round((c / st.length) * 100) : 0 };
    });

    const attemptsData = (attempts.data as any[]) ?? [];
    const reportsData = (reports.data as any[]) ?? [];
    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    const mockAcc = avg(reportsData.map((r) => r.accuracy ?? 0).filter((x) => x > 0));
    const attemptAcc = avg(attemptsData.map((r) => r.accuracy ?? 0).filter((x) => x > 0));
    const readiness = avg(reportsData.map((r) => r.readiness_score ?? 0).filter((x) => x > 0));

    const pendingSample = topics.filter((t: any) => t.status !== "completed").slice(0, 20).map((t: any) => {
      const sub = subjects.find((s: any) => s.id === t.subject_id)?.name ?? "Subject";
      const ch = chapters.find((c: any) => c.id === t.chapter_id)?.name ?? "Chapter";
      return `${sub} > ${ch} > ${t.name} (${t.status}, ${t.priority})`;
    });

    const context = {
      overall: { total, completed, pending: remaining, pct: syllabusPct },
      subjects: subjectSummary,
      pending_topics_sample: pendingSample,
      mock_accuracy: mockAcc,
      practice_accuracy: attemptAcc,
      readiness_score: readiness,
      wrongs_pending: ((wrongs.data as any[]) ?? []).filter((w: any) => w.status === "pending").length,
      targets_last_14d: ((targets.data as any[]) ?? []).length,
    };

    const aiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!aiKey) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const system = "You are AJIT AI, an exam-selection coach. Reply strictly in JSON only. Use short direct sentences mixing Hindi + English. Never give generic advice. Every point must reference actual subjects, chapters or topics from the provided data. If a subject is weak in mocks AND its syllabus is incomplete, tell the student to finish that syllabus first.";
    const userPrompt = `USER DATA:\n${JSON.stringify(context)}\n\nRespond with JSON exactly matching this shape:\n{\n  "summary": string,\n  "insights": string[],   // 3-6, specific\n  "gaps": string[],       // 3-6, specific syllabus gaps\n  "next_plan": string[],  // 3-6 concrete actions naming actual pending topics\n  "readiness": { "syllabus": number, "subject": number, "exam": number, "selection": number } // 0-100 ints\n}`;

    const aiRes = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: system }, { role: "user", content: userPrompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      if (aiRes.status === 429) return json({ error: "Rate limit exceeded, try again shortly" }, 429);
      if (aiRes.status === 402) return json({ error: "AI credits exhausted" }, 402);
      return json({ error: `AI gateway error: ${t}` }, 500);
    }
    const aiJson = await aiRes.json();
    let parsed: any = {};
    try { parsed = JSON.parse(aiJson.choices?.[0]?.message?.content ?? "{}"); } catch { parsed = {}; }

    return json({
      summary: parsed.summary ?? "",
      insights: Array.isArray(parsed.insights) ? parsed.insights : [],
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
      next_plan: Array.isArray(parsed.next_plan) ? parsed.next_plan : [],
      readiness: parsed.readiness ?? { syllabus: syllabusPct, subject: 0, exam: 0, selection: 0 },
      estimated: { days_remaining: daysRemaining, weeks_remaining: weeksRemaining, expected_date: expected },
    });
  } catch (e) {
    console.error("syllabus-ai error", e);
    return json({ error: String((e as any)?.message ?? e) }, 500);
  }
});
