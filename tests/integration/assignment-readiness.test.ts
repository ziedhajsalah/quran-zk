import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { eq, sql } from 'drizzle-orm'
import { withDatabase } from '../../src/server/db.server'
import { user } from '../../src/server/db/schema/auth'
import {
  gradeHistory,
  grades,
  memorizationAssignments,
  reviews,
} from '../../src/server/db/schema/app'
import { serializeUser } from '../../src/server/accounts'
import {
  removeGrade,
  setGrade,
} from '../../src/server/services/grades.server'
import {
  finishReview,
  listReviews,
} from '../../src/server/services/reviews.server'
import {
  finishMemorization,
  listMemorization,
} from '../../src/server/services/memorization.server'
import { setAssignmentReadiness } from '../../src/server/services/assignment-readiness.server'
import { rescheduleAssignment } from '../../src/server/services/assignment-deadline.server'
import { listWorkQueue } from '../../src/server/services/work-queue.server'
import { assignmentReadinessInput } from '../../src/server/functions/validation'
import type { Actor } from '../../src/server/auth-guards.server'
import type { Database } from '../../src/server/db.server'
import type { WorkCursor } from '../../src/lib/work-queue'

const url =
  process.env.TEST_DATABASE_URL ??
  'postgresql://quran_dev:quran_local@127.0.0.1:55432/quran_test'
if (!new URL(url).pathname.endsWith('_test'))
  throw new Error('Tests require an isolated _test database.')
const run = <T>(fn: (db: Database) => Promise<T>) => withDatabase(url, fn)
let student: Actor, other: Actor, teacher: Actor, admin: Actor
beforeAll(() => run((db) => migrate(db, { migrationsFolder: './drizzle' })))
beforeEach(() =>
  run(async (db) => {
    await db.execute(sql`truncate "user" cascade`)
    const rows = await db
      .insert(user)
      .values(
        ['student', 'other', 'teacher', 'admin'].map((id) => ({
          id,
          name: id,
          email: `${id}@example.com`,
          username: id,
          role: id === 'other' ? 'student' : id,
        })),
      )
      .returning()
    const actors = Object.fromEntries(
      rows.map((row) => [row.id, serializeUser(row)]),
    )
    ;({ student, other, teacher, admin } = actors)
  }),
)
for (const kind of ['review', 'memorization'] as const) {
  const table = kind === 'review' ? reviews : memorizationAssignments
  const assignmentId = 'task'
  const input = { kind, assignmentId, ready: true }
  const list = kind === 'review' ? listReviews : listMemorization
  async function create(db: Database) {
    if (kind === 'review')
      await setGrade(db, teacher, {
        studentId: student.id,
        surahNumber: 1,
        grade: 'medium',
      })
    await db.insert(table).values({
      id: assignmentId,
      studentId: student.id,
      surahNumber: 1,
      assignedAt: new Date(),
      dueAt: new Date('2026-11-08T00:00:00Z'),
    })
  }
  const saved = async (db: Database) =>
    (await db.select().from(table).where(eq(table.id, assignmentId)))[0]
  const finish = (db: Database, cancel = false) =>
    kind === 'review'
      ? finishReview(db, teacher, { assignmentId }, cancel)
      : finishMemorization(db, teacher, {
          assignmentId,
          grade: cancel ? undefined : 'good',
        })
  describe(`${kind} readiness`, () => {
    it('marks and undoes own work, preserves repeated timestamp and changes no assessment data', () =>
      run(async (db) => {
        await create(db)
        const original = await saved(db)
        const originalGrades = await db.select().from(grades)
        const originalHistory = await db.select().from(gradeHistory)
        await setAssignmentReadiness(db, student, input)
        const marked = await saved(db)
        expect(marked.readyAt).toBeInstanceOf(Date)
        expect({ ...marked, readyAt: null }).toEqual(original)
        expect((await list(db, student, student.id))[0].readyAt).toBe(
          marked.readyAt!.getTime(),
        )
        expect((await list(db, teacher, student.id))[0].readyAt).toBe(
          marked.readyAt!.getTime(),
        )
        await setAssignmentReadiness(db, student, input)
        expect((await saved(db)).readyAt).toEqual(marked.readyAt)
        await setAssignmentReadiness(db, student, { ...input, ready: false })
        await setAssignmentReadiness(db, student, { ...input, ready: false })
        expect(await saved(db)).toEqual(original)
        expect(await db.select().from(grades)).toEqual(originalGrades)
        expect(await db.select().from(gradeHistory)).toEqual(originalHistory)
      }))
    it('rejects anonymous and nonstudent staff before querying', async () => {
      for (const actor of [null, teacher, admin])
        await expect(
          setAssignmentReadiness({} as Database, actor, input),
        ).rejects.toThrow()
    })
    it('hides other students work and ignores attempted owner/timestamp injection', () =>
      run(async (db) => {
        await create(db)
        for (const ready of [true, false])
          await expect(
            setAssignmentReadiness(db, other, {
              ...input,
              ready,
              studentId: student.id,
            }),
          ).rejects.toThrow('غير متاح')
        await setAssignmentReadiness(db, student, {
          ...input,
          studentId: other.id,
          readyAt: 1,
        })
        expect((await saved(db)).studentId).toBe(student.id)
        expect((await saved(db)).readyAt!.getTime()).toBeGreaterThan(1)
      }))
    it('rechecks active student role under lock and supports mixed-role self only', () =>
      run(async (db) => {
        await create(db)
        for (const change of [
          { banned: true },
          { banned: false, role: 'teacher' },
        ]) {
          await db.update(user).set(change).where(eq(user.id, student.id))
          await expect(
            setAssignmentReadiness(db, student, input),
          ).rejects.toThrow('طالب نشط')
        }
        await db
          .update(user)
          .set({ role: 'teacher,student' })
          .where(eq(user.id, student.id))
        const mixed = serializeUser(
          (await db.select().from(user).where(eq(user.id, student.id)))[0],
        )
        await setAssignmentReadiness(db, mixed, input)
        await expect(
          setAssignmentReadiness(db, { ...mixed, id: other.id }, input),
        ).rejects.toThrow('غير متاح')
      }))
    for (const cancel of [false, true])
      it(`clears readiness on ${cancel ? 'cancellation' : 'assessment'} and rejects late mark/undo`, () =>
        run(async (db) => {
          await create(db)
          await setAssignmentReadiness(db, student, input)
          await finish(db, cancel)
          const closed = await saved(db)
          expect(closed.readyAt).toBeNull()
          expect(closed.status).toBe(cancel ? 'cancelled' : 'closed')
          for (const ready of [true, false])
            await expect(
              setAssignmentReadiness(db, student, { ...input, ready }),
            ).rejects.toThrow('لم يعد مفتوحاً')
          expect(await saved(db)).toEqual(closed)
        }))
    it('clears readiness through existing grade side effects', () =>
      run(async (db) => {
        await create(db)
        await setAssignmentReadiness(db, student, input)
        if (kind === 'review')
          await removeGrade(db, admin, {
            studentId: student.id,
            surahNumber: 1,
          })
        else
          await setGrade(db, teacher, {
            studentId: student.id,
            surahNumber: 1,
            grade: 'good',
          })
        expect((await saved(db)).readyAt).toBeNull()
        expect((await saved(db)).status).toBe(
          kind === 'review' ? 'cancelled' : 'closed',
        )
      }))
    it('preserves readiness on deadline edits', () =>
      run(async (db) => {
        await create(db)
        await setAssignmentReadiness(db, student, input)
        const marked = await saved(db)
        await rescheduleAssignment(db, teacher, kind, {
          assignmentId,
          dueAt: null,
          expectedDueAt: marked.dueAt!.getTime(),
        })
        expect((await saved(db)).readyAt).toEqual(marked.readyAt)
      }))
    it('serializes concurrent marking and assessment with no terminal readiness', () =>
      run(async (db) => {
        await create(db)
        const results = await Promise.allSettled([
          run((connection) =>
            setAssignmentReadiness(connection, student, input),
          ),
          run((connection) => finish(connection)),
        ])
        expect(results[1].status).toBe('fulfilled')
        expect(await saved(db)).toMatchObject({
          status: 'closed',
          readyAt: null,
        })
      }))
    it('enforces open-only readiness in PostgreSQL', () =>
      run(async (db) => {
        await create(db)
        await finish(db)
        await expect(
          db
            .update(table)
            .set({ readyAt: new Date() })
            .where(eq(table.id, assignmentId)),
        ).rejects.toThrow()
      }))
  })
}
it('validates explicit readiness and assignment kind without accepting client identity', () => {
  const base = { kind: 'review', assignmentId: 'task', ready: false }
  expect(
    assignmentReadinessInput.parse({ ...base, studentId: 'other' }),
  ).toEqual(base)
  for (const change of [
    { ready: undefined },
    { ready: 'true' },
    { assignmentId: '' },
    { kind: 'all' },
  ])
    expect(
      assignmentReadinessInput.safeParse({ ...base, ...change }).success,
    ).toBe(false)
})
it('filters ready work across kinds and pages, composing with names and deadlines', () =>
  run(async (db) => {
    const today = new Date('2026-11-08T01:00:00Z')
    for (let i = 1; i <= 25; i++)
      for (const [kind, table] of [
        ['review', reviews],
        ['memorization', memorizationAssignments],
      ] as const) {
        await db.insert(table).values({
          id: `${kind}-${i.toString().padStart(2, '0')}`,
          studentId: student.id,
          surahNumber: i,
          assignedAt: today,
          dueAt: i === 25 ? null : new Date('2026-11-07T00:00:00Z'),
          readyAt: i <= 23 ? today : null,
        })
      }
    let cursor: WorkCursor | null = null
    const found: Array<string> = []
    do {
      const page = await listWorkQueue(
        db,
        teacher,
        {
          readiness: 'ready',
          q: student.username,
          deadline: 'overdue',
          cursor,
        },
        today,
      )
      expect(page.rows.every((row) => row.readyAt === today.getTime())).toBe(
        true,
      )
      found.push(...page.rows.map((row) => `${row.kind}-${row.id}`))
      cursor = page.nextCursor
      if (found.length > 46) throw new Error('Repeated cursor')
    } while (cursor)
    expect(found).toHaveLength(46)
    expect(new Set(found).size).toBe(46)
    for (const kind of ['review', 'memorization']) {
      expect(
        (
          await listWorkQueue(
            db,
            teacher,
            { readiness: 'not-ready', kind, deadline: 'all' },
            today,
          )
        ).rows.map((row) => row.surahNumber),
      ).toEqual([24, 25])
      expect(
        (
          await listWorkQueue(
            db,
            teacher,
            { readiness: 'ready', kind, deadline: 'undated' },
            today,
          )
        ).rows,
      ).toEqual([])
    }
    expect(
      (
        await listWorkQueue(
          db,
          teacher,
          { readiness: 'ready', q: other.username, deadline: 'all' },
          today,
        )
      ).rows,
    ).toEqual([])
  }))
