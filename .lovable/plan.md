# Practice Book By Ajit — Premium Upgrade Plan

This is a large upgrade. To ship it safely without breaking working features (auth, guest mode, PDFs, AI test generator, TestEngine, cloud sync), I'll build it in ordered phases. Each phase is self-contained and testable. Nothing is removed — routes are relocated, not deleted.

## Guiding rules
- Keep every existing route working (deep links still resolve); only the **navigation menu** is trimmed.
- All persistence stays in the cloud database (no localStorage for user data — theme preference is the only allowed local flag).
- Reuse the existing `TestEngine`, `testLoader`, and AI generator instead of rewriting them.

---

## Phase 1 — Branding & Navigation shell
- **PB logo**: generate a premium "PB" mark, use it in header, splash, auth, profile, favicon, and subject cards.
- **Header**: PB logo + "Practice Book By Ajit".
- **Minimal nav**: keep only 🏠 Home and ❌ Wrong Questions (+ Admin for admins). Move everything else into Home/Subject/Profile. Old routes stay registered so nothing 404s.
- **Footer**: © Practice Book By Ajit · Designed & Developed by Ajit Singh.
- **Splash screen** + **About page** (`/about`): PB logo, developer, version, copyright.
- Refresh the theme tokens toward the royal-blue/purple/orange/emerald/cyan premium palette with glassmorphism utilities (extend existing `index.css`).

## Phase 2 — Home Dashboard
Rebuild `Dashboard.tsx` as the central hub with sections:
- **Continue Studying**: last PDF, last test, last subject, last chapter (from `pdf_progress`, `test_attempts`, `chapter_views`).
- **Subjects grid**: premium gradient cards showing icon, name, total chapters/PDFs/tests, progress %.
- **Today's Revision**: pending wrong-question counts by priority + "Start Revision" button.
- **Recent Activity**: recent PDFs, recent tests, completed chapters.
- **Download Android App** premium card (uses existing `app_release`).

## Phase 3 — Subject-centric structure
- Subject → Chapter → (Study PDFs + Practice Tests) all inside `SubjectDetail`/chapter view.
- Remove standalone Tests/PDF pages from nav; fold their content into the chapter view. Keep the routes alive as redirects.

## Phase 4 — Profile hub
Move into `Profile.tsx` as tabs/sections:
- Study Statistics, Test History, Score Analysis (best/avg/accuracy/attempts, weak & strong subjects, revision progress), Bookmarks, Achievements, Cloud Sync status, Account Settings, Guest/Login status.

## Phase 5 — Smart Wrong-Question Bank + Auto Revision Engine (core intelligence)
Database migration (extends existing tables, no destructive changes):
- `wrong_questions`: add `question_id`, `wrong_count`, `correct_revision_count`, `consecutive_correct`, `last_attempt_at`, `mastered_at`. Priority derived from `wrong_count` (1=low, 2=medium, 3+=high). Status: `pending` / `mastered`.
- New `revision_tests` table: one auto-generated revision test per original test per user, linked Subject→Chapter→Original Test, storing the current set of wrong+skipped `question_id`s. Grants + RLS scoped to `auth.uid()`.

Logic (in `TestEngine` submit handler + a shared `revisionEngine.ts`):
1. **After every attempt** of any test, compute incorrect + skipped questions and **upsert** each into `wrong_questions` (increment counts, recompute priority).
2. **Auto-create/refresh** the linked revision test for that original test with the current pending set — no manual step.
3. **Re-attempt handling**: on re-attempting the original test, remove now-mastered questions, keep remaining wrong, add newly wrong/skipped, regenerate the revision test.
4. **Mastery**: a question moves to Mastered only after **2 consecutive correct revision attempts**; mastered questions stay permanently visible in a Mastered section.
5. **Today's Revision**: auto-built from all pending wrong questions; single "Start Revision" launches it via `TestEngine`.

Wrong Questions page hierarchy: Subject → Chapter → Original Test → Wrong & Skipped Test, plus per-question history (wrong count, correct-revision count, last attempt, priority, status) and a Mastered tab.

## Phase 6 — Test modes (verify/extend)
Confirm Practice Mode (instant feedback, answer, explanation, live score, progress, accuracy) and Exam Mode (no feedback, result on submit) work for original **and** auto-generated revision tests via the shared `TestEngine`.

## Phase 7 — Premium UI polish
Apply glassmorphism, gradients, rounded cards, premium shadows, fade/scale/slide animations, ripple buttons, skeleton loaders, and responsive mobile layout across the new dashboard, subject, profile, and wrong-question screens.

---

## Technical notes
- New files: `revisionEngine.ts`, `About.tsx`, `SplashScreen`, PB logo asset; migration for wrong-question intelligence + `revision_tests`.
- Edited: `AppLayout` (nav/branding/footer), `Dashboard`, `SubjectDetail`, `Profile`, `WrongQuestions`, `TestEngine` (post-submit hook), `App.tsx` (add `/about`), `index.css`, `index.html` (favicon/title).
- No existing table columns dropped; migrations are additive so current features keep working.

## Suggested build order for approval
I recommend shipping Phase 1+2 first (visible transformation), then Phase 5 (the intelligent engine), then 3/4/6/7. I'll implement top-to-bottom after you approve, verifying the build and test flow at each phase.

Would you like me to proceed with this plan, or adjust the phase order / scope first?