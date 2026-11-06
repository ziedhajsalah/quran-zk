# New Memorization Assignments Implementation Plan

> **For Codex:** Implement in the current isolated worktree; execution is already authorized.

**Goal:** Teachers assign an unrecorded whole surah with an optional deadline; students see it separately from reviews, and assessment records the grade and progress history.

**Architecture:** Add a separate PostgreSQL assignment table with one open assignment per student/surah. All writes lock the student before assignments and preserve existing review/reset/admin locks. Share transactional grade-writing logic so both explicit assessment and ordinary first-grade recording complete an open memorization assignment atomically. Session-scoped queries share cache invalidation across grades and assignments. No polling or new services.

**Tech Stack:** TanStack Start/Query, Mantine, Drizzle, PostgreSQL.

---

### Task 1: Persistence and invariants
- Test `tests/integration/memorization.test.ts`: staff writes, self/staff reads, unrecorded-only targets, duplicates/concurrency, assessment, cancellation, manual grading, history rollback and retention.
- Add `memorizationAssignments` to `src/server/db/schema/app.ts`; generate/review `drizzle/0003_memorization_assignments.sql` and metadata. Reuse review status enum, range check, partial open unique index, student/status/due index and terminal-grade consistency check.
- Add validated assignment/assessment inputs in `src/server/functions/validation.ts`.
- Extract a transaction-only grade writer in `src/server/services/grades.server.ts`, retaining previous-grade/history semantics and automatically completing a matching open memorization assignment.
- Add `src/server/services/memorization.server.ts` and `src/server/functions/memorization.ts`. Assignment rejects recorded surahs and duplicates; completion requires an explicit grade, checks open status under locks and writes grade/history/closure atomically; cancellation writes no grade. Open list is bounded by 114 possible surahs and ordered by UTC deadline.

### Task 2: Teacher and student UI
- Add browser-safe row/input types in `src/lib/memorization.ts`, query helper in `src/lib/queries.ts` and invalidation for grade writes.
- Add `MemorizationQueue`, `AssignMemorizationDrawer`, `AssessMemorizationDialog` and query panel under `src/components/surahs/Memorization/`, with presentation stories.
- The assignment drawer offers searchable, unrecorded/unassigned surahs and one optional UTC calendar date. Await writes; preserve input and explain errors; block duplicate/pending dismissal.
- The assessment dialog requires a grade and waits for success; cancellation is confirmed. Students see read-only work with explicit empty/error/retry states.
- Add validated `memorization` tabs to student and staff detail routes; reset form state when switching students.
- Add a separate student-dashboard card with at most five deadline-sorted assignments, counts and links to the corresponding queue anchor. Assigned work does not count as recorded/mastered before grading.

### Task 3: Verification and delivery
- Apply reviewed migrations only to local development/test databases; update `scripts/db-smoke.ts`, SETUP and architecture documentation.
- Add `tests/e2e/memorization.spec.ts` covering mobile/desktop assignment, student dashboard/queue, UTC dates, assessment/history, manual grading, cancellation, stale selection errors and pending protection using local temporary accounts.
- Run integration tests, lint, Worker build, Storybook build, local DB smoke and full browser suite.
- Commit/push a feature branch, open PR against develop and verify CI. Leave the user's main-checkout UI edits untouched; no hosted deployment/migration or paid service.
