# Memorization History Implementation Plan

**Goal:** Students and staff inspect completed and cancelled new memorization within the existing حفظ جديد tab.

**Architecture:** Add a session-authorized GET over retained assignment rows, server-side status filtering and 20-row cursor pages ordered by closure time and ID. Preserve saved closing grades independently of current grades. Lazily expand history below the open queue; share the memorization cache prefix so assessment, cancellation and ordinary grading refresh history. No schema changes, polling or new services.

**Tech Stack:** PostgreSQL/Drizzle, TanStack Start/Query, React/Mantine.

### Task 1: Server contract and regressions
Create browser-safe history types in `src/lib/memorization.ts`, `memorizationHistoryInput` in `src/server/functions/validation.ts`, `listMemorizationHistory` in `src/server/services/memorization.server.ts` and a GET function in `src/server/functions/memorization.ts`. Test self/staff permissions, private student isolation, terminal-only filtering, deterministic tied-date pagination, saved grades and malformed inputs in `tests/integration/memorization-history.test.ts`.

### Task 2: History interface
Add `MemorizationHistoryList.tsx`, `MemorizationHistoryPanel.tsx` and presentation stories under `src/components/surahs/Memorization/`. Show assignment/deadline/closure dates in UTC, completed/cancelled status, saved assessment grade and explicit undated/empty/loading/error/retry states. Extend `src/lib/queries.ts` with history under the memorization prefix. Add a collapsible, lazily fetched history section inside `MemorizationPanel.tsx`, retaining open forms while history is expanded.

### Task 3: Verification and delivery
Create `tests/e2e/memorization-history.spec.ts` for mobile/desktop negative-timezone display, filters/pagination, staff assessment/cancellation refresh, student isolation and request-error recovery. Run integration tests, lint, Worker/Storybook builds and full browser suite. Update architecture/SETUP, commit/push a feature branch and open a PR against develop; verify CI. Preserve main-checkout UI edits, hosted data and production configuration.
