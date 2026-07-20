import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

import { unifiedFetch } from "../_shared/unifiedAI.ts";

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
    const [prof, mocksR] = await Promise.all([
      admin.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
      admin.from("ai_mock_reports")
        .select("id, title, created_at, accuracy, readiness_score, overall_score, report")
        .eq("user_id", userId).eq("status", "completed")
        .in("report_type", ["full_mock", "previous_year"])
        .order("created_at", { ascending: true }).limit(50),
    ]);

    const mocks = mocksR.data ?? [];
    if (mocks.length === 0) {
      return json({ empty: true, mentor: "अभी तक कोई Full Mock upload नहीं हुआ — पहला mock upload करते ही AI Memory शुरू हो जायेगी।" });
    }

    const firstName = (prof.data?.display_name ?? "Student").trim().split(/\s+/)[0] || "Student";

    // Compact per-mock digest for the LLM (keeps prompt small even with 50 mocks)
    const digest = mocks.map((m: any, i: number) => {
      const r = m.report ?? {};
      return {
        n: i + 1,
        date: (m.created_at ?? "").slice(0, 10),
        title: m.title,
        score: m.overall_score ?? r?.totals?.marks ?? null,
        accuracy: m.accuracy ?? null,
        readiness: m.readiness_score ?? null,
        time_min: r?.totals?.time_taken_minutes ?? r?.totals?.time ?? null,
        correct: r?.totals?.correct ?? null,
        wrong: r?.totals?.wrong ?? null,
        skipped: r?.totals?.skipped ?? null,
        weak_subjects: r?.weak_subjects ?? [],
        strong_subjects: r?.strong_subjects ?? [],
        weak_chapters: (r?.weak_chapters ?? []).slice(0, 10),
        weak_topics: (r?.weak_topics ?? []).slice(0, 10),
        strong_topics: (r?.strong_topics ?? []).slice(0, 6),
        subject_analysis: (r?.subject_analysis ?? []).map((s: any) => ({
          subject: s.subject, accuracy: s.accuracy,
        })),
        mistakes: r?.mistake_categories ?? {},
      };
    });

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    let mentor = "";
    if (apiKey) {
      const prompt = `You are ${firstName}'s personal SSC coach. You have permanently remembered ALL ${mocks.length} full mocks below (oldest → latest). NEVER treat the latest mock in isolation — always speak about the JOURNEY.

Write a short mentor letter (Hinglish, Devanagari + English tech terms, 150-220 words) that:
1. Opens with "मैंने आपके पिछले ${mocks.length} Full Mocks analyse किए हैं…"
2. Names 2-3 subjects/chapters/topics that improved continuously (with numbers).
3. Names 1-2 that declined or are stuck (with numbers).
4. Calls out the biggest ongoing obstacle by name.
5. Ends with one concrete next-step (revision / practice) — never generic.

Return ONLY the letter text, no JSON, no headings.

MOCK HISTORY (${mocks.length} mocks):
${JSON.stringify(digest)}`;

      const res = await unifiedFetch({ body: {
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.4,
        }, feature: "ai-memory-mentor" });
      if (res.ok) {
        const j = await res.json();
        mentor = j?.choices?.[0]?.message?.content?.trim() ?? "";
      } else {
        mentor = `मैंने आपके ${mocks.length} Full Mocks का पूरा record याद रखा है — trends और patterns नीचे visible हैं।`;
      }
    }

    return json({
      empty: false,
      total_mocks: mocks.length,
      first_mock: mocks[0]?.created_at,
      last_mock: mocks[mocks.length - 1]?.created_at,
      mocks: digest,
      mentor,
    });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
