import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { eq, sql } from 'drizzle-orm'
import {
  hashPassword as libraryHash,
  verifyPassword as libraryVerify,
} from 'better-auth/crypto'
import { withDatabase } from '../../src/server/db.server'
import { authRateLimits } from '../../src/server/db/schema/app'
import { user } from '../../src/server/db/schema/auth'
import { hashPassword, verifyPassword } from '../../src/server/password.server'
import {
  consumeRateLimit,
  rateLimitKey,
} from '../../src/server/rate-limit.server'
import { limitSignIn } from '../../src/server/sign-in-limit.server'

const url =
  process.env.TEST_DATABASE_URL ??
  'postgresql://quran_dev:quran_local@127.0.0.1:55432/quran_test'
if (!new URL(url).pathname.endsWith('_test'))
  throw new Error('Test database must end in _test.')
const config = {
  SITE_URL: 'https://example.com',
  BETTER_AUTH_SECRET: 'test-secret-at-least-32-characters-long',
}
const run = <T>(fn: Parameters<typeof withDatabase<T>>[1]) =>
  withDatabase(url, fn)
beforeAll(() => run((db) => migrate(db, { migrationsFolder: './drizzle' })))
beforeEach(() =>
  run(async (db) => {
    await db.execute(sql`truncate auth_rate_limits`)
    await db.execute(sql`truncate "user" cascade`)
  }),
)
function request(identifier: string, ip = '192.0.2.1', email = false) {
  return new Request(
    `${config.SITE_URL}/api/auth/sign-in/${email ? 'email' : 'username'}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: config.SITE_URL,
        'cf-connecting-ip': ip,
      },
      body: JSON.stringify(
        email
          ? { email: identifier, password: 'test' }
          : { username: identifier, password: 'test' },
      ),
    },
  )
}
describe('password compatibility and distributed sign-in protection', () => {
  it('verifies a pre-upgrade hash including Unicode normalization', async () => {
    const hash =
      '88cdf0632b78605ce1cf4e8ca967408b:eaecfcaa6c4b861ad988707cb03e63aeabcdaf730f4015d75aa5fff1b2236420ad4ba3096c619920277ef95b7ebe51a96513023138f2dea1083cacb587dda7ce'
    expect(await verifyPassword({ hash, password: 'Ａrabic-سلام-2026!' })).toBe(
      true,
    )
    expect(await verifyPassword({ hash, password: 'Arabic-سلام-2026!' })).toBe(
      true,
    )
    expect(await verifyPassword({ hash, password: 'wrong-password' })).toBe(
      false,
    )
  })
  it('retains compatibility with Better Auth writers and rejects malformed hashes', async () => {
    const password = 'Compatibility-password-2026!'
    expect(
      await libraryVerify({ password, hash: await hashPassword(password) }),
    ).toBe(true)
    expect(
      await verifyPassword({ password, hash: await libraryHash(password) }),
    ).toBe(true)
    for (const hash of ['', 'salt:key', '00:ff', 'x'.repeat(161)])
      expect(await verifyPassword({ password, hash })).toBe(false)
  })
  it('allows exactly five of twenty simultaneous requests across database clients', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        run((db) => consumeRateLimit(db, 'race', { window: 60, max: 5 })),
      ),
    )
    expect(results.filter((x) => x.allowed)).toHaveLength(5)
    expect(
      results.filter((x) => !x.allowed).every((x) => x.retryAfter! > 0),
    ).toBe(true)
    const stored = await run((db) => db.select().from(authRateLimits))
    expect(stored[0].count).toBe(6)
  })
  it('reopens an expired window without resetting another bucket', async () => {
    await run((db) => consumeRateLimit(db, 'expired', { window: 60, max: 1 }))
    await run((db) =>
      db
        .update(authRateLimits)
        .set({ windowStart: new Date(Date.now() - 61_000) })
        .where(eq(authRateLimits.key, 'expired')),
    )
    expect(
      (
        await run((db) =>
          consumeRateLimit(db, 'expired', { window: 60, max: 1 }),
        )
      ).allowed,
    ).toBe(true)
    expect(
      (
        await run((db) =>
          consumeRateLimit(db, 'expired', { window: 60, max: 1 }),
        )
      ).allowed,
    ).toBe(false)
    expect(
      (await run((db) => consumeRateLimit(db, 'other', { window: 60, max: 1 })))
        .allowed,
    ).toBe(true)
  })
  it('shares a canonical account limit across email, username and distinct IPs', async () => {
    await run((db) =>
      db.insert(user).values({
        id: 'canonical',
        name: 'Canonical',
        username: 'canonical',
        email: 'canonical@example.com',
      }),
    )
    for (let i = 0; i < 5; i++)
      expect(
        await run((db) =>
          limitSignIn(
            db,
            config,
            request(
              i % 2 ? 'canonical@example.com' : ' CANONICAL ',
              `192.0.2.${i}`,
              Boolean(i % 2),
            ),
          ),
        ),
      ).toBeNull()
    const denied = await run((db) =>
      limitSignIn(db, config, request('canonical', '192.0.2.9')),
    )
    expect(denied!.status).toBe(429)
    expect(Number(denied!.headers.get('retry-after'))).toBeGreaterThan(0)
    const keys = await run((db) => db.select().from(authRateLimits))
    expect(keys.every((row) => /^[a-f0-9]{64}$/.test(row.key))).toBe(true)
    expect(
      rateLimitKey(config.BETTER_AUTH_SECRET, 'one', 'canonical'),
    ).not.toBe(rateLimitKey(config.BETTER_AUTH_SECRET, 'two', 'canonical'))
  })
  it('limits one IP across identifiers and does not trust forwarded headers', async () => {
    for (let i = 0; i < 30; i++)
      expect(
        await run((db) => limitSignIn(db, config, request(`unknown${i}`))),
      ).toBeNull()
    const req = request('another')
    req.headers.set('x-forwarded-for', '203.0.113.99')
    expect((await run((db) => limitSignIn(db, config, req)))!.status).toBe(429)
  })
  it('rejects oversized input and ignores foreign-origin requests for account counters', async () => {
    const oversized = request('x'.repeat(9000))
    expect(
      (await run((db) => limitSignIn(db, config, oversized)))!.status,
    ).toBe(413)
    const foreign = request('target')
    foreign.headers.set('origin', 'https://untrusted.example')
    expect(await run((db) => limitSignIn(db, config, foreign))).toBeNull()
    expect(await run((db) => db.select().from(authRateLimits))).toHaveLength(1)
  })
})
