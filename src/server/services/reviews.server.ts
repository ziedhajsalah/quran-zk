import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import { grades, reviews } from '../db/schema/app'
import { user } from '../db/schema/auth'
import {
  requireSelfOrStaff,
  requireStaff,
  requireStudent,
} from '../auth-guards.server'
import { fail } from '../errors'
import type { Database } from '../db.server'
import type { Actor } from '../auth-guards.server'
import type { Grade } from './grades.server'
import type {
  ReviewHistoryCursor,
  ReviewHistoryPage,
  ReviewHistoryStatus,
} from '~/lib/review-history'

export async function listReviews(
  db: Database,
  actor: Actor | null,
  studentId: string,
) {
  requireSelfOrStaff(actor, studentId)
  const rows = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.studentId, studentId), eq(reviews.status, 'open')))
    .orderBy(sql`${reviews.dueAt} asc nulls last`, asc(reviews.assignedAt))
  return rows.map((row) => ({
    ...row,
    _id: row.id,
    assignedAt: row.assignedAt.getTime(),
    dueAt: row.dueAt?.getTime() ?? null,
    closedAt: row.closedAt?.getTime() ?? null,
  }))
}
export async function listReviewHistory(
  db: Database,
  actor: Actor | null,
  input: {
    studentId: string
    status?: ReviewHistoryStatus
    cursor?: ReviewHistoryCursor | null
  },
): Promise<ReviewHistoryPage> {
  requireSelfOrStaff(actor, input.studentId)
  const cursor = input.cursor
  const afterCursor = !cursor
    ? undefined
    : cursor.closedAt === null
      ? and(isNull(reviews.closedAt), lt(reviews.id, cursor.id))
      : or(
          lt(reviews.closedAt, new Date(cursor.closedAt)),
          and(
            eq(reviews.closedAt, new Date(cursor.closedAt)),
            lt(reviews.id, cursor.id),
          ),
          isNull(reviews.closedAt),
        )
  const result = await db
    .select({
      id: reviews.id,
      surahNumber: reviews.surahNumber,
      status: reviews.status,
      assignedAt: reviews.assignedAt,
      dueAt: reviews.dueAt,
      closedAt: reviews.closedAt,
      closingGrade: reviews.closingGrade,
    })
    .from(reviews)
    .where(
      and(
        eq(reviews.studentId, input.studentId),
        input.status && input.status !== 'all'
          ? eq(reviews.status, input.status)
          : inArray(reviews.status, ['closed', 'cancelled']),
        afterCursor,
      ),
    )
    .orderBy(sql`${reviews.closedAt} desc nulls last`, desc(reviews.id))
    .limit(21)
  const rows = result.slice(0, 20).map((row) => ({
    ...row,
    status:
      row.status === 'closed' ? ('closed' as const) : ('cancelled' as const),
    assignedAt: row.assignedAt.getTime(),
    dueAt: row.dueAt?.getTime() ?? null,
    closedAt: row.closedAt?.getTime() ?? null,
  }))
  const last = rows.at(-1)
  return {
    rows,
    nextCursor:
      result.length > 20 && last
        ? { closedAt: last.closedAt, id: last.id }
        : null,
  }
}

export async function assignReview(
  db: Database,
  actor: Actor | null,
  input: { studentId: string; surahNumber: number; dueAt?: number },
) {
  const staff = requireStaff(actor)
  await db.transaction(async (tx) => {
    await requireStudent(tx, input.studentId, true)
    const grade = (
      await tx
        .select()
        .from(grades)
        .where(
          and(
            eq(grades.studentId, input.studentId),
            eq(grades.surahNumber, input.surahNumber),
          ),
        )
    ).at(0)
    if (!grade) fail('الطالب لم يحفظ هذه السورة بعد.')
    const rows = await tx
      .insert(reviews)
      .values({
        id: crypto.randomUUID(),
        studentId: input.studentId,
        surahNumber: input.surahNumber,
        dueAt: input.dueAt === undefined ? null : new Date(input.dueAt),
        assignedBy: staff.id,
        assignedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning()
    if (!rows.length) fail('توجد مراجعة مفتوحة لهذه السورة بالفعل.')
  })
}
export async function finishReview(
  db: Database,
  actor: Actor | null,
  input: { assignmentId: string; newGrade?: Grade },
  cancel = false,
) {
  const staff = requireStaff(actor)
  await db.transaction(async (tx) => {
    const candidate = (
      await tx.select().from(reviews).where(eq(reviews.id, input.assignmentId))
    ).at(0)
    if (!candidate) fail('المراجعة غير موجودة أو لم تعد مفتوحة.')
    // Lock users before assignments, matching account deletion and grade-removal order.
    if (!cancel) await requireStudent(tx, candidate.studentId, true)
    else
      await tx
        .select()
        .from(user)
        .where(eq(user.id, candidate.studentId))
        .for('update')
    const row = (
      await tx
        .select()
        .from(reviews)
        .where(eq(reviews.id, input.assignmentId))
        .for('update')
    ).at(0)
    if (!row || row.status !== 'open')
      fail('المراجعة غير موجودة أو لم تعد مفتوحة.')
    const now = new Date()
    let closingGrade: Grade | null = null
    if (!cancel) {
      if (input.newGrade) {
        await tx
          .insert(grades)
          .values({
            id: crypto.randomUUID(),
            studentId: row.studentId,
            surahNumber: row.surahNumber,
            grade: input.newGrade,
            updatedBy: staff.id,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [grades.studentId, grades.surahNumber],
            set: { grade: input.newGrade, updatedBy: staff.id, updatedAt: now },
          })
        closingGrade = input.newGrade
      } else {
        const grade = (
          await tx
            .select()
            .from(grades)
            .where(
              and(
                eq(grades.studentId, row.studentId),
                eq(grades.surahNumber, row.surahNumber),
              ),
            )
            .for('update')
        ).at(0)
        closingGrade = grade?.grade ?? null
      }
    }
    await tx
      .update(reviews)
      .set({
        status: cancel ? 'cancelled' : 'closed',
        closingGrade,
        closedBy: staff.id,
        closedAt: now,
      })
      .where(eq(reviews.id, row.id))
  })
}
