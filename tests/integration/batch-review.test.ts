import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { eq, sql } from 'drizzle-orm'
import { withDatabase } from '../../src/server/db.server'
import { user } from '../../src/server/db/schema/auth'
import { grades, reviews } from '../../src/server/db/schema/app'
import { serializeUser } from '../../src/server/accounts'
import {
  assignReview,
  assignReviews,
  finishReview,
} from '../../src/server/services/reviews.server'
import { removeGrade } from '../../src/server/services/grades.server'
import { batchReviewInput } from '../../src/server/functions/validation'
import type { Actor } from '../../src/server/auth-guards.server'
import type { Database } from '../../src/server/db.server'

const url =
  process.env.TEST_DATABASE_URL ??
  'postgresql://quran_dev:quran_local@127.0.0.1:55432/quran_test'
if (!new URL(url).pathname.endsWith('_test'))
  throw new Error('Batch review tests require an isolated _test database.')
const run = <T>(fn: (db: Database) => Promise<T>) => withDatabase(url, fn)
const dueAt = Date.UTC(2026, 10, 20)
let teacher: Actor, admin: Actor, student: Actor
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
          username: id,
          email: `${id}@example.com`,
          role: id === 'other' ? 'student' : id,
        })),
      )
      .returning()
    const actors = Object.fromEntries(
      rows.map((row) => [row.id, serializeUser(row)]),
    )
    teacher = actors.teacher
    admin = actors.admin
    student = actors.student
    await db
      .insert(grades)
      .values(
        [1, 2, 3].map((surahNumber) => ({
          id: `grade-${surahNumber}`,
          studentId: student.id,
          surahNumber,
          grade: 'good' as const,
          updatedAt: new Date(),
        })),
      )
  }),
)

describe('batch review assignment', () => {
  it('assigns multiple recorded surahs with one date and actor without changing grades', () =>
    run(async (db) => {
      const result = await assignReviews(db, teacher, {
        studentId: student.id,
        surahNumbers: [3, 1, 2],
        dueAt,
      })
      expect(result).toEqual({
        assignedSurahNumbers: [1, 2, 3],
        skippedSurahNumbers: [],
      })
      const rows = await db.select().from(reviews)
      expect(rows).toHaveLength(3)
      expect(
        rows.every(
          (row) =>
            row.dueAt?.getTime() === dueAt &&
            row.assignedBy === teacher.id &&
            row.status === 'open',
        ),
      ).toBe(true)
      expect(new Set(rows.map((row) => row.assignedAt.getTime())).size).toBe(1)
      expect(
        (await db.select().from(grades)).every((row) => row.grade === 'good'),
      ).toBe(true)
    }))
  it('skips already-open reviews, preserves their date and is safe to retry', () =>
    run(async (db) => {
      await assignReview(db, teacher, {
        studentId: student.id,
        surahNumber: 1,
        dueAt: dueAt - 86400000,
      })
      const result = await assignReviews(db, admin, {
        studentId: student.id,
        surahNumbers: [1, 2, 3],
        dueAt,
      })
      expect(result).toEqual({
        assignedSurahNumbers: [2, 3],
        skippedSurahNumbers: [1],
      })
      const retry = await assignReviews(db, admin, {
        studentId: student.id,
        surahNumbers: [1, 2, 3],
        dueAt,
      })
      expect(retry).toEqual({
        assignedSurahNumbers: [],
        skippedSurahNumbers: [1, 2, 3],
      })
      const rows = await db.select().from(reviews)
      expect(rows).toHaveLength(3)
      expect(rows.find((row) => row.surahNumber === 1)).toMatchObject({
        assignedBy: teacher.id,
        dueAt: new Date(dueAt - 86400000),
      })
    }))
  it('rejects the whole batch if any selected surah is not recorded for this student', () =>
    run(async (db) => {
      await db
        .insert(grades)
        .values({
          id: 'other-grade',
          studentId: 'other',
          surahNumber: 4,
          grade: 'good',
          updatedAt: new Date(),
        })
      await expect(
        assignReviews(db, teacher, {
          studentId: student.id,
          surahNumbers: [1, 4],
        }),
      ).rejects.toThrow('لم تُضف أي مراجعات.')
      expect(await db.select().from(reviews)).toHaveLength(0)
    }))
  it('permits a new review after a completed one and supports no deadline', () =>
    run(async (db) => {
      await assignReview(db, teacher, { studentId: student.id, surahNumber: 1 })
      const [previous] = await db.select().from(reviews)
      await finishReview(db, teacher, { assignmentId: previous.id })
      const result = await assignReviews(db, teacher, {
        studentId: student.id,
        surahNumbers: [1, 2],
      })
      expect(result.assignedSurahNumbers).toEqual([1, 2])
      const rows = await db.select().from(reviews)
      expect(rows.filter((row) => row.status === 'closed')).toHaveLength(1)
      expect(
        rows.filter((row) => row.status === 'open' && row.dueAt === null),
      ).toHaveLength(2)
    }))
  it('denies anonymous users and students before accessing the database', async () => {
    await expect(
      assignReviews({} as Database, null, {
        studentId: student.id,
        surahNumbers: [1],
      }),
    ).rejects.toThrow('يلزم تسجيل الدخول.')
    await expect(
      assignReviews({} as Database, student, {
        studentId: student.id,
        surahNumbers: [1],
      }),
    ).rejects.toThrow('غير مصرح لك بهذه العملية.')
  })
  it('rejects disabled and non-student targets without adding assignments', () =>
    run(async (db) => {
      await db.update(user).set({ banned: true }).where(eq(user.id, student.id))
      for (const studentId of [student.id, teacher.id, 'missing']) {
        await expect(
          assignReviews(db, teacher, { studentId, surahNumbers: [1] }),
        ).rejects.toThrow('لم يتم العثور على طالب نشط.')
      }
      expect(await db.select().from(reviews)).toHaveLength(0)
    }))
  it('serializes overlapping batches and creates exactly one open review per surah', async () => {
    const results = await Promise.all([
      run((db) =>
        assignReviews(db, teacher, {
          studentId: student.id,
          surahNumbers: [1, 2],
          dueAt,
        }),
      ),
      run((db) =>
        assignReviews(db, admin, {
          studentId: student.id,
          surahNumbers: [2, 3],
          dueAt,
        }),
      ),
    ])
    expect(
      results.flatMap((result) => result.assignedSurahNumbers).sort(),
    ).toEqual([1, 2, 3])
    expect(results.flatMap((result) => result.skippedSurahNumbers)).toEqual([2])
    expect(await run((db) => db.select().from(reviews))).toHaveLength(3)
  })
  it('preserves the grade-removal lock order under concurrent assignment', async () => {
    const [batch, removal] = await Promise.allSettled([
      run((db) =>
        assignReviews(db, teacher, {
          studentId: student.id,
          surahNumbers: [1, 2],
        }),
      ),
      run((db) =>
        removeGrade(db, admin, { studentId: student.id, surahNumber: 2 }),
      ),
    ])
    expect(removal.status).toBe('fulfilled')
    const rows = await run((db) => db.select().from(reviews))
    expect(
      rows.some((row) => row.surahNumber === 2 && row.status === 'open'),
    ).toBe(false)
    expect(rows.filter((row) => row.status === 'open')).toHaveLength(
      batch.status === 'fulfilled' ? 1 : 0,
    )
  })
  it('validates bounds, unique selections and calendar-date deadlines before writing', () =>
    run(async (db) => {
      for (const extra of [
        { surahNumbers: [] },
        { surahNumbers: [1, 1] },
        { surahNumbers: [0] },
        { surahNumbers: [115] },
        { surahNumbers: [1.5] },
        { surahNumbers: Array(115).fill(1) },
        { surahNumbers: [1], dueAt: dueAt + 1 },
        { surahNumbers: [1], dueAt: -1 },
        { surahNumbers: [1], dueAt: 9e15 },
      ]) {
        const input = { studentId: student.id, ...extra }
        expect(batchReviewInput.safeParse(input).success).toBe(false)
        await expect(assignReviews(db, teacher, input)).rejects.toThrow()
      }
      expect(await db.select().from(reviews)).toHaveLength(0)
    }))
})
