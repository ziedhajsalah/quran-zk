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
import { removeGrade, setGrade } from '../../src/server/services/grades.server'
import {
  finishReview,
  listReviewHistory,
} from '../../src/server/services/reviews.server'
import {
  finishMemorization,
  listMemorizationHistory,
} from '../../src/server/services/memorization.server'
import {
  assessMemorizationInput,
  closeReviewInput,
} from '../../src/server/functions/validation'
import type { Actor } from '../../src/server/auth-guards.server'
import type { Database } from '../../src/server/db.server'

const url =
  process.env.TEST_DATABASE_URL ??
  'postgresql://quran_dev:quran_local@127.0.0.1:55432/quran_test'
if (!new URL(url).pathname.endsWith('_test'))
  throw new Error('Tests require an isolated _test database.')
const run = <T>(fn: (db: Database) => Promise<T>) => withDatabase(url, fn)
let teacher: Actor, student: Actor, other: Actor, admin: Actor
beforeAll(() => run((db) => migrate(db, { migrationsFolder: './drizzle' })))
beforeEach(() =>
  run(async (db) => {
    await db.execute(sql`truncate "user" cascade`)
    const rows = await db
      .insert(user)
      .values(
        ['teacher', 'student', 'other', 'admin'].map((id) => ({
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
    ;({ teacher, student, other, admin } = actors)
  }),
)
const feedback = 'أحسنت الحفظ.\nراجع أحكام المدّ <script>alert(1)</script>.'
for (const kind of ['review', 'memorization'] as const) {
  const table = kind === 'review' ? reviews : memorizationAssignments
  const history =
    kind === 'review' ? listReviewHistory : listMemorizationHistory
  const assignmentId = 'task'
  const finish = (
    db: Database,
    extra: { feedback?: string; nextReviewDueAt?: number } = {},
    actor: Actor | null = teacher,
  ) =>
    kind === 'review'
      ? finishReview(db, actor, { assignmentId, ...extra })
      : finishMemorization(db, actor, {
          assignmentId,
          grade: 'good',
          ...extra,
        })
  const saved = async (db: Database) =>
    (await db.select().from(table).where(eq(table.id, assignmentId)))[0]
  const create = async (db: Database) => {
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
      readyAt: new Date(),
    })
  }
  describe(`${kind} assessment feedback`, () => {
    it('stores trimmed multiline plain text with assessment and exposes it to self/staff only', () =>
      run(async (db) => {
        await create(db)
        await finish(db, { feedback: `  ${feedback}\n ` })
        expect(await saved(db)).toMatchObject({
          status: 'closed',
          assessmentFeedback: feedback,
          readyAt: null,
          closedBy: teacher.id,
        })
        for (const actor of [student, teacher, admin]) {
          expect(
            (await history(db, actor, { studentId: student.id })).rows[0],
          ).toMatchObject({
            assessmentFeedback: feedback,
            closingGrade: kind === 'review' ? 'medium' : 'good',
          })
        }
        for (const actor of [null, other])
          await expect(
            history(db, actor, { studentId: student.id }),
          ).rejects.toThrow()
        expect((await db.select().from(grades))[0].grade).toBe(
          kind === 'review' ? 'medium' : 'good',
        )
        // A review with an unchanged grade still has its own assessment feedback.
        expect(await db.select().from(gradeHistory)).toHaveLength(1)
      }))
    for (const value of [undefined, '', ' \n\t '])
      it(`stores omitted/blank feedback as null (${JSON.stringify(value)})`, () =>
        run(async (db) => {
          await create(db)
          await finish(db, { feedback: value })
          expect((await saved(db)).assessmentFeedback).toBeNull()
        }))
    it('accepts the exact text limit and rejects longer text without changing work', () =>
      run(async (db) => {
        await create(db)
        await expect(
          finish(db, { feedback: 'أ'.repeat(2001) }),
        ).rejects.toThrow()
        expect(await saved(db)).toMatchObject({
          status: 'open',
          assessmentFeedback: null,
        })
        await finish(db, { feedback: 'أ'.repeat(2000) })
        expect((await saved(db)).assessmentFeedback).toHaveLength(2000)
      }))
    it('rejects student and anonymous assessment writes and rechecks disabled students', () =>
      run(async (db) => {
        await create(db)
        for (const actor of [student, other, null])
          await expect(finish(db, { feedback }, actor)).rejects.toThrow()
        await db
          .update(user)
          .set({ banned: true })
          .where(eq(user.id, student.id))
        await expect(finish(db, { feedback })).rejects.toThrow()
        expect(await saved(db)).toMatchObject({
          status: 'open',
          assessmentFeedback: null,
        })
      }))
    it('does not permit feedback on cancellation and retains normal cancellation behavior', () =>
      run(async (db) => {
        await create(db)
        const cancel = (extra: { feedback?: string } = {}) =>
          kind === 'review'
            ? finishReview(db, teacher, { assignmentId, ...extra }, true)
            : finishMemorization(db, teacher, { assignmentId, ...extra })
        await expect(cancel({ feedback })).rejects.toThrow(
          'لا يمكن حفظ ملاحظات تقييم',
        )
        expect((await saved(db)).status).toBe('open')
        await cancel()
        expect(await saved(db)).toMatchObject({
          status: 'cancelled',
          assessmentFeedback: null,
        })
      }))
    it('preserves feedback and closing grade after later grade changes/removal and rejects rewrites', () =>
      run(async (db) => {
        await create(db)
        await finish(db, { feedback })
        const original = await saved(db)
        await setGrade(db, teacher, {
          studentId: student.id,
          surahNumber: 1,
          grade: 'forgotten',
        })
        await removeGrade(db, admin, { studentId: student.id, surahNumber: 1 })
        await expect(finish(db, { feedback: 'replacement' })).rejects.toThrow()
        expect(await saved(db)).toEqual(original)
        expect(
          (await history(db, student, { studentId: student.id })).rows[0]
            .assessmentFeedback,
        ).toBe(feedback)
      }))
    it('rolls back feedback, grade/history and closure when follow-up insertion fails', () =>
      run(async (db) => {
        await create(db)
        const original = await saved(db)
        const originalGrades = await db.select().from(grades)
        const originalHistory = await db.select().from(gradeHistory)
        await db.execute(
          sql`create function pg_temp.reject_feedback_followup() returns trigger language plpgsql as $$ begin raise exception 'injected failure'; end $$`,
        )
        await db.execute(
          sql`create trigger reject_feedback_followup before insert on surah_review_assignments for each row execute function pg_temp.reject_feedback_followup()`,
        )
        const now = new Date()
        const tomorrow = Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + 1,
        )
        try {
          await expect(
            finish(db, { feedback, nextReviewDueAt: tomorrow }),
          ).rejects.toThrow()
          expect(await saved(db)).toEqual(original)
          expect(await db.select().from(grades)).toEqual(originalGrades)
          expect(await db.select().from(gradeHistory)).toEqual(originalHistory)
        } finally {
          await db.execute(
            sql`drop trigger reject_feedback_followup on surah_review_assignments`,
          )
        }
      }))
    it('serializes competing assessments and keeps only the winning feedback', async () => {
      await run(create)
      const choices = ['first', 'second']
      const results = await Promise.allSettled(
        choices.map((value) => run((db) => finish(db, { feedback: value }))),
      )
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1)
      const winner =
        choices[results.findIndex((result) => result.status === 'fulfilled')]
      await run(async (db) =>
        expect(await saved(db)).toMatchObject({
          status: 'closed',
          assessmentFeedback: winner,
        }),
      )
    })
    it('enforces completed-only bounded nonempty feedback in PostgreSQL', () =>
      run(async (db) => {
        await create(db)
        await expect(
          db
            .update(table)
            .set({ assessmentFeedback: feedback })
            .where(eq(table.id, assignmentId)),
        ).rejects.toThrow()
        await finish(db)
        for (const value of ['', '   ', 'a'.repeat(2001)])
          await expect(
            db
              .update(table)
              .set({ assessmentFeedback: value })
              .where(eq(table.id, assignmentId)),
          ).rejects.toThrow()
      }))
  })
}
it('validates and trims feedback at both public assessment boundaries', () => {
  for (const schema of [closeReviewInput, assessMemorizationInput]) {
    const input = {
      assignmentId: 'task',
      grade: 'good',
      feedback: '  أحسنت\nتابع  ',
    }
    expect(schema.parse(input).feedback).toBe('أحسنت\nتابع')
    for (const value of [null, 3, {}, 'x'.repeat(2001)])
      expect(schema.safeParse({ ...input, feedback: value }).success).toBe(
        false,
      )
  }
})
