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
  listReviews,
} from '../../src/server/services/reviews.server'
import {
  assignMemorization,
  finishMemorization,
} from '../../src/server/services/memorization.server'
import { listWorkQueue } from '../../src/server/services/work-queue.server'
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
  throw new Error('Follow-up tests require an isolated _test database.')
const run = <T>(fn: (db: Database) => Promise<T>) => withDatabase(url, fn)
const now = new Date()
const today = Date.UTC(
  now.getUTCFullYear(),
  now.getUTCMonth(),
  now.getUTCDate(),
)
const dueAt = today + 7 * 86400000
const input = { studentId: 'student', surahNumber: 1 }
let teacher: Actor, student: Actor
const kinds = ['review', 'memorization'] as const
type Kind = (typeof kinds)[number]
const table = (kind: Kind) =>
  kind === 'review' ? reviews : memorizationAssignments
async function start(db: Database, kind: Kind) {
  if (kind === 'review') {
    await setGrade(db, teacher, { ...input, grade: 'medium' })
    await assignReview(db, teacher, input)
  } else await assignMemorization(db, teacher, input)
  return (await db.select().from(table(kind)))[0].id
}
function finish(
  db: Database,
  kind: Kind,
  assignmentId: string,
  extra: { nextReviewDueAt?: number } = {},
  actor: Actor | null = teacher,
) {
  return kind === 'review'
    ? finishReview(db, actor, { assignmentId, newGrade: 'good', ...extra })
    : finishMemorization(db, actor, { assignmentId, grade: 'good', ...extra })
}
beforeAll(() => run((db) => migrate(db, { migrationsFolder: './drizzle' })))
beforeEach(() =>
  run(async (db) => {
    await db.execute(sql`truncate "user" cascade`)
    const rows = await db
      .insert(user)
      .values(
        ['teacher', 'student'].map((id) => ({
          id,
          name: id,
          username: id,
          email: `${id}@example.com`,
          role: id,
        })),
      )
      .returning()
    teacher = serializeUser(rows.find((row) => row.id === 'teacher')!)
    student = serializeUser(rows.find((row) => row.id === 'student')!)
  }),
)

describe('assessment follow-up reviews', () => {
  for (const kind of kinds) {
    it(`${kind}: closes and grades the original and assigns one dated review visible to the student and queue`, () =>
      run(async (db) => {
        const id = await start(db, kind)
        await finish(db, kind, id, { nextReviewDueAt: dueAt })
        expect(
          (
            await db
              .select()
              .from(table(kind))
              .where(eq(table(kind).id, id))
          )[0],
        ).toMatchObject({
          status: 'closed',
          closingGrade: 'good',
          closedBy: teacher.id,
        })
        const next = await listReviews(db, student, student.id)
        expect(next).toHaveLength(1)
        expect(next[0]).toMatchObject({
          surahNumber: 1,
          dueAt,
          assignedBy: teacher.id,
        })
        expect(next[0].id).not.toBe(id)
        expect((await db.select().from(grades))[0].grade).toBe('good')
        expect(await db.select().from(gradeHistory)).toHaveLength(
          kind === 'review' ? 2 : 1,
        )
        expect(
          (await listWorkQueue(db, teacher, { deadline: 'all' })).rows.map(
            (row) => row.id,
          ),
        ).toEqual([next[0].id])
        await expect(
          finish(db, kind, id, { nextReviewDueAt: dueAt }),
        ).rejects.toThrow()
        expect(await listReviews(db, student, student.id)).toHaveLength(1)
      }))
    it(`${kind}: creates no follow-up when omitted`, () =>
      run(async (db) => {
        await finish(db, kind, await start(db, kind))
        expect(await listReviews(db, student, student.id)).toHaveLength(0)
      }))
    it(`${kind}: rejects unauthorized actors, invalid and past deadlines without changing the assessment`, () =>
      run(async (db) => {
        const id = await start(db, kind)
        for (const actor of [null, student])
          await expect(
            finish(db, kind, id, { nextReviewDueAt: dueAt }, actor),
          ).rejects.toThrow()
        for (const value of [
          today - 86400000,
          today + 1,
          -1,
          1.5,
          NaN,
          Infinity,
        ])
          await expect(
            finish(db, kind, id, { nextReviewDueAt: value }),
          ).rejects.toThrow()
        expect((await db.select().from(table(kind)))[0].status).toBe('open')
        expect(await db.select().from(gradeHistory)).toHaveLength(
          kind === 'review' ? 1 : 0,
        )
      }))
    it(`${kind}: rolls back grades, history and closure if inserting the follow-up fails`, () =>
      run(async (db) => {
        const id = await start(db, kind)
        await db.execute(
          sql`create function pg_temp.reject_follow_up() returns trigger language plpgsql as $$ begin raise exception 'injected failure'; end $$`,
        )
        await db.execute(
          sql`create trigger reject_follow_up before insert on surah_review_assignments for each row execute function pg_temp.reject_follow_up()`,
        )
        try {
          await expect(
            finish(db, kind, id, { nextReviewDueAt: dueAt }),
          ).rejects.toThrow()
          expect((await db.select().from(table(kind)))[0]).toMatchObject({
            status: 'open',
            closedAt: null,
          })
          expect(await db.select().from(grades)).toHaveLength(
            kind === 'review' ? 1 : 0,
          )
          if (kind === 'review')
            expect((await db.select().from(grades))[0].grade).toBe('medium')
          expect(await db.select().from(gradeHistory)).toHaveLength(
            kind === 'review' ? 1 : 0,
          )
        } finally {
          await db.execute(
            sql`drop trigger reject_follow_up on surah_review_assignments`,
          )
        }
      }))
    it(`${kind}: concurrent duplicate submissions create only one follow-up`, async () => {
      const id = await run((db) => start(db, kind))
      const results = await Promise.allSettled([
        run((db) => finish(db, kind, id, { nextReviewDueAt: dueAt })),
        run((db) => finish(db, kind, id, { nextReviewDueAt: dueAt })),
      ])
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1)
      await run(async (db) => {
        expect(await listReviews(db, student, student.id)).toHaveLength(1)
        expect(await db.select().from(gradeHistory)).toHaveLength(
          kind === 'review' ? 2 : 1,
        )
      })
    })
    it(`${kind}: cancellation cannot request a follow-up`, () =>
      run(async (db) => {
        const id = await start(db, kind)
        await expect(
          kind === 'review'
            ? finishReview(
                db,
                teacher,
                { assignmentId: id, nextReviewDueAt: dueAt },
                true,
              )
            : finishMemorization(db, teacher, {
                assignmentId: id,
                nextReviewDueAt: dueAt,
              }),
        ).rejects.toThrow('لا يمكن إسناد مراجعة تالية')
        expect((await db.select().from(table(kind)))[0].status).toBe('open')
      }))
  }
  it('keeps the existing review grade and records a separate follow-up, including today', () =>
    run(async (db) => {
      const id = await start(db, 'review')
      await finishReview(db, teacher, {
        assignmentId: id,
        nextReviewDueAt: today,
      })
      expect(
        (await db.select().from(reviews).where(eq(reviews.id, id)))[0]
          .closingGrade,
      ).toBe('medium')
      expect(await db.select().from(gradeHistory)).toHaveLength(1)
      expect((await listReviews(db, student, student.id))[0].dueAt).toBe(today)
    }))
  it('requires a recorded grade when keeping the grade of a legacy orphaned review', () =>
    run(async (db) => {
      await db
        .insert(reviews)
        .values({ id: 'orphan', ...input, assignedAt: new Date() })
      await expect(
        finishReview(db, teacher, {
          assignmentId: 'orphan',
          nextReviewDueAt: dueAt,
        }),
      ).rejects.toThrow('اختر تقييماً')
      expect((await db.select().from(reviews))[0].status).toBe('open')
    }))
  it('preserves an existing open review and rolls back memorization assessment on conflict', () =>
    run(async (db) => {
      const id = await start(db, 'memorization')
      await db
        .insert(reviews)
        .values({
          id: 'existing',
          ...input,
          assignedAt: new Date(),
          dueAt: new Date(today),
        })
      await expect(
        finish(db, 'memorization', id, { nextReviewDueAt: dueAt }),
      ).rejects.toThrow('توجد مراجعة مفتوحة')
      expect((await db.select().from(memorizationAssignments))[0].status).toBe(
        'open',
      )
      expect(await db.select().from(grades)).toHaveLength(0)
      expect(await db.select().from(gradeHistory)).toHaveLength(0)
      expect((await db.select().from(reviews))[0]).toMatchObject({
        id: 'existing',
        status: 'open',
        dueAt: new Date(today),
      })
    }))
  it('validates the public server-function input contract', () => {
    for (const schema of [closeReviewInput, assessMemorizationInput]) {
      const inputData = {
        assignmentId: 'x',
        grade: 'good',
        nextReviewDueAt: dueAt,
      }
      expect(schema.safeParse(inputData).success).toBe(true)
      for (const invalid of [null, '2026-12-01', today - 1, today + 0.5])
        expect(
          schema.safeParse({ ...inputData, nextReviewDueAt: invalid }).success,
        ).toBe(false)
    }
  })
})
