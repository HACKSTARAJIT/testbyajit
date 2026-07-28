
# Imported Report → Single Source of Truth

Goal: After every "Analyze & Save", AJIT 360 must automatically deep-analyze the imported report, refresh every AI module from that structured data, and auto-generate personalized recovery tests. No second manual step.

## 1. Deeper post-import analysis (server)

Extend `supabase/functions/import-mock-analysis/index.ts`:

- After the current extraction pass, run a **second AI pass** ("deep understanding") on the same text + first-pass JSON. Output a richer schema:
  - `subjects[]`, `chapters[]`, `topics[]`, `subtopics[]` — each with `{ name, parent, mistakes, skipped, accuracy, priority }`
  - `recurring_weaknesses[]`, `recurring_strengths[]` — computed by cross-referencing the user's prior imported reports (`imported_report_insights`) with the new one
  - `patterns` — `time_management`, `silly_mistakes`, `concept_mistakes`, `guesswork`, `confidence_issues`, `skipped_patterns`
  - `revision_priority[]` (ranked), `high_roi_topics[]`, `action_plan[]`
  - `scores` — `mastery`, `weakness`, `recovery`, `confidence`, `learning_progress` (0-100, computed deterministically from extracted counts)
- Write the enriched blob into `imported_report_insights` (new columns) and also aggregate into `imported_coach_memory.memory` so the coach chat + every dashboard reads one canonical structure.
- Classify every mistake/skipped entry into the `Subject → Chapter → Topic → Subtopic` hierarchy; store on `mistake_bank` / `skipped_bank` items.

## 2. Auto test generation (server)

Same edge function, after analysis persists, populate `mock_generated_questions` (already exists) tagged with `report_id`, `bucket`, `subject`, `chapter`, `topic`, `subtopic`, `difficulty`:

- Wrong Question Test — all `mistake_bank` items
- Skipped Question Test — all `skipped_bank` items (kept strictly separate)
- Weak Subject / Chapter / Topic Tests — one per detected weak node
- Topic Recovery Test — auto-created when a topic has ≥3 mistakes, ordered easy→hard
- Recurring Weakness → Priority Recovery Test — when the same topic appears weak in ≥2 reports
- Full Recovery Test — mixed pool of highest-priority items

Tests are represented as rows in a new `imported_auto_tests` table `{ report_id, user_id, kind, subject, chapter, topic, subtopic, question_ids[], difficulty_curve, priority, created_at }`. Runner reuses existing `MockAutoTest` page by report_id + test kind.

## 3. Client wiring

- `AnalysisImportPanel.tsx` — after save, show live progress ("Analyzing… classifying topics… generating tests…") and refetch. No extra button.
- `AIPerformanceCenter.tsx` and its tabs (Overview, Memory, Subject, Chapter, Topic, Repositories, Planner, History, Compare, AI Coach, Preparation 360, Academic Intelligence) — swap their data sources to read from the enriched `imported_report_insights` + `imported_coach_memory` for the selected/latest report, instead of raw text or legacy tables. A single `useImportedReport(reportId)` hook centralizes this.
- `MockRevisionHub.tsx` — surface the new auto-generated test buckets per imported report with "▶ Start" buttons.
- `imported-coach-chat` edge function — feed it the enriched structured JSON, not raw text.

## 4. Database

One migration:
- Add JSONB columns to `imported_report_insights`: `hierarchy`, `patterns`, `scores`, `recurring`, `deep_analysis_status`.
- New table `imported_auto_tests` with RLS + GRANTs (owner-only, `service_role` full).
- Extend `mock_generated_questions` with `report_id` link + `bucket`, `subject`, `chapter`, `topic`, `subtopic` columns if missing.

## Technical notes

- Deep analysis uses `unifiedAI.ts` chat completion, JSON-only, with retries. All prompts server-side.
- Scoring formulas are deterministic in TS so dashboards never depend on model whims.
- Existing legacy raw-text paths remain read-only fallbacks but every UI prefers structured data.
- Everything runs inside the existing `import-mock-analysis` request; user sees one spinner, one success toast.

## Out of scope

- No visual redesign. No changes to Practice Tests, PDF library, Admin, auth, or Smart Revision core.
- No new AI provider work.
