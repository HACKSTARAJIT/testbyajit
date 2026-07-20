import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

import { unifiedFetch } from "../_shared/unifiedAI.ts";
const MODEL = "google/gemini-3-flash-preview";
const BATCH_SIZE = 15;

const DIFFICULTIES = ["very_easy", "easy", "medium", "hard", "very_hard"];
const BLOOM = ["remember", "understand", "apply", "analyze", "evaluate", "create"];
const IMPORTANCE = ["very_high", "high", "medium", "low", "rare"];
const EXAM_LEVELS = ["SSC MTS", "SSC CHSL", "SSC CGL", "SSC CPO", "Railway", "Banking", "State PCS", "General Competitive Exams"];

const ISSUE_TYPES = [
  "grammar_mistake","typing_mistake","ocr_error","duplicate_question","duplicate_options",
  "missing_option","incorrect_answer_key","poor_formatting","low_quality_image",
  "incomplete_question","ambiguous_wording","multiple_correct_answers",
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const token = auth.replace("Bearer ", "");
    const { data: claims } = await userClient.auth.getClaims(token);
    if (!claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // admin gate
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    if (!(roles ?? []).some((r: any) => r.role === "admin")) return json({ error: "Admins only" }, 403);

    const { testId, force } = await req.json();
    if (!testId) return json({ error: "testId required" }, 400);

    const { data: test } = await admin
      .from("tests").select("id,title,ai_analysis_status,subjects(name),chapters(name)")
      .eq("id", testId).maybeSingle();
    if (!test) return json({ error: "Test not found" }, 404);

    let qsQuery = admin.from("questions")
      .select("id,question_text,option_a,option_b,option_c,option_d,correct_option,explanation,ai_analyzed_at")
      .eq("test_id", testId).order("sort_order");
    const { data: allQs, error: qErr } = await qsQuery;
    if (qErr) return json({ error: qErr.message }, 500);
    const targets = (allQs ?? []).filter((q: any) => force || !q.ai_analyzed_at);
    if (targets.length === 0) {
      await admin.from("tests").update({ ai_analysis_status: "ready" }).eq("id", testId);
      return json({ ok: true, analyzed: 0, total: (allQs ?? []).length });
    }

    await admin.from("tests").update({ ai_analysis_status: "analyzing" }).eq("id", testId);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const context = {
      subject: (test as any).subjects?.name ?? null,
      chapter: (test as any).chapters?.name ?? null,
      test_title: test.title,
    };

    const schema = {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              subject: { type: "string" },
              chapter: { type: "string" },
              topic: { type: "string" },
              subtopic: { type: "string" },
              concept: { type: "string" },
              question_type: { type: "string" },
              language: { type: "string" },
              difficulty: { type: "string", enum: DIFFICULTIES },
              difficulty_confidence: { type: "number" },
              exam_level: { type: "string", enum: EXAM_LEVELS },
              exam_level_confidence: { type: "number" },
              related_formula: { type: "string" },
              required_rule: { type: "string" },
              required_logic: { type: "string" },
              required_skill: { type: "string" },
              importance: { type: "string", enum: IMPORTANCE },
              importance_reason: { type: "string" },
              expected_time_seconds: { type: "number" },
              fast_time_seconds: { type: "number" },
              average_time_seconds: { type: "number" },
              slow_time_seconds: { type: "number" },
              bloom_level: { type: "string", enum: BLOOM },
              bloom_reason: { type: "string" },
              quality_score: { type: "number" },
              complexity_score: { type: "number" },
              complexity_factors: { type: "array", items: { type: "string" } },
              issues: { type: "array", items: { type: "object", properties: {
                type: { type: "string", enum: ISSUE_TYPES },
                severity: { type: "string", enum: ["low", "medium", "high"] },
                note: { type: "string" },
              }, required: ["type"] } },
            },
            required: ["id", "difficulty", "bloom_level", "topic", "concept", "importance", "quality_score", "complexity_score"],
          },
        },
      },
      required: ["questions"],
    };

    const sys = `You are AJIT AI's competitive-exam content analyst.
Analyse every question with rigour. Output STRICT JSON matching the schema.
- Difficulty: consider concept depth, calculation load, trick factor, options quality.
- Provide confidence 0-100 for difficulty and exam-level predictions.
- Bloom: pick the highest cognitive level the question truly requires.
- Quality score 0-100: 100 = clean, unambiguous, correct answer, no OCR issues.
- Complexity score 0-100: overall solving complexity (harder ≠ lower quality).
- Detect ALL quality issues you can spot from the text alone (ignore images).
- expected_time_seconds should be the average student's realistic time.
Ground topic/concept in the provided subject and chapter context.`;

    let totalAnalyzed = 0;
    const failures: string[] = [];

    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const batch = targets.slice(i, i + BATCH_SIZE);
      const payload = {
        context,
        questions: batch.map((q: any) => ({
          id: q.id,
          text: q.question_text,
          options: { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d },
          correct: q.correct_option,
          explanation: q.explanation ?? null,
        })),
      };

      try {
        const resp = await unifiedFetch({ body: {
            model: MODEL,
            messages: [
              { role: "system", content: sys },
              { role: "user", content: JSON.stringify(payload) },
            ],
            tools: [{ type: "function", function: { name: "emit", description: "Return per-question analysis", parameters: schema } }],
            tool_choice: { type: "function", function: { name: "emit" } },
          }, feature: "analyze-test-questions" });
        if (resp.status === 429) { failures.push("rate_limited"); break; }
        if (resp.status === 402) { failures.push("credits_exhausted"); break; }
        if (!resp.ok) { failures.push(`http_${resp.status}`); continue; }
        const j = await resp.json();
        const raw = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? j.choices?.[0]?.message?.content ?? "{}";
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        const arr: any[] = parsed.questions ?? [];

        for (const a of arr) {
          const patch: Record<string, any> = {
            difficulty: a.difficulty ?? null,
            exam_level: a.exam_level ?? null,
            topic: a.topic ?? null,
            subtopic: a.subtopic ?? null,
            concept: a.concept ?? null,
            bloom_level: a.bloom_level ?? null,
            importance: a.importance ?? null,
            expected_time_seconds: a.expected_time_seconds ? Math.round(a.expected_time_seconds) : null,
            complexity_score: a.complexity_score != null ? Math.round(a.complexity_score) : null,
            quality_score: a.quality_score != null ? Math.round(a.quality_score) : null,
            ai_confidence: a.difficulty_confidence != null ? Math.round(a.difficulty_confidence) : null,
            ai_issues: Array.isArray(a.issues) ? a.issues : [],
            ai_analysis: a,
            ai_analyzed_at: new Date().toISOString(),
          };
          const { error: upErr } = await admin.from("questions").update(patch).eq("id", a.id);
          if (!upErr) totalAnalyzed++;
        }
      } catch (e) {
        console.error("batch error", e);
        failures.push((e as Error).message);
      }
    }

    // Build test-level summary
    const { data: freshQs } = await admin.from("questions")
      .select("difficulty,bloom_level,exam_level,quality_score,complexity_score,ai_issues,expected_time_seconds")
      .eq("test_id", testId);
    const summary = buildSummary(freshQs ?? []);
    await admin.from("tests").update({
      ai_analysis_status: failures.length && totalAnalyzed === 0 ? "failed" : "ready",
      ai_analysis_summary: summary,
      ai_analyzed_at: new Date().toISOString(),
    }).eq("id", testId);

    return json({ ok: true, analyzed: totalAnalyzed, total: (allQs ?? []).length, failures, summary });
  } catch (e) {
    console.error("analyze-test-questions error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function buildSummary(qs: any[]) {
  const total = qs.length;
  if (!total) return { total: 0 };
  const bucket = (key: string) => {
    const m: Record<string, number> = {};
    qs.forEach((q) => { const v = q[key] ?? "unknown"; m[v] = (m[v] ?? 0) + 1; });
    return m;
  };
  const avg = (key: string) => {
    const vals = qs.map((q) => Number(q[key])).filter((n) => Number.isFinite(n));
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };
  const totalTime = qs.reduce((s, q) => s + (Number(q.expected_time_seconds) || 0), 0);
  const issueCounts: Record<string, number> = {};
  let flaggedCount = 0;
  qs.forEach((q) => {
    const issues = (q.ai_issues ?? []) as any[];
    if (issues.length > 0) flaggedCount++;
    issues.forEach((i: any) => { const t = i?.type ?? "unknown"; issueCounts[t] = (issueCounts[t] ?? 0) + 1; });
  });
  return {
    total,
    difficulty: bucket("difficulty"),
    bloom: bucket("bloom_level"),
    exam_level: bucket("exam_level"),
    avg_quality_score: avg("quality_score"),
    avg_complexity_score: avg("complexity_score"),
    expected_total_time_seconds: totalTime,
    flagged_questions: flaggedCount,
    issue_counts: issueCounts,
  };
}
