import { eq } from 'drizzle-orm'
import { requireStaff, requireStudent } from '../auth-guards.server'
import { memorizationAssignments, reviews } from '../db/schema/app'
import { fail } from '../errors'
import { assignmentDeadlineInput } from '../functions/validation'
import type { Actor } from '../auth-guards.server'
import type { Database } from '../db.server'
import type { AssignmentDeadlineChange } from '~/lib/assignment-deadline'

export async function rescheduleAssignment(
  db: Database,
  actor: Actor | null,
  kind: 'review' | 'memorization',
  input: AssignmentDeadlineChange & { assignmentId: string },
) {
  requireStaff(actor)
  const data = assignmentDeadlineInput.parse(input)
  const table = kind === 'review' ? reviews : memorizationAssignments
  await db.transaction(async (tx) => {
    const candidate = (
      await tx
        .select({ studentId: table.studentId })
        .from(table)
        .where(eq(table.id, data.assignmentId))
    ).at(0)
    if (!candidate)
      fail('الواجب غير موجود أو لم يعد مفتوحاً. أغلق النافذة وحدّث القائمة.')
    // Match grading, closure and deletion: student row before assignment row.
    await requireStudent(tx, candidate.studentId, true)
    const row = (
      await tx
        .select({ status: table.status, dueAt: table.dueAt })
        .from(table)
        .where(eq(table.id, data.assignmentId))
        .for('update')
    ).at(0)
    if (!row || row.status !== 'open')
      fail('الواجب غير موجود أو لم يعد مفتوحاً. أغلق النافذة وحدّث القائمة.')
    if ((row.dueAt?.getTime() ?? null) !== data.expectedDueAt)
      fail(
        'تغيّر موعد الواجب منذ فتح النافذة. أغلق النافذة وحدّث القائمة قبل المحاولة مرة أخرى.',
      )
    await tx
      .update(table)
      .set({ dueAt: data.dueAt === null ? null : new Date(data.dueAt) })
      .where(eq(table.id, data.assignmentId))
  })
}
