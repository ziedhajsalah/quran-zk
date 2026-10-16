# Better Auth setup

Better Auth 1.7.7 runs in the application with the PostgreSQL Drizzle adapter, username and admin plugins. Public signup is disabled. Set `BETTER_AUTH_SECRET` and exact-origin `SITE_URL` in `.dev.vars` locally, or as Worker secrets remotely. Database setup is in [SETUP.md](SETUP.md).

Cookie sessions live in SQL. Cookie caching is disabled; backend authorization reads the current user and status. Multi-role users retain admin/teacher/student flags. Teachers create students with a fixed server-side role; all other account administration is app-admin-only. The plugin's public `/admin/*` routes are disabled so they cannot bypass the app's transactional last-admin checks.

Create the first admin by running `npm run bootstrap:admin` in a terminal. The interactive wizard asks for the environment, username, display name, optional email, and a hidden password/confirmation. Review the selected database and type `create <environment>` to proceed. Bootstrap refuses any database that already contains users. There is no separate super-admin role.

For automation, run `npm run bootstrap:admin -- --non-interactive` with `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_NAME` and optional `ADMIN_EMAIL` explicitly exported. These `ADMIN_*` variables do not prefill the interactive wizard.

For recovery, run `npm run rescue:password` in a terminal. Select the environment, enter the existing username or email and a hidden new password/confirmation, then type `reset <environment>` after reviewing the target. The CLI requires DB access; there is no public rescue endpoint. It hashes with Better Auth's pinned password contract and revokes all target sessions transactionally, preserving roles and account status.

For automation, run `npm run rescue:password -- --non-interactive` with `DATABASE_URL`, `RESET_IDENTIFIER` and `RESET_PASSWORD` explicitly exported. These `RESET_*` variables do not prefill the interactive wizard.

Both wizards load only the selected local (`.env.local`) or hosted development (`.env.neon-development.local`) configuration. Production requires an explicitly entered direct PostgreSQL URL; production files are never read automatically. Custom mode can use an explicitly exported `DATABASE_URL`. Non-interactive mode skips prompts/confirmation and does not automatically load `.env.local`. Neither command saves passwords to files. Cancellation before confirmation opens no database connection. See [the CLI setup and recovery instructions](SETUP.md#password-recovery) for details; either command accepts `--help` without connecting.

Admins issue six-digit password reset codes in the existing UI. Codes expire after 30 minutes, allow five failed attempts, and are stored as secret-keyed hashes. Issuing a new code invalidates earlier ones. Redemption atomically updates credentials, consumes the code and revokes sessions. Codes never carry plaintext Better Auth reset tokens.

Core self-service profile/account mutation endpoints are also disabled, keeping username/display-name/email changes inside the admin-managed service.

Direct auth-table writes are limited to the account/credential services and are covered by schema/login compatibility tests. Re-run these tests and review the generated schema when upgrading Better Auth. Do not weaken hashing to fit a hosting plan.
