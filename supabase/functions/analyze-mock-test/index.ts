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

    const verification = getVerifiedAttemptSnapshot(report, userId);
    if (!verification.ok) {
      const message = verification.error ?? INCOMPLETE_VERIFIED_DATA_MESSAGE;
      await supabase.from("ai_mock_reports").update({
        status: "failed",
        analysis_status: "failed",
        verification_error: message,
        error: message,
      }).eq("id", reportId).eq("user_id", userId);
      return json({ error: message }, 400);
    }

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
    const { data: latestReport } = await admin
      .from("ai_mock_reports")
      .select("*")
      .eq("id", reportId)
      .eq("user_id", userId)
      .maybeSingle();
    const sourceReport = latestReport ?? report;
    const verification = getVerifiedAttemptSnapshot(sourceReport, userId);
    if (!verification.ok || !verification.snapshot) {
      throw new Error(verification.error ?? INCOMPLETE_VERIFIED_DATA_MESSAGE);
    }
    const verified = verification.snapshot;
    const filePaths: string[] = sourceReport.file_paths ?? [];
    // Fetch student's display name for personalization
    let firstName = "Student";
    try {
      const { data: prof } = await admin.from("profiles").select("display_name").eq("id", userId).maybeSingle();
      const dn = (prof?.display_name ?? "").trim();
      if (dn) firstName = dn.split(/\s+/)[0];
    } catch (_) { /* ignore */ }

    const contentParts: any[] = [{
      type: "text",
      text: `You are a senior SSC / competitive-exam faculty personally reviewing the mock test of your student "${firstName}". You are NOT an AI chatbot. Write like an experienced teacher who has sat across the table with the student — warm, specific, blunt where needed, motivational, never generic. Every observation MUST be grounded in the VERIFIED_ATTEMPT_DATA and what you actually see in the uploaded pages. Never invent chapters/topics/numbers that are not present.

VERIFIED_ATTEMPT_DATA — ABSOLUTE SINGLE SOURCE OF TRUTH FOR ALL PERFORMANCE METRICS:
${JSON.stringify(verified)}

STEP 1 — Read every visible element: questions, options, marked answers, correct answers, section-wise score, timing, subjects, chapters, topics.
STEP 2 — Return ONE strict JSON object, no prose outside JSON, matching this schema EXACTLY (keys in English, narrative in bilingual as described below):

{
 "exam_name": string|null,
 "report_type": "full_mock"|"subject"|"chapter"|"topic"|"revision_test"|"previous_year",
 "detected_subject": string|null,
 "detected_chapter": string|null,
 "detected_topic": string|null,
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

 "questions": [{ "q_no": number|null, "text": string, "options": { "a": string|null, "b": string|null, "c": string|null, "d": string|null }, "marked": "A"|"B"|"C"|"D"|null, "correct": "A"|"B"|"C"|"D"|null, "status": "correct"|"wrong"|"skipped"|"unknown", "subject": string|null, "chapter": string|null, "topic": string|null, "mistake_category": string|null, "explanation": string|null }],

 "ocr_text": string
}

LANGUAGE & TONE RULES (STRICT — the report must read like a senior SSC faculty, not a chatbot):
- Keys stay in English. Subject / Chapter / Topic names stay in English (e.g. "Trigonometry", "Coordinate Geometry", "Reasoning", "Polity").
- ALL narrative values — overall_performance, performance_summary, positive_points, negative_points, biggest_strength, biggest_weakness, lost_marks_analysis, improvement_areas items, revision_advice, time_management_advice, motivational_feedback, speed_analysis, time_pressure, difficulty_analysis, frequent_mistakes, concept_weakness, silly_mistakes, guess_answers, mistake_reasons[].why, subject_analysis strings, chapter_analysis.ai_advice, ai_coach fields, coach_feedback, plan_7_day/30_day focus + tasks, readiness_reason, readiness_to_90 — MUST be written in a natural mix of simple Hindi in Devanagari + English technical terms.
- Keep these words in English inside Hindi sentences: Accuracy, Score, Performance, Mock Test, Revision, Chapter, Topic, Subject, Concept, Calculation, Silly Mistake, Guess, Time Pressure, Time Management, Practice, Focus, Weak, Strong, Priority, Readiness, AI Coach.
- Do NOT write pure English. Do NOT write pure Hindi. Do NOT write Roman-Hindi (no "aapki accuracy achhi hai"). Devanagari for Hindi words.
- Address the student personally by first name "${firstName}" at least in overall_performance, coach_feedback and motivational_feedback (e.g. "${firstName}, आपकी Accuracy ...").
- AUTO-DETECT report_type strictly from visible content — never ask the student:
  * "full_mock" — complete SSC/competitive mock covering multiple subjects.
  * "subject" — covers ONLY one subject (e.g. only Maths). Populate detected_subject.
  * "chapter" — covers ONLY one chapter of one subject. Populate detected_subject + detected_chapter.
  * "topic" — covers ONLY one topic. Populate detected_topic (+ subject/chapter if visible).
  * "revision_test" — a short revision / recap paper built from previously-wrong questions or clearly labelled Revision Test.
  * "previous_year" — a real Previous Year Paper (PYQ) of any exam (year / exam name usually printed).
- coach_feedback: 5–8 sentences — क्यों marks गए, कौन से Chapters पहले पढ़ने हैं, कौन से Topics तुरंत Revision चाहिए, Time Management सलाह, रोज़ का study target, आखिर में एक personal motivational line।
- motivational_feedback: 2–3 lines, personalised to THIS mock's numbers — never a generic quote.
- lost_marks_analysis: explain sectionwise कहाँ और क्यों marks गए (concept gap, calculation, silly, time, guess) with specific chapter/topic names from the paper.
- readiness_reason explains WHY the readiness_score is what it is. readiness_to_90 explains क्या करना है 90% तक पहुँचने के लिए. NEVER promise guaranteed selection.
- Each task in plan_7_day / plan_30_day reads like a short teacher instruction (e.g. "Trigonometry के Height & Distance के 25 Practice questions solve करें और गलतियों की Revision करें").
- mistake_reasons: one entry per non-zero mistake_categories key, explaining WHY that class of mistake happened in this paper.
- Every string must be specific to THIS paper. Avoid repetitive sentences, avoid generic advice, avoid hallucinations. If a field cannot be determined, use null / [] / 0.
- Never return an empty object, placeholder-only object, or all-zero report. If the file is readable, extract the visible totals and analysis. If the file is not readable, still return a valid JSON object with ocr_text explaining what was visible/unreadable and leave unknown fields null / [] / 0.
- A report is INVALID if totals.questions is 0/null, accuracy is missing, subject_analysis is empty, and all feedback fields are blank. Do not output that shape.
- For the "questions" array you MUST include EVERY question that is visible in the paper — do not sample or skip. For each question extract the full question text and, whenever the four options are printed in the PDF, populate options.a/b/c/d with the exact option text (without the "A." / "(A)" prefix). If an option is not clearly visible leave that specific option null. marked/correct must be a single letter A|B|C|D (map "1/2/3/4" → A/B/C/D). explanation should carry the visible solution/explanation text if printed, else null.

═══════════════════════════════════════════════════════════════════════
🚨 CRITICAL — SINGLE SOURCE OF TRUTH FOR SCORE / ACCURACY / TOTALS 🚨
═══════════════════════════════════════════════════════════════════════
VERIFIED_ATTEMPT_DATA above is the ONLY source of truth. The uploaded PDF / OCR text is NOT allowed to change any performance metric. You are FORBIDDEN from calculating, deriving, estimating, rounding or inventing any of these fields:
  totals.questions, totals.attempted, totals.correct, totals.wrong, totals.skipped,
  totals.score, totals.max_score, totals.time_minutes, accuracy
RULES (strict, non-negotiable):
1. Copy all totals from VERIFIED_ATTEMPT_DATA only. Never copy totals from OCR if OCR disagrees.
2. If VERIFIED_ATTEMPT_DATA score = 78, then totals.score MUST be exactly 78. Never 77, 79, or a re-computed value.
3. NEVER derive totals.score as (correct × marks). NEVER derive accuracy as (correct / attempted × 100). The backend has already verified the numbers.
4. Per-question status in questions[] is OCR/extraction data and MAY disagree with VERIFIED_ATTEMPT_DATA. When they disagree, VERIFIED_ATTEMPT_DATA WINS.
5. NO-HALLUCINATION LANGUAGE: never write phrases like "approximately", "around", "probably", "estimated", "roughly", "about X marks", "लगभग", "करीब", or "अनुमान" in ANY narrative field.
6. readiness_score, subject_analysis[].accuracy, chapter_analysis[].accuracy must never contradict VERIFIED_ATTEMPT_DATA.

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
        text: `Existing AJIT 360 history for context (use if useful, do not invent):
recent_wrong_topics: ${JSON.stringify(wrongs ?? [])}
recent_attempts: ${JSON.stringify(attempts ?? [])}`,
      });
    }

    const aiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!aiKey) throw new Error("LOVABLE_API_KEY missing");

    let parsed: any = null;
    let lastErr = "";
    let lastRaw = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log("calling AI", { reportId, attempt, parts: contentParts.length });
      const aiRes = await fetch(LOVABLE_AI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiKey}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [{ role: "user", content: contentParts }],
          response_format: { type: "json_object" },
          max_tokens: 16000,
        }),
      });

      if (!aiRes.ok) {
        const errText = await aiRes.text();
        lastErr = `AI ${aiRes.status}: ${errText.slice(0, 400)}`;
        console.error("AI request failed", reportId, attempt, lastErr);
        if (aiRes.status === 429 || aiRes.status === 402) throw new Error(lastErr);
        continue;
      }
      const aiData = await aiRes.json();
      const finish = aiData.choices?.[0]?.finish_reason;
      const raw = aiData.choices?.[0]?.message?.content ?? "";
      lastRaw = typeof raw === "string" ? raw : JSON.stringify(raw);
      console.log("AI response", { reportId, attempt, finish, len: lastRaw.length });

      if (finish === "length" || finish === "max_tokens") {
        lastErr = `AI response was truncated (${finish}); retrying with full JSON requirement`;
        console.error("truncated response", reportId, attempt, lastErr);
        continue;
      }

      try {
        const rawCandidate = typeof raw === "string" ? extractJSON(raw) : raw;
        const candidate = applyVerifiedSnapshotToReport(rawCandidate, verified);
        const validationError = getReportValidationError(candidate);
        if (!validationError) {
          parsed = candidate;
          break;
        }
        lastErr = validationError;
        console.error("validation failed", reportId, attempt, lastErr);
      } catch (parseErr) {
        lastErr = `JSON parse failed: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`;
        console.error("parse failed", reportId, attempt, lastErr, "raw head:", lastRaw.slice(0, 300));
      }
    }

    if (!parsed) {
      throw new Error(`AI analysis failed after retries. ${lastErr}. Raw head: ${lastRaw.slice(0, 400)}`);
    }

    parsed = applyVerifiedSnapshotToReport(parsed, verified);
    const finalValidationError = getReportValidationError(parsed);
    if (finalValidationError) {
      throw new Error(`AI analysis produced an invalid report and was not saved. ${finalValidationError}. Raw head: ${lastRaw.slice(0, 400)}`);
    }

    const totals = parsed.totals ?? {};
    const validTypes = new Set(["full_mock", "subject", "chapter", "topic", "revision_test", "previous_year"]);
    const reportType = validTypes.has(parsed.report_type) ? parsed.report_type : "full_mock";

    // ── SOURCE-OF-TRUTH GUARD ────────────────────────────────────────────
    // The verified attempt snapshot is authoritative. OCR/question extraction
    // is allowed only for qualitative analysis and retest creation. It can
    // never overwrite score, accuracy, correct, wrong, skipped, time or marks.
    try {
      const qs = Array.isArray(parsed.questions) ? parsed.questions : [];
      const counted = {
        correct: qs.filter((q: any) => q?.status === "correct").length,
        wrong: qs.filter((q: any) => q?.status === "wrong").length,
        skipped: qs.filter((q: any) => q?.status === "skipped").length,
      };
      if (
        totals.correct != null && counted.correct !== totals.correct ||
        totals.wrong   != null && counted.wrong   !== totals.wrong
      ) {
        console.warn("OCR counted mismatch — keeping VERIFIED attempt totals", {
          reportId, verified: { correct: totals.correct, wrong: totals.wrong, skipped: totals.skipped }, counted,
        });
      }
    } catch (_) { /* ignore */ }

    // Audit trail — every saved report carries the exact source values it was built from,
    // so downstream modules (Report History, Performance Center, Selection Intelligence,
    // Mock Revision Hub) can prove they read the same verified numbers.
    parsed.__audit = {
      report_id: reportId,
      user_id: userId,
      analysis_version: "v2-strict-2026-07",
      generated_at: new Date().toISOString(),
      data_verification_status: "verified",
      source: verified.source,
      attempt_id: verified.attempt_id,
      test_id: verified.test_id,
      verified_totals: {
        questions: toNum(totals.questions),
        correct: toNum(totals.correct),
        wrong: toNum(totals.wrong),
        skipped: toNum(totals.skipped),
        score: toNum(totals.score),
        max_score: toNum(totals.max_score),
        accuracy: toNum(parsed.accuracy),
        time_minutes: toNum(totals.time_minutes),
        time_taken_seconds: verified.time_taken_seconds,
        negative_marks: verified.negative_marks,
        submitted_at: verified.submitted_at,
      },
    };

    const analysisVersion = "v3-verified-attempt-2026-07";
    const generatedAt = new Date().toISOString();
    await admin.from("ai_mock_reports").update({
      status: "completed",
      analysis_status: "verified",
      analysis_version: analysisVersion,
      analysis_generated_at: generatedAt,
      report: parsed,
      ocr_text: parsed.ocr_text ?? null,
      exam_name: parsed.exam_name ?? null,
      // Verbatim from what AI copied off the printed result card. No re-derivation.
      accuracy: toNum(parsed.accuracy),
      readiness_score: toNum(parsed.readiness_score),
      overall_score: toNum(totals.score),
      report_type: reportType,
      detected_subject: parsed.detected_subject ?? null,
      detected_chapter: parsed.detected_chapter ?? null,
      detected_topic: parsed.detected_topic ?? null,
      error: null,
    }).eq("id", reportId);
    await admin.from("ai_report_audit_logs").insert({
      report_id: reportId,
      attempt_id: verified.attempt_id ?? null,
      user_id: userId,
      analysis_version: analysisVersion,
      generated_at: generatedAt,
      data_verification_status: "verified",
      verified_snapshot: verified,
      consistency_status: "passed",
      error: null,
    });
    console.log("report done (verified attempt)", reportId, "score=", totals.score, "acc=", parsed.accuracy, "correct=", totals.correct, "source=", verified.source);

    // ---- Smart Revision sync + Planner/Coach/Goals persistence (non-fatal) ----
    try {
      await syncWithAjit360(admin, userId, reportId, parsed);
    } catch (syncErr) {
      console.error("sync failed", reportId, syncErr);
    }

    // ---- Auto-generate retest questions from wrong/skipped items (non-fatal) ----
    try {
      await generateRetestQuestions(admin, userId, reportId, parsed);
    } catch (genErr) {
      console.error("retest generation failed", reportId, genErr);
    }

  } catch (e) {
    const msg = e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e);
    console.error("processReport failed", reportId, msg);
    await admin.from("ai_mock_reports").update({ status: "failed", analysis_status: "failed", verification_error: msg.slice(0, 1000), error: msg.slice(0, 1000) }).eq("id", reportId);
  }
}

function extractJSON(raw: string): any {
  let s = raw.trim()
    .replace(/^\uFEFF/, "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  if (!s.startsWith("{") && !s.startsWith("[")) {
    const oi = s.indexOf("{"), ai = s.indexOf("[");
    const isArr = ai !== -1 && (oi === -1 || ai < oi);
    const start = isArr ? ai : oi;
    const end = isArr ? s.lastIndexOf("]") : s.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("No JSON object found");
    s = s.slice(start, end + 1);
  }
  try { return JSON.parse(s); } catch (e) {
    // Try trimming to last balanced brace
    const end = s.lastIndexOf("}");
    if (end > 0) {
      try { return JSON.parse(s.slice(0, end + 1)); } catch { /* fallthrough */ }
    }
    throw e;
  }
}

function toNum(v: any): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  const m = String(v).match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function getReportValidationError(r: any): string | null {
  if (!r || typeof r !== "object" || Array.isArray(r)) return "AI returned no JSON report object";
  if (Object.keys(r).length === 0) return "AI returned an empty JSON object";
  if (!r.totals || typeof r.totals !== "object") return "AI report is missing totals";
  const t = r.totals;
  const questions = toNum(t.questions ?? t.total_questions ?? t.total);
  if (questions === null || questions <= 0) return "Analysis unavailable because verified attempt data is incomplete. (missing: total questions)";

  // STRICT DATA-INTEGRITY GATE — every core metric MUST be present in the printed result card.
  // We refuse to save an analysis when the source of truth is incomplete, so the AI cannot
  // hallucinate score/accuracy/marks. See the "SINGLE SOURCE OF TRUTH" prompt block above.
  const required: Array<[string, number | null]> = [
    ["correct answers", toNum(t.correct)],
    ["wrong answers", toNum(t.wrong)],
    ["skipped answers", toNum(t.skipped)],
    ["score", toNum(t.score)],
    ["max_score", toNum(t.max_score)],
    ["accuracy", toNum(r.accuracy)],
  ];
  const missing = required.filter(([, v]) => v === null).map(([k]) => k);
  if (missing.length > 0) {
    return `Analysis unavailable because verified attempt data is incomplete. The uploaded PDF did not clearly show: ${missing.join(", ")}. Please upload a mock PDF that includes the printed result / score card.`;
  }

  // Cross-check: totals must be internally consistent with total questions
  const sum = (toNum(t.correct) ?? 0) + (toNum(t.wrong) ?? 0) + (toNum(t.skipped) ?? 0);
  if (Math.abs(sum - questions) > 1) {
    return `Analysis unavailable — verified totals are inconsistent (correct+wrong+skipped=${sum}, total=${questions}).`;
  }

  if (toNum(r.readiness_score) === null) return "AI report is missing readiness score";
  if (!Array.isArray(r.subject_analysis) || r.subject_analysis.length === 0) return "AI report is missing subject analysis";
  const narratives = [r.coach_feedback, r.overall_performance, r.performance_summary];
  if (!narratives.some((x) => typeof x === "string" && x.trim().length > 20 && x.trim() !== "-")) return "AI report has no usable coach feedback";
  const usefulArrays = [
    r.strong_subjects, r.weak_subjects, r.weak_chapters, r.weak_topics,
    r.priority_chapters, r.priority_topics, r.improvement_areas, r.questions,
  ];
  const hasUsefulArray = usefulArrays.some((x) => Array.isArray(x) && x.length > 0);
  if (!hasUsefulArray && questions > 1) return "AI report contains only default/empty analysis fields";
  return null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// ------------------- AJIT 360 sync -------------------

function normalize(s: string) {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9\u0900-\u097f]+/g, " ").replace(/\s+/g, " ").trim();
}
function jaccard(a: string, b: string) {
  const A = new Set(normalize(a).split(" ").filter(Boolean));
  const B = new Set(normalize(b).split(" ").filter(Boolean));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0; for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}
function priorityRank(p: string) {
  return p === "critical" ? 4 : p === "high" ? 3 : p === "medium" ? 2 : 1;
}
function bumpPriority(current: string) {
  if (current === "critical" || current === "high") return "critical";
  if (current === "medium") return "high";
  return "medium";
}

async function syncWithAjit360(admin: any, userId: string, reportId: string, parsed: any) {
  const questions: any[] = Array.isArray(parsed?.questions) ? parsed.questions : [];
  const chapterAnalysis: any[] = Array.isArray(parsed?.chapter_analysis) ? parsed.chapter_analysis : [];

  // Load lookup: subjects + chapters (id + name)
  const [{ data: subs }, { data: chaps }] = await Promise.all([
    admin.from("subjects").select("id, name"),
    admin.from("chapters").select("id, name, subject_id"),
  ]);
  const subjByName = new Map<string, string>();
  (subs ?? []).forEach((s: any) => subjByName.set(normalize(s.name), s.id));
  const chapByKey = new Map<string, { id: string; subject_id: string }>();
  (chaps ?? []).forEach((c: any) => chapByKey.set(normalize(c.name), { id: c.id, subject_id: c.subject_id }));

  // Collect candidate chapter ids from mock (for question matching + priority bump)
  const chapterIds = new Set<string>();
  const chapterNameHits = new Map<string, { subject_id: string | null; chapter_id: string | null }>();
  const collectChapter = (name: string | null | undefined) => {
    if (!name) return;
    const key = normalize(name);
    const hit = chapByKey.get(key);
    if (hit) {
      chapterIds.add(hit.id);
      chapterNameHits.set(key, { subject_id: hit.subject_id, chapter_id: hit.id });
    } else {
      chapterNameHits.set(key, { subject_id: null, chapter_id: null });
    }
  };
  questions.forEach((q) => collectChapter(q?.chapter));
  chapterAnalysis.forEach((c) => collectChapter(c?.chapter));

  // Fetch candidate DB questions from tests belonging to those chapters (bounded)
  let candidates: any[] = [];
  if (chapterIds.size > 0) {
    const { data: tests } = await admin
      .from("tests")
      .select("id, subject_id, chapter_id")
      .in("chapter_id", [...chapterIds])
      .limit(400);
    const testIds = (tests ?? []).map((t: any) => t.id);
    const testMeta = new Map<string, { subject_id: string; chapter_id: string }>();
    (tests ?? []).forEach((t: any) => testMeta.set(t.id, { subject_id: t.subject_id, chapter_id: t.chapter_id }));
    if (testIds.length > 0) {
      const { data: qs } = await admin
        .from("questions")
        .select("id, question_text, correct_option, explanation, test_id")
        .in("test_id", testIds)
        .limit(2000);
      candidates = (qs ?? []).map((q: any) => ({ ...q, ...(testMeta.get(q.test_id) ?? {}) }));
    }
  }

  // Existing wrong_questions to check duplicates + bump
  const { data: existingWrongs } = await admin
    .from("wrong_questions")
    .select("id, question_id, chapter_id, priority, wrong_count, status")
    .eq("user_id", userId);
  const existingByQid = new Map<string, any>();
  (existingWrongs ?? []).forEach((w: any) => { if (w.question_id) existingByQid.set(w.question_id, w); });

  let matched = 0, priorityBumped = 0, added = 0;

  // Match each wrong/skipped mock question to a candidate
  for (const mq of questions) {
    const status = mq?.status;
    if (status !== "wrong" && status !== "skipped") continue;
    const text: string = mq?.text ?? "";
    if (!text || text.length < 8) continue;

    let best: { q: any; score: number } | null = null;
    for (const c of candidates) {
      const s = jaccard(text, c.question_text ?? "");
      if (!best || s > best.score) best = { q: c, score: s };
    }

    if (best && best.score >= 0.55) {
      matched++;
      const existing = existingByQid.get(best.q.id);
      if (existing) {
        const newPriority = bumpPriority(existing.priority);
        await admin.from("wrong_questions").update({
          priority: newPriority,
          wrong_count: (existing.wrong_count ?? 1) + 1,
          status: "pending",
          last_attempt_at: new Date().toISOString(),
          source_report_id: reportId,
        }).eq("id", existing.id);
        if (priorityRank(newPriority) > priorityRank(existing.priority)) priorityBumped++;
      } else {
        await admin.from("wrong_questions").insert({
          user_id: userId,
          question_id: best.q.id,
          subject_id: best.q.subject_id ?? null,
          chapter_id: best.q.chapter_id ?? null,
          question_text: best.q.question_text ?? text,
          correct_option: best.q.correct_option ?? mq.correct ?? null,
          selected_option: mq.marked ?? null,
          explanation: best.q.explanation ?? null,
          priority: "high",
          status: "pending",
          source: "ai_mock",
          source_report_id: reportId,
          topic: mq.topic ?? null,
          last_attempt_at: new Date().toISOString(),
        });
        added++;
      }
    } else {
      // Fallback: chapter/topic tagging — bump priority on any pending wrong_questions of that chapter
      const chKey = normalize(mq?.chapter ?? "");
      const hit = chapterNameHits.get(chKey);
      if (hit?.chapter_id) {
        const inChap = (existingWrongs ?? []).filter((w: any) => w.chapter_id === hit.chapter_id && w.status !== "mastered");
        for (const w of inChap.slice(0, 5)) {
          const newP = bumpPriority(w.priority);
          if (priorityRank(newP) > priorityRank(w.priority)) {
            await admin.from("wrong_questions").update({ priority: newP, source_report_id: reportId }).eq("id", w.id);
            priorityBumped++;
          }
        }
      }
    }
  }

  // -------- Persist AI Coach snapshot --------
  const ai_coach = parsed?.ai_coach ?? {};
  const rec = {
    tests: [] as any[],
    pdfs: [] as any[],
    chapters: (parsed?.priority_chapters ?? parsed?.important_chapters ?? []).slice(0, 10),
    topics: (parsed?.priority_topics ?? parsed?.important_topics ?? []).slice(0, 15),
    revision_sets: (parsed?.immediate_revision_topics ?? []).slice(0, 10),
  };
  // Recommend Practice Tests + PDFs from weak chapters
  if (chapterIds.size > 0) {
    const [{ data: recTests }, { data: recPdfs }] = await Promise.all([
      admin.from("tests").select("id, title, chapter_id").in("chapter_id", [...chapterIds]).limit(6),
      admin.from("pdfs").select("id, title, chapter_id").in("chapter_id", [...chapterIds]).limit(6),
    ]);
    rec.tests = recTests ?? [];
    rec.pdfs = recPdfs ?? [];
  }

  await admin.from("ai_coach_snapshots").upsert({
    user_id: userId,
    report_id: reportId,
    focus: ai_coach.study_today ?? parsed?.biggest_weakness ?? null,
    biggest_mistake: ai_coach.common_mistakes ?? (parsed?.frequent_mistakes ?? [])[0] ?? null,
    target_score: parsed?.readiness_to_90 ?? null,
    motivation: parsed?.motivational_feedback ?? null,
    revision_goal: ai_coach.revise_tomorrow ?? parsed?.revision_advice ?? null,
    recommendations: rec,
    sync_summary: { matched, priority_bumped: priorityBumped, added, candidates: candidates.length },
  }, { onConflict: "report_id" });

  // -------- Persist Study Plan tasks --------
  // Clear previous tasks for this report so re-runs don't duplicate
  await admin.from("study_plan_tasks").delete().eq("report_id", reportId);

  const plan7: any[] = Array.isArray(parsed?.plan_7_day) ? parsed.plan_7_day : [];
  const plan30: any[] = Array.isArray(parsed?.plan_30_day) ? parsed.plan_30_day : [];
  const today = new Date();
  const toDate = (offset: number) => {
    const d = new Date(today); d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  const tasksToInsert: any[] = [];
  plan7.forEach((day: any, i: number) => {
    const dayNum = Number(day?.day ?? i + 1);
    const offset = Math.max(0, dayNum - 1);
    const scope = offset === 0 ? "today" : offset === 1 ? "tomorrow" : "week";
    const tasks: string[] = Array.isArray(day?.tasks) ? day.tasks : [];
    const chapters = Array.isArray(day?.chapters) ? day.chapters : [];
    const topics = Array.isArray(day?.topics) ? day.topics : [];
    (tasks.length ? tasks : [day?.focus ?? "Revision"]).forEach((t: string, ti: number) => {
      tasksToInsert.push({
        user_id: userId,
        report_id: reportId,
        scope,
        task_date: toDate(offset),
        day_index: dayNum,
        title: String(t).slice(0, 200),
        description: day?.focus ?? null,
        subject: null,
        chapter: chapters[ti] ?? chapters[0] ?? null,
        topic: topics[ti] ?? topics[0] ?? null,
        estimated_minutes: 45,
        practice_questions: Number(day?.practice_questions ?? 0) || 0,
        revision_minutes: Number(day?.revision_minutes ?? 0) || 0,
        priority: ti === 0 ? "high" : "medium",
      });
    });
  });
  plan30.forEach((wk: any, i: number) => {
    const weekNum = Number(wk?.week ?? i + 1);
    const tasks: string[] = Array.isArray(wk?.tasks) ? wk.tasks : [];
    const chapters = Array.isArray(wk?.chapters) ? wk.chapters : [];
    const topics = Array.isArray(wk?.topics) ? wk.topics : [];
    (tasks.length ? tasks : [wk?.focus ?? "Weekly focus"]).forEach((t: string, ti: number) => {
      tasksToInsert.push({
        user_id: userId,
        report_id: reportId,
        scope: "month",
        week_index: weekNum,
        task_date: toDate(7 * (weekNum - 1)),
        title: String(t).slice(0, 200),
        description: wk?.focus ?? null,
        chapter: chapters[ti] ?? chapters[0] ?? null,
        topic: topics[ti] ?? topics[0] ?? null,
        estimated_minutes: 60,
        practice_questions: 0,
        revision_minutes: 0,
        priority: "medium",
      });
    });
  });
  if (tasksToInsert.length > 0) {
    await admin.from("study_plan_tasks").insert(tasksToInsert);
  }

  // -------- Smart Goals --------
  await admin.from("smart_goals").delete().eq("report_id", reportId);
  const goals: any[] = [];
  const acc = Number(parsed?.accuracy ?? 0);
  if (acc < 90) {
    goals.push({
      user_id: userId, report_id: reportId,
      title: "Reach 90% Accuracy",
      description: `Current Accuracy ${acc}% — aim for 90% in next mock.`,
      target_value: 90, current_value: acc, unit: "%",
      deadline: toDate(14),
    });
  }
  const weakCh: string[] = (parsed?.priority_chapters ?? []).slice(0, 3);
  if (weakCh.length) {
    goals.push({
      user_id: userId, report_id: reportId,
      title: `Finish ${weakCh.length} Weak Chapters`,
      description: weakCh.join(", "),
      target_value: weakCh.length, current_value: 0, unit: "chapters",
      deadline: toDate(10),
    });
  }
  goals.push({
    user_id: userId, report_id: reportId,
    title: "Complete 200 Practice Questions",
    description: "Focus on weak chapters flagged by AI.",
    target_value: 200, current_value: 0, unit: "questions",
    deadline: toDate(7),
  });
  goals.push({
    user_id: userId, report_id: reportId,
    title: "Complete Smart Revision before Sunday",
    description: "Clear all pending revision items generated from this mock.",
    target_value: 1, current_value: 0, unit: "task",
    deadline: toDate(7),
  });
  if (goals.length) await admin.from("smart_goals").insert(goals);

  console.log("sync done", reportId, { matched, priorityBumped, added, tasks: tasksToInsert.length, goals: goals.length });
}



function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// -------- Auto-generate playable retest from wrong/skipped mock questions --------
async function generateRetestQuestions(admin: any, userId: string, reportId: string, parsed: any) {
  const questions: any[] = Array.isArray(parsed?.questions) ? parsed.questions : [];
  if (questions.length === 0) return;

  const normLetter = (v: any): string | null => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim().toUpperCase();
    if (["A", "B", "C", "D"].includes(s)) return s;
    if (["1", "2", "3", "4"].includes(s)) return ["A", "B", "C", "D"][Number(s) - 1];
    const m = s.match(/[A-D]/);
    return m ? m[0] : null;
  };

  // Idempotent: clear previous auto rows for this report
  await admin.from("mock_generated_questions").delete().eq("report_id", reportId);

  const rows: any[] = [];
  let order = 0;
  for (const q of questions) {
    const status = q?.status;
    if (status !== "wrong" && status !== "skipped") continue;
    const text: string = (q?.text ?? "").trim();
    if (!text || text.length < 6) continue;

    const opts = q?.options ?? {};
    const a = typeof opts.a === "string" ? opts.a.trim() : null;
    const b = typeof opts.b === "string" ? opts.b.trim() : null;
    const c = typeof opts.c === "string" ? opts.c.trim() : null;
    const d = typeof opts.d === "string" ? opts.d.trim() : null;
    const correct = normLetter(q?.correct);
    const marked = normLetter(q?.marked);
    const has_options = !!(a && b && c && d && correct);

    rows.push({
      user_id: userId,
      report_id: reportId,
      q_no: typeof q?.q_no === "number" ? q.q_no : null,
      question_text: text,
      option_a: a, option_b: b, option_c: c, option_d: d,
      correct_option: correct,
      marked_option: marked,
      original_status: status,
      subject: q?.subject ?? null,
      chapter: q?.chapter ?? null,
      topic: q?.topic ?? null,
      explanation: typeof q?.explanation === "string" ? q.explanation : null,
      has_options,
      sort_order: order++,
    });
  }

  if (rows.length === 0) return;

  // Insert in chunks to avoid payload limits
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error } = await admin.from("mock_generated_questions").insert(chunk);
    if (error) { console.error("mock_generated_questions insert error", error); break; }
  }
  console.log("retest rows inserted", reportId, rows.length);
}
