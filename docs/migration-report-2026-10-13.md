# PostgreSQL migration implementation — October 13, 2026

## Result

The application runs locally without Convex. Application data and Better Auth sessions/credentials use PostgreSQL 17 and Drizzle. The hosted database target is Neon Free; the current app host remains Cloudflare Workers with Hyperdrive. The existing Neon project `quran-zk` (`spring-smoke-00759083`), branch `production` (`br-sweet-mud-bamj655r`), was selected by the user. Its empty `neondb` database was migrated. Cache-disabled Hyperdrive was created and verified. No new Neon project, paid upgrade, production app deployment, or remote backend deletion was performed.

## Implemented

- App-owned Better Auth 1.5.3 with its version-matched Drizzle adapter, username/admin plugins, disabled public signup, cookie sessions, and TanStack cookie forwarding.
- Request-scoped native pg clients closed after each request; local Worker connects through Hyperdrive to PostgreSQL.
- A nonpersistent `db:smoke` command verifies connection, transaction commit/rollback and all eight migration tables. It passed against local PostgreSQL and the selected Neon branch.
- Versioned SQL migration for four auth tables and grades/reviews/notes/reset-code tables. Foreign keys, surah/body checks, unique grades, and partial uniqueness for open reviews/unused codes are enforced by PostgreSQL.
- Session-derived role guards, active-student validation, account creation/admin updates/status/removal, atomic bootstrap, operator rescue, and local-only repeatable seed scripts.
- Shared advisory locking and fresh actor re-checks protect last-admin role/status/delete operations. Direct Better Auth `/admin/*` endpoints are blocked to prevent bypassing these rules.
- Review close/cancel row locks; grade update and closing snapshot share one transaction.
- Reset codes use secret-keyed hashes, 30-minute expiry, five failed attempts, one live code per user, single-use locked redemption, and transactional credential/session updates. Wrong attempts commit independently of validation errors.
- TanStack Start server functions with Zod validators and same-origin mutation checks; ordinary Query keys and invalidation replace subscriptions. Polling stays off. Login/logout use full navigation to discard private caches.
- Arabic RTL components retained. Auth form inputs wait for hydration, and a readiness marker makes browser checks deterministic. Unexpected backend errors produce a generic Arabic message rather than a raw stack.
- Convex packages, backend directory, generated types, demo numbers route, scripts, project skills and obsolete instructions removed. Setup/auth/architecture docs and CI now describe SQL migrations plus one Worker deployment.

The layout follows the plan with two small consolidations: query options live in `src/lib/queries.ts`, and integration/browser cases are grouped in one suite each. Auth schema fields were checked against `getAuthTables` from the installed Better Auth version rather than copied from newer documentation.

## Verification

| Check | Result |
| --- | --- |
| Empty local database migration | Passed |
| Seed and repeat migration | Passed |
| Real PostgreSQL integration suite | 25 passed |
| Browser regression suite in local Worker runtime | 4 passed |
| Typecheck and ESLint | Passed |
| Vite client/Worker build | Passed |
| Dependency manifest/lockfile install dry run | Passed |
| Active source/config scan for old backend references | None; historical reports/plans retain context |
| Diff whitespace check | Passed |
| Migration + commit/rollback smoke on selected Neon branch | Passed |
| Hosted Neon Better Auth login/session/reset revocation | Passed; temporary account removed |
| Remote Worker → Hyperdrive → Neon rollback/reconnect | Passed twice; temporary preview stopped |

Integration checks cover installed auth schema fields, hash/login compatibility, bans/revocation, disabled signup, role restrictions, canonical duplicates, atomic bootstrap, last-admin races, grade uniqueness/isolation, review eligibility/duplicate races/close races/forced rollback/order, note ownership/deletion retention/100-row bound, reset single-use/replay/five attempts/expiry/reissue/missing credentials/forced rollback.

Browser checks cover anonymous protection, disabled signup, blocked plugin-admin endpoints, safe login redirects, teacher/student profiles and notes, mobile viewport bounds, no old backend network requests, no console/hydration errors in the teacher/student flow, logout, admin-issued signed-out reset and session revocation, student creation, grade addition, review close with new grade/cancel, and note edit/delete.

Local Worker password verification was also exercised directly (HTTP 200, approximately 74 ms wall time in one request). This is **not a CPU measurement** or evidence that deployed Free Worker limits pass. A temporary remote Worker passed two sequential real Hyperdrive-to-Neon SQL/rollback checks, with a fresh closed pg client each time, and was then stopped. Hosted Better Auth credentials/cookies/multi-role sessions/reset revocation passed a separate direct-Neon check using a temporary account that was removed. Neon scale-to-zero cold starts and actual full-app deployed CPU remain untested.

## Local access

The app is running at http://localhost:3000. The isolated PostgreSQL cluster used in this session is `/tmp/quran-zk-pg`, port 55432, with development database `quran_dev` and destructive-test database `quran_test`. The server has no dependency on the previous hosted development backend.

Seed usernames:

- `qa.admin.oct13`
- `qa.teacher.oct13`
- `qa.student.oct13`

Password: the existing local test password `QuranLocal-2026!`, also stored in ignored `.env.local` as `DEV_SEED_PASSWORD`. No production credentials are in this report. Browser tests created additional `qa.e2e.*` local students and test notes.

For reproducible setup on another machine, follow [SETUP.md](../SETUP.md), including creating the separate test database and installing the Playwright browser. Home dashboard progress/course/lesson fixtures remain fixtures.

## Outstanding hosted work and costs

Completed hosted setup:

- Neon project: `spring-smoke-00759083`, user-selected branch `br-sweet-mud-bamj655r` (`production`), database `neondb`, PostgreSQL 18. The branch had no public tables before applying the migration.
- Neon organization plan verified through the authenticated CLI: **Free**.
- Direct connection saved privately in git-ignored `.env.neon.local` with mode 0600. No credentials were printed or committed.
- Hyperdrive: `quran-zk-neon`, ID `2d291ff522d94474b68541e49e89ee4b`, stored in `wrangler.jsonc`. SQL caching is disabled and origin connection limit is five.
- TLS is `verify-full`, using uploaded public CA `bd481922-63c5-4855-a05b-6a799507d68b` (ISRG Root X1). Neon's certificate chain and hostname independently passed OpenSSL verification; Hyperdrive's retrieved configuration confirms TLS/caching policy. [Cloudflare TLS configuration](https://developers.cloudflare.com/api/resources/hyperdrive/subresources/configs/methods/create/).

Remaining launch steps:

1. Set production Worker `SITE_URL` and a fresh `BETTER_AUTH_SECRET`; configure GitHub production secrets including the direct `DATABASE_URL`. Bootstrap a real admin through the operator CLI. The hosted database intentionally has no permanent test users.
2. Deploy only when requested, then measure the full application's password hashing/SSR CPU on the intended hosting plan. No weaker hash or automatic paid upgrade was introduced.
3. Verify Neon scale-to-zero cold starts and hosted auth/session cookies under the final app origin. Add distributed sign-in rate limiting before a public production launch; current Better Auth defaults use per-isolate memory.
4. Remote old-backend teardown remains separate.

Neon remains $0 within its verified Free plan quotas (1 GB storage, 100 CU-hours and 5 GB transfer per project/month, as checked in the plan). Hyperdrive has no separate subscription fee. No paid subscription/upgrade was requested or activated. Cloudflare hosting can be $0 if its limits pass; Paid hosting would start at $5/month separately. See [the migration plan](plans/2026-10-13-remove-convex-plan.md) for dated sources and assumptions.

Dependency audit still reports advisories in the existing pinned auth/framework/tooling versions and migration tools. Better Auth's reported critical OAuth/OIDC advisory concerns plugins not enabled here; app admin endpoints are blocked and account/session deletion is transactional. The new Vitest runner was moved to patched 3.2.6 for the critical UI-server advisory, and tests use run mode without a UI server. Remaining dependency upgrades need separate version/schema/runtime verification before production launch; this migration does not claim a clean dependency audit.

The user approved and Claude Code completed the additional read-only implementation review, excluding credentials/environment files. Its [full response and checked follow-up decisions](plans/2026-10-13-migration-claude-implementation-review.md) are saved.

Concrete fixes from the review: block self-service profile/account mutation endpoints, synchronize renamed usernames/display usernames/placeholder emails, validate active students under transaction locks for grade/review writes, and atomically cancel open reviews when an admin removes the associated grade. Regression tests cover those cases plus HTTP method/origin protection.

Two review assumptions were corrected from evidence: local E2E used Hyperdrive's local binding, and installed TanStack Start rejects POST-function GET calls with 405. Hyperdrive caching is now explicitly disabled in the hosted resource. The installed Better Auth memory limiter is module-level rather than per-auth-instance; distributed per-account/IP limiting still needs a production hardening choice.

## Workspace preservation

Existing presentation/storybook edits were retained. Before deleting the superseded backend and skills, their contents (including pre-existing backend edits) were archived outside the checkout at `/tmp/quran-zk-convex-pre-migration.tar.gz` and `/tmp/quran-zk-obsolete-skills.tar.gz`. The old local environment file was preserved privately at `/tmp/quran-zk-env-before-migration`. These temporary backups are not durable version-control snapshots. The implementation was initially left uncommitted; migration files were subsequently staged separately when the user requested a PR to develop. Pre-existing presentation/storybook edits remain outside that PR.
