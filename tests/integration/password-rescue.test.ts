import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { withDatabase } from '../../src/server/db.server'
import { account, session, user } from '../../src/server/db/schema/auth'
import { createAccount } from '../../src/server/services/accounts.server'
import { verifyPassword } from '../../src/server/password.server'
import { adminSetupErrorMessage } from '../../scripts/lib/admin-errors'
import { collectPasswordReset } from '../../scripts/lib/password-reset-setup'

const url =
  process.env.TEST_DATABASE_URL ??
  'postgresql://quran_dev:quran_local@127.0.0.1:55432/quran_test'
if (
  !new URL(url).pathname.endsWith('_test') ||
  !['localhost', '127.0.0.1'].includes(new URL(url).hostname)
)
  throw new Error(
    'Recovery CLI tests require a local database ending in _test.',
  )
const run = <T>(fn: Parameters<typeof withDatabase<T>>[1]) =>
  withDatabase(url, fn)
function wizard(answers: Array<string>, database = url) {
  const queue = [...answers]
  return {
    ask: vi.fn(() => {
      const value = queue.shift()
      if (value === undefined) throw new Error('Unexpected prompt')
      return Promise.resolve(value)
    }),
    write: vi.fn(),
    readDatabaseUrl: vi.fn(() => Promise.resolve(database)),
    databaseUrl: 'postgresql://ignored.example/not_selected',
  }
}
const password = 'Recovery-password-canary-2026!'

describe('password recovery wizard', () => {
  it('selects development, normalizes email and confirms session revocation', async () => {
    const options = wizard([
      '2',
      ' Person@Example.com ',
      password,
      password,
      'reset development',
    ])
    expect(await collectPasswordReset(options)).toEqual({
      connectionString: url,
      identifier: 'person@example.com',
      password,
    })
    expect(options.readDatabaseUrl.mock.calls).toEqual([
      ['.env.neon-development.local'],
    ])
    expect(options.write.mock.calls.flat().join('\n')).toContain(
      'revokes all existing sessions',
    )
    expect(options.write.mock.calls.flat().join('\n')).not.toContain(password)
    expect(options.ask.mock.calls).toContainEqual([
      'New password (8–128 characters; input hidden): ',
      true,
    ])
  })
  it('never reads production files or inherits the process database URL', async () => {
    const options = wizard([
      '3',
      url,
      'user.name',
      password,
      password,
      'reset production',
    ])
    expect((await collectPasswordReset(options))?.connectionString).toBe(url)
    expect(options.readDatabaseUrl).not.toHaveBeenCalled()
  })
  it('cancels on a mismatched environment confirmation', async () => {
    expect(
      await collectPasswordReset(
        wizard(['1', 'user.name', password, password, 'reset production']),
      ),
    ).toBeNull()
  })
  it('retries invalid identifiers, short passwords and mismatched passwords', async () => {
    const options = wizard([
      '1',
      '',
      'bad@',
      'valid.user',
      'short',
      password,
      'mismatch',
      password,
      password,
      'reset local',
    ])
    expect((await collectPasswordReset(options))?.identifier).toBe('valid.user')
    expect(options.write.mock.calls.flat().join('\n')).toContain(
      'Passwords do not match',
    )
  })
  it('uses recovery-specific guidance without driver messages or creation advice', () => {
    for (const code of ['42501', '28P01', '23505', 'ECONNRESET', 'EPIPE']) {
      const message = adminSetupErrorMessage(
        Object.assign(new Error(password), { code }),
        'reset',
      )
      expect(message).not.toContain(password)
      expect(message).not.toContain('create an admin')
      expect(message).not.toContain('first admin')
    }
  })
})

const exec = promisify(execFile)
function rescue(identifier: string) {
  return exec(
    './node_modules/.bin/tsx',
    ['scripts/rescue-reset-password.ts', '--non-interactive'],
    {
      env: {
        ...process.env,
        DATABASE_URL: url,
        RESET_IDENTIFIER: identifier,
        RESET_PASSWORD: password,
      },
      timeout: 15000,
    },
  )
}

describe('password recovery CLI against isolated local PostgreSQL', () => {
  beforeAll(() => run((db) => migrate(db, { migrationsFolder: './drizzle' })))
  beforeEach(() =>
    run(async (db) => {
      await db.execute(sql`truncate "user" cascade`)
    }),
  )
  it.each(['target.user', 'TARGET@EXAMPLE.COM'])(
    'resets %s, revokes only its sessions and retains role/status',
    async (identifier) => {
      const target = await run((db) =>
        createAccount(
          db,
          {
            username: 'target.user',
            displayName: 'Target',
            email: 'target@example.com',
            password: 'Old-password-2026!',
          },
          ['admin'],
        ),
      )
      const other = await run((db) =>
        createAccount(
          db,
          {
            username: 'other.user',
            displayName: 'Other',
            email: null,
            password: 'Other-password-2026!',
          },
          ['student'],
        ),
      )
      await run(async (db) => {
        await db
          .update(user)
          .set({ banned: true })
          .where(eq(user.id, target.id))
        await db
          .insert(session)
          .values(
            [target, other].map((person) => ({
              id: crypto.randomUUID(),
              userId: person.id,
              token: crypto.randomUUID(),
              expiresAt: new Date(Date.now() + 60000),
            })),
          )
      })
      const result = await rescue(identifier)
      expect(result.stdout).toContain('all existing sessions revoked')
      expect(result.stdout + result.stderr).not.toContain(password)
      await run(async (db) => {
        const credentials = (
          await db.select().from(account).where(eq(account.userId, target.id))
        )[0]
        expect(
          await verifyPassword({ hash: credentials.password!, password }),
        ).toBe(true)
        expect(
          await verifyPassword({
            hash: credentials.password!,
            password: 'Old-password-2026!',
          }),
        ).toBe(false)
        expect(
          await db.select().from(session).where(eq(session.userId, target.id)),
        ).toHaveLength(0)
        expect(
          await db.select().from(session).where(eq(session.userId, other.id)),
        ).toHaveLength(1)
        expect(
          (await db.select().from(user).where(eq(user.id, target.id)))[0],
        ).toMatchObject({ role: 'admin', banned: true })
      })
    },
  )
  it('explains a missing account without creating one', async () => {
    await expect(rescue('missing.user')).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('No account matches'),
    })
    expect(await run((db) => db.select().from(user))).toHaveLength(0)
  })
  it('explains missing password credentials and rolls back without revoking sessions', async () => {
    const person = await run((db) =>
      createAccount(
        db,
        {
          username: 'no.credential',
          displayName: 'Test',
          email: null,
          password: 'Original-password-2026!',
        },
        ['student'],
      ),
    )
    await run(async (db) => {
      await db.delete(account).where(eq(account.userId, person.id))
      await db
        .insert(session)
        .values({
          id: crypto.randomUUID(),
          userId: person.id,
          token: crypto.randomUUID(),
          expiresAt: new Date(Date.now() + 60000),
        })
    })
    await expect(rescue('no.credential')).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('no password credential'),
    })
    expect(
      await run((db) =>
        db.select().from(session).where(eq(session.userId, person.id)),
      ),
    ).toHaveLength(1)
  })
})
