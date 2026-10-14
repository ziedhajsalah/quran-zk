# Better Auth setup

Better Auth 1.7.7 runs in the application with the PostgreSQL Drizzle adapter, username and admin plugins. Public signup is disabled. Set `BETTER_AUTH_SECRET` and exact-origin `SITE_URL` in `.dev.vars` locally, or as Worker secrets remotely. Database setup is in [SETUP.md](SETUP.md).

Cookie sessions live in SQL. Cookie caching is disabled; backend authorization reads the current user and status. Multi-role users retain admin/teacher/student flags. Teachers create students with a fixed server-side role; all other account administration is app-admin-only. The plugin's public `/admin/*` routes are disabled so they cannot bypass the app's transactional last-admin checks.

Create the first admin with `npm run bootstrap:admin` and server-only operator variables `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_NAME`, optional `ADMIN_EMAIL`, and a direct `DATABASE_URL`. Bootstrap refuses existing users.

For recovery, supply `RESET_IDENTIFIER` and `RESET_PASSWORD` to `npm run rescue:password`, with an explicit direct `DATABASE_URL`. This CLI requires DB access; there is no public rescue endpoint. It hashes with Better Auth's pinned password contract and revokes all target sessions transactionally.

Admins issue six-digit password reset codes in the existing UI. Codes expire after 30 minutes, allow five failed attempts, and are stored as secret-keyed hashes. Issuing a new code invalidates earlier ones. Redemption atomically updates credentials, consumes the code and revokes sessions. Codes never carry plaintext Better Auth reset tokens.

Core self-service profile/account mutation endpoints are also disabled, keeping username/display-name/email changes inside the admin-managed service.

Direct auth-table writes are limited to the account/credential services and are covered by schema/login compatibility tests. Re-run these tests and review the generated schema when upgrading Better Auth. Do not weaken hashing to fit a hosting plan.
