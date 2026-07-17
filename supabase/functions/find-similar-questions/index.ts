import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

type Status = "exact_duplicate" | "nearly_duplicate" | "concept_similar" | "pattern_similar" | "original";

function classifyStatus(score: number, isHashMatch: boolean): Status {
  if (isHashMatch || score >= 99) return "exact_duplicate";
  if (score >= 92) return "nearly_duplicate";
  if (score >= 80) return "concept_similar";
  if (score >= 65) return "pattern_similar";
  return "original";
}

function detectVariantType(score: number, targetText: string, matchText: string): string {
  const nums = (s: string) => (s.match(/\d+(\.\d+)?/g) ?? []).join(",");
  const stripped = (s: string) => s.toLowerCase().replace(/\d+(\.\d+)?/g, "").replace(/\s+/g, " ").trim();
  if (score >= 92 && nums(targetText) !== nums(matchText) && stripped(targetText) === stripped(matchText)) {
    return "numerical_variation";
  }
  if (score >= 92) return "modified";
  if (score >= 80) return "concept_variation";
  if (score >= 65) return "pattern_variation";
  return "original";
}

function buildRecommendation(status: Status, count: number): string {
  switch (status) {
    case "exact_duplicate":
      return count > 1
        ? `Exact duplicate — this question already exists in ${count} places. Delete the upload or replace it with a fresh question on the same concept.`
        : "Exact duplicate detected. Delete the upload, or increase difficulty / create a numerical variation to keep it useful.";
    case "nearly_duplicate":
      return "Almost identical to an existing question. Consider a numerical variation, changed wording, or a different sub-concept before publishing.";
    case "concept_similar":
      return "Same concept already covered. Publish only if the difficulty, angle, or sub-topic is meaningfully different.";
    case "pattern_similar":
      return "Similar pattern in the bank. Safe to publish if it adds diversity (different numbers, options, or scenario).";
    default:
      return "Looks fresh — no significant overlap with the existing question bank.";
  }
}

function buildEmbeddingInput(q: any): string {
  const opts = [q.option_a, q.option_b, q.option_c, q.option_d].filter((o: string) => o && o !== "-").join(" | ");
  return `${q.question_text}\nOptions: ${opts}\nCorrect: ${q.correct_option}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: claims } = await userClient.auth.getClaims(auth.replace("Bearer ", ""));
    if (!claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    if (!(roles ?? []).some((r: any) => r.role === "admin")) return json({ error: "Admins only" }, 403);

    const { testId } = await req.json();
    if (!testId) return json({ error: "testId required" }, 400);

    const { data: questions } = await admin
      .from("questions")
      .select("id,test_id,question_text,option_a,option_b,option_c,option_d,correct_option,embedding,content_hash,topic,concept")
      .eq("test_id", testId).order("sort_order");

    if (!questions?.length) return json({ ok: true, analysed: 0 });

    // Preload test titles once (cache)
    const testTitleCache = new Map<string, { title: string; created_at: string; subject: string | null }>();
    async function getTest(id: string) {
      if (testTitleCache.has(id)) return testTitleCache.get(id)!;
      const { data } = await admin.from("tests").select("title,created_at,subjects(name)").eq("id", id).maybeSingle();
      const rec = { title: data?.title ?? "Unknown", created_at: data?.created_at ?? "", subject: (data as any)?.subjects?.name ?? null };
      testTitleCache.set(id, rec);
      return rec;
    }

    let analysed = 0;
    const failures: string[] = [];

    for (const q of questions) {
      if (!q.embedding) { failures.push(`no-embedding:${q.id}`); continue; }

      // Exact hash matches across the whole bank
      let hashMatches: any[] = [];
      if (q.content_hash) {
        const { data: hm } = await admin
          .from("questions")
          .select("id,test_id,question_text,correct_option,topic,concept,exam_level,difficulty,created_at")
          .eq("content_hash", q.content_hash).neq("id", q.id).limit(10);
        hashMatches = hm ?? [];
      }

      // Semantic matches
      const { data: sem, error: rpcErr } = await admin.rpc("match_questions", {
        query_embedding: q.embedding as any,
        match_count: 10,
        exclude_ids: [q.id],
      });
      if (rpcErr) { failures.push(rpcErr.message); continue; }

      // Merge (hash wins)
      const merged = new Map<string, any>();
      for (const h of hashMatches) merged.set(h.id, { ...h, similarity: 1, hash_match: true });
      for (const s of (sem ?? [])) if (!merged.has(s.id)) merged.set(s.id, { ...s, hash_match: false });

      const candidates = [...merged.values()]
        .filter((m) => (m.similarity ?? 0) >= 0.6 || m.hash_match)
        .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));

      const withMeta = await Promise.all(candidates.slice(0, 8).map(async (m) => {
        const t = await getTest(m.test_id);
        const score = m.hash_match ? 100 : Math.round((m.similarity ?? 0) * 100);
        const status = classifyStatus(score, !!m.hash_match);
        const variant = detectVariantType(score, q.question_text, m.question_text);
        return {
          question_id: m.id,
          test_id: m.test_id,
          test_title: t.title,
          subject: t.subject,
          uploaded_at: t.created_at,
          topic: m.topic ?? null,
          concept: m.concept ?? null,
          exam_level: m.exam_level ?? null,
          difficulty: m.difficulty ?? null,
          score,
          status,
          variant_type: variant,
          preview: (m.question_text ?? "").slice(0, 240),
          correct_option: m.correct_option ?? null,
        };
      }));

      const top = withMeta[0];
      const topScore = top?.score ?? 0;
      const topStatus: Status = top?.status ?? "original";
      const variant = top?.variant_type ?? "original";
      const rec = buildRecommendation(topStatus, withMeta.filter((m) => m.status === "exact_duplicate" || m.status === "nearly_duplicate").length + 1);

      // Preserve prior admin_status if row already accepted/ignored
      const { data: prior } = await admin.from("question_similarity_reports").select("admin_status").eq("question_id", q.id).maybeSingle();
      const admin_status = prior?.admin_status && prior.admin_status !== "pending" ? prior.admin_status : "pending";

      const { error: upErr } = await admin.from("question_similarity_reports").upsert({
        question_id: q.id,
        test_id: testId,
        top_match_score: topScore,
        top_match_status: topStatus,
        variant_type: variant,
        matches: withMeta,
        ai_recommendation: rec,
        admin_status,
        generated_at: new Date().toISOString(),
      }, { onConflict: "question_id" });
      if (upErr) failures.push(upErr.message);
      else analysed++;
    }

    return json({ ok: true, analysed, total: questions.length, failures });
  } catch (e) {
    console.error("find-similar-questions error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
