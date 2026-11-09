import { prepareAuthRequest } from '~/server/auth-request.server'
import { limitSignIn } from '~/server/sign-in-limit.server'
import { withRuntime } from '~/server/runtime.server'

export const handler = async (request: Request) => {
  // Account administration uses the app services' last-admin lock and revocation rules.
  // Do not expose the admin plugin's parallel mutation endpoints to browser callers.
  if (new URL(request.url).pathname.startsWith('/api/auth/admin/'))
    return new Response('Not found', { status: 404 })
  const prepared = await prepareAuthRequest(request)
  if (prepared instanceof Response) return prepared
  return withRuntime(async ({ auth, db, config }) => {
    const limited = await limitSignIn(db, config, prepared)
    return limited ?? auth.handler(prepared)
  }, prepared)
}
