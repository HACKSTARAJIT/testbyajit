import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { chatCompletion } from "../_shared/unifiedAI.ts";

const MODEL = "google/gemini-2.5-flash";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractJson(raw: string): any {
  if (!raw) throw new Error("AI ने खाली उत्तर दिया");
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("AI उत्तर में JSON नहीं मिला");
  return JSON.parse(s.slice(start, end + 1));
}

const SYSTEM = `You extract study-time data from a screenshot of a study timer / study tracker mobile app.

Return STRICT JSON only, in this exact shape:
{
  "date": "YYYY-MM-DD" | null,
  "date_confidence": "high" | "low",
  "rows": [
    { "subject": "<subject text exactly as shown>", "duration": "H:MM:SS" | "MM:SS" | null, "confident": true | false }
  ],
  "notes": "<short note about anything unreadable>"
}

RULES — follow strictly:
- Only extract rows that are clearly a STUDY SUBJECT with a TIMER/DURATION next to it.
- IGNORE: phone status bar (clock, battery, network), app navigation/tab bars, buttons, ads,
  headers, "Total"/"Grand total" summary rows, settings text, dates used as headings, any UI chrome.
- Include subjects whose duration is 0:00:00 — they are real rows.
- NEVER invent a subject or a duration. If a duration is unreadable, set "duration": null and "confident": false.
- If the date is not clearly visible in the screenshot, set "date": null and "date_confidence": "low".
- Keep the subject text as written in the image (do not translate or expand abbreviations).
- Output JSON only. No prose.`;

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
    const { data: auth } = await userClient.auth.getUser();
    if (!auth?.user) return json({ error: "Unauthorized" }, 401);

    const { image } = await req.json().catch(() => ({}));
    if (typeof image !== "string" || !image.startsWith("data:image/")) {
      return json({ error: "A screenshot image is required." }, 400);
    }

    let reply;
    try {
      reply = await chatCompletion(
        {
          model: MODEL,
          messages: [
            { role: "system", content: SYSTEM },
            {
              role: "user",
              content: [
                { type: "text", text: "Extract the study subjects and their durations from this screenshot." },
                { type: "image_url", image_url: { url: image } },
              ],
            },
          ],
          max_tokens: 2000,
          response_format: { type: "json_object" },
        },
        { feature: "extract-study-time", timeoutMs: 90_000 },
      );
    } catch (e) {
      return json({ error: `Screenshot could not be read: ${e instanceof Error ? e.message : String(e)}` }, 502);
    }

    const content = reply?.choices?.[0]?.message?.content ?? "";
    let parsed: any;
    try {
      parsed = extractJson(content);
    } catch (e) {
      return json({ error: `Could not understand the extraction result: ${e instanceof Error ? e.message : String(e)}` }, 502);
    }

    const rows = Array.isArray(parsed?.rows) ? parsed.rows : [];
    const clean = rows
      .map((r: any) => ({
        subject: typeof r?.subject === "string" ? r.subject.trim() : "",
        duration: typeof r?.duration === "string" ? r.duration.trim() : null,
        confident: r?.confident !== false && !!r?.duration,
      }))
      .filter((r: any) => r.subject.length > 0);

    if (clean.length === 0) {
      return json({ error: "No study subject rows could be found in this screenshot." }, 422);
    }

    return json({
      date: typeof parsed?.date === "string" ? parsed.date : null,
      date_confidence: parsed?.date_confidence === "high" ? "high" : "low",
      rows: clean,
      notes: typeof parsed?.notes === "string" ? parsed.notes : "",
      provider: reply.provider,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
