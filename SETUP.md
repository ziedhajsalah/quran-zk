# Local development

The app uses React/Mantine, TanStack Start/Query, Better Auth 1.7.7 and PostgreSQL through Drizzle. Cloudflare Workers hosts SSR and auth; Neon Free is the production database target.

Use Node 22+, npm, and Docker (or PostgreSQL 17 installed locally).

```bash
npm ci
docker compose up -d db
cp .env.example .env.local
cp .dev.vars.example .dev.vars
```

Set a random `BETTER_AUTH_SECRET` of at least 32 characters in `.dev.vars`, and `DEV_SEED_PASSWORD` in `.env.local`. Both files are ignored. CLI tools use `DATABASE_URL` in `.env.local`; the Worker uses Hyperdrive's `localConnectionString` in `wrangler.jsonc`.

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:3000. Seed usernames: `qa.admin.oct13`, `qa.teacher.oct13`, `qa.student.oct13`. Their password is the operator-supplied `DEV_SEED_PASSWORD`. Repeated seeding does not replace existing passwords or reset existing grades. Seeding refuses remote databases and production mode.

For a new deployment, use `npm run bootstrap:admin` with `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_NAME`, `ADMIN_PASSWORD`, optional `ADMIN_EMAIL`. It refuses any database that already contains users. Do not seed production.

## Verification

Create an isolated database named `quran_test` with the same local PostgreSQL role. Integration tests truncate that database and reject a test URL whose database name does not end in `_test`.

```bash
# Docker PostgreSQL:
docker compose exec db createdb -U quran_dev quran_test
npm test
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

`TEST_DATABASE_URL` overrides the local test connection. Browser tests use seeded local development accounts and `DEV_SEED_PASSWORD`; they start the app if port 3000 is not already running. Browser tests modify test-user product data, so use only local development databases.

## Neon and Cloudflare setup

1. Create a Neon Free project with separate development/production branches. Get a **direct**, non-pooled PostgreSQL URL for migrations and Hyperdrive's upstream origin.
2. Create Hyperdrive with `npx wrangler hyperdrive create quran-zk --connection-string <direct-url> --caching-disabled`. Supply credentials privately; do not commit them. Set the returned ID in `wrangler.jsonc`. The checked-in ID currently points to the configured `quran-zk-neon` Hyperdrive; replace it if provisioning a different environment. Full TLS verification additionally requires a public CA uploaded with `wrangler cert upload certificate-authority --ca-cert <public-ca.pem>` and `--ca-certificate-id <id> --sslmode verify-full` on Hyperdrive creation.
3. Set the production auth secret using `wrangler secret put BETTER_AUTH_SECRET`. Production `SITE_URL=https://quran-zk.tn` is checked into `wrangler.jsonc`; the development environment has its own origin. Run `npm run cf-typegen` when bindings change.
4. Apply committed migrations using an explicit production `DATABASE_URL`, bootstrap an admin, build and deploy. The deployment workflow requires GitHub production secrets for the direct DB URL and Cloudflare API/account, and a configured Hyperdrive ID.
5. For a development branch, save its direct URL privately in ignored `.env.neon.local` as `DATABASE_URL`. Run `npx tsx --env-file=.env.neon.local scripts/db-migrate.ts`, then `npm run db:smoke`. This checks connectivity, commit/rollback and migrated table presence without persistent test rows. `npm run db:auth-smoke` additionally checks login/sessions/reset revocation using a temporary account and removes it afterward. It does not replace a Worker/Hyperdrive smoke check.
6. Verify hosted login, sessions, reconnects, queries and actual Worker CPU before launch. Local wall time is not a deployed CPU measurement. The selected Neon branch and its Hyperdrive binding have been configured. The merged app has been deployed separately to `quran-zk-dev` for development verification; hosted CPU failures block launch. See [the hosted verification report](docs/hosted-test-report-2026-10-14.md).

Neon is $0 within Free quotas. Hosted follow-up tests pass, but measured auth/SSR CPU still exceeds the Workers Free allowance; see [the findings follow-up](docs/hosted-findings-followup-2026-10-14.md). Workers Free and Neon Free are the selected hosting plans because the project has no hosting budget and expects low traffic. CPU usage remains a constraint even with low traffic; no paid upgrade is planned. See the findings follow-up for measurements.

## Commands

- `npm run dev`: one app server, port 3000
- `npm run db:generate`: generate a versioned SQL migration after editing Drizzle schemas
- `npm run db:migrate`: apply migrations to explicit `DATABASE_URL`
- `npm run db:seed`: local idempotent sample users/data
- `npm run bootstrap:admin`: first admin only
- `npm run db:smoke`: nonpersistent SQL runtime/schema check against `.env.neon.local`
- `npm run db:auth-smoke`: hosted auth smoke with temporary-account cleanup
- `npm run rescue:password`: operator-only recovery, revokes sessions
- `npm run storybook`: presentation components
- `npm run deploy`: build and deploy Worker after database migrations

Development queries refetch on navigation/focus and after local writes. Polling is off; another browser sees changes on focus/reload. Database credentials and auth secrets never use `VITE_*` variables.

## Isolated hosted development

`wrangler.jsonc` has an explicit `development` environment for `quran-zk-dev` and its dedicated Hyperdrive, pointing to Neon branch `development` (`br-restless-poetry-baiuk2qp`). Production retains its original binding. The direct development connection belongs in ignored `.env.neon-development.local`, never in browser variables.

```bash
npx tsx --env-file=.env.neon-development.local scripts/db-migrate.ts
npx tsx --env-file=.env.neon-development.local scripts/db-smoke.ts
npm run deploy:development
```

The environment supplies the exact HTTPS SITE_URL. Set its own BETTER_AUTH_SECRET with `npx wrangler secret put BETTER_AUTH_SECRET --env development` when provisioning a new Worker. No remote seeds are allowed. Temporary hosted QA accounts must be individually created and cleaned up by the verification operator.

The additive `0001` migration is required before deploying this auth version to any environment. Sign-in limits persist in PostgreSQL across instances: five attempts per account/IP pair per five minutes and 30 per Cloudflare IP per minute. Backend origin protection and fresh session reads remain enabled. The native password implementation accepts existing stored hashes.


## Public deployment health

`npm run check:deployment` checks the live login page, anonymous session, protected-page redirect, and canonical redirects from `www` and the primary workers.dev alias. The GitHub production workflow runs it after deployment. It creates no users and requires no credentials; run it once after a release rather than polling Neon continuously.

Production deploys automatically from `main` (both Cloudflare Builds and the GitHub deployment workflow). A merge to `develop` does **not** promote production. The October 14 repaired release was explicitly deployed from merged `develop` plus the origin/routing repair. Keep migrations ahead of the Worker deployment. Cloudflare's legacy non-production version uploads are not isolated application deployments; their public version URLs are disabled until separate database/auth configuration is provided. Use the isolated `quran-zk-dev` environment for development verification.

The apex is a Worker custom domain. `www` keeps its existing proxied CNAME to the apex and uses a Worker route, so no DNS deletion is required. Both `www` and the primary workers.dev alias redirect with HTTP 308 to the apex, preserving path and query. Development has no production routes. See [the deployment health report](docs/deployment-health-2026-10-14.md).
