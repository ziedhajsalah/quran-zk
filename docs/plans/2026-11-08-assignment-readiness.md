# Assignment Readiness Implementation Plan

> **For Codex:** Implement task by task in the existing isolated checkout; the user authorized implementation. The referenced superpowers execution skill is not installed, so execute directly.

**Goal:** Students mark their own open review/memorization assignments ready for assessment and undo that signal; staff can see and filter ready work.

**Architecture:** Add nullable `ready_at` columns with open-only constraints. A session-scoped POST locks the active student before the assignment, checks ownership/open status and sets explicit readiness idempotently. All closure paths clear readiness in their existing transactions. Reuse current queries, invalidation and URL filter schema; no polling or new service.

**Tech Stack:** TanStack Start/Query, Mantine, PostgreSQL, Drizzle.

---

### Task 1: Storage and authorized writes
- Modify `src/server/db/schema/app.ts`; generate/review `drizzle/0004_assignment_readiness.sql` using `npm run db:generate -- --name=assignment_readiness`.
- Add `src/server/services/assignment-readiness.server.ts`, `src/server/functions/assignment-readiness.ts`, validation with kind/assignmentId/ready boolean. No student ID or timestamp from client. Own active student only, including mixed roles acting on self. Preserve timestamp on repeated ready requests; undo sets null. Reject terminal work and unauthorized users with safe guidance.
- Clear readiness in review close/cancel, grade-removal cancellation, memorization assessment/manual grading/cancellation. Rescheduling preserves readiness.
- Add integration tests for both kinds: authorization, validation, idempotence, unchanged grades/deadlines/history, closure paths, concurrent marking/completion and fresh reads.

### Task 2: Student controls and staff visibility
- Shared `AssignmentReadiness` badge/action component: Arabic mark/undo, hydration and pending guards, authored retry error, refresh on stale work. Student controls on `/surahs` only for student role; staff student detail displays badge only.
- Include readiness in existing open review/memorization DTOs and mappings. Optional presentation props retain existing stories. Student dashboard previews display the same badge.
- Add readiness all/ready/not-ready to `src/lib/work-queue.ts`, SQL projection/filter, staff queue select, hidden native GET field and list badges. Default all, deadline filters still apply. URL parsing and cursor reset share existing schema/component key.

### Task 3: Verify and deliver
- Apply reviewed migration only to local development/test databases; never seed/migrate remote environments for this task.
- Add browser tests at 390px light and 1280px dark: mark/undo both assignment kinds, failed request/retry, teacher ready filter with URL/search preservation, assessment clears readiness, no student grading controls. Use own local fixture accounts and cleanup only their records.
- Run `npm test`, `npm run lint`, `npm run build`, `npm run build-storybook`, `npm run test:e2e`; inspect RTL screenshots.
- Update SETUP.md/docs/architecture.md with migration order, readiness semantics and $0 additional services. Commit/push and open PR to develop; verify CI/build and address relevant findings.
