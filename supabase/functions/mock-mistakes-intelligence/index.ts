import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { unifiedFetch } from "../_shared/unifiedAI.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Q = {
  id: string;
  mock_id: string;
  question_text: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  correct_answer: string | null;
  user_answer: string | null;
  explanation: string | null;
  chapter: string | null;
  topic: string | null;
  ai_subject: string | null;
  ai_chapter: string | null;
  ai_topic: string | null;
  ai_subtopic: string | null;
  source_status: string | null;
  practice_count: number | null;
  correct_count: number | null;
  wrong_count: number | null;
  last_practice_at: string | null;
  mastered: boolean | null;
  created_at: string;
};

function parseJsonObject(text: string): any | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

const SEVERITIES = ["critical", "high", "medium", "improving", "insufficient"];

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
    const { data: claims, error: authErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── SOURCE OF TRUTH: only this user's imported Mock Mistakes questions ────
    const { data: mocks } = await admin
      .from("mock_mistake_mocks")
      .select("id, name, subject, created_at")
      .eq("user_id", userId);
    const mockList = (mocks ?? []) as any[];
    const mockById = new Map(mockList.map((m) => [m.id, m]));

    if (mockList.length === 0) {
      return json({ error: "no_data", message: "अभी कोई imported Mock Mistake उपलब्ध नहीं है।" }, 400);
    }

    const { data: qData } = await admin
      .from("mock_mistake_questions")
      .select(
        "id, mock_id, question_text, option_a, option_b, option_c, option_d, correct_answer, user_answer, explanation, chapter, topic, ai_subject, ai_chapter, ai_topic, ai_subtopic, source_status, practice_count, correct_count, wrong_count, last_practice_at, mastered, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(2000);

    const questions = (qData ?? []) as Q[];
    if (questions.length === 0) {
      return json({ error: "no_data", message: "अभी कोई imported प्रश्न उपलब्ध नहीं है।" }, 400);
    }

    const subjOf = (q: Q) => q.ai_subject || mockById.get(q.mock_id)?.subject || "Unclassified";
    const chapOf = (q: Q) => q.ai_chapter || q.chapter || "Unclassified";
    const topicOf = (q: Q) => q.ai_topic || q.topic || "General";

    // ── Deterministic evidence (AI never invents counts) ─────────────────────
    const now = Date.now();
    const RECENT_MS = 14 * 24 * 60 * 60 * 1000;
    const bySubject = new Map<string, Q[]>();
    for (const q of questions) {
      const s = subjOf(q);
      if (!bySubject.has(s)) bySubject.set(s, []);
      bySubject.get(s)!.push(q);
    }

    const sections = [...bySubject.entries()].map(([subject, list]) => {
      const areaMap = new Map<string, any>();
      for (const q of list) {
        const key = `${chapOf(q)}|${topicOf(q)}`;
        const a = areaMap.get(key) ?? {
          chapter: chapOf(q),
          topic: topicOf(q),
          subtopics: {} as Record<string, number>,
          mistakes: 0,
          wrong: 0,
          skipped: 0,
          practiced: 0,
          practice_wrong: 0,
          practice_correct: 0,
          still_wrong: 0,
          improved: 0,
          recent: 0,
          samples: [] as any[],
        };
        a.mistakes++;
        if ((q.source_status ?? "wrong") === "skipped") a.skipped++;
        else a.wrong++;
        if (q.ai_subtopic) a.subtopics[q.ai_subtopic] = (a.subtopics[q.ai_subtopic] ?? 0) + 1;
        if ((q.practice_count ?? 0) > 0) {
          a.practiced++;
          a.practice_wrong += q.wrong_count ?? 0;
          a.practice_correct += q.correct_count ?? 0;
          if ((q.wrong_count ?? 0) >= 2) a.still_wrong++;
          if (q.mastered || ((q.correct_count ?? 0) >= 2 && (q.wrong_count ?? 0) === 0)) a.improved++;
        }
        if (now - new Date(q.created_at).getTime() < RECENT_MS) a.recent++;
        if (a.samples.length < 4) {
          a.samples.push({
            q: (q.question_text ?? "").slice(0, 260),
            options: [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean).map((o) => String(o).slice(0, 90)),
            correct: q.correct_answer ?? "",
            my_answer: q.user_answer ?? "",
            status: q.source_status ?? "wrong",
            explanation: (q.explanation ?? "").slice(0, 220),
            subtopic: q.ai_subtopic ?? "",
          });
        }
        areaMap.set(key, a);
      }
      const areas = [...areaMap.values()].sort((a, b) => b.mistakes - a.mistakes).slice(0, 14);
      return { subject, total_mistakes: list.length, areas };
    }).sort((a, b) => b.total_mistakes - a.total_mistakes);

    // Question-level repeat mistakes (same imported question still going wrong)
    const repeatedQuestions = questions
      .filter((q) => (q.practice_count ?? 0) >= 2 && (q.wrong_count ?? 0) >= 2 && !q.mastered)
      .sort((a, b) => (b.wrong_count ?? 0) - (a.wrong_count ?? 0))
      .slice(0, 12)
      .map((q) => ({
        id: q.id,
        subject: subjOf(q),
        chapter: chapOf(q),
        topic: topicOf(q),
        question_text: q.question_text,
        attempts: q.practice_count ?? 0,
        correct: q.correct_count ?? 0,
        wrong: q.wrong_count ?? 0,
        last_practice_at: q.last_practice_at,
        status: q.mastered ? "mastered" : "still_wrong",
      }));

    const improvedQuestions = questions.filter(
      (q) => (q.practice_count ?? 0) > 0 && (q.mastered || ((q.correct_count ?? 0) >= 2 && (q.wrong_count ?? 0) === 0)),
    ).length;

    const evidence = {
      total_questions: questions.length,
      total_mocks: mockList.length,
      practiced_questions: questions.filter((q) => (q.practice_count ?? 0) > 0).length,
      improved_questions: improvedQuestions,
      recent_questions: questions.filter((q) => now - new Date(q.created_at).getTime() < RECENT_MS).length,
      sections,
      repeated_questions: repeatedQuestions,
    };

    // ── Previous report + memory (intelligence grows, never resets) ──────────
    const { data: prevRow } = await admin
      .from("mock_mistake_intelligence")
      .select("report, questions_analyzed, generated_at")
      .eq("user_id", userId)
      .maybeSingle();

    const { data: memRows } = await admin
      .from("mock_mistake_ai_memory")
      .select("pattern_key, subject, area, kind, severity, summary, occurrences, first_seen_at, last_seen_at")
      .eq("user_id", userId)
      .order("last_seen_at", { ascending: false })
      .limit(40);

    await admin.from("mock_mistake_intelligence").upsert({
      user_id: userId,
      status: "processing",
      error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    const schema = `{
  "overview": "2-4 वाक्य का व्यक्तिगत सारांश (Hindi)",
  "insufficient_data": false,
  "sections": [
    {
      "subject": "...",
      "condition": "critical|high|medium|improving|insufficient",
      "headline": "इस subject की मुख्य बात (Hindi)",
      "areas": [
        {
          "area": "Chapter → Topic",
          "condition": "critical|high|medium|improving|insufficient",
          "pattern": "किस तरह की गलती बार-बार दिख रही है (Hindi)",
          "cause": "संभावित कारण, सिर्फ तभी जब evidence support करे (Hindi)",
          "advice": "इन्हीं imported questions पर आधारित ठोस सलाह (Hindi)",
          "evidence": "कितने प्रश्न / कौन-सा pattern (Hindi, केवल दिए गए आंकड़े)"
        }
      ]
    }
  ],
  "repeat_patterns": [{ "pattern": "...", "evidence": "..." }],
  "improvements": [{ "area": "...", "detail": "..." }],
  "what_changed": ["..."],
  "priorities": { "now": [{ "area": "...", "reason": "..." }], "next": [{ "area": "...", "reason": "..." }] },
  "stop_doing": ["..."],
  "selection_focus": ["..."],
  "memory": [
    { "pattern_key": "subject|chapter|topic|kind", "subject": "...", "area": "...", "kind": "concept|formula|application|calculation|interpretation|confusion|trap|guess|multistep|time|careless|improvement", "severity": "critical|high|medium|improving|insufficient", "summary": "...", "advice": "..." }
  ]
}`;

    const prompt = `तुम "AJIT AI" हो — एक अनुभवी personal mentor। नीचे छात्र के असली mock tests से खुद import किए गए Wrong/Skipped प्रश्नों का पूरा evidence है। यही एकमात्र सत्य है।

कड़े नियम:
- केवल इसी evidence से निष्कर्ष निकालो। कोई नया प्रश्न मत बनाओ, प्रश्न/विकल्प/उत्तर/explanation मत बदलो।
- कोई काल्पनिक आंकड़ा या कमजोरी मत गढ़ो। जहाँ evidence कम है, वहाँ साफ लिखो: "इस निष्कर्ष के लिए अभी पर्याप्त प्रश्न उपलब्ध नहीं हैं।"
- किसी भी topic को "Strong" या "Mastered" मत कहो — यह repository ही गलत/छूटे प्रश्नों की है।
- सिर्फ वही subject दिखाओ जो evidence में मौजूद हैं। सरल, स्वाभाविक हिंदी में लिखो।
- सिर्फ categorization मत करो — कारण (concept confusion, formula, application, calculation, interpretation, similar-concept mix-up, repeated trap, guessing, multi-step, time, careless) तभी बताओ जब प्रश्नों का pattern उसे support करे।
- insights की संख्या evidence के हिसाब से रखो — कम data पर छोटा विश्लेषण, ज्यादा data पर गहरा।
- what_changed केवल तब भरो जब पिछला विश्लेषण/मेमोरी उपलब्ध हो और अंतर evidence से दिखे, वरना खाली array।

EVIDENCE (deterministic, गिनती पहले से निकाली हुई है):
${JSON.stringify(evidence).slice(0, 90000)}

पिछली AI MEMORY (patterns जो पहले पकड़े गए):
${JSON.stringify(memRows ?? []).slice(0, 8000)}

पिछला विश्लेषण (सारांश):
${JSON.stringify((prevRow as any)?.report?.overview ?? null)} (तब ${(prevRow as any)?.questions_analyzed ?? 0} प्रश्न थे, अब ${questions.length})

केवल इस JSON schema में उत्तर दो, कोई अतिरिक्त text नहीं:
${schema}`;

    const res = await unifiedFetch({
      feature: "mock-mistakes-intelligence",
      body: {
        messages: [
          { role: "system", content: "You are AJIT AI, a strict evidence-based Hindi mentor. Output strict JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
        // Function-specific budget: kept at ~3000 so the OpenRouter fallback stays
        // affordable on the current balance. Do not raise without checking that.
        max_tokens: 3000,
      },
      overallTimeoutMs: 180000,
    });

    if (!res.ok) {
      const err = await res.json();
      await admin.from("mock_mistake_intelligence").upsert({
        user_id: userId,
        status: "error",
        error: err?.error ?? "AI unavailable",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      return json({ error: err?.error ?? "AI unavailable" }, 503);
    }

    const data = await res.json();
    const report = parseJsonObject(data?.choices?.[0]?.message?.content ?? "");

    if (!report || !Array.isArray(report.sections) || report.sections.length === 0) {
      await admin.from("mock_mistake_intelligence").upsert({
        user_id: userId,
        status: "error",
        error: "AI response could not be parsed",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      return json({ error: "AI response could not be parsed" }, 502);
    }

    // Never let the model claim strength or drop deterministic facts.
    report.repeated_questions = repeatedQuestions;
    report.totals = {
      questions: questions.length,
      mocks: mockList.length,
      practiced: evidence.practiced_questions,
      improved: improvedQuestions,
    };

    const generatedAt = new Date().toISOString();
    await admin.from("mock_mistake_intelligence").upsert({
      user_id: userId,
      status: "ready",
      report,
      evidence,
      questions_analyzed: questions.length,
      error: null,
      generated_at: generatedAt,
      updated_at: generatedAt,
    }, { onConflict: "user_id" });

    // ── Grow AI memory (no duplicates for the same pattern) ──────────────────
    const memory = Array.isArray(report.memory) ? report.memory.slice(0, 30) : [];
    const existing = new Map((memRows ?? []).map((m: any) => [m.pattern_key, m]));
    for (const m of memory) {
      const key = typeof m?.pattern_key === "string" && m.pattern_key.trim()
        ? m.pattern_key.trim().slice(0, 200)
        : `${m?.subject ?? ""}|${m?.area ?? ""}|${m?.kind ?? ""}`.slice(0, 200);
      if (!key.replace(/\|/g, "").trim()) continue;
      const severity = SEVERITIES.includes(m?.severity) ? m.severity : "medium";
      const prev = existing.get(key) as any;
      await admin.from("mock_mistake_ai_memory").upsert({
        user_id: userId,
        pattern_key: key,
        subject: typeof m?.subject === "string" ? m.subject.slice(0, 120) : null,
        area: typeof m?.area === "string" ? m.area.slice(0, 200) : null,
        kind: typeof m?.kind === "string" ? m.kind.slice(0, 40) : null,
        severity,
        summary: typeof m?.summary === "string" ? m.summary.slice(0, 1200) : null,
        advice: typeof m?.advice === "string" ? m.advice.slice(0, 1200) : null,
        evidence: { questions_analyzed: questions.length },
        occurrences: (prev?.occurrences ?? 0) + 1,
        last_seen_at: generatedAt,
      }, { onConflict: "user_id,pattern_key" });
    }

    return json({ ok: true, report, generated_at: generatedAt });
  } catch (e) {
    console.error("mock-mistakes-intelligence error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
