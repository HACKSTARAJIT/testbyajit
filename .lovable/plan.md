# Admin Intelligence Center

Hidden admin-only module. Zero changes to existing student modules — purely additive.

## Access & routing
- New route `/admin/intelligence` wrapped in the existing `AdminRoute` guard (already checks `has_role(auth.uid(), 'admin')`).
- Add a link inside the existing Admin dashboard (`/admin`) only. No entry in student nav (`AppLayout` nav stays as-is).
- Server-side role check on every edge function via `has_role` RPC before returning any data.

## Data sources (all existing tables — no schema changes needed)
- `profiles`, `user_roles`, `auth.users` (via existing `admin_get_user_emails` RPC)
- `test_attempts`, `tests`, `questions`, `subjects`, `chapters`
- `wrong_questions`, `revision_items`, `revision_tests`
- `ai_mock_reports`, `ai_coach_snapshots`, `ai_chat_threads`, `study_plan_tasks`
- `study_activity`, `performance`, `smart_goals`

## New edge functions (admin-only, JWT + has_role check)
1. `admin-overview` — aggregate counts: total students, online-now (activity in last 5 min), active today/week, new registrations (last 7d), premium/guest breakdown.
2. `admin-live-activity` — recent `study_activity` + latest `test_attempts` joined with profile/email/subject/chapter/test for a live feed.
3. `admin-students-list` — paginated + searchable list with per-student aggregates (readiness, accuracy, questions solved, wrong count, revision pending/done, streak).
4. `admin-student-detail` — full 360° for one student: subject/chapter/topic accuracy, mock history, test history, AI reports, revision progress, weak/strong areas, trend, planner, coach threads.
5. `admin-leaderboard` — top accuracy / score / most active / most improved / longest streak / highest revision completion.
6. `admin-insights` — Gemini via Lovable AI: generates 4–6 short data-backed one-liners from aggregated stats.

All 6 functions:
- Verify JWT from `Authorization` header, call `has_role(user_id, 'admin')` with service-role client, 403 otherwise.
- Return JSON; no raw SQL from client.

## Frontend (new files only)
- `src/pages/AdminIntelligence.tsx` — tabbed shell (Overview / Live Activity / Students / Leaderboard / Insights).
- `src/components/admin-intel/OverviewTab.tsx` — hero stat grid + Insights panel.
- `src/components/admin-intel/LiveActivityTab.tsx` — polling every 15s.
- `src/components/admin-intel/StudentsTab.tsx` — search, filters (subject, chapter, accuracy, readiness, reg date, last login, streak, premium, guest), CSV export.
- `src/components/admin-intel/StudentDetailDrawer.tsx` — opens on row click; shows full 360° profile, mock history, test history, AI report, revision, planner, coach threads.
- `src/components/admin-intel/LeaderboardTab.tsx`.
- Export helpers: CSV (client-side), Excel via `xlsx` npm pkg, PDF via existing `jspdf` if present else CSV+print.

## Router wiring
- `src/App.tsx`: add `<Route path="/admin/intelligence" element={<AdminRoute><AppLayout><AdminIntelligence /></AppLayout></AdminRoute>} />`.
- `src/pages/Admin.tsx`: add one card linking to `/admin/intelligence`.

## Security
- No client-side role trust: every fetch hits an edge function that re-verifies admin via `has_role`.
- No new RLS policies needed — edge functions use service role after admin check, mirroring existing `admin-get-user-emails` pattern.
- Route double-guarded by `AdminRoute` + server check.

## Out of scope (kept intact)
Practice Tests, Smart Revision, AI Mock Analyzer, AI Performance Center, Dashboard, PDF Library, Auth, existing Admin & AdminAnalytics pages, student nav.

## Notes
- "Premium Users" and "Phone" fields don't exist in current schema → shown as "—" with a small "not tracked" note. No migration added since spec says do not modify existing functionality; can wire up later if user confirms adding columns.
- "Online now" = `study_activity.updated_at` within last 5 minutes (best available signal without new presence infra).
