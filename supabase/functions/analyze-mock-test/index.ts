import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

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

    // Mark analyzing, then process in background so we return immediately
    // and avoid the 150s edge-function idle timeout for slow AI calls.
    await supabase.from("ai_mock_reports").update({ status: "analyzing", error: null }).eq("id", reportId);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // @ts-ignore EdgeRuntime is provided by Supabase edge runtime
    EdgeRuntime.waitUntil(processReport(admin, reportId, userId, report));

    return json({ ok: true, status: "analyzing" }, 202);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("analyze-mock-test entry error", msg);
    return json({ error: msg }, 500);
  }
});

async function processReport(admin: any, reportId: string, userId: string, report: any) {
  try {
    const filePaths: string[] = report.file_paths ?? [];
    const contentParts: any[] = [{
      type: "text",
      text: `You are an elite exam-prep coach. The user has uploaded a mock test (screenshots or PDF).
1) Read every visible element: questions, options, marked answers, correct answers, score, time, sections, subjects, chapters.
2) Produce a JSON report ONLY (no prose outside JSON) matching this schema exactly:
{
 "exam_name": string|null,
 "totals": { "questions": number, "attempted": number, "correct": number, "wrong": number, "skipped": number, "score": number|null, "max_score": number|null, "time_minutes": number|null },
 "accuracy": number,
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
 "readiness_score": number,
 "questions": [{ "q_no": number|null, "text": string, "marked": string|null, "correct": string|null, "status": "correct"|"wrong"|"skipped"|"unknown", "subject": string|null, "chapter": string|null, "topic": string|null, "mistake_category": string|null }]
}
If a field cannot be determined, use null / [] / 0. Never hallucinate.
Also include a top-level "ocr_text": string containing the raw text you read from the images.
Return strict JSON.`,
    }];

    for (const p of filePaths) {
      try {
        const { data: signed, error: signErr } = await admin.storage.from("mock-uploads").createSignedUrl(p, 60 * 30);
        if (signErr || !signed?.signedUrl) { console.error("sign url failed", p, signErr); continue; }
        const isPdf = p.toLowerCase().endsWith(".pdf");
        const res = await fetch(signed.signedUrl);
        if (!res.ok) { console.error("fetch upload failed", p, res.status); continue; }
        const buf = new Uint8Array(await res.arrayBuffer());
        const b64 = bytesToBase64(buf);
        if (isPdf) {
          contentParts.push({
            type: "file",
            file: { filename: p.split("/").pop() ?? "mock.pdf", file_data: `data:application/pdf;base64,${b64}` },
          });
        } else {
          const ext = (p.split(".").pop() ?? "png").toLowerCase();
          const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";
          contentParts.push({ type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } });
        }
      } catch (fileErr) {
        console.error("file processing error", p, fileErr);
      }
    }

    const [{ data: wrongs }, { data: attempts }] = await Promise.all([
      admin.from("wrong_questions").select("subject, chapter, topic").eq("user_id", userId).limit(50),
      admin.from("test_attempts").select("marks_obtained, accuracy, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
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
    if (!aiKey) throw new Error("LOVABLE_API_KEY missing");

    console.log("calling AI", { reportId, parts: contentParts.length });
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
      throw new Error(`AI ${aiRes.status}: ${errText.slice(0, 800)}`);
    }
    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { parsed = { raw }; }

    const totals = parsed.totals ?? {};
    await admin.from("ai_mock_reports").update({
      status: "completed",
      report: parsed,
      ocr_text: parsed.ocr_text ?? null,
      exam_name: parsed.exam_name ?? null,
      accuracy: parsed.accuracy ?? null,
      readiness_score: parsed.readiness_score ?? null,
      overall_score: totals.score ?? null,
      error: null,
    }).eq("id", reportId);
    console.log("report done", reportId);
  } catch (e) {
    const msg = e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e);
    console.error("processReport failed", reportId, msg);
    await admin.from("ai_mock_reports").update({ status: "failed", error: msg.slice(0, 1000) }).eq("id", reportId);
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
