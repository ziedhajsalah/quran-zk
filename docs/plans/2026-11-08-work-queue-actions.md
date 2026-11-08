# Staff Work Queue Actions Implementation Plan

**Goal:** Staff assess, reschedule and cancel work without leaving their filtered queue.

**Architecture:** Extend the staff-only bounded queue projection with the current grade. Reuse existing session-authorized mutation endpoints and deadline dialog; retain transaction locks and query invalidation. A queue-specific dialog displays the selected student and surah, retains failed input, and offers save-and-next using the refreshed current page. No migration, polling or additional paid service.

**Tech Stack:** React, Mantine, TanStack Query/Start, Drizzle/PostgreSQL.

### Task 1: Bounded grade projection

- Update `src/lib/work-queue.ts` and `src/server/services/work-queue.server.ts` with nullable currentGrade via the unique student/surah grade join.
- Update `tests/integration/work-queue.test.ts` to verify recorded, absent and changed grades without changing pagination.

### Task 2: Queue actions

- Add `src/components/staff/WorkQueueActionDialog.tsx` for review closure (keep grade or explicitly change it), required memorization assessment and confirmed cancellation.
- Extend `AssignmentDeadlineDialog.tsx` with optional student context, preserving existing callers.
- Add accessible action buttons to `WorkQueueList.tsx`, disabled until hydrated or while filtering/loading/acting. Preserve student-page links and Storybook fixtures.
- Wire existing mutations in `WorkQueue.tsx`; retain current filters/cursor and scroll. Invalidate existing grade/history/attention/queue keys. Save-and-next selects a remaining item from the refreshed current page. Show outcome and recovery feedback.

### Task 3: Verification and delivery

- Add browser coverage for direct review/memorization assessment, save-and-next, failed input retention, cancellation/rescheduling, later-page/filter preservation and pre-hydration controls.
- Run integration tests, lint, Worker build, focused browser tests and full browser suite. Build Storybook for presentation changes.
- Document behavior in SETUP.md and docs/architecture.md. Commit, push and open a PR to develop; follow CI to completion.

User authorized implementation in this chat; execute here without a separate handoff.
