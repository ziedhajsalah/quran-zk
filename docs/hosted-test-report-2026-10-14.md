# Hosted development verification — October 14, 2026

## Result

The migrated app works through Cloudflare Workers, Hyperdrive and Neon, but is **not reliable under the current Worker CPU allowance**. Cloudflare terminated five of 75 captured dynamic requests with `exceededCpu` and HTTP 503. Successful password-verification requests used 206–496 ms of CPU. A paid hosting decision or a different hosting design is required before launch; no subscription was changed.

The existing primary URL returned HTTP 500 and still ran an April deployment with old backend secrets. It was not replaced. The separate development Worker is [quran-zk-dev](https://quran-zk-dev.ziedhajsalah.workers.dev), built from merged commit `1a7dccee27cfc0118650ccbecaa05ae49e42a091` in an isolated checkout, excluding the user's uncommitted UI/Storybook edits.

Worker version: `0a87aa6b-f5ed-44ab-a452-3973516a40e7`. It uses the existing cache-disabled Hyperdrive and user-selected Neon branch, with its own fresh auth secret and exact HTTPS `SITE_URL`. The database branch is named `production`; this Worker is isolated at the app/configuration level, **not a separate database environment**. Use a separate Neon development branch before ongoing shared development.

## Checks

| Check | Result |
| --- | --- |
| Build of merged source | Passed |
| Anonymous redirects, signup disabled, admin API blocked, redirect validation | Passed |
| Teacher/student profiles, notes visibility, logout redirects, Arabic mobile layout | Passed; no browser console/hydration errors or Convex requests |
| Student creation, grade write, review close/cancel, note edit/delete | Passed |
| Mutation GET rejection and foreign-origin mutation rejection | Passed in the staff flow |
| Admin-issued signed-out password reset and existing-session revocation | Passed before the later replay page hit CPU limits |
| Reset-code replay browser check | Incomplete: navigation returned HTTP 503 / `exceededCpu` |
| HTTPS session cookie Secure, HttpOnly and SameSite=Lax attributes | Passed before session endpoint failed |
| Separate cookie/session API, foreign-origin login, and stolen-cookie logout checks | Incomplete: CPU failures interrupted the checks; no complete pass claimed |
| Authenticated page after confirmed Neon compute suspension | Passed: HTTP 200, profile rendered, 1,187 ms client wall time |
| Subsequent warm authenticated page | Passed: HTTP 200, profile rendered, 389 ms client wall time |

The initial browser run passed two of four scenarios. A targeted follow-up corrected an overlong temporary test username and passed the complete staff workflow; the remaining reset and cookie tests were interrupted by CPU limits. These are observed failures, not a green hosted suite. Local migration coverage remains in the existing integration/browser tests.

For the cold database test, the selected compute was explicitly suspended without modifying data. The Neon API confirmed `idle` and a new suspension timestamp before requesting `/profile` with a valid private session cookie. One cold/warm pair is evidence of successful reconnect, not a latency distribution or proof of every timeout/retry case. The first public login-page request took about 0.9 seconds and 166 ms Worker CPU; it was not treated as proof of a database cold start.

## CPU evidence and cost decision

Sanitized `wrangler tail` records captured actual deployed CPU and wall time, paths, response statuses and execution outcomes. Cookies, headers, raw errors and password inputs were not retained in the metrics. Across the captured dynamic requests: **70 `ok`, five `exceededCpu`**. This small QA sample is not a production error-rate estimate.

| Request group | Captured requests | CPU time | Outcomes |
| --- | ---: | --- | --- |
| Login page | 16 | 4–74 ms | 14 ok, two exceededCpu |
| Username sign-in | 10 | Successful requests: 206–496 ms; terminated request: 10 ms | Nine ok, one exceededCpu |
| Session endpoint | One | 10 ms before termination | exceededCpu |
| Profile | Four | 9–100 ms | Four ok |
| Domain POST server functions | 22 | 1–407 ms | 22 ok |

Cloudflare documents a [10 ms CPU allowance for Workers Free](https://developers.cloudflare.com/workers/platform/limits/) and explains that isolates can temporarily tolerate overruns before terminating repeated excess usage. This explains successful expensive requests followed by failures. CPU is distinct from database/network waiting and client wall time. The account API returned usage model `standard`; that alone is not confirmation of a paid subscription, and the OAuth token could not read billing subscriptions.

The existing Neon project remains the previously verified Free database target. Neon can stay at $0 within its free quotas. [Workers Paid pricing](https://developers.cloudflare.com/workers/platform/pricing/) starts at $5/month with included requests/CPU and usage overages. It is the smallest infrastructure change to test next; it has not been activated, and a paid retest is still required. If total hosting must remain $0, evaluate a Node host with sufficient CPU rather than weakening password hashing or relying on occasional Free Worker overruns.

## Cleanup and next work

Three temporary role-specific accounts were created directly through the existing account service; the staff browser flow created a fourth account. No remote seed command or schema migration was run. All four owned accounts were deleted with cascading cleanup of their credentials, sessions, reset codes, grades, reviews and notes. Private temporary password/cookie/secret files were removed. The development Worker and its server-side secret remain available; there are no permanent QA login accounts.

Before launch:

1. Choose hosting that supports the measured auth/SSR CPU, then rerun the entire hosted suite including reset replay, explicit stolen-cookie revocation and final-origin cookies.
2. Create an isolated Neon development branch and matching Hyperdrive for repeatable development testing.
3. Add distributed sign-in rate limiting and review the documented dependency advisories.
4. Configure production origin/secrets, bootstrap a real admin, and deploy production after the hosted suite passes.

The primary deployment and the user's local UI changes were preserved. This report records a completed verification task with a concrete launch blocker; it does not declare production readiness.
