# Better Auth + Convex auth setup

## 1. Required Convex env vars

Set these on the Convex deployment before you bootstrap the first admin:

```bash
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
npx convex env set SITE_URL http://localhost:3000
```

For production, set `SITE_URL` to the real app origin.

## 2. Local app env vars

`.env.local` should contain:

```dotenv
CONVEX_DEPLOYMENT=
VITE_CONVEX_URL=
VITE_CONVEX_SITE_URL=
VITE_SITE_URL=http://localhost:3000
```

`VITE_CONVEX_SITE_URL` must end in `.convex.site`.

## 3. Push the Convex config

Run:

```bash
npx convex dev --once
```

This updates generated files and pushes the Better Auth component/auth config.

## 4. Bootstrap the first admin

Run:

```bash
npm run bootstrap:admin -- --username admin --password 'strong-password' --display-name 'Admin Name' [--email admin@example.com]
```

The bootstrap command:

1. Verifies the Better Auth user store is empty.
2. Creates the first user.
3. Promotes that user to the `admin` role.

After the first admin exists, bootstrap is blocked and all further account creation must go through the app's admin APIs.

## 5. Rescue: reset a password from the deployment

Use this when no admin can sign in (e.g. the only admin forgot their password and the in-app admin-mediated reset is unreachable). It bypasses the in-app admin session check, so it is restricted to whoever has Convex deployment access.

```bash
npx convex run --push 'auth/admin:rescueResetPassword' '{"identifier":"<email-or-username>","password":"<new-password>"}'
```

`identifier` accepts either the user's email (anything containing `@`) or their username. The action looks up the user, hashes the new password with Better Auth's default hasher, and writes it directly to the matching `account` row (`providerId='credential'`).

Defined as an `internalAction` in `convex/auth/admin.ts`, so it cannot be called from the public API — only via `npx convex run` with deployment credentials.

## 6. Auth model

- Public sign-up is disabled.
- Login supports email/password and username/password.
- Password resets are admin-only.
- User roles are `admin`, `teacher`, and `student`.
- Disabled users are implemented with Better Auth bans plus session revocation.
