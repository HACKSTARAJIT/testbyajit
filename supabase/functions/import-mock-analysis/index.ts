import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { chatCompletion } from "../_shared/unifiedAI.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const EXTRACTION_PROMPT = `You are a strict JSON extractor. The user pastes a Gemini-generated mock test analysis report (English/Hindi/mixed). Extract ONLY the information that is explicitly present in the report. If a field is not present, use null for scalars or [] for arrays. NEVER invent, infer beyond what is stated, or paraphrase conclusions.

Return ONLY valid JSON (no markdown, no commentary) matching this exact schema:

{
  "mock_name": string|null,
  "score": number|null,
  "accuracy": number|null,
  "attempt_percent": number|null,
  "negative_marks": number|null,
  "time_used": string|null,
  "verdict": string|null,
  "exam_readiness": string|null,
  "strong_subjects": string[],
  "weak_subjects": string[],
  "strong_chapters": string[],
  "weak_chapters": string[],
  "strong_topics": string[],
  "weak_topics": string[],
  "critical_topics": string[],
  "conceptual_errors": string[],
  "silly_mistakes": string[],
  "guesswork": string[],
  "calculation_errors": string[],
  "reading_errors": string[],
  "time_problems": string[],
  "red_flags": string[],
  "strengths": string[],
  "weaknesses": string[],
  "revision_priority": string[],
  "action_plan_3day": string[],
  "next_mock_strategy": string[],
  "high_roi_chapters": string[],
  "high_roi_topics": string[]
}

Rules:
- Numbers must be plain numbers (no % sign, no "marks" suffix). If the report says "Accuracy: 62%" then accuracy = 62.
- Keep list items short and self-contained (one sentence or phrase each).
- Preserve the original language of items (do not translate).
- Return ONLY JSON.`;

function extractJson(raw: string): any {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try { return JSON.parse(cleaned); } catch {}
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
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

    const { text, mockName } = await req.json();
    if (typeof text !== "string" || text.trim().length < 40) {
      return json({ error: "Please paste the full Gemini analysis report." }, 400);
    }
    if (text.length > 60_000) {
      return json({ error: "Report is too long (max 60,000 characters)." }, 400);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // next report_number
    const { data: last } = await admin
      .from("imported_mock_reports")
      .select("report_number")
      .eq("user_id", userId)
      .order("report_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const reportNumber = (last?.report_number ?? 0) + 1;

    // Call AI
    let extracted: any = null;
    let aiError: string | null = null;
    try {
      const resp = await chatCompletion({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          { role: "user", content: text },
        ],
        temperature: 0,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }, { feature: "import_mock_analysis", timeoutMs: 60_000, overallTimeoutMs: 120_000 });
      const raw = resp.choices?.[0]?.message?.content ?? "";
      extracted = extractJson(raw);
      if (!extracted) aiError = "AI returned an unreadable response.";
    } catch (e) {
      aiError = e instanceof Error ? e.message : String(e);
    }

    if (!extracted) {
      return json({ error: aiError ?? "Extraction failed." }, 502);
    }

    const asArr = (v: any) => Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).slice(0, 60) : [];
    const asNum = (v: any) => {
      if (v === null || v === undefined || v === "") return null;
      const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d.\-]/g, ""));
      return isFinite(n) ? n : null;
    };

    const { data: reportRow, error: insertErr } = await admin
      .from("imported_mock_reports")
      .insert({
        user_id: userId,
        report_number: reportNumber,
        mock_name: (typeof mockName === "string" && mockName.trim()) ? mockName.trim() : (extracted.mock_name ?? `Mock ${reportNumber}`),
        original_text: text,
        extracted,
        score: asNum(extracted.score),
        accuracy: asNum(extracted.accuracy),
        attempt_percent: asNum(extracted.attempt_percent),
        negative_marks: asNum(extracted.negative_marks),
        time_used: extracted.time_used ?? null,
        verdict: extracted.verdict ?? null,
        exam_readiness: extracted.exam_readiness ?? null,
        extraction_status: "completed",
      })
      .select()
      .single();
    if (insertErr) return json({ error: insertErr.message }, 500);

    await admin.from("imported_report_insights").insert({
      report_id: reportRow.id,
      user_id: userId,
      strong_subjects: asArr(extracted.strong_subjects),
      weak_subjects: asArr(extracted.weak_subjects),
      strong_chapters: asArr(extracted.strong_chapters),
      weak_chapters: asArr(extracted.weak_chapters),
      strong_topics: asArr(extracted.strong_topics),
      weak_topics: asArr(extracted.weak_topics),
      critical_topics: asArr(extracted.critical_topics),
      conceptual_errors: asArr(extracted.conceptual_errors),
      silly_mistakes: asArr(extracted.silly_mistakes),
      guesswork: asArr(extracted.guesswork),
      calculation_errors: asArr(extracted.calculation_errors),
      reading_errors: asArr(extracted.reading_errors),
      time_problems: asArr(extracted.time_problems),
      red_flags: asArr(extracted.red_flags),
      strengths: asArr(extracted.strengths),
      weaknesses: asArr(extracted.weaknesses),
      revision_priority: asArr(extracted.revision_priority),
      action_plan_3day: asArr(extracted.action_plan_3day),
      next_mock_strategy: asArr(extracted.next_mock_strategy),
      high_roi_chapters: asArr(extracted.high_roi_chapters),
      high_roi_topics: asArr(extracted.high_roi_topics),
    });

    // Update rolling coach memory
    await admin.from("imported_coach_memory").upsert({
      user_id: userId,
      last_report_id: reportRow.id,
      memory: { last_imported_at: new Date().toISOString(), last_report_number: reportNumber },
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    return json({ ok: true, report: reportRow });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
