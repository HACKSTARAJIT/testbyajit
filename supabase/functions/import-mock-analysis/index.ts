import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { chatCompletion } from "../_shared/unifiedAI.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const EXTRACTION_PROMPT = `You are a strict, format-agnostic JSON extractor for AJIT 360.

The user pastes a mock/practice test analysis produced by ANY AI system — Gemini, ChatGPT, Claude, DeepSeek, Perplexity, Copilot, Grok, Llama, etc. — in ANY structure, ANY headings, ANY language (English / Hindi / Hinglish / mixed).

Your job:
1. SEMANTICALLY understand the report. Different AIs use different words for the same concept:
   - "Overall Result" / "Performance Summary" / "Final Score" / "कुल स्कोर" → score/accuracy fields
   - "Weak Areas" / "Areas of Improvement" / "Focus Zones" / "कमज़ोर विषय" → weak_subjects/topics
   - "Silly Mistakes" / "Careless Errors" / "Avoidable Mistakes" → silly_mistakes
   - "Concept Gaps" / "Fundamental Errors" / "Understanding Issues" → conceptual_errors
   - "Formulas to Remember" / "Key Tricks" / "Shortcuts" / "Important Points" → learning_repository
2. Map ANY variation onto the schema below.
3. If per-question analysis is present (Q1, Q2, question numbers, "Question 5 was wrong because…"), extract it into question_level.
4. When explicit data is missing but strongly implied by nearby text, you MAY infer conservatively — but NEVER fabricate numbers, ranks, or facts the report does not support.
5. Preserve original language of every text item. Do NOT translate.
6. Keep each list item short (one sentence/phrase).

Return ONLY valid JSON (no markdown, no commentary, no code fences) exactly matching this schema:

{
  "source_ai": string|null,               // best guess: "Gemini"|"ChatGPT"|"Claude"|"DeepSeek"|"Unknown"
  "mock_name": string|null,
  "score": number|null,
  "accuracy": number|null,                // 0-100
  "attempt_percent": number|null,         // 0-100
  "negative_marks": number|null,
  "overall_rank": number|null,
  "percentile": number|null,              // 0-100
  "time_used": string|null,
  "verdict": string|null,
  "exam_readiness": string|null,
  "section_scores": [                     // per-section/per-subject scores if present
    { "name": string, "score": number|null, "total": number|null, "accuracy": number|null, "attempted": number|null }
  ],
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
  "high_roi_topics": string[],
  "improving_topics": string[],           // topics the report calls out as improving
  "declining_topics": string[],           // topics the report calls out as declining
  "mistake_bank": [                       // EVERY wrong-answer insight found in the report
    { "topic": string|null, "chapter": string|null, "subject": string|null,
      "question": string|null, "why_wrong": string|null, "correct_concept": string|null,
      "trick": string|null, "type": string|null }
  ],
  "skipped_bank": [                       // EVERY skipped question insight
    { "topic": string|null, "chapter": string|null, "subject": string|null,
      "question": string|null, "reason": string|null, "recommendation": string|null }
  ],
  "learning_repository": [                // formulas, tricks, definitions, rules, vocabulary
    { "kind": string, "title": string, "content": string, "topic": string|null, "chapter": string|null, "subject": string|null }
  ],
  "additional_insights": string[],        // anything valuable that did not fit above
  "question_level": [                     // per-question detail if the report has it
    { "q_no": number|null, "subject": string|null, "chapter": string|null, "topic": string|null,
      "status": "correct"|"wrong"|"skipped"|null, "difficulty": string|null, "note": string|null }
  ]
}

Rules:
- Numbers must be plain numbers (no % or "marks" suffix). "Accuracy: 62%" → 62.
- Empty arrays [] and null are valid when the info is not present.
- Do NOT include any key outside this schema.
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
      return json({ error: "Please paste the full AI analysis report." }, 400);
    }
    if (text.length > 80_000) {
      return json({ error: "Report is too long (max 80,000 characters)." }, 400);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: last } = await admin
      .from("imported_mock_reports")
      .select("report_number")
      .eq("user_id", userId)
      .order("report_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const reportNumber = (last?.report_number ?? 0) + 1;

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
        max_tokens: 8000,
        response_format: { type: "json_object" },
      }, { feature: "import_mock_analysis", timeoutMs: 90_000, overallTimeoutMs: 150_000 });
      const raw = resp.choices?.[0]?.message?.content ?? "";
      extracted = extractJson(raw);
      if (!extracted) aiError = "AI returned an unreadable response.";
    } catch (e) {
      aiError = e instanceof Error ? e.message : String(e);
    }

    if (!extracted) {
      return json({ error: aiError ?? "Extraction failed." }, 502);
    }

    const asArr = (v: any) => Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).slice(0, 100) : [];
    const asObjArr = (v: any) => Array.isArray(v) ? v.filter((x) => x && typeof x === "object").slice(0, 500) : [];
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
        source_ai: typeof extracted.source_ai === "string" ? extracted.source_ai : null,
        score: asNum(extracted.score),
        accuracy: asNum(extracted.accuracy),
        attempt_percent: asNum(extracted.attempt_percent),
        negative_marks: asNum(extracted.negative_marks),
        overall_rank: asNum(extracted.overall_rank),
        percentile: asNum(extracted.percentile),
        section_scores: asObjArr(extracted.section_scores),
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
      improving_topics: asArr(extracted.improving_topics),
      declining_topics: asArr(extracted.declining_topics),
      mistake_bank: asObjArr(extracted.mistake_bank),
      skipped_bank: asObjArr(extracted.skipped_bank),
      learning_repository: asObjArr(extracted.learning_repository),
      additional_insights: asArr(extracted.additional_insights),
      question_level: asObjArr(extracted.question_level),
    });

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
