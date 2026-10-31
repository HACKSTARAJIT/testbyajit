# Architecture rules
- Keep personal task tracking in dedicated tracker tables and routes, using the existing auth client and query cache; isolation prevents accidental changes to exam and study records.
- Enforce tracker task ownership with a composite list/user foreign key and row-level policies; client filters alone do not protect private data.
- Keep CGL timetable tasks separate from personal tasks and legacy generated planner rows; legacy regeneration can delete planner records.
- Store reviewed external results in imported_mock_reports with manual_external provenance and structured manual_details; one score history prevents counting imported question containers as extra mocks.
- Reference existing mistake records in spaced schedules and submit attempts through owner-checked, idempotent transactional RPCs; scheduler mastery must not alter legacy mistake mastery.
- Use configured timezone calendar dates for revision and wake-to-wake preparation dates for overnight timetables; actual Study Time remains the recorded calendar-day total, never estimated task time.
- Scope shared catalog/configuration reads to protected app roles and storage reads to referenced resources; only enabled intro media is anonymous, so unpublished files and private mistake images stay isolated.