# Clerk + Convex auth setup

## 1. Clerk application

1. Create a Clerk application in the Clerk dashboard.
2. Enable username + password and email + password sign-in.
3. Disable public sign-up in Clerk.
4. Open the Clerk Convex integration page and activate the Convex integration.
5. Copy:
   - Publishable key
   - Secret key
   - Clerk JWT issuer domain / Frontend API URL for Convex

If you plan to bootstrap admins with both `--username` and `--email`, those
identifier types must both be enabled in Clerk's "User & authentication"
settings. Clerk returns `422 Unprocessable Entity` if you submit an identifier
that is not enabled or omit one that is configured as required.

## 2. Environment variables

Set the following values locally and in production:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_JWT_ISSUER_DOMAIN`
- `CONVEX_DEPLOYMENT`
- `VITE_CONVEX_URL`
- `VITE_CONVEX_SITE_URL`

See `.env.example` for the expected names.

## 3. Push the Convex auth config

After setting the environment variables, run:

```bash
npx convex dev --once
```

This updates generated files and pushes the new auth/schema configuration.

## 4. Bootstrap the first admin

Run the repo command with explicit arguments:

```bash
npm run bootstrap:admin -- \
  --username admin \
  --password 'change-me-now' \
  --display-name 'المشرف العام' \
  --email admin@example.com
```

The command:

1. Creates the Clerk user
2. Mirrors the user into Convex with the `admin` role

Bootstrap only works before any app user exists.

## 5. Validation checklist

- Sign in at `/login` with email
- Sign in at `/login` with username
- Confirm protected pages redirect to `/login` when signed out
- Confirm a disabled user is blocked from app access
- Confirm an admin can call the user-management backend functions
