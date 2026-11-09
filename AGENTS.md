<!-- context7 -->
Use Context7 MCP for current library/framework/SDK/API/CLI/cloud-service documentation, including setup, migration and library-specific debugging. Resolve the library ID first, then query documentation scoped to one concept. Prefer it to web search. Do not use it for ordinary refactoring, standalone scripts, business-logic debugging or code review.
<!-- context7 -->

# Project instructions

This app uses TanStack Start on Cloudflare Workers, PostgreSQL (Neon Free for hosted environments), Drizzle and Better Auth 1.7.7.

- Read SETUP.md and docs/architecture.md for runtime and local database commands.
- Keep database/auth implementation server-only; derive actors from request sessions.
- Apply reviewed Drizzle migrations, never run seeds against remote databases.
- Preserve transaction locks for review close, password-reset redemption and last-admin account changes.
- Keep credentials out of source, browser variables and logs.
- Integration tests use a separate PostgreSQL database ending in `_test` and erase its data.
- Preserve existing UI/storybook work and Arabic RTL behavior.
