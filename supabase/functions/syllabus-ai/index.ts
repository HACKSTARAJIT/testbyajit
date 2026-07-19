// deno-lint-ignore-file no-explicit-any
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createLovableAiGatewayProvider } from "../_shared/ai-gateway.ts";
import { generateText, Output } from "npm:ai";
import { z } from "npm:zod";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { user_id } = await req.json();
    if (!user_id) return json({ error: "user_id required" }, 400);

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const [subs, chaps, tops, attempts, reports, wrongs, targets] = await Promise.all([
      supa.from("syllabus_subjects").select("id,name").eq("user_id", user_id),
      supa.from("syllabus_chapters").select("id,subject_id,name").eq("user_id", user_id),
      supa.from("syllabus_topics").select("*").eq("user_id", user_id),
      supa.from("test_attempts").select("accuracy,created_at,status").eq("user_id", user_id).eq("status", "completed").order("created_at", { ascending: false }).limit(30),
      supa.from("ai_mock_reports").select("accuracy,readiness_score,report_type,created_at,status,analysis_status").eq("user_id", user_id).eq("status", "completed").eq("analysis_status", "verified").order("created_at", { ascending: false }).limit(15),
      supa.from("wrong_questions").select("status,subject_id").eq("user_id", user_id),
      supa.from("daily_targets").select("*").eq("user_id", user_id).order("created_at", { ascending: false }).limit(14),
    ]);

    const topics = (tops.data as any[]) ?? [];
    const subjects = (subs.data as any[]) ?? [];
    const chapters = (chaps.data as any[]) ?? [];
    const total = topics.length;
    const completed = topics.filter((t) => t.status === "completed").length;
    const syllabusPct = total ? Math.round((completed / total) * 100) : 0;

    // Consistency estimate: completed topics per day over last 14 days
    const twoWeeksAgo = Date.now() - 14 * 86400_000;
    const completedRecent = topics.filter((t) => t.completed_at && new Date(t.completed_at).getTime() > twoWeeksAgo).length;
    const perDay = completedRecent / 14;
    const remaining = total - completed;
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
    const avgAcc = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    const mockAcc = avgAcc(reportsData.map((r) => r.accuracy ?? 0).filter((x) => x > 0));
    const attemptAcc = avgAcc(attemptsData.map((r) => r.accuracy ?? 0).filter((x) => x > 0));
    const readiness = avgAcc(reportsData.map((r) => r.readiness_score ?? 0).filter((x) => x > 0));

    const chapterNames = (subId: string) => chapters.filter((c) => c.subject_id === subId).map((c) => c.name);
    const pendingSample = topics.filter((t) => t.status !== "completed").slice(0, 20).map((t) => {
      const sub = subjects.find((s) => s.id === t.subject_id)?.name ?? "Subject";
      const ch = chapters.find((c) => c.id === t.chapter_id)?.name ?? "Chapter";
      return `${sub} > ${ch} > ${t.name} (${t.status}, ${t.priority})`;
    });

    const context = {
      overall: { total, completed, pending: remaining, pct: syllabusPct },
      subjects: subjectSummary,
      pending_topics_sample: pendingSample,
      mock_accuracy: mockAcc,
      practice_accuracy: attemptAcc,
      readiness_score: readiness,
      wrongs_pending: ((wrongs.data as any[]) ?? []).filter((w) => w.status === "pending").length,
      targets_last_14d: ((targets.data as any[]) ?? []).length,
      chapters_by_subject: subjects.map((s) => ({ subject: s.name, chapters: chapterNames(s.id) })),
    };

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "Missing LOVABLE_API_KEY" }, 500);
    const gateway = createLovableAiGatewayProvider(key);

    const { output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      output: Output.object({
        schema: z.object({
          summary: z.string(),
          insights: z.array(z.string()).max(6),
          gaps: z.array(z.string()).max(6),
          next_plan: z.array(z.string()).max(6),
          readiness: z.object({
            syllabus: z.number().int().min(0).max(100),
            subject: z.number().int().min(0).max(100),
            exam: z.number().int().min(0).max(100),
            selection: z.number().int().min(0).max(100),
          }),
        }),
      }),
      system: "You are AJIT AI, an exam-selection coach. Speak in short, direct sentences mixing Hindi + English. NEVER give generic advice. Every point must reference specific subjects, chapters or topics from the user's actual data. Use the pending topics, weak mock subjects and syllabus gaps provided. If a subject is weak in mocks AND its syllabus is incomplete, tell the student to finish that syllabus first before more mocks.",
      prompt: `USER DATA:\n${JSON.stringify(context, null, 2)}\n\nGenerate: summary (1-2 lines), 3-6 specific insights, 3-6 concrete syllabus gaps, and today's next study plan (3-6 concrete actions naming actual pending topics). Compute readiness scores (0-100).`,
    });

    return json({
      ...output,
      estimated: { days_remaining: daysRemaining, weeks_remaining: weeksRemaining, expected_date: expected },
    });
  } catch (e) {
    console.error("syllabus-ai error", e);
    return json({ error: String((e as any)?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
