# Assessment Feedback Implementation Plan

> **For Codex:** Execute the following tasks in this isolated checkout. The referenced superpowers execution skill is unavailable; use the existing repository workflow.

**Goal:** Let teachers attach optional feedback to completed assignments, visible to students and staff in history.

**Architecture:** Add nullable feedback to review and memorization assignments. Validate and normalize text at the server boundary; save inside existing assessment transactions and student-first locks. Read feedback through existing authorized history queries; never copy it into mutable general notes or later grades.

**Tech Stack:** TanStack Start, React/Mantine, PostgreSQL, Drizzle, Vitest and Playwright.

---

### Task 1: Persistence and authorization

- Modify `src/server/db/schema/app.ts`, generate and inspect `drizzle/0005_assessment_feedback.sql` plus snapshot/journal.
- Add nullable `assessment_feedback` to both assignment tables. Constrain non-null feedback to completed work and 1–2000 characters.
- Modify `src/server/functions/validation.ts`, `src/server/services/reviews.server.ts`, `src/server/services/memorization.server.ts` to trim, limit and save feedback atomically. Reject feedback on cancellation. Keep grade writer unchanged; explicit memorization assessment updates its closed assignment within the same transaction.
- Expose only via existing self/staff history queries and DTOs in `src/lib/review-history.ts` and `src/lib/memorization.ts`.
- Add `tests/integration/assessment-feedback.test.ts`: both kinds, unchanged grades, whitespace/omission, auth, rejection, rollback, immutable closed snapshots, concurrency and database constraints.
- Run `npm test -- tests/integration/assessment-feedback.test.ts`, then full `npm test`.

### Task 2: Arabic assessment and history UI

- Create shared `src/components/surahs/AssessmentFeedback.tsx` and browser-safe input type/limit in `src/lib/assessment-feedback.ts`.
- Wire `CloseAssignmentDialog`, `AssessMemorizationDialog`, `WorkQueueActionDialog`, `WorkQueue` and `MemorizationPanel`.
- Display escaped multiline feedback in both history lists. Preserve input on errors, disable while saving, clear between assignments, and show no invented feedback for older records.
- Extend `tests/e2e/assessment-follow-up.spec.ts` to cover all dialog paths, failure retention, save-and-next reset, staff/student histories and mobile RTL. Add story examples.
- Run focused browser suite, lint, Worker and Storybook builds.

### Task 3: Documentation and delivery

- Document migration-before-deploy, student visibility, history retention and $0 extra service cost in `SETUP.md` and `docs/architecture.md`.
- Review diff, run full browser suite; commit, push and open PR to `develop`. Follow required CI to completion and resolve findings.
- Local migrations only. No production secrets, hosted data mutation or paid services.
