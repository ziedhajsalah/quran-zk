import { and, eq } from 'drizzle-orm'
import { grades, reviews } from '../db/schema/app'
import { fail } from '../errors'
import type { Database } from '../db.server'

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

// Caller holds the student lock and has completed assessment in this transaction.
export async function scheduleFollowUpReview(
  tx: Transaction,
  staffId: string,
  studentId: string,
  surahNumber: number,
  dueAt: number,
) {
  const grade = (
    await tx
      .select({ id: grades.id })
      .from(grades)
      .where(
        and(
          eq(grades.studentId, studentId),
          eq(grades.surahNumber, surahNumber),
        ),
      )
  ).at(0)
  if (!grade)
    fail('لا يوجد تقييم لهذه السورة. اختر تقييماً قبل إسناد المراجعة التالية.')
  const inserted = await tx
    .insert(reviews)
    .values({
      id: crypto.randomUUID(),
      studentId,
      surahNumber,
      dueAt: new Date(dueAt),
      assignedBy: staffId,
      assignedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning({ id: reviews.id })
  if (!inserted.length)
    fail(
      'توجد مراجعة مفتوحة لهذه السورة بالفعل. لم يُحفظ التقييم. أغلق النافذة وحدّث القائمة أو ألغِ اختيار المراجعة التالية.',
    )
}
