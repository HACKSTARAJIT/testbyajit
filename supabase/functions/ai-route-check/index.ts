// TEMPORARY: verifies unifiedAI routing order and model validity. No secrets returned.
import { unifiedFetch } from "../_shared/unifiedAI.ts";

Deno.serve(async () => {
  const res = await unifiedFetch({
    feature: "route-check",
    body: {
      messages: [
        { role: "system", content: "Output strict JSON only." },
        { role: "user", content: 'Return {"ok":true} as JSON.' },
      ],
      model: "google/gemini-2.5-flash",
      temperature: 0.4,
      max_tokens: 400,
    },
    overallTimeoutMs: 60000,
  });
  const data = await res.json();
  return new Response(JSON.stringify({
    status: res.status,
    provider: data?.provider ?? null,
    model: data?.model ?? null,
    content: data?.choices?.[0]?.message?.content ?? data?.error ?? null,
  }, null, 2), { headers: { "Content-Type": "application/json" } });
});
