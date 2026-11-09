# Assessment Follow-up Reviews Implementation Plan

**Goal:** Optionally assign the next review when closing a review or assessing new memorization, through the student page and staff queue.

**Architecture:** Extend the existing assessment inputs with an optional UTC calendar deadline (today or later). Under the existing student-before-assignment locks, finish the assessment and insert its next review in one transaction. Reject an existing open-review conflict without changing it or committing partial grades/history. Reuse the current assignment table; no migration, polling or additional service.

### 1. Transaction and input contract
- Extend `src/server/functions/validation.ts`, `src/server/functions/reviews.ts` and `src/server/services/{reviews,memorization}.server.ts`.
- Add transaction-only `src/server/services/follow-up-review.server.ts` for insertion and grade/conflict checks.
- Add `tests/integration/assessment-follow-up.test.ts` covering both assessment kinds, defaults, validation, permissions, cancellation, missing grades, atomic rollback, existing conflicts and concurrent submissions.

### 2. Assessment UI
- Add a shared optional Arabic next-review control and browser-safe payload helper.
- Wire `WorkQueueActionDialog`, `WorkQueue`, `AssessMemorizationDialog` and `MemorizationPanel`; invalidate reviews after memorization follow-up.
- Make `CloseAssignmentDialog` await submission and retain errors/choices; wire the student route to propagate failures and reset keyed dialog state between assignments.
- Preserve pending guards, RTL, date formatting, queue filters/pagination and save-and-next behavior.

### 3. Verify and deliver
- Add browser coverage at mobile and desktop widths for review and memorization follow-ups, student visibility, failure recovery, optional behavior and dialog resets.
- Run integration tests, lint, Worker/Storybook builds and browser suite.
- Update architecture/setup documentation, commit and open a PR to develop. Follow CI to completion. Preserve the main checkout's existing UI changes.
