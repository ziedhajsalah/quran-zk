import { eq, or } from 'drizzle-orm'
import { user } from './db/schema/auth'
import {
  consumeRateLimit,
  pruneRateLimits,
  rateLimitKey,
} from './rate-limit.server'
import type { Database } from './db.server'
import type { AuthEnvironment } from './auth.server'

function denied(retryAfter: number) {
  return Response.json(
    { message: 'محاولات كثيرة. حاول مرة أخرى لاحقاً.' },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
    },
  )
}
export async function limitSignIn(
  db: Database,
  config: AuthEnvironment,
  request: Request,
) {
  const path = new URL(request.url).pathname
  if (
    request.method !== 'POST' ||
    !['/api/auth/sign-in/username', '/api/auth/sign-in/email'].includes(path)
  )
    return null
  if (
    request.headers.has('origin') &&
    request.headers.get('origin') !== new URL(config.SITE_URL).origin
  )
    return null
  await pruneRateLimits(db)
  // Cloudflare overwrites this header; never trust caller-controlled forwarded IP headers.
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
  const ipResult = await consumeRateLimit(
    db,
    rateLimitKey(config.BETTER_AUTH_SECRET, 'sign-in-ip', ip),
    { window: 60, max: 30 },
  )
  if (!ipResult.allowed) return denied(ipResult.retryAfter!)
  const reader = request.clone().body?.getReader()
  if (!reader) return null
  let size = 0
  const chunks: Array<Uint8Array> = []
  try {
    for (;;) {
      const part = await reader.read()
      if (part.done) break
      size += part.value.byteLength
      if (size > 8192) {
        void reader.cancel()
        return new Response('Request too large', { status: 413 })
      }
      chunks.push(part.value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    const body = JSON.parse(new TextDecoder().decode(bytes))
    const identifier = path.endsWith('/username') ? body?.username : body?.email
    if (typeof identifier !== 'string' || identifier.length > 320) return null
    const normalized = identifier.trim().toLowerCase()
    const existing = (
      await db
        .select({ id: user.id })
        .from(user)
        .where(or(eq(user.username, normalized), eq(user.email, normalized)))
        .limit(1)
    ).at(0)
    const result = await consumeRateLimit(
      db,
      rateLimitKey(
        config.BETTER_AUTH_SECRET,
        'sign-in-account',
        existing ? `id:${existing.id}` : `input:${normalized}`,
      ),
      { window: 300, max: 5 },
    )
    return result.allowed ? null : denied(result.retryAfter!)
  } catch (error) {
    if (error instanceof SyntaxError) return null
    throw error
  } finally {
    reader.releaseLock()
  }
}
