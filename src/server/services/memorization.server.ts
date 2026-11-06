import { and, asc, eq, sql } from 'drizzle-orm'
import { grades, memorizationAssignments } from '../db/schema/app'
import { user } from '../db/schema/auth'
import {
  requireSelfOrStaff,
  requireStaff,
  requireStudent,
} from '../auth-guards.server'
import { fail } from '../errors'
import {
  assignmentInput,
  gradeSchema,
  memorizationInput,
} from '../functions/validation'
import { writeStudentGrade } from './grades.server'
import type { Actor } from '../auth-guards.server'
import type { Database } from '../db.server'
import type { MemorizationInput, MemorizationRow } from '~/lib/memorization'

export async function listMemorization(
  db: Database,
  actor: Actor | null,
  studentId: string,
): Promise<Array<MemorizationRow>> {
  requireSelfOrStaff(actor, studentId)
  const rows = await db
    .select({
      _id: memorizationAssignments.id,
      surahNumber: memorizationAssignments.surahNumber,
      assignedAt: memorizationAssignments.assignedAt,
      dueAt: memorizationAssignments.dueAt,
    })
    .from(memorizationAssignments)
    .where(
      and(
        eq(memorizationAssignments.studentId, studentId),
        eq(memorizationAssignments.status, 'open'),
      ),
    )
    .orderBy(
      sql`${memorizationAssignments.dueAt} asc nulls last`,
      asc(memorizationAssignments.assignedAt),
      asc(memorizationAssignments.id),
    )
    .limit(114)
  return rows.map((row) => ({
    ...row,
    assignedAt: row.assignedAt.getTime(),
    dueAt: row.dueAt?.getTime() ?? null,
  }))
}

export async function assignMemorization(
  db: Database,
  actor: Actor | null,
  input: MemorizationInput & { studentId: string },
) {
  const staff = requireStaff(actor)
  const data = memorizationInput.parse(input)
  await db.transaction(async (tx) => {
    await requireStudent(tx, data.studentId, true)
    const recorded = (
      await tx
        .select({ id: grades.id })
        .from(grades)
        .where(
          and(
            eq(grades.studentId, data.studentId),
            eq(grades.surahNumber, data.surahNumber),
          ),
        )
    ).at(0)
    if (recorded)
      fail(
        'هذه السورة مسجّلة للطالب بالفعل. حدّث القائمة واختر سورة جديدة أو أسند مراجعة لها.',
      )
    const inserted = await tx
      .insert(memorizationAssignments)
      .values({
        id: crypto.randomUUID(),
        studentId: data.studentId,
        surahNumber: data.surahNumber,
        assignedBy: staff.id,
        assignedAt: new Date(),
        dueAt: data.dueAt === undefined ? null : new Date(data.dueAt),
      })
      .onConflictDoNothing()
      .returning({ id: memorizationAssignments.id })
    if (!inserted.length)
      fail(
        'يوجد واجب حفظ مفتوح لهذه السورة بالفعل. حدّث القائمة واختر سورة أخرى.',
      )
  })
}

// An explicit grade assesses the work; absence of a grade cancels it without grading.
export async function finishMemorization(
  db: Database,
  actor: Actor | null,
  input: { assignmentId: string; grade?: 'good' | 'medium' | 'forgotten' },
) {
  const staff = requireStaff(actor)
  assignmentInput.parse(input)
  if (input.grade !== undefined) gradeSchema.parse(input.grade)
  await db.transaction(async (tx) => {
    const candidate = (
      await tx
        .select()
        .from(memorizationAssignments)
        .where(eq(memorizationAssignments.id, input.assignmentId))
    ).at(0)
    if (!candidate) fail('واجب الحفظ غير موجود أو لم يعد مفتوحاً.')
    // Same user-before-assignment lock order as grade writes and account deletion.
    if (input.grade !== undefined)
      await requireStudent(tx, candidate.studentId, true)
    else
      await tx
        .select()
        .from(user)
        .where(eq(user.id, candidate.studentId))
        .for('update')
    const row = (
      await tx
        .select()
        .from(memorizationAssignments)
        .where(eq(memorizationAssignments.id, input.assignmentId))
        .for('update')
    ).at(0)
    if (!row || row.status !== 'open')
      fail('واجب الحفظ غير موجود أو لم يعد مفتوحاً. حدّث القائمة.')
    if (input.grade !== undefined) {
      const recorded = (
        await tx
          .select({ id: grades.id })
          .from(grades)
          .where(
            and(
              eq(grades.studentId, row.studentId),
              eq(grades.surahNumber, row.surahNumber),
            ),
          )
      ).at(0)
      if (recorded)
        fail('سُجّل تقييم لهذه السورة بالفعل. حدّث القائمة قبل المتابعة.')
      await writeStudentGrade(tx, staff.id, {
        studentId: row.studentId,
        surahNumber: row.surahNumber,
        grade: input.grade,
      })
    } else {
      await tx
        .update(memorizationAssignments)
        .set({ status: 'cancelled', closedBy: staff.id, closedAt: new Date() })
        .where(eq(memorizationAssignments.id, row.id))
    }
  })
}
