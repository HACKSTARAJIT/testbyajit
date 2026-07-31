import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

import { unifiedFetch } from "../_shared/unifiedAI.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Row = {
  id: string;
  mock_id: string;
  question_text: string;
  correct_answer: string | null;
  user_answer: string | null;
  chapter: string | null;
  topic: string | null;
  explanation: string | null;
  created_at: string;
};

const norm = (v?: string | null) => (v ?? "").trim() || "Unclassified";

/** Heuristic mistake-type tagging using only imported question evidence. */
function mistakeType(r: Row): string {
  const ua = (r.user_answer ?? "").trim();
  if (!ua) return "Skipped / Not Attempted";
  const t = `${r.question_text} ${r.explanation ?? ""}`.toLowerCase();
  if (/calculat|multiply|divide|percentage|%|sum of|value of|simplif/.test(t)) return "Calculation Mistake";
  if (/meaning|synonym|antonym|idiom|spelling|grammar|error/.test(t)) return "Language / Vocabulary Gap";
  if (/passage|inference|assumption|conclusion|infer/.test(t)) return "Comprehension / Inference";
  if (/formula|theorem|rule|law|principle/.test(t)) return "Concept Gap";
  return "Concept Gap";
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

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const [{ data: mocks }, { data: qs }] = await Promise.all([
      admin.from("mock_mistake_mocks").select("id, subject, name, created_at").eq("user_id", userId),
      admin
        .from("mock_mistake_questions")
        .select("id, mock_id, question_text, correct_answer, user_answer, chapter, topic, explanation, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);

    const mockMap = new Map((mocks ?? []).map((m: any) => [m.id, m]));
    const rows = (qs ?? []) as Row[];

    if (rows.length === 0) {
      return json({
        empty: true,
        totals: { questions: 0, mocks: (mocks ?? []).length, skipped: 0, wrong: 0 },
        subjects: [], chapters: [], topics: [], mistakeTypes: [], repeated: [], recent: [],
        commands: [], answers: {}, generatedAt: new Date().toISOString(),
      });
    }

    const bump = (m: Map<string, any>, key: string, extra: Record<string, unknown>) => {
      const cur = m.get(key) ?? { ...extra, count: 0, skipped: 0, wrong: 0 };
      cur.count += 1;
      m.set(key, cur);
      return cur;
    };

    const subjects = new Map<string, any>();
    const chapters = new Map<string, any>();
    const topics = new Map<string, any>();
    const types = new Map<string, number>();
    const textSeen = new Map<string, number>();

    let skipped = 0;
    const now = Date.now();
    let last7 = 0;

    for (const r of rows) {
      const mock = mockMap.get(r.mock_id);
      const subject = norm(mock?.subject);
      const chapter = norm(r.chapter);
      const topic = norm(r.topic);
      const isSkipped = !(r.user_answer ?? "").trim();
      if (isSkipped) skipped += 1;
      if (now - +new Date(r.created_at) <= 7 * 86400_000) last7 += 1;

      const s = bump(subjects, subject, { subject });
      const c = bump(chapters, `${subject}||${chapter}`, { subject, chapter });
      const t = bump(topics, `${subject}||${chapter}||${topic}`, { subject, chapter, topic });
      for (const b of [s, c, t]) { if (isSkipped) b.skipped += 1; else b.wrong += 1; }

      const mt = mistakeType(r);
      types.set(mt, (types.get(mt) ?? 0) + 1);

      const sig = r.question_text.toLowerCase().replace(/\s+/g, " ").slice(0, 90);
      textSeen.set(sig, (textSeen.get(sig) ?? 0) + 1);
    }

    const sortDesc = (m: Map<string, any>) => [...m.values()].sort((a, b) => b.count - a.count);
    const subjectList = sortDesc(subjects);
    const chapterList = sortDesc(chapters);
    const topicList = sortDesc(topics);
    const typeList = [...types.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
    const repeated = [...textSeen.entries()].filter(([, n]) => n > 1)
      .map(([sig, n]) => ({ signature: sig, times: n })).sort((a, b) => b.times - a.times).slice(0, 10);

    const totals = {
      questions: rows.length,
      mocks: (mocks ?? []).length,
      skipped,
      wrong: rows.length - skipped,
      last7,
    };

    const evidence = {
      totals,
      weakSubjects: subjectList.slice(0, 8),
      weakChapters: chapterList.slice(0, 12),
      weakTopics: topicList.slice(0, 15),
      mistakeTypes: typeList,
      repeatedQuestions: repeated.length,
      sampleQuestions: rows.slice(0, 25).map((r) => ({
        subject: norm(mockMap.get(r.mock_id)?.subject),
        chapter: norm(r.chapter),
        topic: norm(r.topic),
        skipped: !(r.user_answer ?? "").trim(),
        q: r.question_text.slice(0, 160),
      })),
    };

    let commands: string[] = [];
    let answers: Record<string, string> = {};
    let mentor = "";

    const prompt = `You are AJIT AI — a STRICT personal revision mentor.
The ONLY evidence you may use is this student's imported mock-mistake data below.
Every imported question was answered WRONG or SKIPPED in a real mock, so each one is proof of a weakness.

Return STRICT JSON only:
{
 "commands": ["6 short imperative orders"],
 "answers": {
   "weakest_topic": "...",
   "biggest_score_loss_chapter": "...",
   "most_repeated_mistake": "...",
   "revise_today": "...",
   "master_first": "...",
   "fastest_marks_chapter": "...",
   "stop_doing": "..."
 },
 "mentor": "3 strict sentences, Hinglish, data-only"
}

HARD RULES:
- NEVER give generic advice or motivation. No "study hard", no "stay consistent".
- Every sentence MUST name a real subject / chapter / topic from the data with a number.
- Commands must be orders: "Revise Algebra today — 14 wrong questions.", "Stop skipping Time & Work — 9 skips."
- If a field has no evidence, say "Not enough imported data yet".

DATA:
${JSON.stringify(evidence)}`;

    const res = await unifiedFetch({
      body: {
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Return only strict JSON. No markdown fences." },
          { role: "user", content: prompt },
        ],
      },
      feature: "revision-intelligence",
      dedupKey: `revint:${userId}:${rows.length}`,
      overallTimeoutMs: 60_000,
    });

    if (res.ok) {
      const raw = await res.json();
      const txt = raw?.choices?.[0]?.message?.content ?? "";
      const m = txt.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          const parsed = JSON.parse(m[0]);
          commands = Array.isArray(parsed.commands) ? parsed.commands.slice(0, 8).map(String) : [];
          answers = typeof parsed.answers === "object" && parsed.answers ? parsed.answers : {};
          mentor = String(parsed.mentor ?? "");
        } catch { /* fall through to deterministic output */ }
      }
    }

    // Deterministic evidence-only fallback so advice is never generic or empty.
    if (commands.length === 0) {
      const top = topicList.slice(0, 3);
      commands = top.map((t) =>
        `Revise ${t.topic} (${t.chapter}, ${t.subject}) today — ${t.count} mistake${t.count > 1 ? "s" : ""} imported.`);
      if (chapterList[0]) commands.push(`Master ${chapterList[0].chapter} first — ${chapterList[0].count} imported mistakes.`);
      if (typeList[0]) commands.push(`Stop repeating ${typeList[0].type} — ${typeList[0].count} occurrences.`);
      if (skipped > 0) commands.push(`Stop skipping — ${skipped} imported questions were left unattempted.`);
    }
    if (Object.keys(answers).length === 0) {
      answers = {
        weakest_topic: topicList[0] ? `${topicList[0].topic} (${topicList[0].count} mistakes)` : "Not enough imported data yet",
        biggest_score_loss_chapter: chapterList[0] ? `${chapterList[0].chapter} — ${chapterList[0].count} mistakes` : "Not enough imported data yet",
        most_repeated_mistake: typeList[0] ? `${typeList[0].type} — ${typeList[0].count} times` : "Not enough imported data yet",
        revise_today: topicList[0]?.topic ?? "Not enough imported data yet",
        master_first: chapterList[0]?.chapter ?? "Not enough imported data yet",
        fastest_marks_chapter: chapterList[0] ? `${chapterList[0].chapter} (${chapterList[0].subject})` : "Not enough imported data yet",
        stop_doing: skipped > 0 ? `Skipping questions — ${skipped} skips imported` : (typeList[0]?.type ?? "Not enough imported data yet"),
      };
    }

    return json({
      empty: false,
      totals,
      subjects: subjectList,
      chapters: chapterList.slice(0, 20),
      topics: topicList.slice(0, 25),
      mistakeTypes: typeList,
      repeated,
      commands,
      answers,
      mentor,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("revision-intelligence error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
