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
    // Fetch student's display name for personalization
    let firstName = "Student";
    try {
      const { data: prof } = await admin.from("profiles").select("display_name").eq("id", userId).maybeSingle();
      const dn = (prof?.display_name ?? "").trim();
      if (dn) firstName = dn.split(/\s+/)[0];
    } catch (_) { /* ignore */ }

    const contentParts: any[] = [{
      type: "text",
      text: `You are a senior SSC / competitive-exam faculty personally reviewing the mock test of your student "${firstName}". You are NOT an AI chatbot. Write like an experienced teacher who has sat across the table with the student — warm, specific, blunt where needed, motivational, never generic. Every observation MUST be grounded in what you actually see in the uploaded pages. Never invent chapters/topics/numbers that are not visible.

STEP 1 — Read every visible element: questions, options, marked answers, correct answers, section-wise score, timing, subjects, chapters, topics.
STEP 2 — Return ONE strict JSON object, no prose outside JSON, matching this schema EXACTLY (keys in English, narrative in bilingual as described below):

{
 "exam_name": string|null,
 "totals": { "questions": number, "attempted": number, "correct": number, "wrong": number, "skipped": number, "score": number|null, "max_score": number|null, "time_minutes": number|null },
 "accuracy": number,
 "readiness_score": number,
 "readiness_reason": string,
 "readiness_to_90": string,

 "overall_performance": string,
 "performance_summary": string,
 "positive_points": string[],
 "negative_points": string[],
 "biggest_strength": string,
 "biggest_weakness": string,
 "lost_marks_analysis": string,
 "improvement_areas": string[],
 "priority_chapters": string[],
 "priority_topics": string[],
 "revision_advice": string,
 "time_management_advice": string,
 "motivational_feedback": string,

 "speed_analysis": string,
 "time_pressure": string,
 "difficulty_analysis": string,

 "strong_subjects": string[],
 "weak_subjects": string[],
 "weak_chapters": string[],
 "weak_topics": string[],
 "strong_topics": string[],
 "critical_topics": string[],
 "immediate_revision_topics": string[],
 "frequent_mistakes": string[],
 "concept_weakness": string[],
 "silly_mistakes": string[],
 "guess_answers": string[],

 "mistake_categories": { "concept": number, "calculation": number, "silly": number, "guess": number, "time_pressure": number, "revision_required": number, "didnt_know": number },
 "mistake_reasons": [{ "category": string, "why": string }],

 "question_level": {
   "easy_lost": number, "medium_lost": number, "hard_lost": number,
   "skipped": number, "guessed": number, "wrong": number, "correct": number
 },

 "subject_analysis": [{
   "subject": string, "accuracy": number,
   "strength": string, "weakness": string,
   "confidence_level": "low"|"medium"|"high",
   "revision_priority": "critical"|"high"|"medium"|"low",
   "expected_improvement": string
 }],

 "chapter_analysis": [{
   "chapter": string, "subject": string|null,
   "accuracy": number, "attempted": number, "wrong": number,
   "confidence": "low"|"medium"|"high",
   "priority": "critical"|"high"|"medium"|"low",
   "ai_advice": string
 }],

 "revision_priority": [{ "item": string, "priority": "critical"|"high"|"medium"|"strong" }],
 "important_chapters": string[],
 "important_topics": string[],
 "heatmap": [{ "subject": string, "chapter": string|null, "topic": string|null, "level": "strong"|"average"|"weak"|"critical" }],

 "ai_coach": {
   "why_marks_lost": string,
   "study_today": string,
   "can_wait": string,
   "revise_tomorrow": string,
   "biggest_opportunity": string,
   "common_mistakes": string,
   "how_to_score_more_next_mock": string
 },
 "coach_feedback": string,

 "plan_7_day": [{
   "day": number, "focus": string,
   "chapters": string[], "topics": string[],
   "practice_questions": number, "revision_minutes": number,
   "mock_recommendation": string,
   "tasks": string[]
 }],
 "plan_30_day": [{
   "week": number, "focus": string,
   "chapters": string[], "topics": string[],
   "tasks": string[]
 }],

 "questions": [{ "q_no": number|null, "text": string, "marked": string|null, "correct": string|null, "status": "correct"|"wrong"|"skipped"|"unknown", "subject": string|null, "chapter": string|null, "topic": string|null, "mistake_category": string|null }],

 "ocr_text": string
}

LANGUAGE & TONE RULES (STRICT — the report must read like a senior SSC faculty, not a chatbot):
- Keys stay in English. Subject / Chapter / Topic names stay in English (e.g. "Trigonometry", "Coordinate Geometry", "Reasoning", "Polity").
- ALL narrative values — overall_performance, performance_summary, positive_points, negative_points, biggest_strength, biggest_weakness, lost_marks_analysis, improvement_areas items, revision_advice, time_management_advice, motivational_feedback, speed_analysis, time_pressure, difficulty_analysis, frequent_mistakes, concept_weakness, silly_mistakes, guess_answers, mistake_reasons[].why, subject_analysis strings, chapter_analysis.ai_advice, ai_coach fields, coach_feedback, plan_7_day/30_day focus + tasks, readiness_reason, readiness_to_90 — MUST be written in a natural mix of simple Hindi in Devanagari + English technical terms.
- Keep these words in English inside Hindi sentences: Accuracy, Score, Performance, Mock Test, Revision, Chapter, Topic, Subject, Concept, Calculation, Silly Mistake, Guess, Time Pressure, Time Management, Practice, Focus, Weak, Strong, Priority, Readiness, AI Coach.
- Do NOT write pure English. Do NOT write pure Hindi. Do NOT write Roman-Hindi (no "aapki accuracy achhi hai"). Devanagari for Hindi words.
- Address the student personally by first name "${firstName}" at least in overall_performance, coach_feedback and motivational_feedback (e.g. "${firstName}, आपकी Accuracy ...").
- coach_feedback: 5–8 sentences — क्यों marks गए, कौन से Chapters पहले पढ़ने हैं, कौन से Topics तुरंत Revision चाहिए, Time Management सलाह, रोज़ का study target, आखिर में एक personal motivational line।
- motivational_feedback: 2–3 lines, personalised to THIS mock's numbers — never a generic quote.
- lost_marks_analysis: explain sectionwise कहाँ और क्यों marks गए (concept gap, calculation, silly, time, guess) with specific chapter/topic names from the paper.
- readiness_reason explains WHY the readiness_score is what it is. readiness_to_90 explains क्या करना है 90% तक पहुँचने के लिए. NEVER promise guaranteed selection.
- Each task in plan_7_day / plan_30_day reads like a short teacher instruction (e.g. "Trigonometry के Height & Distance के 25 Practice questions solve करें और गलतियों की Revision करें").
- mistake_reasons: one entry per non-zero mistake_categories key, explaining WHY that class of mistake happened in this paper.
- Every string must be specific to THIS paper. Avoid repetitive sentences, avoid generic advice, avoid hallucinations. If a field cannot be determined, use null / [] / 0.

Return strict JSON only.`,
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

    // ---- Smart Revision sync + Planner/Coach/Goals persistence (non-fatal) ----
    try {
      await syncWithPracticeBook(admin, userId, reportId, parsed);
    } catch (syncErr) {
      console.error("sync failed", reportId, syncErr);
    }

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
