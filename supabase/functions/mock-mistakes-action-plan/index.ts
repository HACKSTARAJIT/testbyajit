import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { unifiedFetch } from "../_shared/unifiedAI.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

type Q = {
  id: string;
  mock_id: string;
  question_text: string;
  chapter: string | null;
  topic: string | null;
  ai_subject: string | null;
  ai_chapter: string | null;
  ai_topic: string | null;
  ai_subtopic: string | null;
  source_status: string | null;
  created_at: string;
};

const PRIORITIES = ["critical", "high", "medium", "improving", "controlled"];
const ACTION_TYPES = [
  "revise",
  "re_attempt",
  "repeat_practice",
  "review_mistakes",
  "topic_focus",
  "clear_repeat_mistakes",
  "unresolved",
];

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

    // ── SOURCE OF TRUTH: only this user's imported Mock Mistakes ─────────────
    const { data: mocks } = await admin
      .from("mock_mistake_mocks")
      .select("id, name, subject")
      .eq("user_id", userId);
    const mockList = (mocks ?? []) as any[];
    const mockById = new Map(mockList.map((m) => [m.id, m]));
    if (mockList.length === 0) {
      return json({ error: "no_data", message: "अभी पर्याप्त Mock Mistakes data नहीं है। नए प्रश्न जुड़ने पर Action Plan अधिक सटीक होगा।" }, 400);
    }

    const { data: qData } = await admin
      .from("mock_mistake_questions")
      .select("id, mock_id, question_text, chapter, topic, ai_subject, ai_chapter, ai_topic, ai_subtopic, source_status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(2000);
    const questions = (qData ?? []) as Q[];
    if (questions.length === 0) {
      return json({ error: "no_data", message: "अभी पर्याप्त Mock Mistakes data नहीं है। नए प्रश्न जुड़ने पर Action Plan अधिक सटीक होगा।" }, 400);
    }

    // ── Real practice history (Mock Mistakes only) ───────────────────────────
    const { data: attemptRows } = await admin
      .from("revision_practice_attempts")
      .select("details, created_at")
      .eq("user_id", userId)
      .eq("source", "mock_mistakes")
      .order("created_at", { ascending: true })
      .limit(400);

    type Stat = { attempts: number; correct: number; wrong: number; skipped: number; streak: number };
    const stats = new Map<string, Stat>();
    for (const row of (attemptRows ?? []) as any[]) {
      for (const d of (Array.isArray(row.details) ? row.details : [])) {
        const id = d?.question_id;
        if (!id) continue;
        const s = stats.get(id) ?? { attempts: 0, correct: 0, wrong: 0, skipped: 0, streak: 0 };
        s.attempts++;
        if (d.status === "correct") { s.correct++; s.streak++; }
        else if (d.status === "wrong") { s.wrong++; s.streak = 0; }
        else { s.skipped++; s.streak = 0; }
        stats.set(id, s);
      }
    }

    // resolved only after 2 consecutive correct attempts (never on one attempt)
    const isResolved = (id: string) => (stats.get(id)?.streak ?? 0) >= 2;

    const subjOf = (q: Q) => q.ai_subject || mockById.get(q.mock_id)?.subject || "Unclassified";
    const chapOf = (q: Q) => q.ai_chapter || q.chapter || "Unclassified";
    const topicOf = (q: Q) => q.ai_topic || q.topic || "General";

    type Area = {
      area_key: string;
      subject: string;
      chapter: string;
      topic: string;
      total: number;
      unresolved: number;
      resolved: number;
      never_practiced: number;
      repeat_wrong: number;
      skipped_origin: number;
      unresolved_ids: string[];
      repeat_ids: string[];
      condition: string;
      samples: string[];
    };

    const areaMap = new Map<string, Area>();
    for (const q of questions) {
      const subject = subjOf(q), chapter = chapOf(q), topic = topicOf(q);
      const key = `${subject}||${chapter}||${topic}`;
      const a = areaMap.get(key) ?? {
        area_key: key, subject, chapter, topic,
        total: 0, unresolved: 0, resolved: 0, never_practiced: 0,
        repeat_wrong: 0, skipped_origin: 0,
        unresolved_ids: [], repeat_ids: [], condition: "medium", samples: [],
      };
      a.total++;
      const s = stats.get(q.id);
      if (!s) a.never_practiced++;
      if ((q.source_status ?? "wrong") === "skipped") a.skipped_origin++;
      if (isResolved(q.id)) a.resolved++;
      else {
        a.unresolved++;
        a.unresolved_ids.push(q.id);
        if ((s?.wrong ?? 0) >= 2) { a.repeat_wrong++; a.repeat_ids.push(q.id); }
      }
      if (a.samples.length < 3) a.samples.push((q.question_text ?? "").slice(0, 140));
      areaMap.set(key, a);
    }

    const scored = [...areaMap.values()].map((a) => {
      const score = a.unresolved * 2 + a.repeat_wrong * 3;
      const ratio = a.total ? a.unresolved / a.total : 0;
      a.condition = a.unresolved === 0
        ? "controlled"
        : a.repeat_wrong >= 2 && a.unresolved >= 4
        ? "critical"
        : a.repeat_wrong >= 1 || a.unresolved >= 4
        ? "high"
        : ratio < 0.4
        ? "improving"
        : "medium";
      return { a, score };
    }).sort((x, y) => y.score - x.score);

    const candidates = scored.filter((s) => s.a.unresolved > 0).slice(0, 10).map((s) => s.a);
    const totalUnresolved = [...areaMap.values()].reduce((n, a) => n + a.unresolved, 0);
    const totalResolved = [...areaMap.values()].reduce((n, a) => n + a.resolved, 0);

    if (candidates.length === 0) {
      const emptyPlan = {
        insufficient_data: false,
        overview: "अभी आपके सभी imported प्रश्न practice में लगातार सही हो रहे हैं। नए Mock जोड़ने पर Action Plan फिर से अपडेट होगा।",
        today: [], next: [],
        improvement: `अब तक ${totalResolved} प्रश्न लगातार दो बार सही हुए हैं।`,
        totals: { questions: questions.length, mocks: mockList.length, unresolved: 0, resolved: totalResolved },
      };
      const at = new Date().toISOString();
      await admin.from("mock_mistake_action_plans").upsert({
        user_id: userId, status: "ready", plan: emptyPlan,
        evidence: { areas: [] }, questions_analyzed: questions.length,
        error: null, generated_at: at, updated_at: at,
      }, { onConflict: "user_id" });
      return json({ ok: true, plan: emptyPlan, generated_at: at });
    }

    // ── Existing AI Intelligence + memory (built on top, never replaced) ─────
    const { data: intel } = await admin
      .from("mock_mistake_intelligence")
      .select("report, generated_at, questions_analyzed")
      .eq("user_id", userId)
      .maybeSingle();

    const { data: memRows } = await admin
      .from("mock_mistake_ai_memory")
      .select("pattern_key, subject, area, kind, severity, summary, advice, occurrences, last_seen_at")
      .eq("user_id", userId)
      .order("last_seen_at", { ascending: false })
      .limit(30);

    const { data: doneRows } = await admin
      .from("mock_mistake_action_completions")
      .select("action_key, title, completed_at")
      .eq("user_id", userId)
      .order("completed_at", { ascending: false })
      .limit(30);

    const evidence = {
      totals: {
        questions: questions.length,
        mocks: mockList.length,
        unresolved: totalUnresolved,
        resolved: totalResolved,
      },
      candidates: candidates.map((a) => ({
        area_key: a.area_key,
        subject: a.subject, chapter: a.chapter, topic: a.topic,
        total: a.total, unresolved: a.unresolved, resolved: a.resolved,
        never_practiced: a.never_practiced, repeat_wrong: a.repeat_wrong,
        skipped_origin: a.skipped_origin, condition: a.condition,
        samples: a.samples,
      })),
    };

    await admin.from("mock_mistake_action_plans").upsert({
      user_id: userId, status: "processing", error: null, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    const schema = `{
  "overview": "1-3 वाक्य, सीधे मुझसे बात करते हुए (Hindi)",
  "insufficient_data": false,
  "today": [
    {
      "area_key": "candidates में से बिल्कुल वैसा ही area_key",
      "action_type": "revise|re_attempt|repeat_practice|review_mistakes|topic_focus|clear_repeat_mistakes|unresolved",
      "priority": "critical|high|medium|improving",
      "title": "क्या करना है, छोटा और specific (Hindi)",
      "why": "क्यों — केवल दिए गए आंकड़ों के आधार पर (Hindi, 1-2 वाक्य)",
      "how": "कैसे करें — ठोस निर्देश (Hindi, 1-2 वाक्य)",
      "use_repeat_only": false
    }
  ],
  "next": [ { "...same fields..." } ],
  "improvement": "हाल का सुधार, केवल evidence से (Hindi)"
}`;

    const prompt = `तुम "AJIT AI" हो — सख्त लेकिन मददगार personal mentor। नीचे छात्र के अपने imported Mock Mistakes का असली evidence है। यही एकमात्र सत्य है।

काम: विश्लेषण नहीं, बल्कि साफ ACTION PLAN बनाओ — "अब मुझे क्या करना चाहिए?" का उत्तर।

कड़े नियम:
- केवल दिए गए candidates में से ही area चुनो और area_key हूबहू वही लिखो।
- today में अधिकतम 3 और next में अधिकतम 3 actions रखो। कम evidence हो तो कम actions दो।
- कोई नया प्रश्न मत बनाओ, कोई काल्पनिक आंकड़ा मत लिखो, किसी और छात्र या App Test का ज़िक्र मत करो।
- सामान्य सलाह ("Maths पर ध्यान दें") बिल्कुल मत दो — हमेशा उसी topic के unresolved imported प्रश्नों की बात करो।
- "यह topic selection पक्का करेगा" जैसे दावे मत करो। evidence-आधारित भाषा रखो।
- जिस area में repeat_wrong ज्यादा है वहाँ use_repeat_only true कर सकते हो।
- सरल, स्वाभाविक हिंदी। छोटे वाक्य।

EVIDENCE:
${JSON.stringify(evidence).slice(0, 60000)}

मौजूदा AI Intelligence (सारांश):
${JSON.stringify((intel as any)?.report?.overview ?? null)}
${JSON.stringify((intel as any)?.report?.priorities ?? null).slice(0, 3000)}

AI MEMORY (पहले पकड़े गए patterns):
${JSON.stringify(memRows ?? []).slice(0, 6000)}

पहले पूरे किए गए actions:
${JSON.stringify(doneRows ?? []).slice(0, 2000)}

केवल इस JSON schema में उत्तर दो, कोई अतिरिक्त text नहीं:
${schema}`;

    const res = await unifiedFetch({
      feature: "mock-mistakes-action-plan",
      body: {
        messages: [
          { role: "system", content: "You are AJIT AI, a strict evidence-based Hindi mentor. Output strict JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 3000,
      },
      overallTimeoutMs: 120000,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      await admin.from("mock_mistake_action_plans").upsert({
        user_id: userId, status: "error", error: err?.error ?? "AI unavailable",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      return json({ error: err?.error ?? "AI unavailable" }, 503);
    }

    const data = await res.json();
    const raw = parseJsonObject(data?.choices?.[0]?.message?.content ?? "");
    if (!raw || (!Array.isArray(raw.today) && !Array.isArray(raw.next))) {
      await admin.from("mock_mistake_action_plans").upsert({
        user_id: userId, status: "error", error: "AI response could not be parsed",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      return json({ error: "AI response could not be parsed" }, 502);
    }

    const byKey = new Map(candidates.map((a) => [a.area_key, a]));
    const seen = new Set<string>();

    const buildBucket = (list: any[], bucket: "today" | "next", limit: number) =>
      (Array.isArray(list) ? list : []).flatMap((it: any) => {
        const area = byKey.get(String(it?.area_key ?? ""));
        if (!area) return [];
        const actionType = ACTION_TYPES.includes(it?.action_type) ? it.action_type : "re_attempt";
        const repeatOnly = it?.use_repeat_only === true && area.repeat_ids.length >= 2;
        const ids = (repeatOnly ? area.repeat_ids : area.unresolved_ids).slice(0, 15);
        if (ids.length === 0) return [];
        const actionKey = `${area.area_key}||${actionType}${repeatOnly ? "||repeat" : ""}`;
        if (seen.has(actionKey)) return [];
        seen.add(actionKey);
        return [{
          action_key: actionKey,
          bucket,
          area_key: area.area_key,
          subject: area.subject,
          chapter: area.chapter,
          topic: area.topic,
          action_type: actionType,
          priority: PRIORITIES.includes(it?.priority) ? it.priority : area.condition,
          condition: area.condition,
          title: typeof it?.title === "string" && it.title.trim()
            ? it.title.trim().slice(0, 200)
            : `${area.chapter} → ${area.topic} के ${ids.length} प्रश्न दोबारा करें`,
          why: typeof it?.why === "string" ? it.why.trim().slice(0, 600) : "",
          how: typeof it?.how === "string" ? it.how.trim().slice(0, 600) : "",
          question_ids: ids,
          question_count: ids.length,
          repeat_only: repeatOnly,
          stats: {
            total: area.total,
            unresolved: area.unresolved,
            resolved: area.resolved,
            repeat_wrong: area.repeat_wrong,
            never_practiced: area.never_practiced,
          },
        }];
      }).slice(0, limit);

    const plan = {
      overview: typeof raw?.overview === "string" ? raw.overview.trim().slice(0, 900) : "",
      insufficient_data: raw?.insufficient_data === true,
      today: buildBucket(raw.today, "today", 3),
      next: buildBucket(raw.next, "next", 3),
      improvement: typeof raw?.improvement === "string" ? raw.improvement.trim().slice(0, 600) : "",
      totals: evidence.totals,
    };

    if (plan.today.length === 0 && plan.next.length > 0) {
      plan.today = plan.next.slice(0, 1).map((a: any) => ({ ...a, bucket: "today" }));
      plan.next = plan.next.slice(1);
    }

    const generatedAt = new Date().toISOString();
    await admin.from("mock_mistake_action_plans").upsert({
      user_id: userId, status: "ready", plan, evidence,
      questions_analyzed: questions.length, error: null,
      generated_at: generatedAt, updated_at: generatedAt,
    }, { onConflict: "user_id" });

    // ── Grow existing AJIT AI memory (no duplicate rows per action) ──────────
    const memByKey = new Map((memRows ?? []).map((m: any) => [m.pattern_key, m]));
    for (const a of [...plan.today, ...plan.next]) {
      const key = `action|${a.action_key}`.slice(0, 200);
      const prev = memByKey.get(key) as any;
      await admin.from("mock_mistake_ai_memory").upsert({
        user_id: userId,
        pattern_key: key,
        subject: a.subject.slice(0, 120),
        area: `${a.chapter} → ${a.topic}`.slice(0, 200),
        kind: "action_plan",
        severity: ["critical", "high", "medium", "improving"].includes(a.priority) ? a.priority : "medium",
        summary: a.title,
        advice: a.why || a.how || null,
        evidence: {
          action_type: a.action_type,
          question_ids: a.question_ids,
          stats: a.stats,
          bucket: a.bucket,
        },
        occurrences: (prev?.occurrences ?? 0) + 1,
        last_seen_at: generatedAt,
      }, { onConflict: "user_id,pattern_key" });
    }

    return json({ ok: true, plan, generated_at: generatedAt });
  } catch (e) {
    console.error("mock-mistakes-action-plan error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
