import { withRuntime } from '~/server/runtime.server'

export const handler = (request: Request) => {
  // Account administration uses the app services' last-admin lock and revocation rules.
  // Do not expose the admin plugin's parallel mutation endpoints to browser callers.
  if (new URL(request.url).pathname.startsWith('/api/auth/admin/'))
    return Promise.resolve(new Response('Not found', { status: 404 }))
  return withRuntime(({ auth }) => auth.handler(request), request)
}
