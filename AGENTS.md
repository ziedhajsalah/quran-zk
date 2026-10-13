# Project instructions

This app uses TanStack Start on Cloudflare Workers, PostgreSQL (Neon Free for hosted environments), Drizzle and Better Auth 1.5.3.

- Read SETUP.md and docs/architecture.md for runtime and local database commands.
- Keep database/auth implementation server-only; derive actors from request sessions.
- Apply reviewed Drizzle migrations, never run seeds against remote databases.
- Preserve transaction locks for review close, password-reset redemption and last-admin account changes.
- Keep credentials out of source, browser variables and logs.
- Integration tests use a separate PostgreSQL database ending in `_test` and erase its data.
- Preserve existing UI/storybook work and Arabic RTL behavior.
