# Memorization Follow-up Implementation Plan

**Goal:** Show overdue new memorization in the staff attention dashboard.

**Architecture:** Independently aggregate open memorization deadlines in the existing single SQL statement. Rank students by their oldest overdue deadline across both work types, retaining forgotten-grade/name/ID tie breakers, active-student permissions and the 20-student cap. Invalidate the dashboard after memorization mutations; no polling, schema migration or paid services.

**Tech Stack:** PostgreSQL, Drizzle, TanStack Query, React/Mantine.

### Task 1: Aggregation and regression tests
Extend `tests/integration/teacher-dashboard.test.ts` for mixed work counts, UTC boundaries, excluded statuses/users, ordering/cap and assessment/cancellation/manual grading. Update `src/server/services/teacher-dashboard.server.ts` and `src/lib/teacher-dashboard.ts` with separate memorization totals and per-student counts; use the earliest overdue deadline across work types.

### Task 2: Dashboard and cache
Update `src/components/home/TeacherDashboard.tsx` and its stories with a fifth statistic, distinct badges, accurate empty/priority copy and memorization tab links. Include memorization mutations in dashboard invalidation in `src/lib/queries.ts`.

### Task 3: Verification and delivery
Extend `tests/e2e/teacher-dashboard.spec.ts` at mobile/desktop widths to follow memorization links and cancel work before existing review assessment, checking refreshed badges and cards. Run integration tests, browser suite, lint, Worker and Storybook builds. Document the new follow-up semantics in `docs/architecture.md`, commit and open a PR to develop, then verify CI.
