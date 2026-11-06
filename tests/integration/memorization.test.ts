import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { eq, sql } from 'drizzle-orm'
import { withDatabase } from '../../src/server/db.server'
import { user } from '../../src/server/db/schema/auth'
import {
  gradeHistory,
  grades,
  memorizationAssignments,
} from '../../src/server/db/schema/app'
import { serializeUser } from '../../src/server/accounts'
import { removeGrade, setGrade } from '../../src/server/services/grades.server'
import {
  assignMemorization,
  finishMemorization,
  listMemorization,
} from '../../src/server/services/memorization.server'
import {
  assessMemorizationInput,
  memorizationInput,
} from '../../src/server/functions/validation'
import type { Database } from '../../src/server/db.server'
import type { Actor } from '../../src/server/auth-guards.server'

const url =
  process.env.TEST_DATABASE_URL ??
  'postgresql://quran_dev:quran_local@127.0.0.1:55432/quran_test'
if (!new URL(url).pathname.endsWith('_test'))
  throw new Error('Memorization tests require an isolated _test database.')
const run = <T>(fn: (db: Database) => Promise<T>) => withDatabase(url, fn)
let teacher: Actor, admin: Actor, student: Actor, other: Actor
const input = { studentId: 'student', surahNumber: 1 }
const dueAt = Date.UTC(2026, 11, 6)
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

describe('new memorization assignments', () => {
  it('assigns an unrecorded surah without inventing a grade or progress', () =>
    run(async (db) => {
      await assignMemorization(db, teacher, { ...input, dueAt })
      const [row] = await listMemorization(db, student, student.id)
      expect(row).toMatchObject({ surahNumber: 1, dueAt })
      expect(
        (await db.select().from(memorizationAssignments))[0],
      ).toMatchObject({
        assignedBy: teacher.id,
        status: 'open',
        closingGrade: null,
      })
      expect(await db.select().from(grades)).toHaveLength(0)
      expect(await db.select().from(gradeHistory)).toHaveLength(0)
    }))
  it('requires staff to write and permits only self or staff to read', () =>
    run(async (db) => {
      await assignMemorization(db, admin, input)
      await assignMemorization(db, teacher, {
        ...input,
        studentId: other.id,
        surahNumber: 114,
      })
      for (const actor of [student, teacher, admin])
        expect(
          (await listMemorization(db, actor, student.id)).map(
            (r) => r.surahNumber,
          ),
        ).toEqual([1])
      await expect(
        listMemorization({} as Database, null, student.id),
      ).rejects.toThrow('يلزم تسجيل الدخول.')
      await expect(
        listMemorization({} as Database, other, student.id),
      ).rejects.toThrow('غير مصرح لك بهذه العملية.')
      await expect(
        assignMemorization({} as Database, student, input),
      ).rejects.toThrow()
      await expect(
        finishMemorization({} as Database, student, {
          assignmentId: 'x',
          grade: 'good',
        }),
      ).rejects.toThrow()
      await expect(
        finishMemorization({} as Database, null, { assignmentId: 'x' }),
      ).rejects.toThrow()
    }))
  it('rejects recorded surahs, open duplicates and inactive/non-student targets', () =>
    run(async (db) => {
      await setGrade(db, teacher, { ...input, grade: 'forgotten' })
      await expect(assignMemorization(db, teacher, input)).rejects.toThrow(
        'مسجّلة',
      )
      await assignMemorization(db, teacher, { ...input, surahNumber: 2 })
      await expect(
        assignMemorization(db, admin, { ...input, surahNumber: 2 }),
      ).rejects.toThrow('مفتوح')
      await expect(
        assignMemorization(db, teacher, { ...input, studentId: teacher.id }),
      ).rejects.toThrow()
      await expect(
        assignMemorization(db, teacher, { ...input, studentId: 'missing' }),
      ).rejects.toThrow()
      await db.update(user).set({ banned: true }).where(eq(user.id, other.id))
      await expect(
        assignMemorization(db, teacher, { ...input, studentId: other.id }),
      ).rejects.toThrow()
      expect(await db.select().from(memorizationAssignments)).toHaveLength(1)
    }))
  it('assesses atomically with a grade/history and rejects repeated closure', () =>
    run(async (db) => {
      await assignMemorization(db, teacher, { ...input, dueAt })
      const [row] = await listMemorization(db, student, student.id)
      await finishMemorization(db, admin, {
        assignmentId: row._id,
        grade: 'medium',
      })
      expect(await listMemorization(db, student, student.id)).toHaveLength(0)
      expect((await db.select().from(grades))[0]).toMatchObject({
        studentId: student.id,
        surahNumber: 1,
        grade: 'medium',
        updatedBy: admin.id,
      })
      expect((await db.select().from(gradeHistory))[0]).toMatchObject({
        previousGrade: null,
        newGrade: 'medium',
        actorId: admin.id,
      })
      const [closed] = await db.select().from(memorizationAssignments)
      expect(closed).toMatchObject({
        status: 'closed',
        closingGrade: 'medium',
        closedBy: admin.id,
      })
      expect(closed.closedAt).toBeInstanceOf(Date)
      await expect(
        finishMemorization(db, teacher, {
          assignmentId: row._id,
          grade: 'good',
        }),
      ).rejects.toThrow()
      expect(await db.select().from(gradeHistory)).toHaveLength(1)
    }))
  it('cancels without grades/history, permits reassigning and does not rewrite saved assessment', () =>
    run(async (db) => {
      await assignMemorization(db, teacher, input)
      const [first] = await listMemorization(db, student, student.id)
      await finishMemorization(db, teacher, { assignmentId: first._id })
      expect(await db.select().from(grades)).toHaveLength(0)
      expect(await db.select().from(gradeHistory)).toHaveLength(0)
      await assignMemorization(db, teacher, input)
      const [next] = await listMemorization(db, student, student.id)
      await finishMemorization(db, teacher, {
        assignmentId: next._id,
        grade: 'good',
      })
      await setGrade(db, teacher, { ...input, grade: 'medium' })
      await removeGrade(db, admin, input)
      expect(
        (
          await db
            .select()
            .from(memorizationAssignments)
            .where(eq(memorizationAssignments.id, next._id))
        )[0].closingGrade,
      ).toBe('good')
    }))
  it('recording a grade directly completes open work without leaving a stale assignment', () =>
    run(async (db) => {
      await assignMemorization(db, teacher, input)
      await setGrade(db, admin, { ...input, grade: 'forgotten' })
      expect(await listMemorization(db, student, student.id)).toHaveLength(0)
      expect(
        (await db.select().from(memorizationAssignments))[0],
      ).toMatchObject({
        status: 'closed',
        closingGrade: 'forgotten',
        closedBy: admin.id,
      })
      expect(await db.select().from(gradeHistory)).toHaveLength(1)
    }))
  it('rolls back assessment and direct grading when history cannot be written', () =>
    run(async (db) => {
      await assignMemorization(db, teacher, input)
      const [row] = await listMemorization(db, student, student.id)
      await db.execute(
        sql`create function pg_temp.reject_mem_history() returns trigger language plpgsql as $$ begin raise exception 'history fixture failure'; end $$`,
      )
      await db.execute(
        sql`create trigger reject_mem_history before insert on student_grade_history for each row execute function pg_temp.reject_mem_history()`,
      )
      try {
        await expect(
          finishMemorization(db, teacher, {
            assignmentId: row._id,
            grade: 'good',
          }),
        ).rejects.toThrow()
        await expect(
          setGrade(db, teacher, { ...input, grade: 'medium' }),
        ).rejects.toThrow()
        expect(await db.select().from(grades)).toHaveLength(0)
        expect(await db.select().from(gradeHistory)).toHaveLength(0)
        expect(
          (await db.select().from(memorizationAssignments))[0].status,
        ).toBe('open')
      } finally {
        await db.execute(
          sql`drop trigger reject_mem_history on student_grade_history`,
        )
      }
    }))
  it('serializes duplicate assignment and competing assessment requests', async () => {
    const created = await Promise.allSettled([
      run((db) => assignMemorization(db, teacher, input)),
      run((db) => assignMemorization(db, admin, input)),
    ])
    expect(created.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const row = await run(
      async (db) => (await listMemorization(db, student, student.id))[0],
    )
    const results = await Promise.allSettled([
      run((db) =>
        finishMemorization(db, teacher, {
          assignmentId: row._id,
          grade: 'good',
        }),
      ),
      run((db) =>
        finishMemorization(db, admin, {
          assignmentId: row._id,
          grade: 'medium',
        }),
      ),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    await run(async (db) => {
      expect(await db.select().from(gradeHistory)).toHaveLength(1)
      const [closed] = await db.select().from(memorizationAssignments)
      expect((await db.select().from(grades))[0].grade).toBe(
        closed.closingGrade,
      )
    })
  })
  it('keeps assignment and direct first-grade recording consistent when they race', async () => {
    await Promise.allSettled([
      run((db) => assignMemorization(db, teacher, input)),
      run((db) => setGrade(db, admin, { ...input, grade: 'good' })),
    ])
    await run(async (db) => {
      expect((await db.select().from(grades))[0].grade).toBe('good')
      expect(await listMemorization(db, student, student.id)).toHaveLength(0)
      expect(await db.select().from(gradeHistory)).toHaveLength(1)
      expect(
        (await db.select().from(memorizationAssignments)).every(
          (row) => row.status === 'closed' && row.closingGrade === 'good',
        ),
      ).toBe(true)
    })
  })
  it('allows only one winner when assessment and cancellation race', async () => {
    await run((db) => assignMemorization(db, teacher, input))
    const [row] = await run((db) => listMemorization(db, student, student.id))
    const result = await Promise.allSettled([
      run((db) =>
        finishMemorization(db, teacher, {
          assignmentId: row._id,
          grade: 'good',
        }),
      ),
      run((db) => finishMemorization(db, admin, { assignmentId: row._id })),
    ])
    expect(result.filter((value) => value.status === 'fulfilled')).toHaveLength(
      1,
    )
    await run(async (db) => {
      const [closed] = await db.select().from(memorizationAssignments)
      const expected = closed.status === 'closed' ? 1 : 0
      expect(await db.select().from(grades)).toHaveLength(expected)
      expect(await db.select().from(gradeHistory)).toHaveLength(expected)
      expect(await listMemorization(db, student, student.id)).toHaveLength(0)
    })
  })
  it('refuses assessment for a disabled student but still permits staff cancellation', () =>
    run(async (db) => {
      await assignMemorization(db, teacher, input)
      const [row] = await listMemorization(db, teacher, student.id)
      await db.update(user).set({ banned: true }).where(eq(user.id, student.id))
      await expect(
        finishMemorization(db, teacher, {
          assignmentId: row._id,
          grade: 'good',
        }),
      ).rejects.toThrow('طالب نشط')
      expect(await db.select().from(grades)).toHaveLength(0)
      await finishMemorization(db, teacher, { assignmentId: row._id })
      expect((await db.select().from(memorizationAssignments))[0].status).toBe(
        'cancelled',
      )
    }))
  it('orders open work by deadline, retains nullable authors and cascades student deletion', () =>
    run(async (db) => {
      await assignMemorization(db, teacher, input)
      await assignMemorization(db, teacher, { ...input, surahNumber: 2, dueAt })
      await assignMemorization(db, teacher, {
        ...input,
        surahNumber: 3,
        dueAt: dueAt - 86400000,
      })
      expect(
        (await listMemorization(db, student, student.id)).map(
          (r) => r.surahNumber,
        ),
      ).toEqual([3, 2, 1])
      await db.delete(user).where(eq(user.id, teacher.id))
      expect(
        (await db.select().from(memorizationAssignments))[0].assignedBy,
      ).toBeNull()
      await db.delete(user).where(eq(user.id, student.id))
      expect(await db.select().from(memorizationAssignments)).toHaveLength(0)
    }))
  it('validates surah/date/grade input', () => {
    for (const surahNumber of [0, 115, 1.5])
      expect(
        memorizationInput.safeParse({ ...input, surahNumber }).success,
      ).toBe(false)
    for (const invalidDate of [-1, 1, 8.64e15 + 1])
      expect(
        memorizationInput.safeParse({ ...input, dueAt: invalidDate }).success,
      ).toBe(false)
    expect(memorizationInput.safeParse({ ...input, dueAt }).success).toBe(true)
    for (const grade of [undefined, null, 'excellent'])
      expect(
        assessMemorizationInput.safeParse({ assignmentId: 'x', grade }).success,
      ).toBe(false)
  })
})
