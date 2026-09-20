# Device-specific responsive experience

## Goal
Keep Practice With AJIT as one application with shared data, authentication, routes, logic, and components, while adapting presentation intentionally for Mobile, Desktop, or Auto Detect.

## What will be built
- A first-visit full-screen device setup with large Mobile and Laptop/Desktop choices.
- A shared device-experience provider storing `mobile`, `desktop`, or `auto` locally without changing user data.
- A Display / Device Experience selector in the existing Profile page so users can switch anytime without losing progress.
- An adaptive app shell: compact hamburger navigation and single-column spacing for Mobile; existing full navigation, wider workspace, and multi-column presentation for Desktop; viewport-responsive behavior for Auto Detect.
- Shared responsive helpers so dialogs, forms, tables, cards, dashboards, and test screens stay usable without duplicating pages or business logic.
- Test interfaces will keep all current Exam and Practice behavior unchanged while their layout adapts to the active device experience.

## Safety and preservation
- No database migration, deletion, reset, or data rewrite.
- No duplicated app, routes, feature pages, test logic, scoring logic, or answer-feedback logic.
- Every feature remains available in every device experience.
- Existing desktop presentation remains the baseline and only receives targeted layout improvements.

## Technical approach
- Add one React context/hook that resolves the selected preference into `mobile`, `tablet`, or `desktop` using the viewport only when Auto Detect is selected.
- Apply a root data attribute and semantic layout classes, allowing user-selected Mobile/Desktop presentation even when the physical viewport differs.
- Reuse the current AppLayout and test UI components; only branch layout structure where a genuinely different arrangement is needed.
- Keep preference independent from test attempts and application records so switching cannot affect progress.

## Verification
- Check 320, 360, 375, 390, 414, 480, 768, 1024, 1280, 1440, and 1920 px.
- Verify no horizontal overflow, clipping, overlap, hidden navigation/buttons, or modal overflow.
- Verify Mobile/Desktop/Auto persist across reloads and switching preserves the current route and progress.
- Verify Practice feedback and Exam feedback restrictions remain unchanged.
