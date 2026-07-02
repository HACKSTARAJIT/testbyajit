# Practice Book By Ajit — UX Overhaul Plan

The app already has: auth, subjects/chapters/PDFs, external test links, Wrong Questions Notebook, Test Score & Analysis, and chapter_views. This plan adds guest mode, progress tracking, bookmarks, notes, revision, and reorganizes navigation. I'll build in phases so the app stays working throughout.

## Phase 1 — Guest Mode + Auth screen
- Add a 3rd option on `/auth`: **Sign In**, **Create Account**, **Continue as Guest**.
- Guest state stored in a lightweight `useGuest` flag (localStorage). `ProtectedRoute` allows guests through to study routes.
- New `<SignInGate>` component: a reusable dialog/inline prompt shown whenever a guest tries to save personal data — message "Please sign in to save your progress and access it from any device." with **Sign In** / **Continue as Guest** buttons.
- Guests can browse subjects, chapters, view/download PDFs, open tests. All "save" actions (scores, history, wrong questions, bookmarks, notes, revision) are gated.

## Phase 2 — Database (one migration)
New per-user tables (RLS: owner-only via `auth.uid()`), each with GRANTs:
- `bookmarks` (item_type: pdf|chapter|test, item_id, subject_id) — bookmark PDFs, chapters, tests.
- `notes` (chapter_id, content) — personal chapter notes.
- `revision_items` (item_type: chapter|test, item_id, subject_id) — Mark for Revision.
- `pdf_progress` (pdf_id, status: not_started|reading|completed, last_page, updated_at).
- `study_activity` (item_type: subject|chapter|pdf|test, item_id, subject_id, opened_at) — powers Continue Studying + Recently Opened (chapter_views already partly does this; this generalizes it).

Existing `test_attempts` and `wrong_questions` already cover history/analysis — reused as-is.

## Phase 3 — Study tracking hooks
- Record `study_activity` on opening a subject, chapter, PDF, or test (registered users only).
- PDF viewer: track status + last page. Since PDFs open as signed URLs in a new tab, "last page" can't be read from the browser tab; I'll implement an in-app lightweight status control (Not Started / Reading / Completed buttons) and store `last_page` via a manual "I'm on page ___" field. (True auto page-tracking would require an embedded PDF.js reader — I'll flag this as an optional follow-up.)

## Phase 4 — New pages & sections
- **Home (`/dashboard`)** cleaned to: Search bar, **Continue Studying**, **Recently Opened**, **Subjects**. Remove standalone test/PDF sections.
- **Bookmarks page** (`/bookmarks`) — grouped PDFs / Chapters / Tests.
- **Revision list** (`/revision`) — chapters & tests marked ⭐.
- **Revision Dashboard** (`/revision-dashboard`) — Wrong Questions pending, bookmarked PDFs, notes, continue reading, continue last test, recently opened.
- **Chapter progress** shown on subject detail: "7/15 chapters completed" + progress bar (chapter = completed when its PDFs are all completed).
- **Weak/Strong subject analysis** added to Test Analysis: average % per subject with Needs Improvement / Excellent labels.
- Per-chapter **Notes** editor and ⭐ **Mark for Revision** on chapters and tests.
- Bookmark toggle on PDFs, chapters, tests.

## Phase 5 — Polish
- Ensure dark/light mode, mobile-first cards, smooth animations, large touch targets throughout new UI.

## Technical notes
- Reuse existing `TestTracker`, `AddWrongQuestionDialog`, `TestAnalysis`, `WrongQuestions`.
- All new tables owner-scoped RLS; guests never write (enforced in UI + RLS since they have no session).
- Accuracy % = correct / (correct+incorrect+unattempted) from `test_attempts`.

## Known limitation to confirm
True automatic "continue from last PDF page" needs an in-app PDF.js reader (PDFs currently open in a new browser tab). I'll ship manual status + last-page-remembered, and can add a full embedded reader as a follow-up if you want exact auto-resume.

I'll start with Phases 1–2 (guest mode + migration), then build the rest.