# Final competitive-exam test interface

## Implementation
- Redesign the existing shared test presentation used by `TestEngine` and `PracticeRunner`; keep their current question, answer, timer, persistence, scoring, mastery, and result logic intact.
- Build a compact `PRACTICE WITH AJIT` header with test/section context, question progress, timer, text-size controls, navigator access, focus mode, and exit/pause actions appropriate to each runner.
- Use a desktop two-column workspace from 768px upward: the question and options occupy the main area while a sticky filtered question navigator remains visible on the right.
- Use a mobile-only question layout below 768px with a large bottom-sheet navigator and a compact fixed Previous / Review & Mark / Next bar that respects device safe areas.
- Restyle the question surface and options for dense, readable Hindi, English, mixed-language, and mathematical content without changing option-selection behavior.
- Add five persisted content-size levels (XS, S, M, L, XL), controlled by A− / A / A+, affecting only question, option, explanation, and supporting content text without reloading the test.
- Preserve neutral answered, unanswered, review, and answered-plus-review states in Exam Mode; correctness colors, answers, explanations, scores, and accuracy remain unavailable until submission. Practice Mode keeps its existing immediate feedback.
- Add desktop keyboard navigation without overriding active form controls, and keep touch targets at least 44px.

## Verification
- Exercise a real published test in Practice Mode and Exam Mode using the existing saved question data.
- Verify widths 320, 360, 375, 390, 414, 480, 768, 1024, 1280, 1440, and 1920 for wrapping, overflow, fixed-bar clearance, drawer behavior, and the desktop navigator.
- Verify Previous, Next, Review & Mark, navigator jumps and filters, timer, focus/exit, answer selection, refresh persistence of text size, and final submission/results.
- Confirm Exam Mode exposes only progress/attempt/review state while running and Practice Mode still exposes immediate correctness and explanations.
- Confirm no database migrations or writes outside the existing attempt/practice flows, and no changes to Mock Mistakes, App Test Mistakes, mastery, Study Time, AI data, test generation, or stored questions.

## Technical details
- Extend the existing `PremiumTestUI` components rather than adding another test engine.
- Keep visual roles token-based in the global test styles, use CSS custom properties for content scaling, and store the preference under a presentation-only local-storage key.
- Represent answered-plus-review as a combined neutral navigator treatment, never as correctness in Exam Mode.