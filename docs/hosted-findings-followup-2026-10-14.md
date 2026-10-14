# Hosted findings follow-up — October 14, 2026

## Result

The auth/framework dependencies are patched, password hashing uses native scrypt without changing its strength or stored representation, distributed sign-in protection is active, and development now has a separate Neon branch and Hyperdrive. All five hosted browser checks passed. The final full and runtime dependency audits reported zero known vulnerabilities.

The follow-up captured 101 dynamic Worker execution records, all `ok`. This improves on the earlier five `exceededCpu` failures, but **does not prove the application fits Workers Free**. Eight successful sign-ins used 107–360 ms CPU (median 174 ms); captured profile requests used 19–77 ms and login-page requests 11–68 ms. These remain above Cloudflare's documented 10 ms Free allowance. The earlier successful sign-in range was 206–496 ms. This is a small, nonidentical sample with several changes, not a controlled benchmark or a guaranteed error rate.

No paid subscription, production Worker deployment, production schema migration, password-strength reduction or remote seed was performed. The user's checkout stays on develop and their UI/Storybook edits are preserved in that checkout.

## Implementation

- Better Auth and its Drizzle adapter are pinned together at 1.7.7. The framework, Vite, Cloudflare tooling, Vitest and Storybook use a compatible patched dependency set. The obsolete router/query adapter was replaced with the current SSR query integration, retaining a request-specific QueryClient.
- All password writers and verification use native `node:crypto` scrypt: N=16384, r=16, p=1, 64-byte key, NFKC normalization, and the original hexadecimal salt:key representation. Verification checks the representation and uses timingSafeEqual. A stored pre-upgrade Unicode password hash and interoperability with Better Auth are tested. Existing users need no reset or data migration.
- `auth_rate_limits` uses an atomic PostgreSQL upsert, bounded counters and database-clock window expiry. Keys are secret-keyed HMACs. Better Auth's endpoint limiter uses this distributed store. HTTP sign-in also shares a canonical account bucket between username/email and a trusted Cloudflare IP bucket. The limits are five account attempts per five minutes and 30 attempts per IP per minute; exhausted requests return HTTP 429 and Retry-After. Caller-supplied forwarded IP headers do not substitute for cf-connecting-ip.
- Sign-in body reading is bounded at 8 KiB. Foreign-origin requests are left to Better Auth's origin rejection without consuming the target account's budget. Expired counters older than one day are pruned at most hourly per isolate; they are not retained indefinitely.
- The reviewed additive migration creates only the counter table, positive-count constraint and expiry index. It was applied to local development/tests and the isolated development branch. Existing review/reset/admin locks and revocation behavior are unchanged.
- Raw unexpected backend errors are no longer logged; only the error class is recorded, avoiding database parameters or submitted credentials in logs.
- Storybook has its own Vite config so application/Worker entries are excluded from component compilation. Existing components and Arabic RTL presentation are preserved.
- The remaining audit finding was the old esbuild used by Drizzle's legacy loader. A scoped override patches that loader to 0.28.2; generation reports no schema changes and the final audit is clean. No Drizzle downgrade or force-based peer bypass was used.

## Development environment

| Resource | Value |
| --- | --- |
| Worker URL | https://quran-zk-dev.ziedhajsalah.workers.dev |
| Verified Worker version | dcbf9cb7-922d-47db-9c33-d74c95f00d1c |
| Neon project | spring-smoke-00759083, existing Free project |
| Development branch | development / br-restless-poetry-baiuk2qp |
| Hyperdrive | quran-zk-neon-dev / d428e5b5be924fa9bb143d379c38a94d |
| Hyperdrive policy | caching disabled, verify-full TLS, five origin connections |
| Neon compute | 0.25 CU, Free plan default suspend interval |

The first creation attempt requested an explicit suspension interval, which Neon Free disallowed. Creation then succeeded using the plan default. The normal child branch copied the existing migrated database after the earlier QA cleanup. The original production branch and its Hyperdrive were not modified.

The new direct connection is stored only in ignored `.env.neon-development.local` in the managed worktree, mode 0600; existing production and local env files were not overwritten. Explicit `build:development` and `deploy:development` commands select the development Worker and Hyperdrive, with SITE_URL fixed to that HTTPS origin. The existing Worker auth secret remains server-side.

## Verification

| Check | Result |
| --- | --- |
| PostgreSQL integration and security regressions | 32 passed |
| Local browser regressions, including cookie/token revocation | Five passed |
| Hosted browser scenarios | Five passed |
| TypeScript / ESLint | Passed |
| Development client/Worker build | Passed |
| Storybook compilation | Passed |
| Reviewed dev migration, nine-table/rollback smoke | Passed |
| Legacy password hash / library interoperability | Passed |
| Concurrent distributed limiter | Exactly five allowed out of twenty simultaneous independent clients |
| Account aliases, changing IP, forwarded-header spoof and oversized input | Regression checks passed |
| Deployed throttle | Five HTTP 401 responses, then HTTP 429 with Retry-After 298 |
| Warm authenticated profile sequence | Twenty HTTP 200 responses |
| Additional invalid sign-in sequence | Fifteen expected HTTP 401 responses |
| Suspended isolated database reconnect with revoked token | HTTP 200 with null session, 933 ms client wall time |
| Full npm audit and omit-dev audit | Zero known vulnerabilities |

Hosted checks cover anonymous protection, signup/admin restrictions, safe redirects, teacher/student pages and notes, mobile bounds, student creation, grading, review close/cancel, note editing/deletion, mutation method/origin restrictions, reset/replay/revocation, Secure/HttpOnly/SameSite=Lax cookies, foreign-origin login and reuse of a logged-out token. The temporary browser configuration disabled password-bearing traces/screenshots/video. Sanitized tail records retained CPU/outcomes/paths/status only, not headers, cookies or raw logs. Tail capture is a sample and not a guarantee that every client request appears in the trace.

Three temporary role accounts and one student created through the staff UI were deleted, with cascading cleanup of their credentials, sessions, grades, notes, reviews and reset codes. Private temporary passwords/cookies and QA scripts were removed. Nonsecret HMAC limiter counters expire through the normal pruning policy. There are no permanent hosted QA accounts.

## Remaining hosting decision and costs

Neon remains on its existing Free plan; its branch compute/storage use shares project quotas. No extra paid database plan was enabled. The development branch adds compute use within those quotas when awake.

Cloudflare documents [10 ms CPU per HTTP request on Free](https://developers.cloudflare.com/workers/platform/limits/) and temporary isolate flexibility for occasional overruns. This app continues to exceed that allowance materially. A passing short run should not be used to promise a reliable free deployment.

[Workers Paid starts at $5/month](https://developers.cloudflare.com/workers/platform/pricing/), with included requests/CPU and usage overages. Enabling it and rerunning the hosted suite is the smallest remaining hosting change. It requires the user's approval because it changes billing. If the entire hosting budget must remain $0, evaluate a different Node host before production instead of weakening hashing or relying on overrun flexibility. Distributed throttling and dependency changes can be reviewed and merged independently of that choice.

Before production rollout, apply the reviewed migration to the production database, configure its origin/secrets, bootstrap a real admin and verify the final production origin on the selected hosting allowance. Production readiness is not declared by this follow-up.
