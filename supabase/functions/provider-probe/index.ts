// TEMPORARY diagnostic: lists available model ids per provider. Never returns keys.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const out: Record<string, unknown> = {};

  const gk = Deno.env.get("GEMINI_API_KEY");
  if (gk) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(gk)}&pageSize=200`);
      const d = await r.json();
      out.gemini = r.ok
        ? (d.models ?? []).map((m: any) => m.name).filter((n: string) => n.includes("flash") || n.includes("pro"))
        : { status: r.status, error: d?.error?.message };
    } catch (e) { out.gemini = { error: String(e) }; }
  } else out.gemini = "missing_key";

  const qk = Deno.env.get("GROQ_API_KEY");
  if (qk) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${qk}` } });
      const d = await r.json();
      out.groq = r.ok ? (d.data ?? []).map((m: any) => m.id) : { status: r.status, error: d?.error?.message };
    } catch (e) { out.groq = { error: String(e) }; }
  } else out.groq = "missing_key";

  const nk = Deno.env.get("NVIDIA_API_KEY");
  if (nk) {
    try {
      const r = await fetch("https://integrate.api.nvidia.com/v1/models", { headers: { Authorization: `Bearer ${nk}` } });
      const d = await r.json();
      out.nvidia = r.ok
        ? (d.data ?? []).map((m: any) => m.id).filter((id: string) => /llama|qwen|nemotron|mistral/i.test(id)).slice(0, 60)
        : { status: r.status, error: d?.error?.message ?? d?.detail };
    } catch (e) { out.nvidia = { error: String(e) }; }
  } else out.nvidia = "missing_key";

  const ok = Deno.env.get("OPENROUTER_API_KEY");
  if (ok) {
    try {
      const r = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${ok}` } });
      const d = await r.json();
      out.openrouter = r.ok ? d?.data : { status: r.status };
    } catch (e) { out.openrouter = { error: String(e) }; }
  } else out.openrouter = "missing_key";

  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
