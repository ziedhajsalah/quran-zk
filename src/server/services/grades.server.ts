import { and, eq } from 'drizzle-orm'
import { grades, reviews } from '../db/schema/app'
import { user } from '../db/schema/auth'
import { roles, serializeUser } from '../accounts'
import {
  requireAdmin,
  requireSelfOrStaff,
  requireStaff,
  requireStudent,
} from '../auth-guards.server'
import { recordGradeChange } from './grade-history.server'
import type { Database } from '../db.server'
import type { Actor } from '../auth-guards.server'

export type Grade = 'good' | 'medium' | 'forgotten'
export async function listStudents(db: Database, actor: Actor | null) {
  requireStaff(actor)
  const rows = await db.select().from(user).where(eq(user.banned, false))
  return rows
    .filter((row) => roles(row.role).includes('student'))
    .map(serializeUser)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'ar'))
}
export async function listGrades(
  db: Database,
  actor: Actor | null,
  studentId: string,
) {
  requireSelfOrStaff(actor, studentId)
  return (
    await db.select().from(grades).where(eq(grades.studentId, studentId))
  ).map((row) => ({ ...row, _id: row.id, updatedAt: row.updatedAt.getTime() }))
}
export async function setGrade(
  db: Database,
  actor: Actor | null,
  input: { studentId: string; surahNumber: number; grade: Grade },
) {
  const staff = requireStaff(actor)
  await db.transaction(async (tx) => {
    await requireStudent(tx, input.studentId, true)
    const previous = (
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
    const now = new Date()
    await tx
      .insert(grades)
      .values({
        id: crypto.randomUUID(),
        ...input,
        updatedAt: now,
        updatedBy: staff.id,
      })
      .onConflictDoUpdate({
        target: [grades.studentId, grades.surahNumber],
        set: { grade: input.grade, updatedAt: now, updatedBy: staff.id },
      })
    await recordGradeChange(tx, {
      studentId: input.studentId,
      surahNumber: input.surahNumber,
      previousGrade: previous?.grade ?? null,
      newGrade: input.grade,
      actorId: staff.id,
      changedAt: now,
      source: 'grade',
    })
  })
}
export async function removeGrade(
  db: Database,
  actor: Actor | null,
  input: { studentId: string; surahNumber: number },
) {
  const admin = requireAdmin(actor)
  await db.transaction(async (tx) => {
    await tx
      .select()
      .from(user)
      .where(eq(user.id, input.studentId))
      .for('update')
    await tx
      .update(reviews)
      .set({ status: 'cancelled', closedBy: admin.id, closedAt: new Date() })
      .where(
        and(
          eq(reviews.studentId, input.studentId),
          eq(reviews.surahNumber, input.surahNumber),
          eq(reviews.status, 'open'),
        ),
      )
    const removed = await tx
      .delete(grades)
      .where(
        and(
          eq(grades.studentId, input.studentId),
          eq(grades.surahNumber, input.surahNumber),
        ),
      )
      .returning()
    if (removed[0])
      await recordGradeChange(tx, {
        studentId: input.studentId,
        surahNumber: input.surahNumber,
        previousGrade: removed[0].grade,
        newGrade: null,
        actorId: admin.id,
        changedAt: new Date(),
        source: 'grade',
      })
  })
}
