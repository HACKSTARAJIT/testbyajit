// Unified AI Service — routes every AJIT 360 AI call through OpenRouter (primary)
// with automatic silent failover to NVIDIA NIM (backup). New providers can be
// registered by adding to the PROVIDERS array below.
//
// Never called directly from the frontend. Only Supabase Edge Functions import this.
// API keys are read from environment secrets and never leave this module.

import { createClient } from "npm:@supabase/supabase-js@2";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: any;
};

export type ChatCompletionRequest = {
  model?: string;                       // canonical model id (e.g. "google/gemini-2.5-flash")
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" | "text" };
  // any extra provider-passthrough fields
  [key: string]: any;
};

// Normalized OpenAI-shaped response — every AI feature gets this shape
// regardless of which provider actually served the request.
export type ChatCompletionResponse = {
  id: string;
  provider: string;                     // internal; safe to expose (not the raw endpoint)
  model: string;
  choices: Array<{
    index: number;
    message: { role: "assistant"; content: string };
    finish_reason: string | null;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

type ProviderConfig = {
  name: string;
  endpoint: string;
  envKey: string;                       // env var name for its API key
  extraHeaders?: (apiKey: string) => Record<string, string>;
  // Translate a canonical model id to whatever this provider accepts.
  mapModel: (canonical: string) => string;
  // Some providers reject unknown fields — strip them here.
  transformBody?: (body: ChatCompletionRequest) => Record<string, any>;
};

// ─── Provider registry ────────────────────────────────────────────────────────
// Add new providers (Gemini, Groq, Claude, OpenAI, DeepSeek …) by pushing here.
// Ordering = priority (index 0 is primary).
const PROVIDERS: ProviderConfig[] = [
  {
    name: "openrouter",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    envKey: "OPENROUTER_API_KEY",
    extraHeaders: () => ({
      "HTTP-Referer": "https://ajit360.lovable.app",
      "X-Title": "AJIT 360",
    }),
    mapModel: (m) => m || "google/gemini-2.5-flash",
  },
  {
    name: "nvidia",
    endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
    envKey: "NVIDIA_API_KEY",
    // Gemini isn't on NIM — map to a strong OSS equivalent.
    mapModel: (m) => {
      const lower = (m || "").toLowerCase();
      if (lower.includes("vision") || lower.includes("pro") || lower.includes("image")) {
        return "meta/llama-3.2-90b-vision-instruct";
      }
      if (lower.includes("flash-lite") || lower.includes("nano") || lower.includes("mini")) {
        return "meta/llama-3.1-8b-instruct";
      }
      return "meta/llama-3.3-70b-instruct";
    },
    transformBody: (body) => {
      // NVIDIA NIM rejects response_format json_object on some models — drop it and
      // rely on the prompt to enforce JSON.
      const { response_format, ...rest } = body;
      return rest;
    },
  },
];

// ─── Health tracking ──────────────────────────────────────────────────────────
// In-memory per-worker; cheap and good enough. If a provider fails, quarantine
// it for a short cool-down so the next request skips it and goes straight to
// the next healthy provider. When cool-down expires we probe it again.
type Health = { healthyUntil: number; failing: boolean };
const health = new Map<string, Health>();
const COOLDOWN_MS = 60_000;

function isHealthy(name: string): boolean {
  const h = health.get(name);
  if (!h) return true;
  if (!h.failing) return true;
  if (Date.now() >= h.healthyUntil) {
    // cool-down over; treat as healthy again
    health.set(name, { healthyUntil: 0, failing: false });
    return true;
  }
  return false;
}
function markHealthy(name: string) {
  health.set(name, { healthyUntil: 0, failing: false });
}
function markUnhealthy(name: string) {
  health.set(name, { healthyUntil: Date.now() + COOLDOWN_MS, failing: true });
}

// ─── In-flight dedup ──────────────────────────────────────────────────────────
// Prevents duplicate Analyze requests within the same worker firing twice.
const inflight = new Map<string, Promise<ChatCompletionResponse>>();

// ─── Logging (internal only, never surfaced to the client) ────────────────────
async function logCall(row: {
  provider: string;
  fallback_used: boolean;
  retry_count: number;
  response_time_ms: number;
  status: string;
  error_code: string | null;
  model: string | null;
  feature: string | null;
}) {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;
    const admin = createClient(url, key);
    await admin.from("ai_provider_logs").insert(row);
  } catch (_) { /* never let logging break the request */ }
}

// ─── Retry helpers ────────────────────────────────────────────────────────────
const RETRYABLE_STATUSES = new Set([402, 429, 500, 502, 503, 504]);
const MAX_RETRIES_PER_PROVIDER = 2;

async function callProvider(
  p: ProviderConfig,
  apiKey: string,
  body: ChatCompletionRequest,
  timeoutMs: number,
): Promise<{ ok: true; data: any; status: number } | { ok: false; status: number; error: string; retryable: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const outBody = {
      ...(p.transformBody ? p.transformBody(body) : body),
      model: p.mapModel(body.model ?? ""),
    };
    const res = await fetch(p.endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(p.extraHeaders ? p.extraHeaders(apiKey) : {}),
      },
      body: JSON.stringify(outBody),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        status: res.status,
        error: text.slice(0, 300),
        retryable: RETRYABLE_STATUSES.has(res.status),
      };
    }
    const data = await res.json();
    return { ok: true, data, status: res.status };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // network / abort / timeout — always retryable
    return { ok: false, status: 0, error: msg, retryable: true };
  } finally {
    clearTimeout(timer);
  }
}

function normalize(providerName: string, data: any, requestedModel: string): ChatCompletionResponse {
  const choices = Array.isArray(data?.choices) ? data.choices : [];
  return {
    id: data?.id ?? crypto.randomUUID(),
    provider: providerName,
    model: data?.model ?? requestedModel,
    choices: choices.map((c: any, i: number) => ({
      index: c.index ?? i,
      message: {
        role: "assistant",
        content: typeof c?.message?.content === "string"
          ? c.message.content
          : (Array.isArray(c?.message?.content)
              ? c.message.content.map((p: any) => p?.text ?? "").join("")
              : ""),
      },
      finish_reason: c?.finish_reason ?? null,
    })),
    usage: data?.usage,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────
export type ChatOptions = {
  feature?: string;         // for logging only ("analyze-mock-test", etc.)
  dedupKey?: string;        // if set, in-flight identical calls share a promise
  timeoutMs?: number;       // per-attempt timeout (default 90s)
};

export async function chatCompletion(
  body: ChatCompletionRequest,
  opts: ChatOptions = {},
): Promise<ChatCompletionResponse> {
  const dedupKey = opts.dedupKey;
  if (dedupKey && inflight.has(dedupKey)) {
    return inflight.get(dedupKey)!;
  }
  const promise = _run(body, opts);
  if (dedupKey) {
    inflight.set(dedupKey, promise);
    promise.finally(() => inflight.delete(dedupKey));
  }
  return promise;
}

async function _run(body: ChatCompletionRequest, opts: ChatOptions): Promise<ChatCompletionResponse> {
  const timeoutMs = opts.timeoutMs ?? 90_000;
  const feature = opts.feature ?? null;
  const requestedModel = body.model ?? "";
  const started = Date.now();

  // Try each registered provider in order, skipping the ones currently cooling down.
  const ordered = PROVIDERS.slice().sort((a, b) => {
    // Healthy providers first, otherwise keep declared order.
    return (isHealthy(a.name) ? 0 : 1) - (isHealthy(b.name) ? 0 : 1);
  });

  let lastError = "AI service is temporarily unavailable. Please try again later.";
  let lastCode: string | null = null;
  let fallbackUsed = false;
  let totalRetries = 0;

  for (let i = 0; i < ordered.length; i++) {
    const p = ordered[i];
    const apiKey = Deno.env.get(p.envKey);
    if (!apiKey) {
      lastCode = `missing_${p.envKey}`;
      continue;
    }
    if (i > 0) fallbackUsed = true;

    for (let attempt = 0; attempt <= MAX_RETRIES_PER_PROVIDER; attempt++) {
      const result = await callProvider(p, apiKey, body, timeoutMs);
      if (result.ok) {
        markHealthy(p.name);
        const normalized = normalize(p.name, result.data, requestedModel);
        logCall({
          provider: p.name,
          fallback_used: fallbackUsed,
          retry_count: totalRetries,
          response_time_ms: Date.now() - started,
          status: "success",
          error_code: null,
          model: requestedModel || null,
          feature,
        });
        return normalized;
      }
      lastError = result.error || `HTTP ${result.status}`;
      lastCode = String(result.status);
      totalRetries++;
      if (!result.retryable) break;                // terminal for this provider → move on
      if (attempt < MAX_RETRIES_PER_PROVIDER) {
        const backoff = 400 * Math.pow(2, attempt); // 400ms, 800ms
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
    markUnhealthy(p.name);
    // fall through to next provider
  }

  logCall({
    provider: ordered[0]?.name ?? "none",
    fallback_used: fallbackUsed,
    retry_count: totalRetries,
    response_time_ms: Date.now() - started,
    status: "failed",
    error_code: lastCode,
    model: requestedModel || null,
    feature,
  });

  const friendly = new Error("AI service is temporarily unavailable. Please try again later.");
  (friendly as any).code = lastCode;
  (friendly as any).internal = lastError;
  throw friendly;
}
