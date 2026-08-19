# Repair AI Hierarchy Classification Pipeline

## Confirmed root cause

- `ai-organize-mock` currently starts one long in-memory `EdgeRuntime.waitUntil()` loop for an entire mock or subject. That is not a durable queue; when the function worker is terminated, no code remains to mark the operation failed or continue it.
- Classification runs in groups of 8, but the shared provider layer allows up to three attempts across each configured provider with a 90-second per-attempt limit and no overall limit supplied by this function. Live `ai_provider_logs` show failed classification calls lasting about **273 seconds** with **8 retries**.
- The first batch was saved, then the next AI call outlived the worker. This exactly matches persisted progress at `8` with messages such as `Question 9 / 24` and `9 / 70`.
- Subject rebuild writes the same aggregate status onto every mock in the subject, so multiple mock cards display the same stuck progress. Those mock columns are being used as a job queue even though they have no durable job, heartbeat, lease, item state, hierarchy version, resume, cancel, or stalled detection.
- A mock already marked `processing` is rejected as “already running,” so stale rows can never recover through the current API.

## 1. Persistent classification jobs

Add owner-scoped backend tables for:

- `mock_classification_jobs`: subject/scope, hierarchy version, totals, completed/failed/skipped counts, current question, status (`pending`, `processing`, `completed`, `partial`, `failed`, `stalled`, `cancelled`), heartbeat, lease expiry/token, retry count, timestamps, and error.
- `mock_classification_job_items`: stable job + original question identity, per-question status, attempts, saved classification/error, timestamps, and a unique `(job_id, question_id)` constraint.

Add `classification_version` to each imported question. Add indexes for owner/scope/status and pending job items. Access remains owner-readable and server-managed; original question content, answers, history, mastery, and AI memory are untouched.

Add transactional database functions, callable only by the server function, to:

- acquire/release a single-flight job lease;
- claim a bounded batch while recovering expired item locks;
- atomically save all hierarchy fields + version and mark the item/job successful;
- atomically record an item failure and update job counters;
- finalize a job from persisted item counts.

## 2. One shared bounded processor

Refactor `ai-organize-mock` into action-based endpoints used by both manual Mock AI Organize and subject Rebuild:

- `start`: create or return the existing active job, snapshot eligible question IDs, and skip questions already classified for the current hierarchy version;
- `process`: acquire the lease and process at most **5 questions** sequentially;
- `resume`: reset only expired/incomplete items and continue from persisted state;
- `cancel`: mark the job cancelled so no future batch starts;
- `status`: return database truth and mark an expired heartbeat as stalled.

Each question gets its own error boundary. A successful classification is committed immediately through the atomic database function before the next question begins. One exhausted question is marked failed and processing continues.

After a batch, schedule the next invocation only when pending work remains, carry a finite hop budget, wait a short cooldown, and re-check paused/cancelled state before processing. No invocation processes the whole subject. Duplicate starts return the active job instead of creating duplicate work.

## 3. Controlled AI retries and fallback

For hierarchy classification only:

- classify one question per call so malformed output cannot poison neighboring questions;
- apply a bounded overall request budget, with up to 3 controlled attempts and exponential backoff for transient timeout/rate-limit/5xx failures;
- retain the existing sequential provider fallback—never fan out the same question to providers in parallel;
- validate strict JSON and canonicalize through the existing hierarchy resolver before saving;
- record the final provider/parsing/timeout reason on the individual job item;
- use deterministic `Unclassified → General` only when content cannot be classified, not when infrastructure fails.

## 4. Recovery of current stuck work

After deploying the schema and processor:

- detect legacy `processing` mock rows whose `updated_at` heartbeat is stale;
- mark them paused/stalled rather than completed and preserve all classifications already saved;
- create resumable jobs only when the user presses Resume, using the same stable question IDs and current hierarchy version;
- continue only unprocessed/outdated questions; never restart successfully versioned questions;
- synchronize legacy mock status fields from the new persisted job solely for backward-compatible displays.

No old classifications or learning data will be deleted.

## 5. Backend-truth UI

Update only the existing Mock Tests / AI Chapters status controls:

- load the latest job per subject/mock and poll/realtime-refresh its persisted counters;
- show real percentage, processed/total, success, failed, skipped, remaining, current question, and last heartbeat;
- show “Processing is taking longer than expected” before lease expiry and `Rebuild paused` once stalled;
- provide `Resume Rebuild`, `Restart Failed Job` (incomplete items only), and `Cancel Rebuild`;
- show each subject/mock’s own job rather than copying one subject aggregate onto every card;
- browser refresh, navigation, or page closure cannot affect processing state.

## 6. Verification

Add focused processor tests with seeded 5, 24, 70, and 205-question jobs covering:

- success and immediate per-question persistence;
- timeout, rate limit, provider failure/fallback, malformed JSON, and one-question failure;
- worker interruption after a partial batch and lease-expiry recovery;
- refresh/page closure and a new invocation resuming correctly;
- duplicate start clicks returning one active job;
- cancellation preserving completed classifications;
- current hierarchy version skipping already completed questions;
- final `completed` versus `partial` counts and legacy status synchronization.

Deploy and invoke the function, inspect the persisted job/items and provider logs, and verify the live UI against backend state before declaring the repair complete.
