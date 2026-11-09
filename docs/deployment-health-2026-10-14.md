# Cloudflare deployment health — 2026-10-14

## Result

The public app and the isolated development deployment passed live checks. Production now serves merged `develop` (`1a0fa7d`) with the canonical-origin/routing repair, at Worker version `a4a181ef-f312-4038-8a96-462751d07687`, deployed at 16:18 UTC. No paid plan or paid resource was added. Workers Free and Neon Free remain the selected plans.

| Target | Verified behavior |
| --- | --- |
| `https://quran-zk.tn/login` | HTTP 200, Arabic app title, hydrated login page |
| Production `/api/auth/get-session` | HTTP 200 and `null` when signed out |
| Production `/profile` | HTTP 307 to login when signed out; HTTP 200 and hydrated profile when signed in |
| `https://www.quran-zk.tn` | HTTP 308 to apex, retaining path and query |
| Primary `quran-zk.ziedhajsalah.workers.dev` | HTTP 308 to apex, retaining path and query |
| `quran-zk-dev.ziedhajsalah.workers.dev` | Login 200, anonymous session 200/null, protected profile redirects to login |
| Historical develop version URL | HTTP 404 after public legacy preview URLs were disabled |

## Cause and repair

The primary Worker was still serving an April 19 release. Its runtime contained legacy Clerk/Convex variables, but no Better Auth secret or app origin. Apex and primary workers.dev login/session requests returned 500. `www` returned 522: a proxied CNAME to the apex existed, but the Worker had no route for that host. The latest `develop` build had uploaded a version, without promoting it to production.

Applied the reviewed additive `0001` Drizzle migration to the existing production Neon branch, then verified all nine app tables and transaction commit/rollback. No remote seed was run. Provisioned a new server-only production auth secret and explicit apex `SITE_URL`, built the current release, and deployed it at 100%. The first deployment updated the Worker but could not add a `www` custom domain because of its existing CNAME; the final deployment keeps that record and uses `www.quran-zk.tn/*` as a Worker route instead.

Global server request middleware redirects only the two named production aliases when the configured origin is the production apex. Local, development, canonical and other hosts remain untouched. Development explicitly has no production routes and retains its separate Hyperdrive/Neon branch. Legacy public version URLs are disabled because version uploads share Worker resources and were not configured as isolated authenticated previews. The existing non-production build/upload behavior remains; it does not publish a supported app URL.

## Verification

- Production build and lint passed.
- All 43 local integration tests and five local browser scenarios passed.
- Two live Chromium checks passed: username/password login, Secure/HttpOnly/SameSite=Lax cookie, current session lookup, hydrated signed-in profile, foreign-origin rejection (403), oversized auth request rejection (413), logout and session invalidation.
- Disposable owned test accounts were removed with cascading credentials and sessions after each check. Production had no permanent users before testing; an operator still needs to bootstrap the first permanent admin privately.
- The new `npm run check:deployment` performs credential-free public endpoint and redirect checks. The GitHub production workflow runs it after deployment, without scheduled database polling.
- Sanitized production trace sample: eight requests, all Worker outcomes `ok`, zero exceptions. Expected application rejections were 403 and 413; no unexpected 5xx occurred.

## Free allowance and remaining limits

Observed CPU in the final live trace: login page 135 ms, sign-in 118 ms, signed-in profile 219 ms, get-session 6–11 ms, sign-out 16 ms, rejected foreign origin 9 ms, oversized body 1 ms. Successful checks do not establish reliable operation within the Workers Free 10 ms CPU allowance. Earlier development tests already observed CPU-limit failures; those can recur even at low traffic. No upgrade was made or is planned. Continue CPU reduction before treating the site as ready for a broad launch. Cost remains $0 within the selected Free allowances; exhausting them can make the app unavailable.

Cloudflare Builds and GitHub production deployment still track `main`. Merging a PR into `develop` does not automatically release production. This deployment was explicitly authorized and performed manually. Database migrations must precede later auth/schema releases; Cloudflare Builds alone currently runs build/deploy without the GitHub migration step.

The deployment checks confirm current functionality, not continuous availability or a load test. Existing legacy encrypted configuration was not deliberately purged. DNS API reads were unavailable to the existing OAuth token; the CNAME was verified in the user's Cloudflare dashboard and preserved.
