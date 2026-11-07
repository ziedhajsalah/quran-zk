import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import { withDatabase } from '../../src/server/db.server'
import { user } from '../../src/server/db/schema/auth'
import { memorizationAssignments } from '../../src/server/db/schema/app'
import { serializeUser } from '../../src/server/accounts'
import {
  assignMemorization,
  finishMemorization,
  listMemorizationHistory,
} from '../../src/server/services/memorization.server'
import { removeGrade, setGrade } from '../../src/server/services/grades.server'
import { memorizationHistoryInput } from '../../src/server/functions/validation'
import type { Actor } from '../../src/server/auth-guards.server'
import type { Database } from '../../src/server/db.server'
import type { MemorizationHistoryCursor } from '../../src/lib/memorization'

const url =
  process.env.TEST_DATABASE_URL ??
  'postgresql://quran_dev:quran_local@127.0.0.1:55432/quran_test'
if (!new URL(url).pathname.endsWith('_test'))
  throw new Error(
    'Memorization history tests require an isolated _test database.',
  )
const run = <T>(fn: (db: Database) => Promise<T>) => withDatabase(url, fn)
const now = Date.UTC(2026, 10, 6)
let teacher: Actor, admin: Actor, student: Actor, other: Actor
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
    const actors = Object.fromEntries(
      rows.map((row) => [row.id, serializeUser(row)]),
    )
    teacher = actors.teacher
    admin = actors.admin
    student = actors.student
    other = actors.other
  }),
)

async function insert(
  db: Database,
  id: string,
  studentId: string,
  status: 'open' | 'closed' | 'cancelled',
  closedAt: number | null = now,
) {
  await db.insert(memorizationAssignments).values({
    id,
    studentId,
    surahNumber: 1,
    assignedAt: new Date(now - 86400000),
    status,
    closedAt: closedAt === null ? null : new Date(closedAt),
    closingGrade: status === 'closed' ? 'medium' : null,
  })
}

describe('memorization history permissions and snapshots', () => {
  it('allows self, teacher and admin but denies anonymous users and other students', () =>
    run(async (db) => {
      await insert(db, 'own', student.id, 'closed')
      await insert(db, 'private-other', other.id, 'closed')
      for (const actor of [student, teacher, admin]) {
        expect(
          (
            await listMemorizationHistory(db, actor, { studentId: student.id })
          ).rows.map((r) => r.id),
        ).toEqual(['own'])
      }
      await expect(
        listMemorizationHistory({} as Database, null, {
          studentId: student.id,
        }),
      ).rejects.toThrow('يلزم تسجيل الدخول.')
      await expect(
        listMemorizationHistory({} as Database, other, {
          studentId: student.id,
        }),
      ).rejects.toThrow('غير مصرح لك بهذه العملية.')
      const page = await listMemorizationHistory(db, student, {
        studentId: student.id,
        cursor: { id: 'private-other', closedAt: now + 1 },
      })
      expect(page.rows.map((r) => r.id)).toEqual(['own'])
    }))
  it('returns only completed/cancelled records and filters on the server', () =>
    run(async (db) => {
      await insert(db, 'open', student.id, 'open', null)
      await insert(db, 'completed', student.id, 'closed')
      await insert(db, 'cancelled', student.id, 'cancelled')
      const all = await listMemorizationHistory(db, student, {
        studentId: student.id,
      })
      expect(all.rows.map((r) => r.id)).toEqual(['completed', 'cancelled'])
      expect(all.nextCursor).toBeNull()
      for (const status of ['closed', 'cancelled'] as const) {
        const result = await listMemorizationHistory(db, student, {
          studentId: student.id,
          status,
        })
        expect(result.rows).toHaveLength(1)
        expect(result.rows[0].status).toBe(status)
      }
      expect(
        (await listMemorizationHistory(db, other, { studentId: other.id }))
          .rows,
      ).toEqual([])
    }))
  it('preserves assessment snapshots after current grades change or are removed', () =>
    run(async (db) => {
      await assignMemorization(db, teacher, {
        studentId: student.id,
        surahNumber: 1,
      })
      const [assignment] = await db.select().from(memorizationAssignments)
      await finishMemorization(db, teacher, {
        assignmentId: assignment.id,
        grade: 'medium',
      })
      await setGrade(db, teacher, {
        studentId: student.id,
        surahNumber: 1,
        grade: 'good',
      })
      await removeGrade(db, admin, { studentId: student.id, surahNumber: 1 })
      const page = await listMemorizationHistory(db, student, {
        studentId: student.id,
      })
      expect(page.rows[0]).toMatchObject({
        id: assignment.id,
        status: 'closed',
        closingGrade: 'medium',
      })
    }))
  it('shows manual first grading and cancellation without inventing cancellation grades', () =>
    run(async (db) => {
      for (const surahNumber of [1, 2])
        await assignMemorization(db, teacher, {
          studentId: student.id,
          surahNumber,
        })
      await setGrade(db, teacher, {
        studentId: student.id,
        surahNumber: 1,
        grade: 'good',
      })
      const assignment = (await db.select().from(memorizationAssignments)).find(
        (row) => row.surahNumber === 2,
      )!
      await finishMemorization(db, teacher, { assignmentId: assignment.id })
      const page = await listMemorizationHistory(db, student, {
        studentId: student.id,
      })
      expect(page.rows.find((row) => row.surahNumber === 1)).toMatchObject({
        status: 'closed',
        closingGrade: 'good',
      })
      expect(page.rows.find((row) => row.surahNumber === 2)).toMatchObject({
        status: 'cancelled',
        closingGrade: null,
      })
    }))
})

describe('bounded stable history pagination', () => {
  it('paginates tied timestamps without skips, including a new completion between reads', () =>
    run(async (db) => {
      await db.insert(memorizationAssignments).values(
        Array.from({ length: 45 }, (_, i) => ({
          id: `history-${String(i).padStart(2, '0')}`,
          studentId: student.id,
          surahNumber: 1,
          status: 'closed' as const,
          closingGrade: 'medium' as const,
          assignedAt: new Date(now - 86400000),
          closedAt: new Date(now - Math.floor(i / 23) * 86400000),
        })),
      )
      const first = await listMemorizationHistory(db, student, {
        studentId: student.id,
      })
      await insert(db, 'newest', student.id, 'closed', now + 1)
      let cursor: MemorizationHistoryCursor | null = first.nextCursor
      const ids = first.rows.map((row) => row.id)
      const sizes = [first.rows.length]
      while (cursor) {
        const page = await listMemorizationHistory(db, student, {
          studentId: student.id,
          cursor,
        })
        sizes.push(page.rows.length)
        ids.push(...page.rows.map((row) => row.id))
        cursor = page.nextCursor
      }
      expect(sizes).toEqual([20, 20, 5])
      expect(new Set(ids).size).toBe(45)
      expect(ids).toEqual([
        ...Array.from(
          { length: 23 },
          (_, i) => `history-${String(22 - i).padStart(2, '0')}`,
        ),
        ...Array.from(
          { length: 22 },
          (_, i) => `history-${String(44 - i).padStart(2, '0')}`,
        ),
      ])
      expect(
        (await listMemorizationHistory(db, student, { studentId: student.id }))
          .rows[0].id,
      ).toBe('newest')
    }))
  it('validates filter and cursor inputs and supplies safe defaults', () => {
    expect(memorizationHistoryInput.parse({ studentId: 'student' })).toEqual({
      studentId: 'student',
      status: 'all',
      cursor: null,
    })
    for (const extra of [
      { status: 'open' },
      { status: 'anything' },
      { cursor: { id: '', closedAt: now } },
      { cursor: { id: 'valid', closedAt: -1 } },
      { cursor: { id: 'valid', closedAt: 9e15 } },
      { cursor: { id: 'valid' } },
      { cursor: { id: 'valid', closedAt: null } },
    ]) {
      expect(
        memorizationHistoryInput.safeParse({ studentId: 'student', ...extra })
          .success,
      ).toBe(false)
    }
  })
})
