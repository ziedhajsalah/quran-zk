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

For a new deployment, run `npm run bootstrap:admin` in a terminal. The wizard explains the operation, asks you to select local, production or a custom database, then asks for username, display name, optional email, password and password confirmation. Password and manually entered database URL input are hidden. It shows the target host/database without credentials and asks you to type `create <environment>` before opening a connection. Ctrl+C or declining confirmation cancels setup.

Local mode reads only `.env.local` in the checkout where you run it. If the selected file or URL is missing, the wizard asks for the URL privately. Production always asks for its URL explicitly and does not read production configuration files. Custom mode uses an explicitly exported `DATABASE_URL`, or asks for one. Selecting an environment is an operator choice: verify the displayed host/database belongs to that environment before confirming. Existing `ADMIN_*` variables do not prefill the interactive wizard.

The app has an `admin` role, without a separate super-admin role. Setup refuses any database that already contains users and preserves the transaction lock around this check and account creation. Do not seed production. For automation, explicitly run `npm run bootstrap:admin -- --non-interactive` with `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_NAME`, `ADMIN_PASSWORD` and optional `ADMIN_EMAIL` already exported (or supplied through an explicit private env file to `tsx`). Non-interactive mode does not prompt for confirmation or load `.env.local` automatically.

The wizard reports specific recovery steps for existing users, missing tables/migrations, invalid account details, wrong database credentials, DNS/network failures, TLS verification and insufficient database permissions. It lists only missing variable names in automation mode. Driver messages, SQL parameters and credentials are never printed. When following migration or password-recovery advice, explicitly set `DATABASE_URL` for the same selected environment; the wizard does not export its chosen URL into your shell.

## Password recovery

Run `npm run rescue:password` in a terminal to select an environment, enter an existing username/email and a new password, confirm the hidden password, and type `reset <environment>` after reviewing the account and target database. Recovery updates only the password and revokes every existing session in one transaction; roles and disabled status stay unchanged. Cancelling opens no database connection. The same configuration selection and credential-safe error guidance as first-admin setup apply: production files are never read automatically.

For automation, use `npm run rescue:password -- --non-interactive` with `DATABASE_URL`, `RESET_IDENTIFIER` and `RESET_PASSWORD` exported explicitly. It does not prompt or automatically load `.env.local`. Keep passwords in private environment configuration rather than shell arguments. `--help` shows usage without connecting to a database.

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

1. Use the existing Neon Free project with its production branch; local PostgreSQL handles development and tests. Get a **direct**, non-pooled PostgreSQL URL for migrations and Hyperdrive's upstream origin.
2. Create Hyperdrive with `npx wrangler hyperdrive create quran-zk --connection-string <direct-url> --caching-disabled`. Supply credentials privately; do not commit them. Set the returned ID in `wrangler.jsonc`. The checked-in ID currently points to the configured `quran-zk-neon` Hyperdrive; replace it if provisioning a different environment. Full TLS verification additionally requires a public CA uploaded with `wrangler cert upload certificate-authority --ca-cert <public-ca.pem>` and `--ca-certificate-id <id> --sslmode verify-full` on Hyperdrive creation.
3. Set the production auth secret using `wrangler secret put BETTER_AUTH_SECRET`. Production `SITE_URL=https://quran-zk.tn` is checked into `wrangler.jsonc`. Run `npm run cf-typegen` when bindings change.
4. Apply committed migrations using an explicit production `DATABASE_URL`, bootstrap an admin, build and deploy. The deployment workflow requires GitHub production secrets for the direct DB URL and Cloudflare API/account, and a configured Hyperdrive ID.
5. Production migrations run in GitHub Actions using the direct `DATABASE_URL` secret in the `production` environment. Optional operator smoke checks require an explicitly exported `DATABASE_URL`; `npm run db:smoke` and `npm run db:auth-smoke` do not load hosted credential files automatically. Auth smoke creates and cleans up its own temporary account; use only when deliberately authorized.
6. Verify hosted login, sessions, reconnects, queries and actual Worker CPU on the selected Free plan. Historical development measurements are in [the hosted verification report](docs/hosted-test-report-2026-10-14.md) and [the findings follow-up](docs/hosted-findings-followup-2026-10-14.md).

Neon is $0 within Free quotas. Hosted follow-up tests pass, but measured auth/SSR CPU still exceeds the Workers Free allowance; see [the findings follow-up](docs/hosted-findings-followup-2026-10-14.md). Workers Free and Neon Free are the selected hosting plans because the project has no hosting budget and expects low traffic. CPU usage remains a constraint even with low traffic; no paid upgrade is planned. See the findings follow-up for measurements.

## Commands

- `npm run dev`: one app server, port 3000
- `npm run db:generate`: generate a versioned SQL migration after editing Drizzle schemas
- `npm run db:migrate`: apply migrations to explicit `DATABASE_URL`
- `npm run db:seed`: local idempotent sample users/data
- `npm run bootstrap:admin`: first admin only
- `npm run db:smoke`: nonpersistent SQL runtime/schema check against explicitly supplied `DATABASE_URL`
- `npm run db:auth-smoke`: hosted auth smoke with temporary-account cleanup
- `npm run rescue:password`: operator-only recovery, revokes sessions
- `npm run storybook`: presentation components
- `npm run deploy`: build and deploy Worker after database migrations

Development queries refetch on navigation/focus and after local writes. Polling is off; another browser sees changes on focus/reload. Database credentials and auth secrets never use `VITE_*` variables.

## Branches and deployment environments

`main` is the only permanent integration/release branch. Create short-lived feature branches from `main`, open PRs to `main`, and remove them after merge. The `develop` branch and hosted development environment are retired. Local PostgreSQL and local browser/Storybook workflows remain available; CI always uses its own disposable databases.

Production is the only hosted environment: Worker `quran-zk`, the existing production Hyperdrive and the existing Neon production branch. There is no `development` Wrangler environment or hosted-development deployment command. Cloudflare Git integration must be disconnected so a second deployment cannot publish ahead of database migrations. Preview deployments are disabled.

Configure GitHub environment `production` with `DATABASE_URL` (direct PostgreSQL), `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The existing Worker retains its server-only `BETTER_AUTH_SECRET`; that secret is not moved into browser variables or source. No remote seed is part of deployment.

On a push to `main`, GitHub Actions runs integration/browser tests, lint and build. The production job validates required secret presence, applies committed Drizzle migrations, deploys the Worker and checks public health. A migration failure stops deployment. Manual workflow dispatch can deploy only `main`. Production releases serialize; PR checks cancel superseded runs independently.

A direct `npm run deploy` is an operator escape hatch and does not migrate automatically. Prefer the workflow. Before any manual deployment, apply reviewed migrations against the intended production database explicitly. Applied migrations are tracked by Drizzle; do not edit migrations already applied to hosted databases.

The initial main release includes migrations `0000` through `0005`; the migrator applies only pending entries. Keep `develop` and hosted-development resources until the main release passes production health checks, then delete the retired Worker `quran-zk-dev`, its dedicated Hyperdrive `d428e5b5be924fa9bb143d379c38a94d` and Neon development branch `br-restless-poetry-baiuk2qp`. Confirm resource identity and dependencies before deleting anything; retain the production database, Hyperdrive, Worker, domains and auth secret.

The additive `0001` migration is required before deploying this auth version to any environment. Sign-in limits persist in PostgreSQL across instances: five attempts per account/IP pair per five minutes and 30 per Cloudflare IP per minute. Backend origin protection and fresh session reads remain enabled. The native password implementation accepts existing stored hashes.


## Public deployment health

`npm run check:deployment` checks the live login page, anonymous session, protected-page redirect, and canonical redirects from `www` and the primary workers.dev alias. The GitHub production workflow runs it after deployment. It creates no users and requires no credentials; run it once after a release rather than polling Neon continuously.

Production deploys from `main` through GitHub Actions, with migrations before deployment. Independent Cloudflare Builds and hosted preview/development deployments must remain disabled. Historical deployment reports describe the previous topology.

The apex is a Worker custom domain. `www` keeps its existing proxied CNAME to the apex and uses a Worker route, so no DNS deletion is required. Both `www` and the primary workers.dev alias redirect with HTTP 308 to the apex, preserving path and query. Local development does not register production routes. See [the deployment health report](docs/deployment-health-2026-10-14.md).

## Grade progress history

Apply committed migration `0002_grade_history.sql` with `npm run db:migrate` against the intended environment before deploying this app version. The additive migration creates an empty history table; it does not backfill grades or infer past changes. Subsequent grade additions, changes and removals (including new grades at review closure) appear under the student/staff **التقدّم** tab. Existing review history remains under **السجل**. No new hosting service or subscription is required. Run local seeds only against local databases as described above.

## New memorization assignments

Apply committed migration `0003_memorization_assignments.sql` before deploying this app version. It only adds a table and indexes. Teachers use **حفظ جديد** on a student page to assign an unrecorded whole surah with an optional UTC calendar deadline. Students see it in the same tab and the **ماذا أحفظ؟** dashboard card. Assignment alone does not change progress. Assessing with a grade adds the surah and a progress-history entry, then completes the assignment in one transaction. Recording the grade through the existing add-surah flow also completes matching open work. Cancellation creates no grade. Existing reviews remain separate. No new service/subscription is required.

Completed and cancelled new memorization assignments are available through **عرض سجل الحفظ** inside **حفظ جديد** for students and staff. The history offers status filters and 20-row pages, showing the saved completion grade and UTC dates. It uses existing migration `0003` data and needs no additional migration or service.

Staff use **تعديل الموعد** on an open review or memorization assignment to change its UTC deadline, add a missing deadline or clear it. Existing assignments are retained. Completed/cancelled work and stale deadline snapshots cannot be edited; close the dialog and refresh the list if another teacher changed the task. No additional migration is required.

## Staff work queue

Teachers and admins open **قائمة الواجبات** from the home dashboard or student list. It combines open reviews and new memorization across active students. Submit a student name/username search, filter by work type and UTC deadline (overdue, today, upcoming, undated, or all), and browse 20 assignments per page. **فتح الواجب** opens the exact assignment in its student's existing controls. Search and filters remain in the URL when returning; pagination starts at the first page. Assignment/account changes and grade side effects refresh the queue; student creation and notes do not. Native GET search preserves type and deadline filters even with JavaScript disabled. The first page is prefetched, and failed memorization reads offer a panel-level retry without taking down the student page. Other browsers refetch on focus/navigation; there is no polling. No migration or additional service is required.

## Direct staff queue actions

On **قائمة الواجبات**, staff can complete a review, assess new memorization, edit a deadline or confirm cancellation without opening a student page. Each dialog identifies the student and surah. Reviews allow keeping the current grade or selecting a new one; new memorization requires a grade. **حفظ والتالي** saves the assessment and opens the next available item at the same position in the refreshed page, when available. Inputs remain open after failed mutations; controls prevent dismissal and duplicate submission while saving.

Actions retain the queue's URL filters and current cursor page. Completed/cancelled work disappears; changed deadlines can move work elsewhere in the filtered ordering. An empty later page keeps **السابق** available. **تحديث القائمة** refreshes the current page and invalidates cached pages for the current filters for recovery after another teacher changes work. Pagination remains a live view, not a snapshot. No migration, polling or new paid service is required.

## Next review at assessment

Staff can optionally enable **إسناد المراجعة التالية** when completing a review or assessing memorization, both on a student page and in the staff queue. Choose today or a later UTC date. The assessment, grade/history changes and new review save together. Follow-up is off by default and resets between assignments; cancelling work creates no follow-up.

If an open review already exists, the save reports a conflict and leaves the assessment and existing review unchanged. Refresh the list or turn off the next-review option before retrying. Failed submissions retain choices; pending submissions block dismissal and duplicate saves. The new assignment appears through the existing student dashboard, review list and staff queue. No migration, background job or new paid service is required.

## Student readiness for assessment

Apply reviewed migration `0004_assignment_readiness.sql` to the intended database before deploying this version. It adds nullable readiness timestamps and open-only constraints to review/memorization assignments; existing work starts unmarked and no data is backfilled.

On **المراجعات** and **حفظ جديد**, students choose **أنا جاهز للتقييم** after practising, or **التراجع عن الجاهزية** to undo it. The signal keeps the task open and does not change grades, progress or deadlines. Staff see **جاهز للتقييم** on student tasks and can filter **جاهزية الطالب** in **قائمة الواجبات**, combined with the existing type/deadline/search filters. Select **كل المواعيد** to include ready work regardless of deadline. Assessment/cancellation, including ordinary grading or grade-removal side effects, clears the signal; changing a deadline retains it. New follow-up assignments start unmarked.

The operation is limited to the signed-in student’s own open assignments. Failed requests retain the current state and offer retry/refresh. Other browsers see changes on navigation/focus/reload or the queue’s refresh button; there is no polling, notification delivery or extra service. Additional service cost: **$0**, within the existing Workers Free/Neon Free allowances.

## Assessment feedback

Apply reviewed migration `0005_assessment_feedback.sql` to the intended database before deploying this version. It adds nullable feedback columns and completed-only text constraints to review and memorization assignments; existing records remain empty, without a backfill.

Teachers can enter **ملاحظات التقييم (اختياري)** when completing a review or assessing memorization, both on the student page and in the staff queue. Feedback is visible to the student, limited to 2,000 characters, and saved with the assessment and any next review in one transaction. Blank input saves no feedback. Failed saves retain input; **حفظ والتالي** starts the next assignment with empty feedback.

Students and staff read **ملاحظات المعلم** alongside the saved result in **السجل** for reviews and **عرض سجل الحفظ** for memorization. Later grade changes/removal do not rewrite completed-assignment feedback. Cancellation has no assessment feedback, and ordinary grade entry continues to work without it. No polling or new service is added. Additional service cost: **$0**, within the existing Workers Free/Neon Free allowances.
