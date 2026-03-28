# Architecture

## Runtime architecture

```mermaid
flowchart LR
  browser["Browser<br/>React 19 + TanStack Router + React Query"]
  worker["Cloudflare Worker<br/>TanStack Start SSR + server routes"]
  authProxy["/api/auth/$ route<br/>proxy handler"]
  convexHttp["Convex HTTP router"]
  convexFns["Convex functions<br/>queries / mutations / actions"]
  authFacade["App auth facade<br/>convex/auth/users.ts<br/>convex/auth/admin.ts<br/>convex/auth/helpers.ts"]
  authEngine["Better Auth runtime<br/>convex/auth.ts"]
  authComponent["Convex component: betterAuth"]
  appTables["App tables<br/>convex/schema.ts"]
  authTables["Auth tables<br/>user / session / account /<br/>verification / jwks / rateLimit"]
  provider["ConvexBetterAuthProvider<br/>+ authClient"]
  convexClient["Convex React client<br/>WebSocket + HTTP"]
  convexJwt["Convex auth.config.ts<br/>JWT verification"]

  browser --> provider
  provider --> convexClient
  browser --> worker
  worker --> authProxy
  authProxy --> convexHttp
  convexHttp --> authEngine
  authEngine --> authComponent
  authComponent --> authTables

  worker -->|SSR protected data| convexFns
  convexClient -->|queries / mutations / actions| convexFns
  convexFns --> appTables
  convexFns --> authFacade
  authFacade --> authComponent
  authEngine --> convexJwt
```

## Login and auth flow

```mermaid
flowchart TD
  login["User submits login form"]
  loginPage["/login page<br/>email or username + password"]
  authClient["Better Auth client<br/>src/lib/auth-client.ts"]
  proxy["TanStack Start route<br/>src/routes/api/auth/$.ts"]
  convexSite["Convex .site auth endpoint"]
  betterAuth["Better Auth runtime on Convex"]
  sessionTable["betterAuth.session"]
  userTable["betterAuth.user"]
  jwtCookie["Convex JWT cookie"]
  ssr["SSR token fetch<br/>src/lib/auth-server.ts"]
  protected["requireProtectedAppUser"]
  current["api.auth.users.current"]

  login --> loginPage
  loginPage --> authClient
  authClient --> proxy
  proxy --> convexSite
  convexSite --> betterAuth
  betterAuth --> userTable
  betterAuth --> sessionTable
  betterAuth --> jwtCookie
  jwtCookie --> ssr
  ssr --> protected
  protected --> current
  current --> userTable
```

## Notes

- App data and auth data live in the same Convex deployment.
- App tables are defined in `convex/schema.ts`.
- Better Auth tables are isolated inside the `betterAuth` Convex component in `convex/betterAuth/schema.ts`.
- Cloudflare Workers handle SSR and proxy `/api/auth/$`; Better Auth itself runs on Convex.
