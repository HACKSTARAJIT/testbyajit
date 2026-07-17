
## Preparation 360° — Central Intelligence Hub

Transform the AI Performance Center into a full preparation brain without touching existing modules. All changes are additive.

### 1. New "🧠 Preparation 360°" primary tab (default)
Add as first tab in `AIPerformanceCenter.tsx`, before Overview. Layout:

- **Hero metrics grid** (18 chips): Preparation Score, Overall Accuracy, Exam Readiness, Progress %, Study Streak, Today Target, Weekly Target, Monthly Target, Pending Revision, Most Improved Subject, Weakest Subject, Strongest Subject, Most Improved Chapter, Weakest Chapter, Most Improved Topic, Weakest Topic, Most Common Mistake, Current AI Recommendation.
- **AI Insights panel** — data-backed one-liners generated server-side (e.g. "Geometry accuracy +12% over last 3 mocks").
- **AI Recommendations panel** — actionable links into Practice Tests, Smart Revision, PDF notes, weak chapters/topics.
- **Refresh button** — recomputes via edge function.

Data sources (all already in DB):
- `ai_mock_reports` (all types, chronological → improvement/decline detection)
- `test_attempts` (practice history + streak)
- `wrong_questions` (common mistakes, weak areas, revision backlog)
- `revision_items` / `revision_tests` (retention, memory)
- `study_activity` (streak, targets)
- `performance` (subject-level trend)
- `smart_goals` (targets)

### 2. New edge function `preparation-360`
Aggregates ALL data server-side and calls Gemini for AI-only fields (insights, recommendations, common mistake). Deterministic fields (scores, streaks, most-improved) computed in code, not by AI. Persists a snapshot to `ai_coach_snapshots` for reuse. Returns:

```
{
  scores: {preparation, accuracy, readiness, progress},
  streak, targets: {today, week, month, pending_revision},
  subjects: {strongest, weakest, most_improved},
  chapters: {weakest, most_improved},
  topics:   {weakest, most_improved},
  common_mistake, current_recommendation,
  insights: string[],           // AI, data-backed
  recommendations: [{label,type,ref}]
}
```

### 3. Expand AI Coach context
Update `supabase/functions/ai-coach-chat/index.ts` system prompt payload to include: practice attempts, wrong questions, revision items, previous reports, performance trend, dashboard stats — not just latest mock. Explicit instruction: never answer from a single upload; reason across the whole preparation history.

### 4. Auto-detection expanded
Update `analyze-mock-test` classifier prompt so `report_type` can also be `revision_test` or `previous_year` (in addition to full_mock / subject / chapter / topic). Add matching filters/labels in the UI tabs (Full Mock tab already renders these; label helper updated).

### 5. UI polish (no redesign)
- Add tab pill "🧠 Preparation 360°" as first tab, keep every other tab intact.
- Reuse existing card + gradient tokens — no new visual language.
- Skeletons while `preparation-360` is loading.

### Files
- **Edit** `src/pages/AIPerformanceCenter.tsx` — add Preparation 360° tab + panels.
- **New** `src/components/prep360/Preparation360.tsx` — self-contained hub UI.
- **New** `supabase/functions/preparation-360/index.ts` — aggregator + AI.
- **Edit** `supabase/functions/ai-coach-chat/index.ts` — full-history context.
- **Edit** `supabase/functions/analyze-mock-test/index.ts` — extend report_type enum.

### Out of scope (kept intact)
Practice Tests, Smart Revision, AI Mock Analyzer upload flow, Dashboard, PDF Library, Auth, Admin Panel. No schema migration needed — existing tables cover every field.
