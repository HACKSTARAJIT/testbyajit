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

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Gather student context
    const [prof, wrongsRes, chaptersRes, subjectsRes, latestReport, attemptsRes] = await Promise.all([
      admin.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
      admin.from("wrong_questions")
        .select("chapter_id, subject_id, priority, status, wrong_count, topic, last_attempt_at")
        .eq("user_id", userId).eq("status", "pending").limit(200),
      admin.from("chapters").select("id, name, subject_id"),
      admin.from("subjects").select("id, name"),
      admin.from("ai_mock_reports").select("report, created_at, report_type")
        .eq("user_id", userId).eq("status", "completed")
        .eq("analysis_status", "verified")
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("test_attempts").select("accuracy, created_at")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
    ]);

    const firstName = ((prof.data?.display_name ?? "").trim().split(/\s+/)[0]) || "Student";
    const chapMap = new Map<string, { name: string; subject_id: string }>();
    (chaptersRes.data ?? []).forEach((c: any) => chapMap.set(c.id, { name: c.name, subject_id: c.subject_id }));
    const subMap = new Map<string, string>();
    (subjectsRes.data ?? []).forEach((s: any) => subMap.set(s.id, s.name));

    // Aggregate weak chapters
    const weakByChap = new Map<string, { chapter: string; subject: string; priority: string; count: number; topics: Set<string> }>();
    (wrongsRes.data ?? []).forEach((w: any) => {
      if (!w.chapter_id) return;
      const ch = chapMap.get(w.chapter_id);
      if (!ch) return;
      const cur = weakByChap.get(w.chapter_id) ?? {
        chapter: ch.name,
        subject: subMap.get(ch.subject_id) ?? "General",
        priority: "medium", count: 0, topics: new Set<string>(),
      };
      cur.count += (w.wrong_count ?? 1);
      if (w.priority === "high" || w.priority === "critical") cur.priority = w.priority;
      if (w.topic) cur.topics.add(w.topic);
      weakByChap.set(w.chapter_id, cur);
    });
    const weak = [...weakByChap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
      .map(w => ({ chapter: w.chapter, subject: w.subject, priority: w.priority, wrong_count: w.count, topics: [...w.topics].slice(0, 5) }));

    const latestNarrative = latestReport.data?.report ? {
      exam: latestReport.data.report.exam_name,
      accuracy: latestReport.data.report.accuracy,
      priority_chapters: latestReport.data.report.priority_chapters ?? [],
      priority_topics: latestReport.data.report.priority_topics ?? [],
      weak_subjects: latestReport.data.report.weak_subjects ?? [],
    } : null;
    const accTrend = (attemptsRes.data ?? []).map((a: any) => a.accuracy).filter((x: any) => x != null);

    const aiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!aiKey) return json({ error: "AI key missing" }, 500);

    const prompt = `You are a senior SSC/competitive-exam faculty personally guiding your student "${firstName}". Generate a realistic 7-day study plan built ONLY from the student's actual weak areas. Return strict JSON only.

STUDENT CONTEXT
weak_chapters: ${JSON.stringify(weak)}
latest_mock: ${JSON.stringify(latestNarrative)}
recent_accuracy_trend: ${JSON.stringify(accTrend)}

Return this JSON:
{
 "summary": string,
 "days": [
   {
     "day_offset": 0,
     "focus": string,
     "tasks": [
       { "title": string, "chapter": string|null, "topic": string|null, "priority": "critical"|"high"|"medium"|"low", "estimated_minutes": number, "practice_questions": number, "revision_minutes": number }
     ]
   }
 ]
}

RULES:
- 7 days total, day_offset 0..6 (0 = today).
- 2 to 4 tasks per day. Total daily minutes 60–120.
- Every task must name a real chapter/topic from the student's weak_chapters or latest_mock. Never invent.
- Language: mix simple Hindi (Devanagari) + English technical terms. Keep Chapter/Topic/Subject names in English.
- Task titles read like short teacher instructions (e.g. "Trigonometry के Height & Distance के 25 Practice questions solve करें").
- Distribute critical/high priority chapters early in the week.
- Include Revision on day 6–7 covering the week's chapters.
- If weak_chapters is empty, generate a maintenance plan from latest_mock priorities. If both are empty, return summary "Enough data नहीं है — पहले एक Practice Test या Mock upload करें।" and days=[].`;

    const aiRes = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 4000,
      }),
    });
    if (!aiRes.ok) {
      const t = await aiRes.text();
      return json({ error: `AI ${aiRes.status}: ${t.slice(0, 300)}` }, aiRes.status === 402 || aiRes.status === 429 ? aiRes.status : 500);
    }
    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content ?? "";
    let parsed: any;
    try {
      const s = String(raw).trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      parsed = JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1));
    } catch (e) {
      return json({ error: "AI returned invalid JSON" }, 500);
    }

    const days: any[] = Array.isArray(parsed?.days) ? parsed.days : [];
    if (days.length === 0) {
      return json({ ok: true, summary: parsed?.summary ?? "No tasks generated", tasks: 0 });
    }

    // Clear previous AI-generated plan tasks (only those without report_id — planner-only)
    await admin.from("study_plan_tasks").delete().eq("user_id", userId).is("report_id", null);

    const today = new Date();
    const toDate = (offset: number) => {
      const d = new Date(today); d.setDate(d.getDate() + offset);
      return d.toISOString().slice(0, 10);
    };
    const rows: any[] = [];
    days.forEach((day: any) => {
      const offset = Number(day?.day_offset ?? 0);
      const scope = offset === 0 ? "today" : offset === 1 ? "tomorrow" : "week";
      (Array.isArray(day?.tasks) ? day.tasks : []).forEach((t: any) => {
        rows.push({
          user_id: userId,
          report_id: null,
          scope,
          task_date: toDate(offset),
          day_index: offset + 1,
          title: String(t?.title ?? day?.focus ?? "Study").slice(0, 200),
          description: day?.focus ?? null,
          chapter: t?.chapter ?? null,
          topic: t?.topic ?? null,
          estimated_minutes: Number(t?.estimated_minutes ?? 45) || 45,
          practice_questions: Number(t?.practice_questions ?? 0) || 0,
          revision_minutes: Number(t?.revision_minutes ?? 0) || 0,
          priority: ["critical", "high", "medium", "low"].includes(t?.priority) ? t.priority : "medium",
        });
      });
    });
    if (rows.length > 0) await admin.from("study_plan_tasks").insert(rows);

    return json({ ok: true, summary: parsed?.summary ?? "", tasks: rows.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("generate-study-plan error", msg);
    return json({ error: msg }, 500);
  }
});
