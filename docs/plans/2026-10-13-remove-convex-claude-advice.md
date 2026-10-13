# Claude Code advice: replacing Convex

Consulted October 13, 2026 through the locally installed Claude Code CLI.
The run completed successfully with read-only source tools and no application edits.
The following is Claude Code's advice, preserved as returned. It is an independent
review, not verified platform documentation; implementation choices and unverified
assertions are assessed in the companion migration plan.

Notable cautions: runtime CPU-limit claims need measurement; PostgreSQL final-admin
checks need transactional serialization; D1 conditional batches need unique operation
identifiers rather than relying on matching timestamps.

---

I recommend Option A: stay on the existing Cloudflare Worker with D1 + Drizzle and run Better Auth 1.5.3 inside the Worker. TanStack Start server functions plus React Query with explicit invalidation replace Convex, with no realtime. That choice depends on two spike gates (below), and Postgres is the fallback if either fails.

The plan file couldn't be written because Write is disabled in this session, so the full advice is here. Nothing was edited or run.

**What I read:** package.json, vite.config.ts, wrangler.jsonc, docs/architecture.md, the Convex guidelines file, the `convex/` app modules and `convex/auth/*`, the Better Auth schema, router.tsx, `__root.tsx`, `src/lib/auth*.ts`, the `/api/auth/$` route, `surahs.tsx`, `staff/students/$studentId.tsx`, deploy.yml, bootstrap-admin.mjs, plus greps over `src/`, SETUP.md and Better Auth's admin plugin in node_modules.
**Not read:** the bodies of the profile, reset-password and staff list routes, components, and `.env`.

## Facts from the code that affect the plan
- **Teachers create students through a headerless admin call.** `staffCreateStudent` calls `auth.api.createUser` with no headers. In Better Auth 1.5.3 (`plugins/admin/routes.mjs:151`), that call is only rejected when there is no session *and* there are request headers. So a headerless server call skips the permission check, and that's the only reason a `teacher` (who has user-level permissions) can create users.
- **Most admin functions have no UI.** Only `staffCreateStudent`, `resetCodes.adminIssue` and `resetCodes.redeem` are called from `src/`. `adminCreate`, `adminUpdate`, `adminSetStatus`, `adminList`, `adminResetPassword`, `rescueResetPassword` and `removeFromList` have no callers. SETUP.md:85 says an in-app admin UI exists; it doesn't.
- **The last-active-admin check isn't atomic today.** It lists all users, then runs `adminUpdateUser` and `setRole` in parallel inside an action.
- **Reset codes store a plaintext Better Auth token.** The `sendResetPassword` hook captures the token into `passwordResetCodes.betterAuthToken`.
- **`anotherPage.tsx`/`myFunctions`/`numbers` can simply be deleted.** Nothing links to them.
- **`auth-server.ts` reads `process.env` at module scope** on the Worker.

## (1) Recommended stack
- **Option A (recommended):** existing Worker, D1 + Drizzle, Better Auth in-process at `/api/auth/$`.
  - Why: no host change and no connection pooling. The domain is small (4 app tables plus 4 auth tables), and every write touches one student.
  - D1's `batch()` is atomic, and SQLite partial unique indexes cover the uniqueness rules.
- **Spike gates:**
  - **G1:** review close and reset-code claim must work as single atomic batches or conditional statements. D1 has no interactive transactions, and Drizzle's `db.transaction` throws on D1.
  - **G2:** Better Auth's scrypt hashing must fit the Worker CPU limit. The Free plan's 10 ms per request is likely too low; Paid is fine.
- **Fallback, Option B:** Postgres (Neon) + Drizzle, keeping the Worker and using Hyperdrive. Real transactions remove all the batch tricks. Move TanStack Start to Node only if G2 fails and you won't pay for Workers.
- **Simpler alternatives don't fit better.** Supabase or Firebase swaps one hosted backend for another, and PocketBase adds a separate server. Turso/libSQL is a reasonable middle option (SQLite with real transactions) but I wouldn't default to it.
- **The main cost is losing live updates.** This app barely needs them: staff edit, students read.

## (2) Hardest traps, ranked
1. **Reset-code brute force under concurrency.** The attempt check is read-modify-write, so parallel guesses can get past the 5-try cap on a 6-digit code.
   - Count attempts in one statement: `UPDATE … SET attempts=attempts+1 WHERE user_id=? AND used_at IS NULL AND expires_at>=? AND attempts<? RETURNING code_hash`.
   - Claim with `UPDATE … SET used_at=? WHERE id=? AND used_at IS NULL RETURNING`, and continue only if a row comes back.
   - Drop the captured-token approach. After the claim, update the credential account's password hash and delete the user's sessions in the same batch. A failed reset then burns the code, which is acceptable.
   - Add a partial unique index on `(user_id) WHERE used_at IS NULL` so issuing a new code can't leave two live ones.
2. **Headerless admin calls skip authorization.** Every headerless `auth.api.*` admin call needs an app-level guard in the same server function, and a test that a student session gets 403. Don't forward request headers into `createUser` for teachers, or Better Auth will reject them.
3. **Closing a review atomically on D1.** Do it as one batch:
   - (a) `UPDATE assignments SET status='closed', closed_by, closed_at=:now, closing_grade=COALESCE(:new,(SELECT grade …)) WHERE id=:id AND status='open'`
   - (b) only when a new grade is given: `INSERT INTO grades … SELECT … FROM assignments WHERE id=:id AND closed_at=:now AND closed_by=:me ON CONFLICT DO UPDATE`
   - A batch can't branch on rows affected, so (b) is gated by re-selecting what (a) wrote. Check (a)'s change count and map 0 to "not open". On Postgres this is a plain transaction with `FOR UPDATE`.
4. **Uniqueness via constraints instead of check-then-insert.**
   - Grades: `UNIQUE(student_id, surah_number)`, and `setGrade` becomes an upsert.
   - Open assignments: partial `UNIQUE(student_id, surah_number) WHERE status='open'`.
   - `assign` becomes `INSERT … SELECT … WHERE EXISTS(grade)`, mapping a constraint error to the existing message.
   - Check that Drizzle emits partial indexes for D1 and targets the right index in upserts.
5. **Last-active-admin rule.** Enforce it in one conditional `UPDATE … WHERE … EXISTS(another active admin)`; banning works the same way plus a session delete. This deliberately bypasses Better Auth's `setRole`/`banUser`. Only port it if an admin UI is actually built (Q2).
6. **Session revocation vs. cookie cache.** If Better Auth's `cookieCache` is on, banned or reset users stay logged in until it expires. Keep it off or very short, and keep reading `banned` from the database on every request, as `requireCurrentAuthUser` does today.
7. **Worker database and auth lifecycle.**
   - Build Drizzle and `betterAuth()` per request from the `cloudflare:workers` env, not at module scope.
   - With Hyperdrive, don't keep a module-scope pool. Use a per-request client and close it via `waitUntil`.
8. **Auth schema generation.**
   - Pin the Better Auth CLI and `@better-auth/drizzle-adapter` to versions matching 1.5.3. The adapter is a re-export and isn't installed locally, so I couldn't verify its D1 transaction behaviour; that's a spike item.
   - Keep `user`, `session`, `account` and `verification`, plus the username fields and admin fields (`role`, `banned`, `banReason`, `banExpires`, `impersonatedBy`).
   - Drop `jwks`, `twoFactor`, the OAuth tables and `rateLimit`.
   - Better Auth's in-memory rate limiting is per-isolate on Workers, so it's effectively off. The reset-code attempt cap is the real protection.
9. **Foreign keys and deletes.** D1 enforces foreign keys, so seed order matters.
   - Student-owned rows: `ON DELETE CASCADE`.
   - Actor columns (`author_id`, `assigned_by`, `closed_by`, `updated_by`, `issued_by`): nullable with `SET NULL`, which keeps the "مستخدم محذوف" fallback.
   - Ban users rather than deleting them, and keep timestamps as integer milliseconds.
10. **SSR, cookies and cache.**
    - Remove the `ConvexQueryClient` default `queryFn`/`hashFn` and the token step in the root `beforeLoad`.
    - Server functions read the session with `auth.api.getSession({ headers })`. `better-auth/tanstack-start` is only needed if server functions call endpoints that set cookies.
    - Invalidate `me` and call `router.invalidate()` after sign-in and sign-out.
    - Replace `ConvexError`/`extractActionErrorMessage` with a typed `AppError`, and check the Arabic message survives server-function serialization in production builds.
11. **Password hashing.** There's no compatibility issue because the database is fresh. Bootstrap should go through the same Better Auth instance, using a headerless `createUser` with `role:'admin'`. That removes the current enable-signup, sign-up, then patch sequence.

## (3) Module mapping and order
| Convex | Replacement |
|---|---|
| `schema.ts`, `betterAuth/schema.ts` | `src/server/db/schema.ts`, `drizzle/` migrations |
| `auth.ts`, `http.ts`, `auth.config.ts`, `convex.config.ts`, `betterAuth/*` | `src/server/auth.ts` (`createAuth(env)`, no convex/JWT plugin); `routes/api/auth/$.ts` calls `auth.handler` directly |
| `auth/helpers.ts` | `src/server/guards.ts` (`requireUser`, `requireStaff`, `requireAdmin`, `requireSelfOrStaff`, `serializeAuthUser`) |
| `auth/utils.ts`, `validators.ts` | Moved unchanged to `src/shared/`; they're pure functions |
| `surahGrades`, `surahReviews`, `studentNotes` | `src/server/{grades,reviews,notes}.ts`: `createServerFn` + zod + guards. Notes join on `user.name` |
| `listAllStudents` | One SQL query |
| `auth/resetCodes.ts` | `src/server/reset-codes.ts` |
| `auth/admin.ts` | Port `staffCreateStudent`; defer the rest or replace with a CLI |
| `lib/auth-server`, `auth`, `auth-queries`, `convex-errors` | `lib/queries.ts` (query keys `me`, `students`, `grades(id)`, `openReviews(id)`, `notes(id)`) and `lib/app-error.ts` |
| `router.tsx`, `__root.tsx` | Plain `QueryClient`; remove `ConvexBetterAuthProvider` and the client-side `convexClient()` plugin |
| Routes | `queryOptions` + `useMutation` with invalidation on success; closing a review invalidates grades and openReviews; drop the `Id<>` casts |

**Changes to the proposed order:**
- **0. Spike:** test G1 and G2 on a throwaway D1 with `wrangler dev`, then choose A or B.
- **1. Schema and seed:** seed through Better Auth, not raw inserts.
- **2. Auth:** switch the client-side auth in the same step as the server side, so the app is never split between Convex auth and the new auth.
- **3. Domain operations:** port grades, reviews and notes, and set up vitest here rather than at the end.
- **4. Hooks and account flows:** merge your steps 5 and 6 and go route by route, including reset-password and create-student.
- **5. Remove Convex:** packages, `convex/`, `ssr.noExternal`, the `dev` script, CI steps and `VITE_CONVEX_*` vars. Update architecture.md, SETUP.md and AUTH_SETUP.md.
- **CI:** run `wrangler d1 migrations apply --remote` before deploy, and set `BETTER_AUTH_SECRET` with `wrangler secret`.

## (4) Tests and done criteria
- **Concurrency:**
  - Concurrent `assign` leaves exactly one open assignment.
  - Concurrent `setGrade` leaves one row.
  - Closing a review updates both tables or neither, and closing it twice fails.
- **Reset codes:**
  - Parallel wrong guesses never exceed the attempt limit, after which the code is dead.
  - Two parallel correct redeems give exactly one success.
  - After a redeem, old sessions are invalid and the new password works.
  - Issuing a new code kills the old one.
- **Authorization:**
  - A student can't read other students' data or call staff functions (403).
  - A teacher can create students but gets 403 on admin functions.
  - A banned user's existing session gets 401 on the next request.
- **End-to-end:**
  - Login by username and by email.
  - `/surahs` server-renders with a cookie, without a redirect loop.
  - The staff grade, assign, close and note flows refresh the lists.
  - Admin issues a code, the student redeems it, then logout.
- **Done when:**
  - `rg -i convex` is empty outside docs history.
  - lint and build pass.
  - Migrations apply cleanly to an empty D1.
  - Bootstrap works on the deployed Worker.
  - CI deploys without Convex secrets.

## (5) Questions that change the plan
1. **Workers Free or Paid?** Free probably breaks scrypt login, which forces Paid, a Node host, or cheaper hashing.
2. **Should the admin user-management functions be ported now?** That means update, ban, list and the last-admin rule. The alternative is deferring them and keeping only a CLI, since there's no UI today.
3. **Do students need near-live updates?** If refetching on focus or navigation is acceptable, there's no realtime work. If not, start with polling.
4. **Are file storage, scheduled jobs, multiple schools or heavy reporting coming soon?** Multiple schools or heavy reporting would favour Postgres.
