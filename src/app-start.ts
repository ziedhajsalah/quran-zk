import { createMiddleware, createStart } from '@tanstack/react-start'

const canonicalOrigin = createMiddleware().server(async ({ request, next }) => {
  const { env } = await import('cloudflare:workers')
  const { canonicalOriginRedirect } =
    await import('./server/canonical-origin.server')
  const redirect = canonicalOriginRedirect(request, env.SITE_URL)
  return redirect ?? next()
})

export const startInstance = createStart(() => ({
  requestMiddleware: [canonicalOrigin],
}))
