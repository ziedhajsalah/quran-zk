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
import { setGrade } from '../../src/server/services/grades.server'
import {
  assignReview,
  finishReview,
} from '../../src/server/services/reviews.server'
import {
  assignMemorization,
  finishMemorization,
} from '../../src/server/services/memorization.server'
import { rescheduleAssignment } from '../../src/server/services/assignment-deadline.server'
import { assignmentDeadlineInput } from '../../src/server/functions/validation'
import { getTeacherDashboard } from '../../src/server/services/teacher-dashboard.server'
import type { Database } from '../../src/server/db.server'
import type { Actor } from '../../src/server/auth-guards.server'

const url =
  process.env.TEST_DATABASE_URL ??
  'postgresql://quran_dev:quran_local@127.0.0.1:55432/quran_test'
if (!new URL(url).pathname.endsWith('_test'))
  throw new Error('Memorization tests require an isolated _test database.')
const run = <T>(fn: (db: Database) => Promise<T>) => withDatabase(url, fn)
let teacher: Actor, admin: Actor, student: Actor, other: Actor
const today = Date.UTC(2026, 10, 7)
const dueAt = today + 86400000
beforeAll(() => run((db) => migrate(db, { migrationsFolder: './drizzle' })))
beforeEach(() =>
  run(async (db) => {
    await db.execute(sql`truncate "user" cascade`)
    const rows = await db
      .insert(user)
      .values(
        ['teacher', 'admin', 'student', 'other'].map((id) => ({
          id,
          name: id,
          email: `${id}@example.com`,
          username: id,
          role: id === 'other' ? 'student' : id,
        })),
      )
      .returning()
    const actors = Object.fromEntries(rows.map((r) => [r.id, serializeUser(r)]))
    teacher = actors.teacher
    admin = actors.admin
    student = actors.student
    other = actors.other
  }),
)

for (const kind of ['review', 'memorization'] as const) {
  const table = kind === 'review' ? reviews : memorizationAssignments
  async function create(db: Database, deadline?: number) {
    if (kind === 'review') {
      await setGrade(db, teacher, {
        studentId: student.id,
        surahNumber: 1,
        grade: 'good',
      })
      await assignReview(db, teacher, {
        studentId: student.id,
        surahNumber: 1,
        dueAt: deadline,
      })
    } else
      await assignMemorization(db, teacher, {
        studentId: student.id,
        surahNumber: 1,
        dueAt: deadline,
      })
    return (await db.select().from(table))[0]
  }
  const finish = (db: Database, id: string) =>
    kind === 'review'
      ? finishReview(db, teacher, { assignmentId: id })
      : finishMemorization(db, teacher, { assignmentId: id, grade: 'medium' })
  describe(`${kind} deadlines`, () => {
    it('allows staff add/change/clear without replacing work or changing grades/history', () =>
      run(async (db) => {
        const original = await create(db)
        const originalGrades = await db.select().from(grades)
        const originalHistory = await db.select().from(gradeHistory)
        let expectedDueAt: number | null = null
        for (const [actor, next] of [
          [teacher, dueAt],
          [admin, today - 86400000],
          [teacher, null],
        ] as const) {
          await rescheduleAssignment(db, actor, kind, {
            assignmentId: original.id,
            dueAt: next,
            expectedDueAt,
          })
          const updated = (await db.select().from(table))[0]
          expect(updated.dueAt?.getTime() ?? null).toBe(next)
          expect({ ...updated, dueAt: original.dueAt }).toEqual(original)
          expectedDueAt = next
        }
        expect(await db.select().from(grades)).toEqual(originalGrades)
        expect(await db.select().from(gradeHistory)).toEqual(originalHistory)
      }))
    it('rejects anonymous users, students and other students before accessing assignments', async () => {
      for (const actor of [null, student, other])
        await expect(
          rescheduleAssignment({} as Database, actor, kind, {
            assignmentId: 'private',
            dueAt,
            expectedDueAt: null,
          }),
        ).rejects.toThrow()
    })
    it('rejects stale deadlines, inactive students, and missing assignments', () =>
      run(async (db) => {
        const row = await create(db, dueAt)
        await expect(
          rescheduleAssignment(db, teacher, kind, {
            assignmentId: row.id,
            dueAt: null,
            expectedDueAt: null,
          }),
        ).rejects.toThrow('تغيّر موعد')
        await db
          .update(user)
          .set({ banned: true })
          .where(eq(user.id, student.id))
        await expect(
          rescheduleAssignment(db, teacher, kind, {
            assignmentId: row.id,
            dueAt: null,
            expectedDueAt: dueAt,
          }),
        ).rejects.toThrow('طالب نشط')
        await expect(
          rescheduleAssignment(db, teacher, kind, {
            assignmentId: 'missing',
            dueAt: null,
            expectedDueAt: null,
          }),
        ).rejects.toThrow('لم يعد مفتوحاً')
        expect((await db.select().from(table))[0].dueAt?.getTime()).toBe(dueAt)
      }))
    it('rejects completed and cancelled work without rewriting saved deadlines', () =>
      run(async (db) => {
        const row = await create(db, dueAt)
        await finish(db, row.id)
        await expect(
          rescheduleAssignment(db, admin, kind, {
            assignmentId: row.id,
            dueAt: null,
            expectedDueAt: dueAt,
          }),
        ).rejects.toThrow('لم يعد مفتوحاً')
        const cancelledId = 'cancelled-task'
        await db.insert(table).values({
          id: cancelledId,
          studentId: student.id,
          surahNumber: 2,
          assignedAt: new Date(today),
          dueAt: new Date(dueAt),
          status: 'cancelled',
          closedAt: new Date(today),
        })
        await expect(
          rescheduleAssignment(db, teacher, kind, {
            assignmentId: cancelledId,
            dueAt: null,
            expectedDueAt: dueAt,
          }),
        ).rejects.toThrow('لم يعد مفتوحاً')
        expect(
          (
            await db.select().from(table).where(eq(table.id, row.id))
          )[0].dueAt?.getTime(),
        ).toBe(dueAt)
      }))
    it('updates overdue follow-up counts when changing or clearing deadlines', () =>
      run(async (db) => {
        const row = await create(db, dueAt)
        const field =
          kind === 'review' ? 'overdueReviews' : 'overdueMemorization'
        const summary = () =>
          getTeacherDashboard(db, teacher, new Date(today + 3600000))
        expect((await summary())[field]).toBe(0)
        await rescheduleAssignment(db, teacher, kind, {
          assignmentId: row.id,
          dueAt: today - 86400000,
          expectedDueAt: dueAt,
        })
        expect(await summary()).toMatchObject({
          [field]: 1,
          attentionStudents: 1,
        })
        await rescheduleAssignment(db, teacher, kind, {
          assignmentId: row.id,
          dueAt: null,
          expectedDueAt: today - 86400000,
        })
        expect(await summary()).toMatchObject({
          [field]: 0,
          attentionStudents: 0,
        })
      }))
    it('serializes competing deadline changes and concurrent completion', () =>
      run(async (db) => {
        const row = await create(db, dueAt)
        const changes = await Promise.allSettled(
          [today, today - 86400000].map((next) =>
            run((connection) =>
              rescheduleAssignment(connection, teacher, kind, {
                assignmentId: row.id,
                dueAt: next,
                expectedDueAt: dueAt,
              }),
            ),
          ),
        )
        expect(
          changes.filter((result) => result.status === 'fulfilled'),
        ).toHaveLength(1)
        const previous = (await db.select().from(table))[0].dueAt!.getTime()
        const [change, close] = await Promise.allSettled([
          run((connection) =>
            rescheduleAssignment(connection, teacher, kind, {
              assignmentId: row.id,
              dueAt: null,
              expectedDueAt: previous,
            }),
          ),
          run((connection) => finish(connection, row.id)),
        ])
        expect(close.status).toBe('fulfilled')
        const saved = (await db.select().from(table))[0]
        expect(saved.status).toBe('closed')
        expect(saved.dueAt?.getTime() ?? null).toBe(
          change.status === 'fulfilled' ? null : previous,
        )
      }))
  })
}
it('requires an explicit UTC calendar deadline or null and an original snapshot', () => {
  const base = { assignmentId: 'assignment', dueAt, expectedDueAt: null }
  expect(assignmentDeadlineInput.parse(base)).toEqual(base)
  expect(
    assignmentDeadlineInput.safeParse({ ...base, dueAt: null }).success,
  ).toBe(true)
  for (const extra of [
    { dueAt: 1 },
    { dueAt: -1 },
    { dueAt: 9e15 },
    { dueAt: undefined },
    { expectedDueAt: undefined },
    { expectedDueAt: -1 },
    { assignmentId: '' },
  ])
    expect(
      assignmentDeadlineInput.safeParse({ ...base, ...extra }).success,
    ).toBe(false)
})
it('permits correcting a legacy review time-of-day using its exact snapshot', () =>
  run(async (db) => {
    await setGrade(db, teacher, {
      studentId: student.id,
      surahNumber: 1,
      grade: 'good',
    })
    await assignReview(db, teacher, {
      studentId: student.id,
      surahNumber: 1,
      dueAt: today + 43200000,
    })
    const row = (await db.select().from(reviews))[0]
    await rescheduleAssignment(db, teacher, 'review', {
      assignmentId: row.id,
      expectedDueAt: today + 43200000,
      dueAt,
    })
    expect((await db.select().from(reviews))[0].dueAt?.getTime()).toBe(dueAt)
  }))
