import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { taxonomyFromRows, taxonomyPrompt, type Taxonomy } from "../_shared/taxonomy.ts";
import { hierarchyPrompt, placeInHierarchy } from "../_shared/hierarchy.ts";

const HIERARCHY_VERSION = "canonical-v2";
const BATCH_SIZE = 5;
const LEASE_SECONDS = 90;
const STALE_MS = 3 * 60 * 1000;
const MAX_CHAIN_HOPS = 40;
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "openai/gpt-5.6-sol";

type Admin = ReturnType<typeof createClient>;
type Job = {
  id: string;
  user_id: string;
  scope_type: "mock" | "subject";
  scope_key: string;
  mock_id: string | null;
  subject: string;
  hierarchy_version: string;
  total_questions: number;
  completed_questions: number;
  failed_questions: number;
  skipped_questions: number;
  current_question: number;
  status: string;
  heartbeat_at: string | null;
  lease_expires_at: string | null;
};

type Question = {
  id: string;
  mock_id: string;
  question_text: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  chapter: string | null;
  topic: string | null;
  ai_chapter: string | null;
  ai_topic: string | null;
  ai_subtopic: string | null;
  ai_subject: string | null;
  classification_id: string | null;
  classification_status: string | null;
  classification_version: string | null;
};

class CircuitBreakerError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Backend configuration is incomplete");
  return createClient(url, key);
}

async function authenticatedUser(req: Request) {
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && header === `Bearer ${serviceKey}`) return { internal: true, userId: null };
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) return null;
  const client = createClient(url, anon, { global: { headers: { Authorization: header } } });
  const token = header.slice(7);
  const { data, error } = await client.auth.getClaims(token);
  const subject = data?.claims?.sub;
  return error || typeof subject !== "string" ? null : { internal: false, userId: subject };
}

function parseObject(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const value = JSON.parse(raw.slice(start, end + 1));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function hasValidClassification(question: Pick<Question, "ai_subject" | "ai_chapter" | "ai_topic">) {
  return Boolean(
    question.ai_subject?.trim()
    && question.ai_chapter?.trim()
    && question.ai_topic?.trim(),
  );
}

async function loadTaxonomy(admin: Admin, userId: string, subject: string): Promise<Taxonomy> {
  const { data: mocks } = await admin.from("mock_mistake_mocks").select("id").eq("user_id", userId).eq("subject", subject);
  const ids = (mocks ?? []).map((m: { id: string }) => m.id);
  if (!ids.length) return taxonomyFromRows([]);
  const { data } = await admin.from("mock_mistake_questions").select("ai_chapter, ai_topic").in("mock_id", ids).eq("classification_version", HIERARCHY_VERSION);
  return taxonomyFromRows((data ?? []) as Array<{ ai_chapter?: string | null; ai_topic?: string | null }>);
}

function classificationPrompt(subject: string, taxonomy: Taxonomy, question: Question) {
  return `Classify exactly one imported mock-mistake question. Never solve, rewrite, or invent content.

SUBJECT: ${subject}
CANONICAL HIERARCHY:\n${hierarchyPrompt(subject)}
EXISTING CATEGORIES TO REUSE:\n${taxonomyPrompt(taxonomy)}

Rules:
1. Broad area is chapter; specific area is topic; narrower concept is optional subtopic.
2. Never combine categories. Same meaning must reuse the same category.
3. Prefer the canonical hierarchy. If content is genuinely unclear use chapter "Unclassified", topic "General".
4. Return one strict JSON object only: {"subject":"...","chapter":"...","topic":"...","subtopic":""}.

QUESTION:\n${JSON.stringify({
    text: question.question_text.slice(0, 1600),
    options: [question.option_a, question.option_b, question.option_c, question.option_d].filter(Boolean),
    current_chapter: question.ai_chapter ?? question.chapter ?? "",
    current_topic: question.ai_topic ?? question.topic ?? "",
  })}`;
}

async function classifyQuestion(subject: string, taxonomy: Taxonomy, question: Question) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new CircuitBreakerError(401, "AI configuration is unavailable");
  const body = {
    model: AI_MODEL,
    reasoning_effort: "none",
    messages: [
      { role: "system", content: "You are a precise academic librarian. Output strict JSON only." },
      { role: "user", content: classificationPrompt(subject, taxonomy, question) },
    ],
    response_format: { type: "json_object" },
  };
  let lastMessage = "AI service is temporarily unavailable";
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try {
      response = await fetch(AI_GATEWAY_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (error) {
      lastMessage = error instanceof Error ? `AI request timed out or failed: ${error.message}` : "AI request timed out";
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 800 + Math.floor(Math.random() * 400)));
        continue;
      }
      throw new Error(lastMessage);
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const nested = payload?.error?.message ?? payload?.error?.error?.message;
      lastMessage = typeof nested === "string"
        ? nested
        : typeof payload?.message === "string"
          ? payload.message
          : typeof payload?.error === "string" ? payload.error : `AI request failed (${response.status})`;
      console.error("AI classification request failed", {
        status: response.status,
        model: AI_MODEL,
        message: lastMessage,
        questionId: question.id,
      });
      // A request/content error belongs to this item only. Auth, credits and policy are job circuit breakers.
      if ([401, 402, 403].includes(response.status)) {
        throw new CircuitBreakerError(response.status, lastMessage);
      }

      if ((response.status === 429 || response.status >= 500) && attempt === 0) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 800 + Math.floor(Math.random() * 400);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
      throw new Error(lastMessage);
    }
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    const parsed = typeof content === "string" ? parseObject(content) : null;
    if (!parsed) throw new Error("AI returned malformed classification JSON");
    const chapter = typeof parsed.chapter === "string" ? parsed.chapter : "";
    const topic = typeof parsed.topic === "string" ? parsed.topic : "";
    if (!chapter.trim() || !topic.trim()) throw new Error("AI classification omitted chapter or topic");
    const canonical = placeInHierarchy({
      subject: typeof parsed.subject === "string" ? parsed.subject : subject,
      chapter,
      topic,
      subtopic: typeof parsed.subtopic === "string" ? parsed.subtopic : "",
    }, subject, taxonomy);
    return { ...canonical, provider: "lovable-ai" };
  }
  throw new Error(lastMessage);
}

async function syncLegacyMock(admin: Admin, job: Job, status: string) {
  if (job.scope_type !== "mock" || !job.mock_id) return;
  const active = status === "processing" || status === "pending";
  const finalStatus = active ? "processing" : status === "completed" || status === "partial" ? "organized" : "updated";
  const processed = job.completed_questions + job.failed_questions + job.skipped_questions;
  await admin.from("mock_mistake_mocks").update({
    organize_status: finalStatus,
    organize_progress: processed,
    organize_total: job.total_questions,
    organize_message: active ? `Classifying question ${Math.min(processed + 1, job.total_questions)} / ${job.total_questions}` : status === "completed" ? "Completed Successfully" : status === "partial" ? `Completed with ${job.failed_questions} failed` : null,
    organize_error: status === "failed" || status === "stalled" || status === "paused" ? "Classification paused. Resume to continue." : null,
    organized_at: status === "completed" || status === "partial" ? new Date().toISOString() : null,
  }).eq("id", job.mock_id);
}

async function invokeNext(jobId: string, hopsLeft: number) {
  if (hopsLeft <= 0) return { ok: false, error: "Processing hop budget was exhausted" };
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return { ok: false, error: "Backend worker configuration is incomplete" };
  await new Promise((resolve) => setTimeout(resolve, 750));
  try {
    const response = await fetch(`${url}/functions/v1/ai-organize-mock`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ action: "process", jobId, hopsLeft }),
      signal: AbortSignal.timeout(15_000),
    });
    const responseText = await response.text();
    if (!response.ok) {
      return { ok: false, error: `Worker invocation failed (${response.status}): ${responseText.slice(0, 500)}` };
    }
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Worker invocation failed" };
  }
}

async function processJob(admin: Admin, jobId: string, hopsLeft: number) {
  const leaseToken = crypto.randomUUID();
  const { data: claimed } = await admin.rpc("claim_mock_classification_job", {
    _job_id: jobId, _lease_token: leaseToken, _lease_seconds: LEASE_SECONDS,
  });
  if (!claimed) return;

  const { data: jobData } = await admin.from("mock_classification_jobs").select("*").eq("id", jobId).maybeSingle();
  const job = jobData as Job | null;
  if (!job || job.status === "cancelled") return;
  if (job.scope_type !== "mock" || !job.mock_id) {
    await admin.from("mock_classification_jobs").update({
      status: "cancelled",
      error_message: "Legacy subject-wide AI rebuild was retired. Organize each mock independently.",
      lease_token: null,
      lease_expires_at: null,
      completed_at: new Date().toISOString(),
    }).eq("id", jobId).eq("lease_token", leaseToken);
    return;
  }

  const expiredBefore = new Date(Date.now() - STALE_MS).toISOString();
  await admin.from("mock_classification_job_items").update({ status: "pending", claimed_at: null })
    .eq("job_id", jobId).eq("status", "processing").lt("claimed_at", expiredBefore);

  const { data: candidates } = await admin.from("mock_classification_job_items")
    .select("id, question_id, attempts").eq("job_id", jobId).eq("status", "pending")
    .order("created_at", { ascending: true }).limit(BATCH_SIZE);
  const items = candidates ?? [];
  if (!items.length) {
    const { data: finalStatus } = await admin.rpc("finalize_mock_classification_job", { _job_id: jobId, _lease_token: leaseToken });
    const { data: finalJob } = await admin.from("mock_classification_jobs").select("*").eq("id", jobId).maybeSingle();
    if (finalJob) await syncLegacyMock(admin, finalJob as Job, String(finalStatus ?? finalJob.status));
    return;
  }

  const ids = items.map((item: { question_id: string }) => item.question_id);
  await admin.from("mock_classification_job_items").update({ status: "processing", claimed_at: new Date().toISOString() })
    .eq("job_id", jobId).in("question_id", ids).eq("status", "pending");
  const { data: questions } = await admin.from("mock_mistake_questions").select("id, mock_id, question_text, option_a, option_b, option_c, option_d, chapter, topic, ai_subject, ai_chapter, ai_topic, ai_subtopic, classification_id, classification_status, classification_version").in("id", ids);
  const questionMap = new Map((questions ?? []).map((q: Question) => [q.id, q]));
  const taxonomy = await loadTaxonomy(admin, job.user_id, job.subject);

  let halted = false;
  for (const item of items as Array<{ id: string; question_id: string; attempts: number }>) {
    const { data: latest } = await admin.from("mock_classification_jobs").select("status").eq("id", jobId).maybeSingle();
    if (latest?.status === "cancelled") break;
    const question = questionMap.get(item.question_id);
    if (!question) {
      await admin.rpc("fail_mock_classification_item", { _job_id: jobId, _item_id: item.id, _lease_token: leaseToken, _error_message: "Original question was not found" });
      continue;
    }
    if (hasValidClassification(question)) {
      await admin.from("mock_classification_job_items").update({
        status: "skipped",
        error_message: "Existing valid classification preserved",
        claimed_at: null,
        completed_at: new Date().toISOString(),
      }).eq("id", item.id).eq("job_id", jobId).eq("status", "processing");
      continue;
    }
    try {
      await admin.from("mock_classification_jobs").update({
        heartbeat_at: new Date().toISOString(),
        lease_expires_at: new Date(Date.now() + LEASE_SECONDS * 1000).toISOString(),
        current_question_id: question.id,
      }).eq("id", jobId).eq("lease_token", leaseToken);
      const result = await classifyQuestion(job.subject, taxonomy, question);
      await admin.rpc("complete_mock_classification_item", {
        _job_id: jobId, _item_id: item.id, _lease_token: leaseToken, _hierarchy_version: HIERARCHY_VERSION,
        _ai_subject: result.subject, _ai_chapter: result.chapter, _ai_topic: result.topic,
        _ai_subtopic: result.subtopic ?? "", _provider: result.provider,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof CircuitBreakerError) {
        await admin.from("mock_classification_job_items").update({ status: "pending", claimed_at: null }).eq("id", item.id).eq("status", "processing");
        await admin.from("mock_classification_job_items").update({ status: "pending", claimed_at: null }).eq("job_id", jobId).eq("status", "processing");
        await admin.from("mock_classification_jobs").update({
          status: "stalled",
          error_message: message,
          lease_token: null,
          lease_expires_at: null,
          heartbeat_at: new Date().toISOString(),
        }).eq("id", jobId).eq("lease_token", leaseToken);
        halted = true;
        break;
      }
      await admin.rpc("fail_mock_classification_item", { _job_id: jobId, _item_id: item.id, _lease_token: leaseToken, _error_message: message });
    }
  }

  const { data: itemCounts } = await admin.from("mock_classification_job_items").select("status").eq("job_id", jobId);
  const count = (status: string) => (itemCounts ?? []).filter((item: { status: string }) => item.status === status).length;
  const completedCount = count("completed");
  const failedCount = count("failed");
  const skippedCount = count("skipped");
  await admin.from("mock_classification_jobs").update({
    completed_questions: completedCount,
    failed_questions: failedCount,
    skipped_questions: skippedCount,
    current_question: completedCount + failedCount + skippedCount,
    heartbeat_at: new Date().toISOString(),
  }).eq("id", jobId).eq("lease_token", leaseToken);
  const { data: refreshed } = await admin.from("mock_classification_jobs").select("*").eq("id", jobId).maybeSingle();
  if (!refreshed) return;
  const current = refreshed as Job;
  const { count: remaining } = await admin.from("mock_classification_job_items").select("id", { count: "exact", head: true }).eq("job_id", jobId).eq("status", "pending");
  if (halted || current.status === "stalled") {
    await syncLegacyMock(admin, current, current.status);
    return;
  }
  await syncLegacyMock(admin, current, remaining ? "processing" : current.status);
  if (remaining && current.status !== "cancelled") {
    await admin.from("mock_classification_jobs").update({ lease_token: null, lease_expires_at: null, heartbeat_at: new Date().toISOString() }).eq("id", jobId).eq("lease_token", leaseToken);
    const next = await invokeNext(jobId, hopsLeft > 1 ? hopsLeft - 1 : MAX_CHAIN_HOPS);
    if (!next.ok) {
      await admin.from("mock_classification_jobs").update({
        status: "stalled",
        error_message: next.error,
        lease_token: null,
        lease_expires_at: null,
        heartbeat_at: new Date().toISOString(),
      }).eq("id", jobId).in("status", ["pending", "processing"]);
    }
  } else {
    const { data: finalStatus } = await admin.rpc("finalize_mock_classification_job", { _job_id: jobId, _lease_token: leaseToken });
    const { data: finalJob } = await admin.from("mock_classification_jobs").select("*").eq("id", jobId).maybeSingle();
    if (finalJob) await syncLegacyMock(admin, finalJob as Job, String(finalStatus ?? finalJob.status));
  }
}

async function createJob(admin: Admin, userId: string, body: Record<string, unknown>) {
  const mockId = typeof body.mockId === "string" ? body.mockId : null;
  if (!mockId) throw new Error("mockId is required. Subject-wide AI rebuilds are disabled.");
  const { data: mock } = await admin.from("mock_mistake_mocks").select("id, user_id, subject").eq("id", mockId).maybeSingle();
  if (!mock || mock.user_id !== userId) throw new Error("Mock not found");
  const subject = mock.subject;
  const scopeType = "mock" as const;
  const scopeKey = mockId;
  const activeStatuses = ["pending", "processing", "stalled"];
  const { data: activeJobs } = await admin.from("mock_classification_jobs").select("*")
    .eq("user_id", userId).eq("mock_id", mockId).eq("scope_type", "mock").eq("hierarchy_version", HIERARCHY_VERSION)
    .in("status", activeStatuses).order("created_at", { ascending: false });
  const active = (activeJobs ?? [])[0];
  if (active) return { job: active as Job, existing: true };

  const { data: questions, error: questionError } = await admin.from("mock_mistake_questions")
    .select("id, mock_id, classification_id, ai_subject, ai_chapter, ai_topic")
    .eq("user_id", userId).eq("mock_id", mockId).order("created_at", { ascending: true });
  if (questionError) throw questionError;
  const rows = (questions ?? []) as Array<Pick<Question, "id" | "mock_id" | "ai_subject" | "ai_chapter" | "ai_topic">>;
  const skipped = rows.filter(hasValidClassification).length;
  const unresolved = rows.length - skipped;

  const { data: created, error: createError } = await admin.from("mock_classification_jobs").insert({
    user_id: userId, scope_type: scopeType, scope_key: scopeKey, mock_id: mockId, subject,
    hierarchy_version: HIERARCHY_VERSION, total_questions: rows.length,
    skipped_questions: skipped, current_question: skipped,
    status: unresolved ? "pending" : "completed", completed_at: unresolved ? null : new Date().toISOString(),
  }).select("*").single();
  if (createError) {
    if (createError.code === "23505") {
      const { data: existing } = await admin.from("mock_classification_jobs").select("*")
        .eq("user_id", userId).eq("scope_type", "mock").eq("scope_key", mockId)
        .eq("hierarchy_version", HIERARCHY_VERSION).in("status", activeStatuses)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (existing) return { job: existing as Job, existing: true };
    }
    throw createError;
  }
  const job = created as Job;
  if (rows.length) {
    const { error: itemError } = await admin.from("mock_classification_job_items").insert(rows.map((row) => ({
      job_id: job.id, user_id: userId, question_id: row.id,
      status: hasValidClassification(row) ? "skipped" : "pending",
      error_message: hasValidClassification(row) ? "Existing valid classification preserved" : null,
      completed_at: hasValidClassification(row) ? new Date().toISOString() : null,
    })));
    if (itemError) throw itemError;
  }
  await syncLegacyMock(admin, { ...job, skipped_questions: skipped, current_question: skipped }, unresolved ? "processing" : "completed");
  return { job, existing: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await authenticatedUser(req);
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "start";
    const admin = adminClient();

    if (action === "process") {
      if (!auth.internal) return json({ error: "Forbidden" }, 403);
      const jobId = typeof body.jobId === "string" ? body.jobId : "";
      const hopsLeft = typeof body.hopsLeft === "number" ? Math.max(0, Math.min(MAX_CHAIN_HOPS, body.hopsLeft)) : MAX_CHAIN_HOPS;
      if (!jobId) return json({ error: "jobId is required" }, 400);
      // @ts-ignore EdgeRuntime is available in deployed edge functions.
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(processJob(admin, jobId, hopsLeft));
      else await processJob(admin, jobId, hopsLeft);
      return json({ ok: true, jobId });
    }

    const userId = auth.userId;
    if (!userId) return json({ error: "Unauthorized" }, 401);
    if (action === "cancel") {
      const jobId = typeof body.jobId === "string" ? body.jobId : "";
      const { data } = await admin.from("mock_classification_jobs").update({ status: "cancelled", completed_at: new Date().toISOString(), lease_token: null, lease_expires_at: null })
        .eq("id", jobId).eq("user_id", userId).in("status", ["pending", "processing", "stalled", "partial", "failed"]).select("*").maybeSingle();
      if (!data) return json({ error: "Active job not found" }, 404);
      await syncLegacyMock(admin, data as Job, "cancelled");
      return json({ ok: true, job: data });
    }

    if (action === "status") {
      const staleBefore = new Date(Date.now() - STALE_MS).toISOString();
      const { data } = await admin.from("mock_classification_jobs").select("*")
        .eq("user_id", userId).eq("scope_type", "mock").order("created_at", { ascending: false }).limit(100);
      const jobs = (data ?? []).map((job: Job) => job.status === "processing" && (!job.heartbeat_at || job.heartbeat_at < staleBefore)
        ? { ...job, status: "stalled", error_message: "No progress heartbeat was detected. Resume to continue." }
        : job);
      return json({ ok: true, jobs });
    }

    if (action === "resume") {
      const jobId = typeof body.jobId === "string" ? body.jobId : "";
      const { data: job } = await admin.from("mock_classification_jobs").select("*").eq("id", jobId).eq("user_id", userId).maybeSingle();
      if (!job) return json({ error: "Job not found" }, 404);
      await admin.from("mock_classification_job_items").update({ status: "pending", claimed_at: null, error_message: null })
        .eq("job_id", jobId).in("status", ["failed", "processing"]);
      await admin.from("mock_classification_jobs").update({ status: "pending", error_message: null, lease_token: null, lease_expires_at: null, completed_at: null, heartbeat_at: new Date().toISOString() }).eq("id", jobId).in("status", ["stalled", "partial", "failed"]);
      if (job.status === "processing") {
        await admin.from("mock_classification_jobs").update({ status: "pending", error_message: null, lease_token: null, lease_expires_at: null, completed_at: null, heartbeat_at: new Date().toISOString() }).eq("id", jobId).eq("user_id", userId);
      }
      const next = await invokeNext(jobId, MAX_CHAIN_HOPS);
      if (!next.ok) {
        await admin.from("mock_classification_jobs").update({ status: "stalled", error_message: next.error, lease_token: null, lease_expires_at: null }).eq("id", jobId).eq("user_id", userId);
        return json({ error: next.error }, 503);
      }
      return json({ ok: true, jobId });
    }

    const result = await createJob(admin, userId, body);
    if (result.job.status !== "completed") {
      const next = await invokeNext(result.job.id, MAX_CHAIN_HOPS);
      if (!next.ok) {
        await admin.from("mock_classification_jobs").update({ status: "stalled", error_message: next.error, lease_token: null, lease_expires_at: null }).eq("id", result.job.id).eq("user_id", userId);
        return json({ error: next.error, jobId: result.job.id }, 503);
      }
    }
    return json({ ok: true, job: result.job, existing: result.existing });
  } catch (error) {
    console.error("ai-organize-mock error", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});