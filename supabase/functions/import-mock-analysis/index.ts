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

    // ==== DEEP ANALYSIS PASS + AUTO TEST GENERATION ============================
    // Turn the imported report into the primary data source for the whole
    // Performance Center: build a Subject→Chapter→Topic→Subtopic hierarchy,
    // detect recurring patterns across the user's history, compute deterministic
    // scores, and auto-generate personalized recovery tests.
    let deepStatus = "pending";
    let deepError: string | null = null;
    let hierarchy: any = {};
    let patterns: any = {};
    let recurring: any = {};
    let scores: any = {};
    try {
      const { data: history } = await admin
        .from("imported_report_insights")
        .select("report_id, weak_subjects, weak_chapters, weak_topics, critical_topics")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      const deepPrompt = `You are an exam-preparation analyst. Given a structured JSON extraction of a student's mock-test analysis, output a compact deep-analysis JSON.

Return ONLY JSON (no prose, no fences) with this exact schema:

{
  "hierarchy": {
    "subjects": [
      { "name": string, "accuracy": number|null, "mistakes": number, "skipped": number, "priority": "critical"|"high"|"medium"|"low",
        "chapters": [
          { "name": string, "mistakes": number, "skipped": number, "priority": "critical"|"high"|"medium"|"low",
            "topics": [
              { "name": string, "mistakes": number, "skipped": number, "priority": "critical"|"high"|"medium"|"low",
                "subtopics": [ { "name": string, "mistakes": number, "skipped": number } ]
              }
            ]
          }
        ]
      }
    ]
  },
  "patterns": {
    "time_management": string[],
    "silly_mistakes": string[],
    "concept_mistakes": string[],
    "guesswork": string[],
    "confidence_issues": string[],
    "skipped_patterns": string[],
    "question_patterns": string[]
  }
}

Rules:
- Use ONLY subjects/chapters/topics that actually appear in the input.
- If a level (chapter/topic/subtopic) is not present, omit that array (do not fabricate).
- Priority = critical if mistakes+skipped >= 5 OR the topic is explicitly called "critical"; high if >=3; medium if >=1; low otherwise.
- Preserve original language (English/Hindi/Hinglish).
- Keep pattern strings short (one phrase).`;

      const deepInput = {
        weak_subjects: extracted.weak_subjects,
        strong_subjects: extracted.strong_subjects,
        weak_chapters: extracted.weak_chapters,
        weak_topics: extracted.weak_topics,
        critical_topics: extracted.critical_topics,
        conceptual_errors: extracted.conceptual_errors,
        silly_mistakes: extracted.silly_mistakes,
        guesswork: extracted.guesswork,
        calculation_errors: extracted.calculation_errors,
        reading_errors: extracted.reading_errors,
        time_problems: extracted.time_problems,
        mistake_bank: extracted.mistake_bank,
        skipped_bank: extracted.skipped_bank,
        section_scores: extracted.section_scores,
        question_level: extracted.question_level,
      };

      try {
        const dresp = await chatCompletion({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: deepPrompt },
            { role: "user", content: JSON.stringify(deepInput) },
          ],
          temperature: 0,
          max_tokens: 6000,
          response_format: { type: "json_object" },
        }, { feature: "deep_mock_analysis", timeoutMs: 90_000, overallTimeoutMs: 150_000 });
        const draw = dresp.choices?.[0]?.message?.content ?? "";
        const parsed = extractJson(draw) ?? {};
        hierarchy = parsed.hierarchy ?? {};
        patterns = parsed.patterns ?? {};
      } catch (e) {
        deepError = e instanceof Error ? e.message : String(e);
      }

      const countMap = (getter: (r: any) => any[]) => {
        const m = new Map<string, number>();
        (history ?? []).forEach((h) => {
          const arr = getter(h) ?? [];
          const seen = new Set<string>();
          arr.forEach((v: any) => {
            const key = typeof v === "string" ? v.trim() : (v?.name ?? v?.topic ?? "");
            if (!key || seen.has(key)) return;
            seen.add(key);
            m.set(key, (m.get(key) ?? 0) + 1);
          });
        });
        return m;
      };
      const topRepeating = (m: Map<string, number>, min = 2) =>
        [...m.entries()].filter(([, c]) => c >= min).sort((a, b) => b[1] - a[1]).slice(0, 20)
          .map(([name, count]) => ({ name, count }));

      recurring = {
        weak_subjects: topRepeating(countMap((r) => r.weak_subjects)),
        weak_chapters: topRepeating(countMap((r) => r.weak_chapters)),
        weak_topics: topRepeating(countMap((r) => r.weak_topics)),
        critical_topics: topRepeating(countMap((r) => r.critical_topics)),
      };

      const mCount = Array.isArray(extracted.mistake_bank) ? extracted.mistake_bank.length : 0;
      const sCount = Array.isArray(extracted.skipped_bank) ? extracted.skipped_bank.length : 0;
      const accuracy = typeof extracted.accuracy === "number" ? extracted.accuracy : null;
      const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
      const weaknessScore = clamp((mCount * 3) + (sCount * 2) + (recurring.critical_topics?.length ?? 0) * 5);
      const masteryScore = accuracy != null ? clamp(accuracy) : clamp(100 - weaknessScore);
      const confidenceScore = clamp(100 - ((extracted.guesswork?.length ?? 0) * 6) - ((extracted.silly_mistakes?.length ?? 0) * 4));
      const recoveryScore = clamp(100 - (mCount * 2) - (recurring.weak_topics?.length ?? 0) * 4);
      const learningProgress = accuracy != null && history && history.length >= 2
        ? clamp(accuracy)
        : clamp((masteryScore + confidenceScore) / 2);

      scores = {
        mastery: masteryScore,
        weakness: weaknessScore,
        recovery: recoveryScore,
        confidence: confidenceScore,
        learning_progress: learningProgress,
      };

      deepStatus = deepError ? "partial" : "completed";
    } catch (e) {
      deepError = e instanceof Error ? e.message : String(e);
      deepStatus = "failed";
    }

    await admin
      .from("imported_report_insights")
      .update({ hierarchy, patterns, recurring, scores, deep_analysis_status: deepStatus, deep_analysis_error: deepError })
      .eq("report_id", reportRow.id);

    // ==== AUTO TEST GENERATION ================================================
    // Never mix skipped with wrong. Always separate repositories & tests.
    const mistakes: any[] = Array.isArray(extracted.mistake_bank) ? extracted.mistake_bank : [];
    const skipped: any[] = Array.isArray(extracted.skipped_bank) ? extracted.skipped_bank : [];

    type AutoTest = {
      kind: string; title: string; subject?: string | null; chapter?: string | null;
      topic?: string | null; subtopic?: string | null; items: any[];
      priority: "critical" | "high" | "medium" | "low"; difficulty_curve?: string | null; meta?: any;
    };
    const tests: AutoTest[] = [];

    if (mistakes.length) tests.push({
      kind: "wrong_all", title: `Wrong Question Test — Mock ${reportNumber}`,
      items: mistakes, priority: "high", difficulty_curve: "easy→hard",
    });
    if (skipped.length) tests.push({
      kind: "skipped_all", title: `Skipped Question Test — Mock ${reportNumber}`,
      items: skipped, priority: "medium", difficulty_curve: "easy→hard",
    });

    const bucketBy = (arr: any[], key: "subject" | "chapter" | "topic") => {
      const m = new Map<string, any[]>();
      arr.forEach((it) => {
        const k = (it?.[key] ?? "").toString().trim();
        if (!k) return;
        const list = m.get(k) ?? []; list.push(it); m.set(k, list);
      });
      return m;
    };

    bucketBy(mistakes, "subject").forEach((items, name) => {
      if (items.length >= 2) tests.push({
        kind: "weak_subject", title: `Weak Subject Recovery — ${name}`,
        subject: name, items, priority: items.length >= 5 ? "critical" : "high",
      });
    });
    bucketBy(mistakes, "chapter").forEach((items, name) => {
      if (items.length >= 2) tests.push({
        kind: "weak_chapter", title: `Weak Chapter Recovery — ${name}`,
        chapter: name, items, priority: items.length >= 4 ? "critical" : "high",
      });
    });
    bucketBy(mistakes, "topic").forEach((items, name) => {
      if (items.length >= 3) tests.push({
        kind: "topic_recovery", title: `Topic Recovery Test — ${name}`,
        topic: name, items, priority: "high", difficulty_curve: "easy→medium→hard",
      });
    });

    const recTopics: string[] = (recurring.weak_topics ?? []).map((t: any) => t.name).filter(Boolean);
    recTopics.forEach((name) => {
      const items = mistakes.filter((m) => (m?.topic ?? "").trim() === name);
      if (items.length) tests.push({
        kind: "priority_recovery", title: `🔥 Priority Recovery — ${name} (recurring)`,
        topic: name, items, priority: "critical",
        meta: { reason: "topic weak in multiple mocks" },
      });
    });

    if (mistakes.length >= 5) {
      const critical = mistakes.filter((m) =>
        recTopics.includes((m?.topic ?? "").trim()) ||
        (Array.isArray(extracted.critical_topics) && extracted.critical_topics.includes(m?.topic)));
      const pool = (critical.length ? critical : mistakes).slice(0, 30);
      tests.push({
        kind: "full_recovery", title: `Full Recovery Test — Mock ${reportNumber}`,
        items: pool, priority: "critical", difficulty_curve: "mixed",
      });
    }

    await admin.from("imported_auto_tests").delete().eq("report_id", reportRow.id).eq("user_id", userId);
    if (tests.length) {
      await admin.from("imported_auto_tests").insert(tests.map((t) => ({
        user_id: userId,
        report_id: reportRow.id,
        kind: t.kind,
        title: t.title,
        subject: t.subject ?? null,
        chapter: t.chapter ?? null,
        topic: t.topic ?? null,
        subtopic: t.subtopic ?? null,
        items: t.items,
        item_count: t.items.length,
        priority: t.priority,
        difficulty_curve: t.difficulty_curve ?? null,
        meta: t.meta ?? {},
      })));
    }

    await admin.from("imported_coach_memory").upsert({
      user_id: userId,
      last_report_id: reportRow.id,
      memory: {
        last_imported_at: new Date().toISOString(),
        last_report_number: reportNumber,
        scores,
        hierarchy,
        patterns,
        recurring,
        auto_tests_generated: tests.length,
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    return json({
      ok: true,
      report: reportRow,
      deep_analysis_status: deepStatus,
      auto_tests_generated: tests.length,
      scores,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
