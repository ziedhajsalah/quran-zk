# Student Progress History Implementation Plan

> **For Codex:** Execute these tasks in the current isolated worktree; implementation is already authorized.

**Goal:** Students and staff can inspect actual grade transitions, their author and date, filtered by surah.

**Architecture:** An additive PostgreSQL event table stores nullable previous/new grades and a nullable staff reference. Every product grade write records its actual transition inside the existing student-locked transaction. A session-authorized, cursor-paginated query supplies a lazy Arabic timeline tab; no polling or new services.

**Tech Stack:** TanStack Start/Query, Mantine, PostgreSQL, Drizzle.

---

### Task 1: Schema and recording
- Modify `src/server/db/schema/app.ts`; generate/review `drizzle/0002*` with `npm run db:generate -- --name=grade_history`.
- Add `src/server/services/grade-history.server.ts` with a transaction-scoped recorder. Previous and new grades must differ; record addition, change and removal. Sequence IDs preserve recorded order even when timestamps tie.
- Modify `src/server/services/grades.server.ts` and `reviews.server.ts` to read previous grades under existing student locks and record transitions atomically. Cancellation, unchanged grades, failed writes and repeated removal produce no events.
- Test `tests/integration/grade-history.test.ts`: transitions, author deletion, student deletion, transaction rollback, concurrent writes and review closing semantics.

### Task 2: Authorized reads and cache
- Add browser-safe `src/lib/grade-history.ts`, validated `gradeHistoryInput`, and `grades.listHistoryForStudent`.
- Query only the authorized student's events; filter by optional surah and return 20 rows plus one lookahead, ordered by descending event ID.
- Add `gradeHistoryQuery` under the existing `grades` cache prefix. Test authorization, filtering, cursor validation and complete pagination with tied timestamps.

### Task 3: Timeline
- Add `src/components/surahs/GradeHistory/GradeHistoryList.tsx`, `GradeHistoryPanel.tsx` and stories for transitions, empty state and deleted author.
- Add `progress` to validated search/tab options on student/staff student-detail pages, retaining review history as its own tab.
- Include previous/new grade, Arabic surah name, teacher, explicit UTC date/time and change source. Explain that recording starts with this feature; no retroactive claims. Include loading/error/retry, filter reset and cursor navigation.

### Task 4: Verification and delivery
- Apply reviewed migration only to local development/test databases.
- Add `tests/e2e/grade-history.spec.ts` for mobile/desktop student access, surah filter, pagination, staff mutations and error/retry behavior in a negative timezone.
- Run `npm test`, `npm run lint`, `npm run build`, `npm run build-storybook`, `npm run test:e2e`.
- Update `docs/architecture.md` and `SETUP.md` with migration ordering and retention semantics.
- Commit, push and open a PR to `develop`; verify CI. Keep existing UI edits in the user's checkout untouched. No hosted migration/deploy or paid service.
