import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

import { unifiedFetch } from "../_shared/unifiedAI.ts";
// Deep-reasoning model: accuracy over speed for post-test analysis.
const MODEL = "google/gemini-2.5-pro";

/** Pull a JSON object out of a model reply (handles fences / stray prose). */
function extractJson(raw: string): any {
  if (!raw) throw new Error("AI ने खाली उत्तर दिया");
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("AI उत्तर में JSON नहीं मिला");
  s = s.slice(start, end + 1);
  return JSON.parse(s);
}

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
    const guesses: any = (attempt.guesses as any) ?? [];
    const guessSet = new Set<string>(Array.isArray(guesses) ? guesses : Object.keys(guesses ?? {}));

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
        was_guess: guessSet.has(q.id),
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
      const topic = q.topic ?? q.concept ?? q.chapter ?? subjectName;
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

    // ---- Scope lock: only what actually exists in THIS test may be discussed ----
    const scopeSubjects = [...new Set(perQ.map((q) => q.subject))];
    const scopeChapters = [...new Set(perQ.map((q) => q.chapter))];
    const scopeTopics = [...new Set(perQ.map((q) => q.topic ?? q.concept ?? q.chapter))];
    const scopeSubtopics = [...new Set(perQ.map((q) => q.subtopic).filter(Boolean))] as string[];
    const inScopeSubject = (s: any) => typeof s === "string" && scopeSubjects.includes(s);

    // ---- Repeated weakness detection (same subject only, so unrelated subjects never leak in) ----
    const repeatCount = new Map<string, { subject: string; topic: string; tests: number; wrong: number; last_seen: string }>();
    for (const r of (pastReports ?? [])) {
      if ((r as any).attempt_id === attemptId) continue;
      const tb = ((r as any).topic_breakdown ?? []) as any[];
      const seen = new Set<string>();
      for (const t of tb) {
        const bad = Number(t?.wrong ?? 0) + Number(t?.skipped ?? 0);
        if (!t?.topic || bad <= 0) continue;
        if (!inScopeSubject(t.subject)) continue;
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
      repeated_weak_topics: repeatedWeaknesses,
      // सिर्फ़ इसी subject का इतिहास — दूसरे विषय कभी report में न आएँ
      previous_topic_breakdowns: (pastReports ?? []).slice(0, 5).map((r: any) => ({
        at: r.created_at,
        topics: ((r.topic_breakdown ?? []) as any[])
          .filter((t) => inScopeSubject(t?.subject))
          .slice(0, 10)
          .map((t) => ({ subject: t.subject, chapter: t.chapter, topic: t.topic, wrong: t.wrong, skipped: t.skipped })),
      })).filter((r) => r.topics.length > 0),
      previous_overalls: (pastReports ?? []).slice(0, 5).map((r: any) => ({
        at: r.created_at,
        weak_topics: ((r.overall ?? {})?.weak_topics ?? []).filter((t: any) => scopeTopics.includes(t) || scopeChapters.includes(t)),
        strong_topics: ((r.overall ?? {})?.strong_topics ?? []).filter((t: any) => scopeTopics.includes(t) || scopeChapters.includes(t)),
      })),
    };

    // AJIT AI लंबी अवधि की memory (append-only timeline) — इसी subject तक सीमित
    const aiMemory = {
      tests_analysed: (dnaRow?.totals as any)?.tests_analysed ?? 0,
      mistake_dna: dnaRow?.distribution ?? null,
      timeline: ((dnaRow?.timeline as any[]) ?? [])
        .filter((t: any) => inScopeSubject(t?.subject))
        .slice(-12),
    };

    // Same-test previous attempts (क्या सुधार हुआ?)
    const sameTestHistory = (pastAttempts ?? [])
      .filter((a: any) => a.test_id === attempt.test_id)
      .slice(0, 5)
      .map((a: any) => ({ accuracy: a.accuracy, marks: a.marks_obtained, time_seconds: a.time_taken_seconds }));

    const guessStats = {
      guessed_total: perQ.filter((q) => q.was_guess).length,
      guessed_correct: perQ.filter((q) => q.was_guess && q.status === "correct").length,
      guessed_wrong: perQ.filter((q) => q.was_guess && q.status === "wrong").length,
    };

    const sys = `तुम AJIT AI हो — एक अनुभवी प्रतियोगी-परीक्षा मेंटर, जो छात्र की कॉपी ख़ुद जाँचता है।

STEP 1 — गहराई से सोचो (यह सोच output में मत लिखो):
हर correct, wrong और skipped question को अलग-अलग पढ़ो — question text, चुना हुआ option, सही option,
explanation, difficulty, peer accuracy, guess flag। फिर पूछो: गलती *क्यों* हुई?
concept confusion, formula गलती, calculation गलती, reading गलती, time pressure, guessing, careless,
pattern confusion — इनमें से क्या? फिर पिछले attempts और ai_memory से तुलना करो।
Speed से ज़्यादा ज़रूरी accuracy है।

STEP 2 — OUTPUT: सिर्फ़ एक valid JSON object लौटाओ (कोई markdown fence नहीं, कोई अतिरिक्त text नहीं)।

🚫 SCOPE LOCK (सबसे सख़्त नियम):
इस test में सिर्फ़ ये चीज़ें मौजूद हैं —
Subjects: ${JSON.stringify(scopeSubjects)}
Chapters: ${JSON.stringify(scopeChapters)}
Topics: ${JSON.stringify(scopeTopics)}
Subtopics: ${JSON.stringify(scopeSubtopics)}
इनके बाहर का कोई भी Subject/Chapter/Topic रिपोर्ट में मत लिखो। English, Reasoning, General Awareness,
Vocabulary या कोई भी असंबंधित विषय बिल्कुल मत छेड़ो — अगर वह ऊपर की सूची में नहीं है तो उसका अस्तित्व ही नहीं है।
"अवर्गीकृत"/"Unclassified" जैसी श्रेणी मत बनाओ।

🚫 TEMPLATE निषेध:
कोई fixed heading-set नहीं। कोई दोहराया हुआ paragraph नहीं। कोई generic सलाह नहीं।
हर report बिल्कुल नई भाषा में, इसी test के आँकड़ों से लिखी जाए।

📝 मुख्य आउटपुट = insights[] (dynamic):
जितना असली evidence है उतने ही insight दो — कम से कम 4, ज़्यादा से ज़्यादा 14।
हर insight = { "title": "...", "body": "...", "evidence": "..." }
title इसी test से निकला हुआ हो (जैसे "Triangle Similarity में Congruency से भ्रम"),
body में असली कारण-सहित मेंटर जैसी व्याख्या (2–5 वाक्य),
evidence में ठोस आँकड़ा (जैसे "प्रश्न 4, 9, 12 — तीनों में similarity ratio उलटा लगाया")।
जहाँ निष्कर्ष के लिए data नहीं है वहाँ insight मत बनाओ; ज़रूरत हो तो लिखो:
"इस परीक्षण के आधार पर इस विषय पर निष्कर्ष निकालने के लिए पर्याप्त डेटा उपलब्ध नहीं है।"

भाषा: पूरी report सरल, स्वाभाविक हिंदी (देवनागरी) में। सिर्फ़ Subject/Chapter/Topic/formula के नाम अंग्रेज़ी रह सकते हैं।

हर wrong/skipped question के लिए 1–2 root-cause categories चुनो (keys अंग्रेज़ी में रहें):
${MISTAKE_CATEGORIES.join(", ")}.
"easy" wrong = careless/reading; "hard" wrong = knowledge gap; was_guess=true = guessing behaviour.
हर question का Subject/Chapter/Topic/Subtopic payload से ही लो, ख़ुद मत गढ़ो।

recommendations सिर्फ़ इसी test + ai_memory से निकलें (जैसे "Triangle Similarity आज 20 मिनट revise करो")।
repeated_weakness_alerts में payload के repeated_weak_topics को ही हिंदी वाक्यों में लिखो।

JSON की अपेक्षित संरचना (keys अंग्रेज़ी, values हिंदी):
${JSON.stringify({
      overall: { performance_grade: "", headline: "", strong_chapters: [], weak_chapters: [], strong_topics: [], weak_topics: [], most_repeated_mistake: "", most_expensive_mistake: "" },
      mistake_distribution: { knowledge_gap: 0 },
      question_analyses: [{ question_id: "", index: 0, difficulty: "", subject: "", chapter: "", topic: "", subtopic: "", concept: "", expected_skill: "", root_causes: [], why_wrong: "", confidence: 0, suggested_improvement: "", suggested_revision: "" }],
      time_analysis: { too_fast_count: 0, too_slow_count: 0, skipped_count: 0, summary: "" },
      thinking_profile: { style: "", traits: [], summary: "" },
      memory_analysis: { memory_strength: 0, revision_quality: 0, retention: 0, forgotten_concepts: [], revision_due: [] },
      improvements: [{ action: "", expected_marks: 0, why: "" }],
      action_plan: { today: [], tomorrow: [], this_week: [] },
      repeated_weakness_alerts: [],
      hindi_report: {
        insights: [{ title: "", body: "", evidence: "" }],
        weak_topics: [], strong_topics: [],
        next_revision_plan: [], next_practice_recommendation: [],
        final_conclusion: "",
      },
      coach_summary: "",
    })}`;

    const userPayload = {
      scope: { subjects: scopeSubjects, chapters: scopeChapters, topics: scopeTopics, subtopics: scopeSubtopics },
      test: { id: attempt.test_id, title: (attempt.tests as any)?.title, subject: (attempt.tests as any)?.subjects?.name, attempted_at: attempt.created_at },
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
      guess_behaviour: guessStats,
      questions: perQ,
      topic_breakdown: topicBreakdown,
      history: historySummary,
      same_test_previous_attempts: sameTestHistory,
      ai_memory: aiMemory,
      related_resources: {
        tests: (relatedTests ?? []).map((t: any) => ({ id: t.id, title: t.title })),
        pdfs: (relatedPdfs ?? []).map((p: any) => ({ id: p.id, title: p.title })),
      },
    };



    // JSON mode (हर provider इसे support करता है; tools को primary provider drop कर देता था)
    async function askAI(extra?: string) {
      return await unifiedFetch({
        body: {
          model: MODEL,
          temperature: 0.85,
          max_tokens: 12000,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: sys + (extra ? `\n\n${extra}` : "") },
            { role: "user", content: JSON.stringify(userPayload) },
          ],
        },
        feature: "analyze-test-mistakes",
        timeoutMs: 180_000,
      });
    }

    function isUsable(p: any) {
      const ins = p?.hindi_report?.insights;
      return !!p && typeof p === "object"
        && (p.coach_summary || p.overall?.headline)
        && Array.isArray(ins) && ins.filter((i: any) => i?.title && i?.body).length >= 3;
    }

    let parsed: any = null;
    let lastErr = "";
    for (let attemptNo = 0; attemptNo < 2 && !isUsable(parsed); attemptNo++) {
      const aiResp = await askAI(attemptNo === 0
        ? undefined
        : "पिछली कोशिश में output अधूरा/अमान्य था। अब सिर्फ़ पूरा valid JSON object लौटाओ — कोई text, कोई fence नहीं।");
      if (aiResp.status === 429) return json({ error: "Rate limited. Try again shortly." }, 429);
      if (aiResp.status === 402) return json({ error: "AI credits exhausted. Add credits to continue." }, 402);
      if (!aiResp.ok) {
        lastErr = (await aiResp.text().catch(() => "")).slice(0, 300);
        continue;
      }
      const aiJson = await aiResp.json();
      const raw = aiJson.choices?.[0]?.message?.content ?? "";
      try { parsed = extractJson(typeof raw === "string" ? raw : JSON.stringify(raw)); }
      catch (e) { lastErr = (e as Error).message; parsed = null; }
    }

    if (!isUsable(parsed)) {
      return json({ error: `AI विश्लेषण नहीं बन पाया${lastErr ? `: ${lastErr}` : ""}` }, 500);
    }

    // ---- Scope sanitizer: कोई भी असंबंधित Subject/Chapter/Topic report में न बचे ----
    const allowed = new Set(
      [...scopeSubjects, ...scopeChapters, ...scopeTopics, ...scopeSubtopics]
        .filter(Boolean).map((s) => String(s).trim().toLowerCase()),
    );
    const keepInScope = (arr: any) =>
      Array.isArray(arr) ? arr.filter((x) => typeof x === "string" && allowed.has(x.trim().toLowerCase())) : [];
    if (parsed.overall) {
      parsed.overall.strong_topics = keepInScope(parsed.overall.strong_topics);
      parsed.overall.weak_topics = keepInScope(parsed.overall.weak_topics);
      parsed.overall.strong_chapters = keepInScope(parsed.overall.strong_chapters);
      parsed.overall.weak_chapters = keepInScope(parsed.overall.weak_chapters);
      delete parsed.overall.strong_subjects;
      delete parsed.overall.weak_subjects;
    }
    if (parsed.hindi_report) {
      parsed.hindi_report.strong_topics = keepInScope(parsed.hindi_report.strong_topics);
      parsed.hindi_report.weak_topics = keepInScope(parsed.hindi_report.weak_topics);
      parsed.hindi_report.insights = (parsed.hindi_report.insights ?? [])
        .filter((i: any) => i?.title && i?.body)
        .slice(0, 14);
    }




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
      topic_breakdown: topicBreakdown,
      repeated_weaknesses: repeatedWeaknesses.map((r, i) => ({
        ...r,
        alert: (parsed.repeated_weakness_alerts ?? [])[i] ?? r.alert,
      })),
      hindi_report: parsed.hindi_report ?? {},
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

    // AJIT AI Memory — append-only (पुरानी entries कभी overwrite नहीं होतीं)
    const timeline = ((dnaRow?.timeline as any[]) ?? []).slice(-49);
    const hr = parsed.hindi_report ?? {};
    timeline.push({
      at: new Date().toISOString(),
      attempt_id: attemptId,
      test_id: attempt.test_id,
      test_title: (attempt.tests as any)?.title ?? null,
      subject: subjectName,
      accuracy: attempt.accuracy,
      marks_obtained: attempt.marks_obtained,
      total_marks: totalMarks,
      correct: attempt.correct_count,
      wrong: attempt.incorrect_count,
      skipped: attempt.unattempted_count,
      time_taken_seconds: attempt.time_taken_seconds,
      dist: parsed.mistake_distribution ?? {},
      topic_breakdown: topicBreakdown.slice(0, 15),
      weak_topics: (parsed.overall?.weak_topics ?? hr.weak_topics ?? []).slice(0, 10),
      strong_topics: (parsed.overall?.strong_topics ?? hr.strong_topics ?? []).slice(0, 10),
      repeated_mistakes: (hr.repeated_mistakes ?? []).slice(0, 10),
      careless_mistakes: (hr.careless_mistakes ?? []).slice(0, 10),
      conceptual_mistakes: (hr.conceptual_mistakes ?? []).slice(0, 10),
      guess_behaviour: guessStats,
      key_insights: (hr.insights ?? []).slice(0, 8).map((i: any) => ({ title: i.title, body: i.body })),
      revision_recommendations: (hr.next_revision_plan ?? hr.topics_to_revise_first ?? []).slice(0, 10),
      ai_observation: parsed.coach_summary ?? null,
    });

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
