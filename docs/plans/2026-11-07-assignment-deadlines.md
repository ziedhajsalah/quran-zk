# Assignment Deadline Editing Implementation Plan

**Goal:** Staff add, change or clear UTC deadlines on open reviews and memorization without replacing assignments.

**Architecture:** A shared server-only transaction validates the new calendar date and original deadline, locks the student before the assignment, and rejects inactive students, terminal assignments or stale deadlines. Separate session-authorized POST functions select the work type. A shared modal awaits writes and preserves selected dates/errors; existing query prefixes refresh queues and dashboards. No schema changes or new services.

**Tech Stack:** PostgreSQL/Drizzle, TanStack Start/Query, Mantine.

### Task 1: Server and integration coverage
Add `assignmentDeadlineInput` to `src/server/functions/validation.ts` and shared browser types in `src/lib/assignment-deadline.ts`. Create `src/server/services/assignment-deadline.server.ts`; add `reschedule` endpoints to reviews/memorization functions. Test permissions, unchanged assignment metadata, add/change/clear, stale/closed/inactive rejection, UTC validation, dashboard effects and concurrent completion/deadline editing in `tests/integration/assignment-deadline.test.ts`.

### Task 2: Interface
Create shared `src/components/surahs/AssignmentDeadlineDialog.tsx` with UTC date picker, explicit clearing, pending dismissal/duplicate protection and input-preserving inline errors plus stories. Add a staff-only edit control to review rows/queue and memorize queue. Connect the modal to the staff detail route and memorization panel; preserve students' read-only views and Arabic RTL.
- QA-03 localization follow-up implemented: the deadline-edit calendar, weekday headings and selected date use Arabic, matching the assignment drawers; UTC values and clearing are unchanged. Browser regressions assert the Arabic calendar and selected date.

### Task 3: Verification and delivery
Create local browser regressions for mobile/desktop, both assignment types, student/dashboard date refresh, clearing, pending requests and stale/terminal rejection. Run integration tests, lint, Worker/Storybook builds and full browser suite. Update SETUP/architecture, commit and open PR against develop, verify CI. Preserve the main checkout's UI changes and avoid hosted/production data or paid services.
