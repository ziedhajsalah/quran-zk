import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { eq, sql } from 'drizzle-orm'
import { withDatabase } from '../../src/server/db.server'
import { user } from '../../src/server/db/schema/auth'
import { gradeHistory, grades, reviews } from '../../src/server/db/schema/app'
import { serializeUser } from '../../src/server/accounts'
import { listGradeHistory } from '../../src/server/services/grade-history.server'
import { removeGrade, setGrade } from '../../src/server/services/grades.server'
import {
  assignReview,
  finishReview,
} from '../../src/server/services/reviews.server'
import { gradeHistoryInput } from '../../src/server/functions/validation'
import type { Actor } from '../../src/server/auth-guards.server'
import type { Database } from '../../src/server/db.server'

const url =
  process.env.TEST_DATABASE_URL ??
  'postgresql://quran_dev:quran_local@127.0.0.1:55432/quran_test'
if (!new URL(url).pathname.endsWith('_test'))
  throw new Error('Grade history requires an isolated _test database.')
const run = <T>(fn: (db: Database) => Promise<T>) => withDatabase(url, fn)
let teacher: Actor, admin: Actor, student: Actor, other: Actor
const input = { studentId: 'student', surahNumber: 1 }
beforeAll(() => run((db) => migrate(db, { migrationsFolder: './drizzle' })))
beforeEach(() =>
  run(async (db) => {
    await db.execute(sql`truncate "user" cascade`)
    const actors = await db
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
    const byId = Object.fromEntries(
      actors.map((row) => [row.id, serializeUser(row)]),
    )
    teacher = byId.teacher
    admin = byId.admin
    student = byId.student
    other = byId.other
  }),
)

describe('recorded grade transitions', () => {
  it('records additions, edits and removals once, including the author and timestamp', () =>
    run(async (db) => {
      await setGrade(db, teacher, { ...input, grade: 'medium' })
      await setGrade(db, teacher, { ...input, grade: 'medium' })
      await setGrade(db, admin, { ...input, grade: 'good' })
      await removeGrade(db, admin, input)
      await removeGrade(db, admin, input)
      await setGrade(db, teacher, { ...input, grade: 'forgotten' })
      const page = await listGradeHistory(db, student, input)
      expect(
        page.rows.map((r) => [r.previousGrade, r.newGrade, r.actorDisplayName]),
      ).toEqual([
        [null, 'forgotten', 'teacher'],
        ['good', null, 'admin'],
        ['medium', 'good', 'admin'],
        [null, 'medium', 'teacher'],
      ])
      expect(
        page.rows.every((row) => row.changedAt > 0 && row.source === 'grade'),
      ).toBe(true)
      expect(page.nextCursor).toBeNull()
      const [current] = await db.select().from(grades)
      expect(current.grade).toBe('forgotten')
    }))
  it('does not backfill existing grades or claim an unchanged grade was changed', () =>
    run(async (db) => {
      await db.insert(grades).values({
        id: 'legacy',
        ...input,
        grade: 'good',
        updatedAt: new Date(),
      })
      expect((await listGradeHistory(db, student, input)).rows).toEqual([])
      await setGrade(db, teacher, { ...input, grade: 'good' })
      expect((await listGradeHistory(db, student, input)).rows).toEqual([])
      await setGrade(db, teacher, { ...input, grade: 'medium' })
      expect(
        (await listGradeHistory(db, student, input)).rows[0],
      ).toMatchObject({ previousGrade: 'good', newGrade: 'medium' })
    }))
  it('records review changes, but not unchanged, cancelled, repeated or grade-free closures', () =>
    run(async (db) => {
      await setGrade(db, teacher, { ...input, grade: 'forgotten' })
      for (const mode of ['change', 'same', 'keep', 'cancel'] as const) {
        await assignReview(db, teacher, input)
        const [assignment] = await db
          .select()
          .from(reviews)
          .where(eq(reviews.status, 'open'))
        const close = {
          assignmentId: assignment.id,
          ...(mode === 'keep' || mode === 'cancel'
            ? {}
            : { newGrade: 'good' as const }),
        }
        await finishReview(db, teacher, close, mode === 'cancel')
        await expect(finishReview(db, teacher, close)).rejects.toThrow()
      }
      const page = await listGradeHistory(db, student, input)
      expect(page.rows).toHaveLength(2)
      expect(page.rows[0]).toMatchObject({
        previousGrade: 'forgotten',
        newGrade: 'good',
        source: 'review',
        actorDisplayName: 'teacher',
      })
      await assignReview(db, teacher, input)
      await removeGrade(db, admin, input)
      expect((await listGradeHistory(db, student, input)).rows).toHaveLength(3)
      expect(
        (await db.select().from(reviews)).filter((r) => r.status === 'open'),
      ).toHaveLength(0)
    }))
  it('rolls back grade changes and review closure if history cannot be written', () =>
    run(async (db) => {
      await setGrade(db, teacher, { ...input, grade: 'forgotten' })
      await assignReview(db, teacher, input)
      const [assignment] = await db.select().from(reviews)
      await db.execute(
        sql`create function pg_temp.reject_history() returns trigger language plpgsql as $$ begin raise exception 'history fixture failure'; end $$`,
      )
      await db.execute(
        sql`create trigger reject_history before insert on student_grade_history for each row execute function pg_temp.reject_history()`,
      )
      try {
        await expect(
          setGrade(db, teacher, { ...input, grade: 'good' }),
        ).rejects.toThrow()
        await expect(
          finishReview(db, teacher, {
            assignmentId: assignment.id,
            newGrade: 'good',
          }),
        ).rejects.toThrow()
        await expect(removeGrade(db, admin, input)).rejects.toThrow()
        expect((await db.select().from(grades))[0].grade).toBe('forgotten')
        expect((await db.select().from(reviews))[0].status).toBe('open')
        expect(await db.select().from(gradeHistory)).toHaveLength(1)
      } finally {
        await db.execute(
          sql`drop trigger reject_history on student_grade_history`,
        )
      }
    }))
  it('serializes overlapping writes so every previous grade matches the prior event', async () => {
    await run((db) => setGrade(db, teacher, { ...input, grade: 'forgotten' }))
    await Promise.all([
      run((db) => setGrade(db, teacher, { ...input, grade: 'good' })),
      run((db) => setGrade(db, admin, { ...input, grade: 'medium' })),
    ])
    await run(async (db) => {
      const rows = (await listGradeHistory(db, student, input)).rows.reverse()
      expect(rows).toHaveLength(3)
      expect(rows[0].previousGrade).toBeNull()
      for (let i = 1; i < rows.length; i++)
        expect(rows[i].previousGrade).toBe(rows[i - 1].newGrade)
      expect((await db.select().from(grades))[0].grade).toBe(
        rows.at(-1)?.newGrade,
      )
    })
  })
  it('retains transitions after author deletion and cascades them on student deletion', () =>
    run(async (db) => {
      await setGrade(db, teacher, { ...input, grade: 'good' })
      await db.delete(user).where(eq(user.id, teacher.id))
      expect(
        (await listGradeHistory(db, student, input)).rows[0],
      ).toMatchObject({ actorDisplayName: null, newGrade: 'good' })
      await db.delete(user).where(eq(user.id, student.id))
      expect(await db.select().from(gradeHistory)).toHaveLength(0)
    }))
  it('does not add events for unauthorized or invalid target writes', () =>
    run(async (db) => {
      await expect(
        setGrade(db, student, { ...input, grade: 'good' }),
      ).rejects.toThrow()
      await expect(removeGrade(db, teacher, input)).rejects.toThrow()
      await db.update(user).set({ banned: true }).where(eq(user.id, student.id))
      await expect(
        setGrade(db, teacher, { ...input, grade: 'good' }),
      ).rejects.toThrow()
      expect(await db.select().from(gradeHistory)).toHaveLength(0)
    }))
})

describe('grade history queries', () => {
  it('permits only self or staff, including with a cursor from another student', () =>
    run(async (db) => {
      await setGrade(db, teacher, { ...input, grade: 'good' })
      await setGrade(db, teacher, {
        studentId: other.id,
        surahNumber: 114,
        grade: 'medium',
      })
      for (const actor of [student, teacher, admin]) {
        const page = await listGradeHistory(db, actor, {
          studentId: student.id,
          cursor: Number.MAX_SAFE_INTEGER,
        })
        expect(page.rows.map((r) => r.surahNumber)).toEqual([1])
      }
      await expect(
        listGradeHistory({} as Database, null, input),
      ).rejects.toThrow('يلزم تسجيل الدخول.')
      await expect(
        listGradeHistory({} as Database, other, input),
      ).rejects.toThrow('غير مصرح لك بهذه العملية.')
    }))
  it('paginates tied timestamps without duplicates, filters by surah and returns empty results', () =>
    run(async (db) => {
      const at = new Date(Date.UTC(2026, 10, 6))
      const inserted = await db
        .insert(gradeHistory)
        .values(
          Array.from({ length: 45 }, (_, i) => ({
            studentId: student.id,
            surahNumber: i % 2 ? 2 : 1,
            previousGrade: null,
            newGrade: 'good' as const,
            actorId: teacher.id,
            changedAt: at,
            source: 'grade' as const,
          })),
        )
        .returning()
      const all: Array<number> = []
      let cursor: number | null = null
      do {
        const page = await listGradeHistory(db, student, {
          studentId: student.id,
          cursor,
        })
        all.push(...page.rows.map((r) => r.id))
        cursor = page.nextCursor
      } while (cursor !== null)
      expect(all).toEqual(inserted.map((r) => r.id).reverse())
      expect(new Set(all).size).toBe(45)
      const filtered = await listGradeHistory(db, student, {
        studentId: student.id,
        surahNumber: 2,
      })
      expect(filtered.rows).toHaveLength(20)
      expect(filtered.rows.every((r) => r.surahNumber === 2)).toBe(true)
      expect(
        (
          await listGradeHistory(db, student, {
            studentId: student.id,
            surahNumber: 2,
            cursor: filtered.nextCursor,
          })
        ).rows,
      ).toHaveLength(2)
      expect(
        (await listGradeHistory(db, other, { studentId: other.id })).rows,
      ).toEqual([])
    }))
  it('rejects invalid filters and unsafe cursors', () => {
    for (const surahNumber of [0, 115, 1.5, '1'])
      expect(
        gradeHistoryInput.safeParse({ ...input, surahNumber }).success,
      ).toBe(false)
    for (const cursor of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '1'])
      expect(gradeHistoryInput.safeParse({ ...input, cursor }).success).toBe(
        false,
      )
  })
})
