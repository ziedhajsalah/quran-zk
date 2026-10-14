import { createHmac } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { authRateLimits } from './db/schema/app'
import type { Database } from './db.server'

export function rateLimitKey(secret: string, scope: string, value: string) {
  return createHmac('sha256', secret).update(`${scope}:${value}`).digest('hex')
}
export async function consumeRateLimit(
  db: Database,
  key: string,
  rule: { window: number; max: number },
) {
  const expired = sql`${authRateLimits.windowStart} <= now() - ${rule.window} * interval '1 second'`
  const [result] = await db
    .insert(authRateLimits)
    .values({ key, count: 1 })
    .onConflictDoUpdate({
      target: authRateLimits.key,
      set: {
        count: sql`case when ${expired} then 1 else least(${authRateLimits.count} + 1, ${rule.max + 1}) end`,
        windowStart: sql`case when ${expired} then now() else ${authRateLimits.windowStart} end`,
      },
    })
    .returning({
      allowed: sql<boolean>`${authRateLimits.count} <= ${rule.max}`,
      retryAfter: sql<number>`greatest(1, ceil(extract(epoch from (${authRateLimits.windowStart} + ${rule.window} * interval '1 second' - now()))))::integer`,
    })
  return {
    allowed: result.allowed,
    retryAfter: result.allowed ? null : result.retryAfter,
  }
}

let lastPrunedAt = 0
export async function pruneRateLimits(db: Database) {
  if (Date.now() - lastPrunedAt < 3_600_000) return
  await db
    .delete(authRateLimits)
    .where(sql`${authRateLimits.windowStart} < now() - interval '1 day'`)
  lastPrunedAt = Date.now()
}
