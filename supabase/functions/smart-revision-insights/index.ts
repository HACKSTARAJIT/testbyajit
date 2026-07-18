import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

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

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const [wq, subs, chaps] = await Promise.all([
      admin.from("wrong_questions").select(
        "subject_id, chapter_id, topic, priority, status, wrong_count, correct_revision_count, consecutive_correct, is_guess, is_marked, is_skipped, last_attempt_at, mastered_at"
      ).eq("user_id", userId),
      admin.from("subjects").select("id, name"),
      admin.from("chapters").select("id, name, subject_id"),
    ]);

    const rows = wq.data ?? [];
    const subjectName = new Map((subs.data ?? []).map((s: any) => [s.id, s.name]));
    const chapterName = new Map((chaps.data ?? []).map((c: any) => [c.id, c.name]));

    // Group by subject → chapter
    type Bucket = { pending: number; mastered: number; critical: number; guessWrong: number; repeated: number; };
    const bySubject = new Map<string, Bucket>();
    const byChapter = new Map<string, Bucket>();
    const zero = (): Bucket => ({ pending: 0, mastered: 0, critical: 0, guessWrong: 0, repeated: 0 });

    let totalPending = 0, totalMastered = 0, totalCritical = 0, totalGuess = 0, totalRepeated = 0;
    const now = Date.now(), week = 7 * 86400_000;
    let masteredThisWeek = 0;

    for (const r of rows) {
      const sk = r.subject_id ?? "none";
      const ck = `${sk}:${r.chapter_id ?? "none"}`;
      const sb = bySubject.get(sk) ?? zero();
      const cb = byChapter.get(ck) ?? zero();
      if (r.status === "mastered") {
        totalMastered += 1; sb.mastered += 1; cb.mastered += 1;
        if (r.mastered_at && now - +new Date(r.mastered_at) <= week) masteredThisWeek += 1;
      } else {
        totalPending += 1; sb.pending += 1; cb.pending += 1;
        if (r.priority === "critical") { totalCritical += 1; sb.critical += 1; cb.critical += 1; }
        if (r.is_guess) { totalGuess += 1; sb.guessWrong += 1; cb.guessWrong += 1; }
        if ((r.wrong_count ?? 0) >= 2) { totalRepeated += 1; sb.repeated += 1; cb.repeated += 1; }
      }
      bySubject.set(sk, sb);
      byChapter.set(ck, cb);
    }

    const subjectSummary = [...bySubject.entries()]
      .map(([id, b]) => ({ id, name: subjectName.get(id) ?? "General", ...b }))
      .sort((a, b) => b.pending - a.pending)
      .slice(0, 12);

    const chapterSummary = [...byChapter.entries()]
      .map(([k, b]) => {
        const [sid, cid] = k.split(":");
        return {
          subject: subjectName.get(sid) ?? "General",
          chapter: chapterName.get(cid) ?? "General",
          ...b,
        };
      })
      .filter((c) => c.pending > 0)
      .sort((a, b) => b.pending - a.pending)
      .slice(0, 10);

    const compact = {
      totals: { totalPending, totalMastered, totalCritical, totalGuess, totalRepeated, masteredThisWeek },
      subjects: subjectSummary,
      chaptersHot: chapterSummary,
    };

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    let insights: string[] = [];
    let coachMessage = "";

    if (apiKey && (totalPending + totalMastered) > 0) {
      const prompt = `You are AJIT AI, the student's revision coach.
Analyse this Smart Revision snapshot and produce output in strict JSON:
{"insights": ["...", "..."], "coach": "one short Hinglish paragraph"}

Rules:
- 4 to 6 insights, each ONE sentence, VERY specific (use subject/chapter names + numbers).
- Never generic. Never repeat the same subject twice.
- Priorities: critical > repeated wrongs > guess-wrong > mastered wins.
- Coach message: 2-3 sentences, Hinglish, motivating and data-driven.

DATA:
${JSON.stringify(compact)}`;

      const res = await fetch(LOVABLE_AI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Return only strict JSON. No markdown." },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (res.ok) {
        const raw = await res.json();
        const txt = raw?.choices?.[0]?.message?.content ?? "";
        const m = txt.match(/\{[\s\S]*\}/);
        if (m) {
          try {
            const parsed = JSON.parse(m[0]);
            insights = Array.isArray(parsed.insights) ? parsed.insights.slice(0, 6) : [];
            coachMessage = String(parsed.coach ?? "");
          } catch { /* ignore */ }
        }
      }
    }

    return json({
      stats: compact,
      insights,
      coachMessage,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("smart-revision-insights error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
