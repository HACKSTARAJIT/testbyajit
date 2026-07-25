import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { chatCompletion } from "../_shared/unifiedAI.ts";

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

    const { question, history } = await req.json();
    if (typeof question !== "string" || !question.trim()) {
      return json({ error: "question required" }, 400);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: reports } = await admin
      .from("imported_mock_reports")
      .select("id, report_number, mock_name, score, accuracy, attempt_percent, negative_marks, time_used, verdict, exam_readiness, extracted, created_at")
      .eq("user_id", userId)
      .order("report_number", { ascending: true })
      .limit(30);

    if (!reports || reports.length === 0) {
      return json({ answer: "Insufficient Data. Please import at least one Gemini mock analysis report first." });
    }

    const contextJson = JSON.stringify(reports.map((r: any) => ({
      report_number: r.report_number,
      mock_name: r.mock_name,
      date: r.created_at,
      score: r.score,
      accuracy: r.accuracy,
      attempt_percent: r.attempt_percent,
      negative_marks: r.negative_marks,
      time_used: r.time_used,
      verdict: r.verdict,
      exam_readiness: r.exam_readiness,
      extracted: r.extracted,
    })));

    const systemPrompt = `You are AJIT AI Coach. You must answer ONLY using the imported Gemini mock analysis reports provided below as JSON. NEVER invent, guess, or use outside knowledge. If the answer is not present in the reports, reply exactly: "Insufficient Data."

Rules:
- Reference specific mocks by report_number and mock_name when useful.
- Use the student's language (English / Hindi / mixed) matching their question.
- Be concise, structured, actionable. Use short bullet points.
- Never modify or contradict Gemini's conclusions in the reports.

IMPORTED REPORTS JSON:
${contextJson}`;

    const messages: any[] = [{ role: "system", content: systemPrompt }];
    if (Array.isArray(history)) {
      for (const m of history.slice(-10)) {
        if (m?.role && typeof m?.content === "string") messages.push({ role: m.role, content: m.content });
      }
    }
    messages.push({ role: "user", content: question });

    const resp = await chatCompletion({
      model: "google/gemini-2.5-flash",
      messages,
      temperature: 0.2,
      max_tokens: 1500,
    }, { feature: "imported_coach_chat", timeoutMs: 45_000, overallTimeoutMs: 90_000 });

    const answer = resp.choices?.[0]?.message?.content ?? "Insufficient Data.";
    return json({ answer });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
