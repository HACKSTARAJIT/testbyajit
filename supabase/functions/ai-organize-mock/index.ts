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
  question_text: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  correct_answer: string | null;
  chapter: string | null;
  topic: string | null;
};

const BATCH = 8;

function clean(v: unknown): string {
  return typeof v === "string" ? v.trim().slice(0, 120) : "";
}

function parseJsonArray(text: string): any[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : text).trim();
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1) return [];
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
    const { data: claims, error: authErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const { mockId } = await req.json().catch(() => ({}));
    if (!mockId || typeof mockId !== "string") return json({ error: "mockId required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: mock } = await admin
      .from("mock_mistake_mocks")
      .select("id, user_id, name, subject, organize_status")
      .eq("id", mockId)
      .maybeSingle();
    if (!mock || mock.user_id !== userId) return json({ error: "Mock not found" }, 404);
    if (mock.organize_status === "processing") return json({ ok: true, already: true });

    const { data: pending } = await admin
      .from("mock_mistake_questions")
      .select("id, question_text, option_a, option_b, option_c, option_d, correct_answer, chapter, topic")
      .eq("mock_id", mockId)
      .eq("user_id", userId)
      .is("classification_id", null)
      .order("sort_order", { ascending: true });

    const rows = (pending ?? []) as Row[];
    if (rows.length === 0) {
      await admin.from("mock_mistake_mocks").update({
        organize_status: "organized",
        organize_progress: 0,
        organize_total: 0,
        organize_message: "Completed Successfully",
        organize_error: null,
        organized_at: new Date().toISOString(),
      }).eq("id", mockId);
      return json({ ok: true, processed: 0 });
    }

    await admin.from("mock_mistake_mocks").update({
      organize_status: "processing",
      organize_progress: 0,
      organize_total: rows.length,
      organize_message: "Preparing...",
      organize_error: null,
    }).eq("id", mockId);

    const work = async () => {
      let done = 0;
      try {
        for (let i = 0; i < rows.length; i += BATCH) {
          const batch = rows.slice(i, i + BATCH);
          await admin.from("mock_mistake_mocks").update({
            organize_progress: done,
            organize_message: `Analyzing Question ${Math.min(done + 1, rows.length)} / ${rows.length}`,
          }).eq("id", mockId);

          const payload = batch.map((q, idx) => ({
            i: idx,
            question: q.question_text?.slice(0, 900) ?? "",
            options: [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean).slice(0, 4),
            hint_chapter: q.chapter ?? "",
            hint_topic: q.topic ?? "",
          }));

          const prompt = `Exam subject: ${mock.subject}\n\nClassify each question below into an academic hierarchy. You are ONLY a librarian: never rewrite, never generate, never answer, never modify anything. Use standard Indian competitive-exam (SSC/Bank) chapter and topic names. Use the student's own hint_chapter/hint_topic when they are sensible.\n\nReturn ONLY a JSON array, one object per input item:\n[{"i":0,"subject":"...","chapter":"...","topic":"...","subtopic":"..."}]\nsubtopic may be "" if unclear. No extra text.\n\nQUESTIONS:\n${JSON.stringify(payload)}`;

          let mapped: any[] = [];
          try {
            const res = await unifiedFetch({
              feature: "ai-organize-mock",
              body: {
                messages: [
                  { role: "system", content: "You are a precise academic classifier. Output strict JSON only." },
                  { role: "user", content: prompt },
                ],
                temperature: 0.1,
                max_tokens: 1200,
              },
            });
            if (res.ok) {
              const data = await res.json();
              mapped = parseJsonArray(data?.choices?.[0]?.message?.content ?? "");
            }
          } catch (e) {
            console.error("classification batch failed", e);
          }

          const byIndex = new Map<number, any>();
          for (const m of mapped) {
            if (typeof m?.i === "number") byIndex.set(m.i, m);
          }

          for (let k = 0; k < batch.length; k++) {
            const q = batch[k];
            const m = byIndex.get(k) ?? {};
            const chapter = clean(m.chapter) || clean(q.chapter) || "Unclassified";
            const topic = clean(m.topic) || clean(q.topic) || "General";
            await admin.from("mock_mistake_questions").update({
              classification_id: crypto.randomUUID(),
              ai_subject: clean(m.subject) || mock.subject,
              ai_chapter: chapter,
              ai_topic: topic,
              ai_subtopic: clean(m.subtopic) || null,
              classification_status: "classified",
              classified_at: new Date().toISOString(),
            }).eq("id", q.id).eq("user_id", userId);
            done++;
          }

          await admin.from("mock_mistake_mocks").update({
            organize_progress: done,
            organize_message: `Saving... ${done} / ${rows.length}`,
          }).eq("id", mockId);
        }

        await admin.from("mock_mistake_mocks").update({
          organize_status: "organized",
          organize_progress: done,
          organize_message: "Completed Successfully",
          organized_at: new Date().toISOString(),
        }).eq("id", mockId);
      } catch (e) {
        console.error("ai-organize-mock job error", e);
        await admin.from("mock_mistake_mocks").update({
          organize_status: done > 0 ? "updated" : "not_organized",
          organize_progress: done,
          organize_message: null,
          organize_error: (e as Error).message,
        }).eq("id", mockId);
      }
    };

    // Keep the job alive after the response so the user can navigate away.
    // @ts-ignore EdgeRuntime is available in Supabase Edge Functions
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(work());
    } else {
      work();
    }

    return json({ ok: true, queued: rows.length });
  } catch (e) {
    console.error("ai-organize-mock error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
