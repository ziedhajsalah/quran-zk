import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { eq, sql } from 'drizzle-orm'
import { withDatabase } from '../../src/server/db.server'
import { user } from '../../src/server/db/schema/auth'
import {
  memorizationAssignments,
  reviews,
} from '../../src/server/db/schema/app'
import { serializeUser } from '../../src/server/accounts'
import { listWorkQueue } from '../../src/server/services/work-queue.server'
import { workQueueInput } from '../../src/server/functions/validation'
import type { Actor } from '../../src/server/auth-guards.server'
import type { Database } from '../../src/server/db.server'
import type { WorkCursor, WorkKind } from '../../src/lib/work-queue'

const url =
  process.env.TEST_DATABASE_URL ??
  'postgresql://quran_dev:quran_local@127.0.0.1:55432/quran_test'
if (!new URL(url).pathname.endsWith('_test'))
  throw new Error('Tests require an isolated _test database.')
const run = <T>(fn: (db: Database) => Promise<T>) => withDatabase(url, fn)
const today = Date.UTC(2026, 10, 7)
const now = new Date(today + 3600000)
let staff: Actor
async function account(
  db: Database,
  id: string,
  role = 'student',
  banned = false,
  name = id,
) {
  const [row] = await db
    .insert(user)
    .values({
      id,
      name,
      username: id,
      email: `${id}@example.com`,
      role,
      banned,
    })
    .returning()
  return serializeUser(row)
}
async function task(
  db: Database,
  id: string,
  studentId: string,
  kind: WorkKind,
  dueAt: number | null,
  surahNumber = 1,
) {
  await db
    .insert(kind === 'review' ? reviews : memorizationAssignments)
    .values({
      id,
      studentId,
      surahNumber,
      dueAt: dueAt === null ? null : new Date(dueAt),
      assignedAt: now,
    })
}
beforeAll(() => run((db) => migrate(db, { migrationsFolder: './drizzle' })))
beforeEach(() =>
  run(async (db) => {
    await db.execute(sql`truncate "user" cascade`)
    staff = await account(db, 'teacher', 'teacher')
  }),
)
describe('staff work queue', () => {
  it('requires staff before querying, including on subsequent pages', async () => {
    for (const actor of [
      null,
      serializeUser({
        id: 'student',
        name: 'student',
        role: 'student',
        email: 's@example.com',
      }),
    ]) {
      await expect(
        listWorkQueue({} as Database, actor, {}, now),
      ).rejects.toThrow()
      await expect(
        listWorkQueue(
          {} as Database,
          actor,
          { cursor: { dueAt: null, kind: 'review', id: 'x' } },
          now,
        ),
      ).rejects.toThrow()
    }
  })
  it('allows admins and returns a truthful empty page', () =>
    run(async (db) => {
      const admin = await account(db, 'admin', 'admin')
      expect(await listWorkQueue(db, admin, {}, now)).toEqual({
        rows: [],
        nextCursor: null,
      })
    }))
  it('unions work without multiplying it, includes mixed-role students, and excludes inactive, nonstudents and terminal work', () =>
    run(async (db) => {
      for (const [id, role, banned] of [
        ['active', 'student', false],
        ['mixed', 'teacher,student', false],
        ['disabled', 'student', true],
        ['nonstudent', 'teacher', false],
      ] as const) {
        await account(db, id, role, banned)
        await task(db, `${id}-r`, id, 'review', today - 1)
        await task(db, `${id}-m`, id, 'memorization', today - 1)
      }
      await task(db, 'closed', 'active', 'review', today - 1, 2)
      await db
        .update(reviews)
        .set({ status: 'closed', closedAt: now })
        .where(eq(reviews.id, 'closed'))
      await task(db, 'cancelled', 'active', 'memorization', today - 1, 3)
      await db
        .update(memorizationAssignments)
        .set({ status: 'cancelled', closedAt: now })
        .where(eq(memorizationAssignments.id, 'cancelled'))
      const page = await listWorkQueue(db, staff, {}, now)
      expect(page.rows.map((r) => r.id)).toEqual([
        'active-m',
        'mixed-m',
        'active-r',
        'mixed-r',
      ])
      expect(Object.keys(page.rows[0]).sort()).toEqual(
        [
          'displayName',
          'dueAt',
          'id',
          'kind',
          'studentId',
          'surahNumber',
          'username',
        ].sort(),
      )
    }))
  it('uses UTC day boundaries including legacy times of day and all deadline/type filters', () =>
    run(async (db) => {
      await account(db, 'student')
      const dates = [today - 1, today, today + 86399999, today + 86400000, null]
      for (const kind of ['review', 'memorization'] as const)
        for (const [i, due] of dates.entries())
          await task(db, `${kind}-${i}`, 'student', kind, due, i + 1)
      for (const [deadline, expected] of [
        ['overdue', [0]],
        ['today', [1, 2]],
        ['upcoming', [3]],
        ['undated', [4]],
        ['all', [0, 1, 2, 3, 4]],
      ] as const) {
        for (const kind of ['review', 'memorization'] as const) {
          const result = await listWorkQueue(db, staff, { deadline, kind }, now)
          expect(result.rows.map((r) => r.id)).toEqual(
            expected.map((i) => `${kind}-${i}`),
          )
        }
      }
    }))
  it('searches name or username literally, trims input and does not interpret SQL or wildcard characters', () =>
    run(async (db) => {
      for (const [id, name] of [
        ['student-one', 'أحمد المعلم'],
        ['student-two', '100%_\\ Name'],
        ['student-three', '100xx Name'],
      ]) {
        await account(db, id, 'student', false, name)
        await task(db, id, id, 'review', null)
      }
      for (const [q, ids] of [
        ['  أحمد  ', ['student-one']],
        ['STUDENT-TWO', ['student-two']],
        ['%_\\', ['student-two']],
        ["' or true --", []],
        ['absent', []],
      ] as const) {
        expect(
          (
            await listWorkQueue(db, staff, { deadline: 'all', q }, now)
          ).rows.map((r) => r.id),
        ).toEqual(ids)
      }
    }))
  it('paginates more than 20 rows deterministically across tied kinds, identical IDs and null dates', () =>
    run(async (db) => {
      await account(db, 'student')
      for (let i = 0; i < 27; i++) {
        const id = String(i).padStart(2, '0')
        for (const kind of ['review', 'memorization'] as const)
          await task(db, id, 'student', kind, i < 11 ? today : null, i + 1)
      }
      let cursor: WorkCursor | null = null
      const found: Array<string> = []
      let pages = 0
      do {
        const page = await listWorkQueue(
          db,
          staff,
          { deadline: 'all', cursor },
          now,
        )
        expect(page.rows.length).toBeLessThanOrEqual(20)
        found.push(...page.rows.map((r) => `${r.kind}-${r.id}`))
        cursor = page.nextCursor
        pages++
        if (pages > 5) throw new Error('Cursor did not advance')
      } while (cursor)
      expect(pages).toBe(3)
      const expected = [false, true].flatMap((undated) =>
        ['memorization', 'review'].flatMap((kind) =>
          Array.from(
            { length: undated ? 16 : 11 },
            (_, i) =>
              `${kind}-${String(i + (undated ? 11 : 0)).padStart(2, '0')}`,
          ),
        ),
      )
      expect(found).toEqual(expected)
      expect(new Set(found).size).toBe(54)
    }))
  it('reflects completion, deadline edits, disabled accounts and removed roles on a fresh read', () =>
    run(async (db) => {
      await account(db, 'student')
      await task(db, 'r', 'student', 'review', today - 1)
      expect((await listWorkQueue(db, staff, {}, now)).rows).toHaveLength(1)
      await db
        .update(reviews)
        .set({ dueAt: new Date(today) })
        .where(eq(reviews.id, 'r'))
      expect((await listWorkQueue(db, staff, {}, now)).rows).toHaveLength(0)
      expect(
        (await listWorkQueue(db, staff, { deadline: 'today' }, now)).rows,
      ).toHaveLength(1)
      await db.update(user).set({ banned: true }).where(eq(user.id, 'student'))
      expect(
        (await listWorkQueue(db, staff, { deadline: 'all' }, now)).rows,
      ).toHaveLength(0)
      await db
        .update(user)
        .set({ banned: false, role: 'teacher' })
        .where(eq(user.id, 'student'))
      expect(
        (await listWorkQueue(db, staff, { deadline: 'all' }, now)).rows,
      ).toHaveLength(0)
      await db
        .update(user)
        .set({ role: 'student' })
        .where(eq(user.id, 'student'))
      await db
        .update(reviews)
        .set({ status: 'closed' })
        .where(eq(reviews.id, 'r'))
      expect(
        (await listWorkQueue(db, staff, { deadline: 'all' }, now)).rows,
      ).toHaveLength(0)
    }))
  it('rejects unbounded searches and malformed filters/cursors', () => {
    for (const input of [
      { q: 'x'.repeat(101) },
      { kind: 'grades' },
      { deadline: 'yesterday' },
      { cursor: { dueAt: -1, kind: 'review', id: 'x' } },
      { cursor: { dueAt: null, kind: 'all', id: 'x' } },
      { cursor: { dueAt: null, kind: 'review', id: '' } },
    ])
      expect(workQueueInput.safeParse(input).success).toBe(false)
  })
})
