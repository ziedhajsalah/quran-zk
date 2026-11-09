import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import { withDatabase } from '../../src/server/db.server'
import { user } from '../../src/server/db/schema/auth'
import {
  grades,
  memorizationAssignments,
  reviews,
} from '../../src/server/db/schema/app'
import { serializeUser } from '../../src/server/accounts'
import { getTeacherDashboard } from '../../src/server/services/teacher-dashboard.server'
import { finishReview } from '../../src/server/services/reviews.server'
import { finishMemorization } from '../../src/server/services/memorization.server'
import { setGrade } from '../../src/server/services/grades.server'
import type { Actor } from '../../src/server/auth-guards.server'
import type { Database } from '../../src/server/db.server'

const url =
  process.env.TEST_DATABASE_URL ??
  'postgresql://quran_dev:quran_local@127.0.0.1:55432/quran_test'
if (!new URL(url).pathname.endsWith('_test'))
  throw new Error('Tests require an isolated _test database.')
const run = <T>(fn: (db: Database) => Promise<T>) => withDatabase(url, fn)
const today = Date.UTC(2026, 10, 6)
const now = new Date(today + 15 * 3600000)
let teacher: Actor
async function addUser(
  db: Database,
  id: string,
  role = 'student',
  banned = false,
) {
  const [row] = await db
    .insert(user)
    .values({
      id,
      name: id,
      username: id,
      email: `${id}@example.com`,
      role,
      banned,
    })
    .returning()
  return serializeUser(row)
}
async function grade(
  db: Database,
  studentId: string,
  surahNumber: number,
  value: 'good' | 'medium' | 'forgotten' = 'forgotten',
) {
  await db.insert(grades).values({
    id: `${studentId}-g-${surahNumber}`,
    studentId,
    surahNumber,
    grade: value,
    updatedAt: now,
  })
}
async function review(
  db: Database,
  studentId: string,
  surahNumber: number,
  dueAt: number | null,
  status: 'open' | 'closed' | 'cancelled' = 'open',
) {
  await db.insert(reviews).values({
    id: `${studentId}-r-${surahNumber}`,
    studentId,
    surahNumber,
    assignedAt: new Date(today - 86400000 * 10),
    dueAt: dueAt === null ? null : new Date(dueAt),
    status,
  })
}
beforeAll(() => run((db) => migrate(db, { migrationsFolder: './drizzle' })))
beforeEach(() =>
  run(async (db) => {
    await db.execute(sql`truncate "user" cascade`)
    teacher = await addUser(db, 'teacher', 'teacher')
  }),
)

describe('teacher attention dashboard', () => {
  it('denies anonymous users and students before querying student data', async () => {
    await expect(
      getTeacherDashboard({} as Database, null, now),
    ).rejects.toThrow('يلزم تسجيل الدخول.')
    const student = serializeUser({
      id: 'student',
      name: 'student',
      email: 'student@example.com',
      role: 'student',
    })
    await expect(
      getTeacherDashboard({} as Database, student, now),
    ).rejects.toThrow('غير مصرح لك بهذه العملية.')
  })
  it('returns truthful empty counts and allows admins as well as teachers', () =>
    run(async (db) => {
      const admin = await addUser(db, 'admin', 'admin')
      const expected = {
        totalStudents: 0,
        attentionStudents: 0,
        overdueReviews: 0,
        overdueMemorization: 0,
        studentsNeedingReview: 0,
        students: [],
      }
      expect(await getTeacherDashboard(db, teacher, now)).toEqual(expected)
      expect(await getTeacherDashboard(db, admin, now)).toEqual(expected)
    }))
  it('counts reviews and grades separately, excludes today, future, undated and finished reviews', () =>
    run(async (db) => {
      await addUser(db, 'student-a')
      await addUser(db, 'student-b')
      await addUser(db, 'student-c')
      await grade(db, 'student-a', 1)
      await grade(db, 'student-a', 2)
      await grade(db, 'student-b', 1)
      await grade(db, 'student-c', 1, 'medium')
      for (const [surah, due, status] of [
        [1, today - 86400000 * 2, 'open'],
        [2, today - 1, 'open'],
        [3, today, 'open'],
        [4, today + 86400000, 'open'],
        [5, null, 'open'],
        [6, today - 86400000, 'closed'],
        [7, today - 86400000, 'cancelled'],
      ] as const)
        await review(db, 'student-a', surah, due, status)
      const result = await getTeacherDashboard(db, teacher, now)
      expect(result.totalStudents).toBe(3)
      expect(result.attentionStudents).toBe(2)
      expect(result.overdueReviews).toBe(2)
      expect(result.studentsNeedingReview).toBe(2)
      expect(result.students[0]).toMatchObject({
        studentId: 'student-a',
        overdueCount: 2,
        forgottenCount: 2,
        oldestDueAt: today - 86400000 * 2,
      })
      expect(result.students[1]).toMatchObject({
        studentId: 'student-b',
        overdueCount: 0,
        forgottenCount: 1,
        oldestDueAt: null,
      })
    }))
  it('excludes disabled users and non-student roles but includes a mixed-role student', () =>
    run(async (db) => {
      await addUser(db, 'disabled', 'student', true)
      await addUser(db, 'former', 'teacher')
      await addUser(db, 'mixed', 'teacher,student')
      for (const id of ['disabled', 'former', 'mixed']) {
        await grade(db, id, 1)
        await review(db, id, 1, today - 86400000)
      }
      const result = await getTeacherDashboard(db, teacher, now)
      expect(result.totalStudents).toBe(1)
      expect(result.overdueReviews).toBe(1)
      expect(result.students.map((s) => s.studentId)).toEqual(['mixed'])
    }))
  it('bounds the preview but keeps school-wide totals and deterministic priority order', () =>
    run(async (db) => {
      for (let i = 0; i < 25; i++) {
        const id = `student-${String(i).padStart(2, '0')}`
        await addUser(db, id)
        await grade(db, id, 1)
      }
      await grade(db, 'student-24', 2)
      await review(db, 'student-23', 1, today - 86400000 * 3)
      await review(db, 'student-22', 1, today - 86400000)
      const result = await getTeacherDashboard(db, teacher, now)
      expect(result.totalStudents).toBe(25)
      expect(result.attentionStudents).toBe(25)
      expect(result.studentsNeedingReview).toBe(25)
      expect(result.overdueReviews).toBe(2)
      expect(result.students).toHaveLength(20)
      expect(result.students.slice(0, 4).map((s) => s.studentId)).toEqual([
        'student-23',
        'student-22',
        'student-24',
        'student-00',
      ])
    }))
  it('reflects closed reviews and improved grades on the next summary read', () =>
    run(async (db) => {
      await addUser(db, 'student-a')
      await grade(db, 'student-a', 1)
      await review(db, 'student-a', 1, today - 86400000)
      expect(
        (await getTeacherDashboard(db, teacher, now)).attentionStudents,
      ).toBe(1)
      await finishReview(db, teacher, {
        assignmentId: 'student-a-r-1',
        newGrade: 'good',
      })
      const result = await getTeacherDashboard(db, teacher, now)
      expect(result.attentionStudents).toBe(0)
      expect(result.overdueReviews).toBe(0)
      expect(result.studentsNeedingReview).toBe(0)
      expect(result.totalStudents).toBe(1)
      await setGrade(db, teacher, {
        studentId: 'student-a',
        surahNumber: 1,
        grade: 'forgotten',
      })
      expect(
        (await getTeacherDashboard(db, teacher, now)).studentsNeedingReview,
      ).toBe(1)
    }))
})

describe('memorization follow-up', () => {
  async function task(
    db: Database,
    studentId: string,
    surahNumber: number,
    dueAt: number | null,
  ) {
    await db.insert(memorizationAssignments).values({
      id: `${studentId}-m-${surahNumber}`,
      studentId,
      surahNumber,
      assignedAt: now,
      dueAt: dueAt === null ? null : new Date(dueAt),
    })
  }
  it('counts work types independently and uses UTC deadlines across both queues', () =>
    run(async (db) => {
      await addUser(db, 'review-only')
      await addUser(db, 'memorization-only')
      await addUser(db, 'mixed-work')
      await addUser(db, 'not-overdue')
      await review(db, 'review-only', 1, today - 86400000 * 2)
      await task(db, 'memorization-only', 1, today - 86400000 * 3)
      await review(db, 'mixed-work', 1, today - 86400000)
      await review(db, 'mixed-work', 2, today - 1)
      await task(db, 'mixed-work', 3, today - 86400000 * 4)
      await task(db, 'mixed-work', 4, today - 1)
      await grade(db, 'mixed-work', 1)
      await grade(db, 'mixed-work', 2)
      await task(db, 'not-overdue', 1, today)
      await task(db, 'not-overdue', 2, today + 86400000)
      await task(db, 'not-overdue', 3, null)
      // This instant is still the previous calendar day west of UTC.
      const result = await getTeacherDashboard(
        db,
        teacher,
        new Date(today + 3600000),
      )
      expect(result).toMatchObject({
        totalStudents: 4,
        attentionStudents: 3,
        overdueReviews: 3,
        overdueMemorization: 3,
        studentsNeedingReview: 1,
      })
      expect(result.students.map((s) => s.studentId)).toEqual([
        'mixed-work',
        'memorization-only',
        'review-only',
      ])
      expect(result.students[0]).toMatchObject({
        overdueCount: 2,
        overdueMemorizationCount: 2,
        forgottenCount: 2,
        oldestDueAt: today - 86400000 * 4,
      })
      expect(result.students[1]).toMatchObject({
        overdueCount: 0,
        overdueMemorizationCount: 1,
      })
    }))
  it('excludes cancelled, assessed, manually graded and inactive work on the next read', () =>
    run(async (db) => {
      await addUser(db, 'student-a')
      await addUser(db, 'disabled', 'student', true)
      await addUser(db, 'nonstudent', 'teacher')
      for (const id of ['student-a', 'disabled', 'nonstudent'])
        await task(db, id, 1, today - 86400000)
      await task(db, 'student-a', 2, today - 86400000)
      await task(db, 'student-a', 3, today - 86400000)
      expect(await getTeacherDashboard(db, teacher, now)).toMatchObject({
        totalStudents: 1,
        attentionStudents: 1,
        overdueMemorization: 3,
      })
      await finishMemorization(db, teacher, { assignmentId: 'student-a-m-1' })
      expect(
        (await getTeacherDashboard(db, teacher, now)).overdueMemorization,
      ).toBe(2)
      await finishMemorization(db, teacher, {
        assignmentId: 'student-a-m-2',
        grade: 'good',
      })
      expect(
        (await getTeacherDashboard(db, teacher, now)).overdueMemorization,
      ).toBe(1)
      await setGrade(db, teacher, {
        studentId: 'student-a',
        surahNumber: 3,
        grade: 'good',
      })
      expect(await getTeacherDashboard(db, teacher, now)).toMatchObject({
        attentionStudents: 0,
        overdueMemorization: 0,
        students: [],
      })
    }))
  it('caps memorization-only previews without truncating totals and breaks deadline ties deterministically', () =>
    run(async (db) => {
      for (let i = 0; i < 25; i++) {
        const id = `student-${String(i).padStart(2, '0')}`
        await addUser(db, id)
        await task(db, id, 1, today - 86400000)
      }
      await grade(db, 'student-24', 2)
      const result = await getTeacherDashboard(db, teacher, now)
      expect(result).toMatchObject({
        attentionStudents: 25,
        overdueMemorization: 25,
        overdueReviews: 0,
      })
      expect(result.students).toHaveLength(20)
      expect(result.students.slice(0, 3).map((s) => s.studentId)).toEqual([
        'student-24',
        'student-00',
        'student-01',
      ])
    }))
})
