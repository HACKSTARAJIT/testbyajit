import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

import { unifiedFetch } from "../_shared/unifiedAI.ts";
const MODEL = "google/gemini-3-flash-preview";

const MISTAKE_CATEGORIES = [
  "knowledge_gap", "concept_confusion", "memory_failure", "calculation_error",
  "reading_mistake", "option_confusion", "guessing", "careless_mistake",
  "time_pressure", "overthinking", "silly_mistake", "question_misinterpretation",
  "weak_revision", "weak_concept", "low_accuracy_under_pressure",
];

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

    const { attemptId, refresh } = await req.json();
    if (!attemptId) return json({ error: "attemptId required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Reuse cached analysis unless refresh=true
    if (!refresh) {
      const { data: existing } = await admin
        .from("test_mistake_analyses").select("*").eq("attempt_id", attemptId).eq("user_id", userId).maybeSingle();
      if (existing) return json({ analysis: existing, cached: true });
    }

    // Load attempt + related data
    const { data: attempt } = await admin
      .from("test_attempts").select("*, tests(id,title,subject_id,subjects(id,name))")
      .eq("id", attemptId).eq("user_id", userId).maybeSingle();
    if (!attempt) return json({ error: "Attempt not found" }, 404);
    if (attempt.status !== "completed") return json({ error: "Attempt not completed" }, 400);

    const { data: questions } = await admin
      .from("questions").select("*").eq("test_id", attempt.test_id).order("sort_order");
    const answers: Record<string, string> = (attempt.answers as any) ?? {};
    const marked: any = (attempt.marked as any) ?? [];

    // Peer benchmarks for difficulty estimation
    const { data: peerAttempts } = await admin
      .from("test_attempts").select("answers,status").eq("test_id", attempt.test_id).eq("status", "completed").limit(200);
    const qStats: Record<string, { attempts: number; correct: number }> = {};
    (peerAttempts ?? []).forEach((a: any) => {
      const map = (a.answers as any) ?? {};
      (questions ?? []).forEach((q: any) => {
        const ans = map[q.id];
        if (ans) {
          const s = qStats[q.id] ??= { attempts: 0, correct: 0 };
          s.attempts++;
          if (ans === q.correct_option) s.correct++;
        }
      });
    });
    const qDifficulty = (qid: string) => {
      const s = qStats[qid]; if (!s || s.attempts < 3) return "medium";
      const acc = s.correct / s.attempts;
      if (acc >= 0.75) return "easy"; if (acc >= 0.45) return "medium"; return "hard";
    };

    // Historical context
    const [{ data: pastReports }, { data: pastAttempts }, { data: dnaRow }, { data: relatedTests }, { data: relatedPdfs }] = await Promise.all([
      admin.from("test_mistake_analyses").select("attempt_id,mistake_distribution,coach_summary,created_at,overall,topic_breakdown")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
      admin.from("test_attempts").select("accuracy,marks_obtained,time_taken_seconds,total_questions,test_id,tests(subject_id)")
        .eq("user_id", userId).eq("status", "completed").order("created_at", { ascending: false }).limit(30),
      admin.from("mistake_dna").select("*").eq("user_id", userId).maybeSingle(),
      admin.from("tests").select("id,title,subject_id").eq("subject_id", (attempt.tests as any)?.subject_id ?? "").limit(6),
      admin.from("pdfs").select("id,title,subject_id,chapter_id").eq("subject_id", (attempt.tests as any)?.subject_id ?? "").limit(6),
    ]);

    // Chapter names for every question
    const chapterIds = [...new Set((questions ?? []).map((q: any) => q.chapter_id).filter(Boolean))] as string[];
    const { data: chapterRows } = chapterIds.length
      ? await admin.from("chapters").select("id,name").in("id", chapterIds)
      : { data: [] as any[] };
    const chapterName = new Map((chapterRows ?? []).map((c: any) => [c.id, c.name]));
    const subjectName = (attempt.tests as any)?.subjects?.name ?? "General";

    // Per-question quick facts
    const perQ = (questions ?? []).map((q: any, i: number) => {
      const selected = answers[q.id] ?? null;
      const isCorrect = selected && selected === q.correct_option;
      const isWrong = selected && selected !== q.correct_option;
      const skipped = !selected;
      const isMarked = Array.isArray(marked) && marked.includes(q.id);
      return {
        index: i + 1,
        id: q.id,
        text: q.question_text?.slice(0, 500),
        options: { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d },
        correct: q.correct_option,
        selected,
        marks: q.marks ?? 1,
        explanation: q.explanation?.slice(0, 400) ?? null,
        difficulty: qDifficulty(q.id),
        subject: subjectName,
        chapter: q.chapter_id ? (chapterName.get(q.chapter_id) ?? "अन्य") : "अन्य",
        topic: (q.topic ?? "").trim() || null,
        subtopic: (q.subtopic ?? "").trim() || null,
        concept: (q.concept ?? "").trim() || null,
        status: isCorrect ? "correct" : isWrong ? "wrong" : "skipped",
        marked_for_review: isMarked,
        peer_accuracy: qStats[q.id]?.attempts ? Math.round((qStats[q.id].correct / qStats[q.id].attempts) * 100) : null,
      };
    });

    const wrongQs = perQ.filter(q => q.status === "wrong");
    const skippedQs = perQ.filter(q => q.status === "skipped");
    const totalMarks = perQ.reduce((s, q) => s + q.marks, 0);
    const lostMarks = wrongQs.reduce((s, q) => s + q.marks, 0) + skippedQs.reduce((s, q) => s + q.marks, 0);
    const avgTimePerQ = attempt.total_questions ? Math.round((attempt.time_taken_seconds ?? 0) / attempt.total_questions) : 0;

    // ---- Deterministic Subject → Chapter → Topic → Subtopic grouping of mistakes ----
    type Node = {
      subject: string; chapter: string; topic: string; subtopic: string | null;
      wrong: number; skipped: number; total: number; lost_marks: number; question_indexes: number[];
    };
    const nodeMap = new Map<string, Node>();
    for (const q of perQ) {
      const topic = q.topic ?? q.concept ?? q.chapter ?? "अवर्गीकृत";
      const key = `${q.subject}||${q.chapter}||${topic}||${q.subtopic ?? ""}`;
      const n = nodeMap.get(key) ?? {
        subject: q.subject, chapter: q.chapter, topic, subtopic: q.subtopic,
        wrong: 0, skipped: 0, total: 0, lost_marks: 0, question_indexes: [],
      };
      n.total++;
      if (q.status === "wrong") { n.wrong++; n.lost_marks += q.marks; n.question_indexes.push(q.index); }
      if (q.status === "skipped") { n.skipped++; n.lost_marks += q.marks; n.question_indexes.push(q.index); }
      nodeMap.set(key, n);
    }
    const topicBreakdown = [...nodeMap.values()]
      .filter((n) => n.wrong + n.skipped > 0)
      .map((n) => ({ ...n, accuracy: n.total ? Math.round(((n.total - n.wrong - n.skipped) / n.total) * 100) : 0 }))
      .sort((a, b) => (b.wrong + b.skipped) - (a.wrong + a.skipped));

    // ---- Repeated weakness detection across previous analysed tests ----
    const repeatCount = new Map<string, { subject: string; topic: string; tests: number; wrong: number; last_seen: string }>();
    for (const r of (pastReports ?? [])) {
      if ((r as any).attempt_id === attemptId) continue;
      const tb = ((r as any).topic_breakdown ?? []) as any[];
      const seen = new Set<string>();
      for (const t of tb) {
        const bad = Number(t?.wrong ?? 0) + Number(t?.skipped ?? 0);
        if (!t?.topic || bad <= 0) continue;
        const k = `${t.subject ?? ""}||${t.topic}`;
        if (seen.has(k)) continue;
        seen.add(k);
        const cur = repeatCount.get(k) ?? { subject: t.subject ?? "", topic: t.topic, tests: 0, wrong: 0, last_seen: (r as any).created_at };
        cur.tests++; cur.wrong += bad;
        repeatCount.set(k, cur);
      }
    }
    // include the current test
    for (const n of topicBreakdown) {
      const k = `${n.subject}||${n.topic}`;
      const cur = repeatCount.get(k) ?? { subject: n.subject, topic: n.topic, tests: 0, wrong: 0, last_seen: new Date().toISOString() };
      cur.tests++; cur.wrong += n.wrong + n.skipped;
      repeatCount.set(k, cur);
    }
    const repeatedWeaknesses = [...repeatCount.values()]
      .filter((r) => r.tests >= 2)
      .sort((a, b) => b.tests - a.tests || b.wrong - a.wrong)
      .slice(0, 12)
      .map((r) => ({
        ...r,
        alert: `⚠️ ${r.topic} पिछले ${r.tests} tests में weak Topic रहा है (कुल ${r.wrong} गलत/छूटे)।`,
      }));

    const historySummary = {
      recent_accuracy_trend: (pastAttempts ?? []).slice(0, 8).map((a: any) => a.accuracy).reverse(),
      previous_mistake_dna: dnaRow?.distribution ?? null,
      recent_coach_notes: (pastReports ?? []).slice(0, 3).map((r: any) => r.coach_summary).filter(Boolean),
      repeated_weak_topics: repeatedWeaknesses,
      previous_topic_breakdowns: (pastReports ?? []).slice(0, 5).map((r: any) => ({
        at: r.created_at,
        topics: ((r.topic_breakdown ?? []) as any[]).slice(0, 10).map((t) => ({ subject: t.subject, chapter: t.chapter, topic: t.topic, wrong: t.wrong, skipped: t.skipped })),
      })),
    };


    const sys = `You are AJIT AI — a senior competitive-exam mentor.
Analyse a completed practice test and produce STRICT JSON only (no markdown fences).
Ground every insight in the provided data — never invent facts.
For each wrong/skipped question, assign 1–2 root-cause categories from this fixed list:
${MISTAKE_CATEGORIES.join(", ")}.
Use "easy" wrong answers to identify careless/reading mistakes; use "hard" wrong answers to identify knowledge gaps.
Coach summary must be specific to this student's data — reference actual chapters, mistake patterns, and mark deltas. Never generic.`;

    const userPayload = {
      test: { id: attempt.test_id, title: (attempt.tests as any)?.title, subject: (attempt.tests as any)?.subjects?.name },
      score: {
        marks_obtained: attempt.marks_obtained,
        total_marks: totalMarks,
        lost_marks: lostMarks,
        correct: attempt.correct_count,
        incorrect: attempt.incorrect_count,
        skipped: attempt.unattempted_count,
        accuracy: attempt.accuracy,
        total_questions: attempt.total_questions,
        time_taken_seconds: attempt.time_taken_seconds,
        avg_time_per_question_seconds: avgTimePerQ,
      },
      questions: perQ,
      history: historySummary,
      related_resources: {
        tests: (relatedTests ?? []).map((t: any) => ({ id: t.id, title: t.title })),
        pdfs: (relatedPdfs ?? []).map((p: any) => ({ id: p.id, title: p.title })),
      },
    };

    const schema = {
      type: "object",
      properties: {
        overall: {
          type: "object",
          properties: {
            performance_grade: { type: "string" },
            headline: { type: "string" },
            strong_subjects: { type: "array", items: { type: "string" } },
            weak_subjects: { type: "array", items: { type: "string" } },
            strong_chapters: { type: "array", items: { type: "string" } },
            weak_chapters: { type: "array", items: { type: "string" } },
            strong_topics: { type: "array", items: { type: "string" } },
            weak_topics: { type: "array", items: { type: "string" } },
            most_repeated_mistake: { type: "string" },
            most_expensive_mistake: { type: "string" },
            most_common_weakness: { type: "string" },
          },
          required: ["headline", "most_repeated_mistake"],
        },
        mistake_distribution: {
          type: "object",
          description: "Category → percentage (0-100). Only include categories that occurred.",
          additionalProperties: { type: "number" },
        },
        question_analyses: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question_id: { type: "string" },
              index: { type: "number" },
              difficulty: { type: "string" },
              topic: { type: "string" },
              chapter: { type: "string" },
              concept: { type: "string" },
              expected_skill: { type: "string" },
              root_causes: { type: "array", items: { type: "string" } },
              why_wrong: { type: "string" },
              confidence: { type: "number" },
              suggested_improvement: { type: "string" },
              suggested_revision: { type: "string" },
              related_tests: { type: "array", items: { type: "string" } },
              related_pdfs: { type: "array", items: { type: "string" } },
              related_smart_revision: { type: "string" },
            },
            required: ["question_id", "root_causes", "why_wrong"],
          },
        },
        time_analysis: {
          type: "object",
          properties: {
            too_fast_count: { type: "number" },
            too_slow_count: { type: "number" },
            skipped_count: { type: "number" },
            late_attempts_count: { type: "number" },
            time_wasted_on_hard_seconds: { type: "number" },
            summary: { type: "string" },
          },
        },
        thinking_profile: {
          type: "object",
          properties: {
            style: { type: "string" },
            traits: { type: "array", items: { type: "string" } },
            summary: { type: "string" },
          },
        },
        memory_analysis: {
          type: "object",
          properties: {
            memory_strength: { type: "number" },
            revision_quality: { type: "number" },
            retention: { type: "number" },
            forgotten_concepts: { type: "array", items: { type: "string" } },
            revision_due: { type: "array", items: { type: "string" } },
          },
        },
        improvements: {
          type: "array",
          items: {
            type: "object",
            properties: {
              action: { type: "string" },
              expected_marks: { type: "number" },
              why: { type: "string" },
            },
            required: ["action", "expected_marks"],
          },
        },
        action_plan: {
          type: "object",
          properties: {
            today: { type: "array", items: { type: "string" } },
            tomorrow: { type: "array", items: { type: "string" } },
            this_week: { type: "array", items: { type: "string" } },
            this_month: { type: "array", items: { type: "string" } },
          },
        },
        related_learning: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question_index: { type: "number" },
              pdf_id: { type: "string" },
              test_id: { type: "string" },
              chapter: { type: "string" },
              topic: { type: "string" },
            },
          },
        },
        coach_summary: { type: "string" },
      },
      required: ["overall", "mistake_distribution", "question_analyses", "coach_summary"],
    };

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const aiResp = await unifiedFetch({ body: {
        model: MODEL,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
        tools: [{
          type: "function",
          function: { name: "emit_analysis", description: "Return the mistake intelligence report", parameters: schema },
        }],
        tool_choice: { type: "function", function: { name: "emit_analysis" } },
      }, feature: "analyze-test-mistakes" });

    if (aiResp.status === 429) return json({ error: "Rate limited. Try again shortly." }, 429);
    if (aiResp.status === 402) return json({ error: "AI credits exhausted. Add credits to continue." }, 402);
    if (!aiResp.ok) {
      const txt = await aiResp.text();
      return json({ error: `AI error: ${txt.slice(0, 300)}` }, 500);
    }
    const aiJson = await aiResp.json();
    const raw = aiJson.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments
      ?? aiJson.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw; }
    catch { return json({ error: "Failed to parse AI output" }, 500); }

    const analysisRow = {
      attempt_id: attemptId,
      user_id: userId,
      test_id: attempt.test_id,
      subject_id: (attempt.tests as any)?.subject_id ?? null,
      overall: parsed.overall ?? {},
      question_analyses: parsed.question_analyses ?? [],
      mistake_distribution: parsed.mistake_distribution ?? {},
      time_analysis: parsed.time_analysis ?? {},
      thinking_profile: parsed.thinking_profile ?? {},
      memory_analysis: parsed.memory_analysis ?? {},
      improvements: parsed.improvements ?? [],
      action_plan: parsed.action_plan ?? {},
      related_learning: parsed.related_learning ?? [],
      coach_summary: parsed.coach_summary ?? null,
      model: MODEL,
    };

    const { data: saved, error: saveErr } = await admin
      .from("test_mistake_analyses").upsert(analysisRow, { onConflict: "attempt_id" }).select().single();
    if (saveErr) return json({ error: saveErr.message }, 500);

    // Update Mistake DNA with rolling average across last 12 tests
    const { data: recent } = await admin
      .from("test_mistake_analyses").select("mistake_distribution,created_at")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(12);
    const totals: Record<string, number> = {};
    let denom = 0;
    (recent ?? []).forEach((r: any) => {
      const dist = (r.mistake_distribution ?? {}) as Record<string, number>;
      const sum = Object.values(dist).reduce((s, v) => s + Number(v || 0), 0);
      if (sum > 0) {
        denom++;
        Object.entries(dist).forEach(([k, v]) => { totals[k] = (totals[k] ?? 0) + Number(v || 0); });
      }
    });
    const dnaDist: Record<string, number> = {};
    if (denom > 0) Object.entries(totals).forEach(([k, v]) => { dnaDist[k] = Math.round(v / denom); });

    const timeline = ((dnaRow?.timeline as any[]) ?? []).slice(-19);
    timeline.push({ at: new Date().toISOString(), accuracy: attempt.accuracy, dist: parsed.mistake_distribution ?? {} });

    await admin.from("mistake_dna").upsert({
      user_id: userId,
      distribution: dnaDist,
      totals: { tests_analysed: denom },
      timeline,
      last_attempt_id: attemptId,
    });

    return json({ analysis: saved, cached: false });
  } catch (e) {
    console.error("analyze-test-mistakes error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
