import { and, eq } from 'drizzle-orm'
import { requireActor, requireStudent } from '../auth-guards.server'
import { memorizationAssignments, reviews } from '../db/schema/app'
import { fail } from '../errors'
import { assignmentReadinessInput } from '../functions/validation'
import type { Actor } from '../auth-guards.server'
import type { Database } from '../db.server'

export async function setAssignmentReadiness(
  db: Database,
  actor: Actor | null,
  input: unknown,
) {
  const student = requireActor(actor)
  if (!student.isStudent) fail('هذه العملية متاحة للطالب صاحب الواجب فقط.')
  const data = assignmentReadinessInput.parse(input)
  const table = data.kind === 'review' ? reviews : memorizationAssignments
  await db.transaction(async (tx) => {
    // Same lock order as assessment, cancellation, grade removal and account edits.
    await requireStudent(tx, student.id, true)
    const row = (
      await tx
        .select({ readyAt: table.readyAt, status: table.status })
        .from(table)
        .where(
          and(
            eq(table.id, data.assignmentId),
            eq(table.studentId, student.id),
          ),
        )
        .for('update')
    ).at(0)
    // Deliberately do not reveal whether another student's assignment exists.
    if (!row || row.status !== 'open')
      fail(
        'الواجب غير متاح أو لم يعد مفتوحاً. حدّث القائمة ثم حاول مرة أخرى.',
      )
    await tx
      .update(table)
      .set({ readyAt: data.ready ? (row.readyAt ?? new Date()) : null })
      .where(
        and(eq(table.id, data.assignmentId), eq(table.studentId, student.id)),
      )
  })
}
