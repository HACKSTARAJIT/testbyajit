import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const EMBED_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
const EMBED_MODEL = "openai/text-embedding-3-small"; // 1536 dims
const BATCH = 50;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").replace(/[^\p{L}\p{N} ]/gu, "").trim();
}

async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function buildEmbeddingInput(q: any): string {
  const opts = [q.option_a, q.option_b, q.option_c, q.option_d].filter((o) => o && o !== "-").join(" | ");
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

    const { testId, force } = await req.json();
    if (!testId) return json({ error: "testId required" }, 400);

    let query = admin.from("questions")
      .select("id,question_text,option_a,option_b,option_c,option_d,correct_option,embedded_at")
      .eq("test_id", testId);
    const { data: all } = await query;
    const targets = (all ?? []).filter((q: any) => force || !q.embedded_at);
    if (targets.length === 0) return json({ ok: true, embedded: 0, total: (all ?? []).length });

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    let embedded = 0;
    for (let i = 0; i < targets.length; i += BATCH) {
      const batch = targets.slice(i, i + BATCH);
      const inputs = batch.map((q: any) => buildEmbeddingInput(q));
      const hashes = await Promise.all(inputs.map((s: string) => sha256(normalize(s))));

      const resp = await fetch(EMBED_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: EMBED_MODEL, input: inputs }),
      });
      if (resp.status === 429) return json({ error: "Rate limited" }, 429);
      if (resp.status === 402) return json({ error: "AI credits exhausted" }, 402);
      if (!resp.ok) {
        const txt = await resp.text();
        return json({ error: `Embed error: ${txt.slice(0, 300)}` }, 500);
      }
      const j = await resp.json();
      const vectors: number[][] = (j.data ?? []).sort((a: any, b: any) => a.index - b.index).map((d: any) => d.embedding);

      for (let k = 0; k < batch.length; k++) {
        const q = batch[k];
        const vec = vectors[k];
        if (!vec) continue;
        const { error } = await admin.from("questions").update({
          embedding: vec as any,
          content_hash: hashes[k],
          embedded_at: new Date().toISOString(),
          embedding_model: EMBED_MODEL,
        }).eq("id", q.id);
        if (!error) embedded++;
      }
    }

    return json({ ok: true, embedded, total: (all ?? []).length });
  } catch (e) {
    console.error("embed-questions error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
