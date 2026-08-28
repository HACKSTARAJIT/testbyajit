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
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(gk)}&pageSize=1`);
      const d = await r.json();
      out.gemini = r.ok ? "ok" : { status: r.status };
    } catch (e) { out.gemini = { error: String(e) }; }
  } else out.gemini = "missing_key";

  const qk = Deno.env.get("GROQ_API_KEY");
  if (qk) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${qk}` } });
      const d = await r.json();
      out.groq = r.ok ? "ok" : { status: r.status, error: d?.error?.message };
    } catch (e) { out.groq = { error: String(e) }; }
  } else out.groq = "missing_key";

  const nk = Deno.env.get("NVIDIA_API_KEY");
  if (nk) {
    try {
      const r = await fetch("https://integrate.api.nvidia.com/v1/models", { headers: { Authorization: `Bearer ${nk}` } });
      const d = await r.json();
      out.nvidia = r.ok ? "ok" : { status: r.status };
    } catch (e) { out.nvidia = { error: String(e) }; }
  } else out.nvidia = "missing_key";

  const ok = Deno.env.get("OPENROUTER_API_KEY");
  if (ok) {
    try {
      const r = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${ok}` } });
      const d = await r.json();
      out.openrouter = r.ok ? "ok" : { status: r.status };
    } catch (e) { out.openrouter = { error: String(e) }; }
  } else out.openrouter = "missing_key";

  // live generation smoke tests
  const tests: Record<string, unknown> = {};
  if (gk) {
    for (const gm of ["gemini-3.6-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"]) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${gm}:generateContent?key=${encodeURIComponent(gk)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "say hi" }] }], generationConfig: { maxOutputTokens: 200 } }),
      });
      const d = await r.json();
      tests[`gemini:${gm}`] = { status: r.status, err: d?.error?.message ?? null };
    }
  }
  if (qk) {
    for (const m of ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "meta-llama/llama-prompt-guard-2-22m"].slice(0,2)) {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST", headers: { Authorization: `Bearer ${qk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: m, messages: [{ role: "user", content: "hi" }], max_tokens: 20 }),
      });
      const d = await r.json();
      tests[`groq:${m}`] = { status: r.status, err: d?.error?.message ?? null };
    }
  }
  if (nk) {
    for (const m of ["nvidia/nemotron-3-super-120b-a12b", "nvidia/nemotron-3-nano-30b-a3b", "meta/llama-3.2-90b-vision-instruct", "mistralai/mistral-nemotron", "nvidia/nemotron-3.5-lightning-30b-a3b"]) {
      const r = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST", headers: { Authorization: `Bearer ${nk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: m, messages: [{ role: "user", content: "hi" }], max_tokens: 20 }),
      });
      const d = await r.json();
      tests[`nvidia:${m}`] = { status: r.status, err: d?.error?.message ?? d?.detail ?? null };
    }
  }
  out.smoke = tests;

  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
