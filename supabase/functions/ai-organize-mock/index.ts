import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { unifiedFetch } from "../_shared/unifiedAI.ts";
import {
  canonicalize,
  taxonomyFromRows,
  taxonomyPrompt,
  type Taxonomy,
} from "../_shared/taxonomy.ts";

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
  ai_chapter?: string | null;
  ai_topic?: string | null;
  ai_subtopic?: string | null;
};

const BATCH = 8;

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

/** Load the canonical taxonomy already present for one user + subject. */
async function loadTaxonomy(admin: any, userId: string, subject: string): Promise<Taxonomy> {
  const { data: mocks } = await admin
    .from("mock_mistake_mocks")
    .select("id")
    .eq("user_id", userId)
    .eq("subject", subject);
  const ids = (mocks ?? []).map((m: any) => m.id);
  if (!ids.length) return taxonomyFromRows([]);
  const { data } = await admin
    .from("mock_mistake_questions")
    .select("ai_chapter, ai_topic")
    .in("mock_id", ids)
    .not("classification_id", "is", null);
  return taxonomyFromRows((data ?? []) as any[]);
}

function buildPrompt(subject: string, tax: Taxonomy, payload: unknown) {
  return `Exam subject: ${subject}

You are ONLY a librarian: never rewrite, never generate, never answer, never modify any question. You only assign classification labels.

EXISTING CANONICAL CATEGORIES for this student (Chapter: topics):
${taxonomyPrompt(tax)}

RULES (very important):
1. FIRST try to reuse an existing canonical Chapter and Topic above. Only invent a new one when the concept is genuinely different.
2. Never output combined names like "Current Affairs / Science & Technology" or "Science (Physics)". Choose ONE Chapter and put the finer concept in topic/subtopic.
3. Same meaning = same category ("Art and Culture" -> "Art & Culture", "Triangles"/"Triangle Problems" -> "Triangles").
4. Keep a real hierarchy: subject > chapter > topic > subtopic. Do not mix levels.
5. Classify from the actual question content, not from the mock name or hints.
6. If the question is not clear enough, use chapter "Unclassified" and topic "General". Never invent.
7. Use consistent naming: "&" (not "and"), Title Case, singular/standard exam terminology.

Return ONLY a JSON array, one object per input item:
[{"i":0,"subject":"...","chapter":"...","topic":"...","subtopic":""}]
subtopic may be "" if unclear. No extra text.

QUESTIONS:
${JSON.stringify(payload)}`;
}

async function classifyBatch(subject: string, tax: Taxonomy, batch: Row[]) {
  const payload = batch.map((q, idx) => ({
    i: idx,
    question: q.question_text?.slice(0, 900) ?? "",
    options: [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean).slice(0, 4),
    current_chapter: q.ai_chapter ?? q.chapter ?? "",
    current_topic: q.ai_topic ?? q.topic ?? "",
  }));

  let mapped: any[] = [];
  try {
    const res = await unifiedFetch({
      feature: "ai-organize-mock",
      body: {
        messages: [
          { role: "system", content: "You are a precise academic classifier that reuses existing canonical categories. Output strict JSON only." },
          { role: "user", content: buildPrompt(subject, tax, payload) },
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
  for (const m of mapped) if (typeof m?.i === "number") byIndex.set(m.i, m);
  return byIndex;
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

    const body = await req.json().catch(() => ({}));
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ------------------------------------------------------------------
    // MODE: normalize & reorganize an entire subject (one-time cleanup)
    // ------------------------------------------------------------------
    if (body?.mode === "normalize") {
      const subject = typeof body.subject === "string" ? body.subject : "";
      if (!subject) return json({ error: "subject required" }, 400);

      const { data: mocks } = await admin
        .from("mock_mistake_mocks")
        .select("id, organize_status")
        .eq("user_id", userId)
        .eq("subject", subject);
      const mockIds = (mocks ?? []).map((m: any) => m.id);
      if (!mockIds.length) return json({ ok: true, processed: 0 });
      if ((mocks ?? []).some((m: any) => m.organize_status === "processing")) {
        return json({ ok: true, already: true });
      }

      const { data: qs } = await admin
        .from("mock_mistake_questions")
        .select("id, mock_id, question_text, option_a, option_b, option_c, option_d, correct_answer, chapter, topic, ai_chapter, ai_topic, ai_subtopic")
        .in("mock_id", mockIds)
        .eq("user_id", userId)
        .not("classification_id", "is", null)
        .order("created_at", { ascending: true });
      const rows = (qs ?? []) as Row[];
      if (!rows.length) return json({ ok: true, processed: 0 });

      const setStatus = async (patch: Record<string, unknown>) => {
        await admin.from("mock_mistake_mocks").update(patch).in("id", mockIds);
      };

      await setStatus({
        organize_status: "processing",
        organize_progress: 0,
        organize_total: rows.length,
        organize_message: "Preparing...",
        organize_error: null,
      });

      const work = async () => {
        let done = 0;
        try {
          await setStatus({ organize_message: "Analyzing existing classifications..." });
          // Pass 1 — deterministic merge of equivalent / combined names.
          const tax = taxonomyFromRows([]);
          await setStatus({ organize_message: "Finding duplicate categories..." });
          const merged = rows.map((r) => ({
            row: r,
            canon: canonicalize(
              { subject, chapter: r.ai_chapter, topic: r.ai_topic, subtopic: r.ai_subtopic },
              subject,
              tax,
            ),
          }));
          await setStatus({ organize_message: "Merging equivalent categories..." });
          for (const m of merged) {
            const r = m.row;
            if (
              r.ai_chapter === m.canon.chapter &&
              r.ai_topic === m.canon.topic &&
              (r.ai_subtopic ?? null) === m.canon.subtopic
            ) continue;
            await admin.from("mock_mistake_questions").update({
              ai_subject: m.canon.subject,
              ai_chapter: m.canon.chapter,
              ai_topic: m.canon.topic,
              ai_subtopic: m.canon.subtopic,
            }).eq("id", r.id).eq("user_id", userId);
          }

          // Pass 2 — AI re-check every question against the canonical taxonomy.
          await setStatus({ organize_message: "Reclassifying questions..." });
          for (let i = 0; i < rows.length; i += BATCH) {
            const batch = rows.slice(i, i + BATCH);
            await setStatus({
              organize_progress: done,
              organize_message: `Reclassifying questions... ${Math.min(done + 1, rows.length)} / ${rows.length}`,
            });
            const byIndex = await classifyBatch(subject, tax, batch);
            for (let k = 0; k < batch.length; k++) {
              const q = batch[k];
              const ai = byIndex.get(k);
              const prev = merged.find((m) => m.row.id === q.id)!.canon;
              const canon = ai
                ? canonicalize(
                    { subject, chapter: ai.chapter, topic: ai.topic, subtopic: ai.subtopic },
                    subject,
                    tax,
                  )
                : prev;
              await admin.from("mock_mistake_questions").update({
                ai_subject: canon.subject,
                ai_chapter: canon.chapter,
                ai_topic: canon.topic,
                ai_subtopic: canon.subtopic,
                classification_status: "classified",
                classified_at: new Date().toISOString(),
              }).eq("id", q.id).eq("user_id", userId);
              done++;
            }
          }

          await setStatus({ organize_message: "Building canonical hierarchy...", organize_progress: done });
          await setStatus({ organize_message: "Saving..." });
          await setStatus({
            organize_status: "organized",
            organize_progress: done,
            organize_message: "Completed Successfully",
            organize_error: null,
            organized_at: new Date().toISOString(),
          });
        } catch (e) {
          console.error("normalize job error", e);
          await setStatus({
            organize_status: "organized",
            organize_progress: done,
            organize_message: null,
            organize_error: (e as Error).message,
          });
        }
      };

      // @ts-ignore EdgeRuntime is available in Supabase Edge Functions
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(work());
      } else {
        work();
      }
      return json({ ok: true, queued: rows.length, mode: "normalize" });
    }

    // ------------------------------------------------------------------
    // MODE: classify one mock's new questions (existing manual AI Organize)
    // ------------------------------------------------------------------
    const mockId = body?.mockId;
    if (!mockId || typeof mockId !== "string") return json({ error: "mockId required" }, 400);

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
        // Reuse the student's existing canonical categories for this subject.
        const tax = await loadTaxonomy(admin, userId, mock.subject);

        for (let i = 0; i < rows.length; i += BATCH) {
          const batch = rows.slice(i, i + BATCH);
          await admin.from("mock_mistake_mocks").update({
            organize_progress: done,
            organize_message: `Analyzing Question ${Math.min(done + 1, rows.length)} / ${rows.length}`,
          }).eq("id", mockId);

          const byIndex = await classifyBatch(mock.subject, tax, batch);

          for (let k = 0; k < batch.length; k++) {
            const q = batch[k];
            const ai = byIndex.get(k) ?? {};
            const canon = canonicalize(
              {
                subject: ai.subject ?? mock.subject,
                chapter: ai.chapter ?? q.chapter,
                topic: ai.topic ?? q.topic,
                subtopic: ai.subtopic,
              },
              mock.subject,
              tax,
            );
            await admin.from("mock_mistake_questions").update({
              classification_id: crypto.randomUUID(),
              ai_subject: canon.subject,
              ai_chapter: canon.chapter,
              ai_topic: canon.topic,
              ai_subtopic: canon.subtopic,
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
