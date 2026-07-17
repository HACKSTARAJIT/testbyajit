import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authErr } = await supabase.auth.getClaims(token);
    if (authErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub;

    const { reportId } = await req.json();
    if (!reportId) return json({ error: "reportId required" }, 400);

    const { data: report, error: rErr } = await supabase
      .from("ai_mock_reports").select("*").eq("id", reportId).eq("user_id", userId).maybeSingle();
    if (rErr || !report) return json({ error: "Report not found" }, 404);

    // Sign each uploaded file so Gemini can fetch it.
    const filePaths: string[] = report.file_paths ?? [];
    const contentParts: any[] = [{
      type: "text",
      text: `You are an elite exam-prep coach. The user has uploaded a mock test (screenshots or PDF).
1) Read every visible element: questions, options, marked answers, correct answers, score, time, sections, subjects, chapters.
2) Produce a JSON report ONLY (no prose outside JSON) matching this schema exactly:
{
 "exam_name": string|null,
 "totals": { "questions": number, "attempted": number, "correct": number, "wrong": number, "skipped": number, "score": number|null, "max_score": number|null, "time_minutes": number|null },
 "accuracy": number, // 0-100
 "speed_analysis": string,
 "strong_subjects": string[],
 "weak_subjects": string[],
 "weak_chapters": string[],
 "weak_topics": string[],
 "frequent_mistakes": string[],
 "concept_weakness": string[],
 "silly_mistakes": string[],
 "guess_answers": string[],
 "time_pressure": string,
 "difficulty_analysis": string,
 "revision_priority": [{ "item": string, "priority": "critical"|"high"|"medium"|"strong" }],
 "important_chapters": string[],
 "important_topics": string[],
 "mistake_categories": { "concept": number, "silly": number, "calculation": number, "guess": number, "time_pressure": number, "revision_required": number, "didnt_know": number },
 "heatmap": [{ "subject": string, "chapter": string|null, "topic": string|null, "level": "strong"|"average"|"weak"|"critical" }],
 "plan_7_day": [{ "day": number, "focus": string, "tasks": string[] }],
 "plan_30_day": [{ "week": number, "focus": string, "tasks": string[] }],
 "coach_feedback": string,
 "readiness_score": number, // 0-100
 "questions": [{ "q_no": number|null, "text": string, "marked": string|null, "correct": string|null, "status": "correct"|"wrong"|"skipped"|"unknown", "subject": string|null, "chapter": string|null, "topic": string|null, "mistake_category": string|null }]
}
If a field cannot be determined, use null / [] / 0. Never hallucinate.
Also include a top-level "ocr_text": string containing the raw text you read from the images.
Return strict JSON.`,
    }];

    for (const p of filePaths) {
      const { data: signed } = await supabase.storage.from("mock-uploads").createSignedUrl(p, 60 * 30);
      if (!signed?.signedUrl) continue;
      const isPdf = p.toLowerCase().endsWith(".pdf");
      if (isPdf) {
        // Fetch and inline PDF as base64
        const res = await fetch(signed.signedUrl);
        const buf = new Uint8Array(await res.arrayBuffer());
        const b64 = btoa(String.fromCharCode(...buf));
        contentParts.push({
          type: "file",
          file: { filename: p.split("/").pop() ?? "mock.pdf", file_data: `data:application/pdf;base64,${b64}` },
        });
      } else {
        contentParts.push({ type: "image_url", image_url: { url: signed.signedUrl } });
      }
    }

    // Optional Practice Book context
    const [{ data: wrongs }, { data: attempts }] = await Promise.all([
      supabase.from("wrong_questions").select("subject, chapter, topic").eq("user_id", userId).limit(50),
      supabase.from("test_attempts").select("marks_obtained, accuracy, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
    ]);
    if ((wrongs?.length ?? 0) + (attempts?.length ?? 0) > 0) {
      contentParts.push({
        type: "text",
        text: `Existing Practice Book history for context (use if useful, do not invent):
recent_wrong_topics: ${JSON.stringify(wrongs ?? [])}
recent_attempts: ${JSON.stringify(attempts ?? [])}`,
      });
    }

    const aiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!aiKey) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const aiRes = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "user", content: contentParts }],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      await supabase.from("ai_mock_reports").update({ status: "failed", error: errText.slice(0, 500) }).eq("id", reportId);
      if (aiRes.status === 429) return json({ error: "Rate limit — please retry shortly." }, 429);
      if (aiRes.status === 402) return json({ error: "AI credits exhausted. Please add credits." }, 402);
      return json({ error: "AI request failed", details: errText }, aiRes.status);
    }

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { parsed = { raw }; }

    const totals = parsed.totals ?? {};
    await supabase.from("ai_mock_reports").update({
      status: "completed",
      report: parsed,
      ocr_text: parsed.ocr_text ?? null,
      exam_name: parsed.exam_name ?? null,
      accuracy: parsed.accuracy ?? null,
      readiness_score: parsed.readiness_score ?? null,
      overall_score: totals.score ?? null,
      error: null,
    }).eq("id", reportId);

    return json({ ok: true, report: parsed });
  } catch (e) {
    console.error("analyze-mock-test error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
