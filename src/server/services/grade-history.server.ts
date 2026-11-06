import { and, desc, eq, lt } from 'drizzle-orm'
import { gradeHistory } from '../db/schema/app'
import { user } from '../db/schema/auth'
import { requireSelfOrStaff } from '../auth-guards.server'
import { gradeHistoryInput } from '../functions/validation'
import type { Database } from '../db.server'
import type { Actor } from '../auth-guards.server'
import type { GradeHistoryPage } from '~/lib/grade-history'

// Caller holds the student row lock and passes the same transaction as the grade write.
export async function recordGradeChange(
  tx: Pick<Database, 'insert'>,
  change: Omit<typeof gradeHistory.$inferSelect, 'id'>,
) {
  if (change.previousGrade === change.newGrade) return
  await tx.insert(gradeHistory).values(change)
}

export async function listGradeHistory(
  db: Database,
  actor: Actor | null,
  input: { studentId: string; surahNumber?: number; cursor?: number | null },
): Promise<GradeHistoryPage> {
  requireSelfOrStaff(actor, input.studentId)
  const data = gradeHistoryInput.parse(input)
  const result = await db
    .select({
      id: gradeHistory.id,
      surahNumber: gradeHistory.surahNumber,
      previousGrade: gradeHistory.previousGrade,
      newGrade: gradeHistory.newGrade,
      actorDisplayName: user.name,
      changedAt: gradeHistory.changedAt,
      source: gradeHistory.source,
    })
    .from(gradeHistory)
    .leftJoin(user, eq(user.id, gradeHistory.actorId))
    .where(
      and(
        eq(gradeHistory.studentId, data.studentId),
        data.surahNumber === undefined
          ? undefined
          : eq(gradeHistory.surahNumber, data.surahNumber),
        data.cursor === null ? undefined : lt(gradeHistory.id, data.cursor),
      ),
    )
    .orderBy(desc(gradeHistory.id))
    .limit(21)
  const rows = result.slice(0, 20).map((row) => ({
    ...row,
    changedAt: row.changedAt.getTime(),
  }))
  return {
    rows,
    nextCursor: result.length > 20 ? rows[rows.length - 1].id : null,
  }
}
