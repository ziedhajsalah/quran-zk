# Staff Work Queue Implementation Plan

> **For Codex:** Execute this plan task by task in the existing isolated worktree.

**Goal:** Staff can find open work across active students and navigate directly to its existing assessment, deadline and cancellation controls.

**Architecture:** A staff-only GET unions the existing review and memorization tables. Parameterized student search, UTC deadline filters and deterministic 20-row cursor pages keep responses bounded. URL filters survive navigation; existing mutation invalidation refreshes the queue without polling. No schema or hosted service changes.

**Tech Stack:** TanStack Start/Router/Query, Mantine, PostgreSQL/Drizzle, Vitest and Playwright.

### Task 1: Authorized query
Create `src/lib/work-queue.ts`, `src/server/services/work-queue.server.ts`, `src/server/functions/work-queue.ts`; extend `src/server/functions/validation.ts`. Require staff before querying, exclude terminal/inactive/non-student work. Search display name and username literally, with a 100-character limit. Filter work type and overdue/today/upcoming/undated/all using UTC day boundaries. Order deadlines ascending (null last), kind and ID; fetch 21 to return 20 plus next cursor. Test permissions, search escaping, filters, date boundaries, ties/null pagination and changed work in `tests/integration/work-queue.test.ts`.

### Task 2: Staff interface
Add a `/staff/work` route and `src/components/staff/WorkQueue.tsx`. Keep search/type/deadline filters in validated URL parameters; submit student search explicitly rather than on each keystroke. Reset pagination on filter changes. Show loading/error/retry/empty states, student and surah, work type, UTC deadline and direct assignment links. Use the existing student detail controls for writes. Add links from the staff dashboard and student list. Extend `src/lib/queries.ts` with queue keys and assignment/account mutation invalidation.

### Task 3: Verification and delivery
Add local-only browser fixtures in `tests/e2e/work-queue.spec.ts`; exercise mobile/desktop search/filter/pages, direct links, returning after mutations, authorization and request failure. Run `npm test`, `npm run lint`, `npm run build`, `npm run build-storybook`, `npm run test:e2e`. Update SETUP and architecture. Review the diff, commit/push `feature/staff-work-queue`, open a PR to develop and verify CI. Preserve the main checkout's UI edits; do not access production configuration or mutate hosted data. No additional service cost.
