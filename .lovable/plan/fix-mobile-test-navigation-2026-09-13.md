# Fix mobile test navigation

## Implementation
- Update the shared test bottom navigation to use a two-row, two-column layout on mobile: Questions and Review & Mark above Previous and Next/Submit.
- Keep the existing single-row desktop layout unchanged.
- Make every navigation control flexible and compact at narrow widths while preserving icons, labels, disabled states, and click behavior.
- Add safe-area-aware bottom spacing so the fixed navigation stays above Android/system controls and question content remains scrollable behind it without being covered.

## Verification
- Exercise the same running test in Practice Mode and Exam Mode at 320, 360, 375, 390, 412, and 430 pixels wide.
- Confirm all four controls remain visible, tappable, unclipped, and produce no horizontal page overflow.
- Confirm desktop remains a single row and Exam Mode still exposes no live correctness, score, or accuracy feedback.

## Technical details
- Scope changes to the shared test navigation presentation and test-shell spacing only; scoring, timer, answer selection, persistence, and test data remain unchanged.
- Use responsive grid/flex classes and `env(safe-area-inset-bottom)` rather than viewport-specific fixed widths.