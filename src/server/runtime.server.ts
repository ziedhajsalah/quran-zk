import { env } from 'cloudflare:workers'
import { getRequest } from '@tanstack/react-start/server'
import { withDatabase } from './db.server'
import { createAuth } from './auth.server'
import { getActor } from './auth-guards.server'
import { AppError } from './errors'
import type { AuthEnvironment } from './auth.server'
import type { Actor } from './auth-guards.server'
import type { Database } from './db.server'

export type RequestContext = {
  db: Database
  actor: Actor | null
  auth: ReturnType<typeof createAuth>
  config: AuthEnvironment
}
export async function withRuntime<T>(
  run: (ctx: RequestContext) => Promise<T> | T,
  request = getRequest(),
): Promise<T> {
  const config = env as unknown as AuthEnvironment & {
    HYPERDRIVE?: { connectionString: string }
    DATABASE_URL?: string
  }
  const connectionString =
    config.HYPERDRIVE?.connectionString ?? config.DATABASE_URL
  if (!connectionString)
    throw new Error('Configure HYPERDRIVE or DATABASE_URL.')
  try {
    const isAuthRoute = new URL(request.url).pathname.startsWith('/api/auth/')
    if (
      !isAuthRoute &&
      request.method === 'POST' &&
      request.headers.get('origin') !== new URL(config.SITE_URL).origin
    ) {
      throw new AppError('غير مصرح لك بهذه العملية.')
    }
    return await withDatabase(connectionString, async (db) => {
      const auth = createAuth(db, config)
      const actor = isAuthRoute
        ? null
        : await getActor(db, auth, request.headers)
      return run({ db, actor, auth, config })
    })
  } catch (error) {
    if (error instanceof AppError) throw new Error(error.message)
    console.error('Backend request failed', {
      name: error instanceof Error ? error.name : 'UnknownError',
    })
    throw new Error('تعذر إتمام العملية. حاول مرة أخرى.')
  }
}
